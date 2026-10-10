(() => {
  'use strict';
  const { pack, feed, embeddedAssets = {} } = JSON.parse(document.getElementById('offline-data').textContent);
  const $ = id => document.getElementById(id);
  const key = `xhs-offline:${pack.id}`;
  let history = {};
  try { history = JSON.parse(localStorage.getItem(key) || '{}'); } catch { /* file storage can be disabled */ }
  if (!history || typeof history !== 'object' || Array.isArray(history)) history = {};
  let index = 0, imageIndex = 0, expanded = false, started = performance.now(), touch = null, lastWheel = -Infinity;
  const positionKey = `${key}:position`;
  let savedPosition = {}, storageAvailable = true;
  try { savedPosition = JSON.parse(localStorage.getItem(positionKey) || '{}'); } catch { storageAvailable = false; }
  if (!savedPosition || typeof savedPosition !== 'object') savedPosition = {};
  const restoredIndex = feed.findIndex(item => `${item.source}:${item.id}` === savedPosition.itemId);
  if (restoredIndex >= 0) index = restoredIndex;
  document.body.classList.toggle('large-text', savedPosition.largeText === true);
  $('font-toggle').setAttribute('aria-pressed', String(savedPosition.largeText === true));
  function savePosition() {
    if (!feed.length) return;
    try {
      localStorage.setItem(positionKey, JSON.stringify({ itemId: `${feed[index].source}:${feed[index].id}`, imageIndex,
        largeText: document.body.classList.contains('large-text') })); storageAvailable = true;
    } catch { storageAvailable = false; }
    $('resume-status').textContent = storageAvailable ? `当前第 ${index + 1} 条，进度保存在此浏览器；移动文件或更换入口后可能无法恢复。` :
      '此入口无法保存进度。请记下当前条数，下次用搜索定位；正文、图片和评论仍可离线阅读。';
  }
  const mins = value => { const m = Math.floor(value); return m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60} 分` : `${m} 分钟`; };
  const size = n => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1024).toFixed(1)} KB`;
  $('mode').textContent = pack.mode === 'mock' ? '演示内容 · 本地离线包' : '小红书图文 · 本地离线包';
  const statuses = { ready: '准备完成', partial: '部分完成', failed: '准备失败', building: '构建中' };
  $('pack-summary').textContent = `${statuses[pack.status] ?? pack.status} · ${pack.itemCount} 条 · 预计 ${mins(pack.estimatedMinutes)} · ${pack.imageCount} 张图片 · ${size(pack.sizeBytes)}。目标 ${mins(pack.targetMinutes)}，含冗余目标 ${mins(pack.targetMinutes * pack.reserveRatio)}。`;
  $('pack-issues').textContent = pack.issues.join('；');
  $('pack-id').textContent = pack.id;
  $('info-toggle').onclick = () => { const open = $('pack-info').hidden; $('pack-info').hidden = !open; $('info-toggle').setAttribute('aria-expanded', String(open)); };
  const safeAsset = value => {
    const asset = /^assets\/[a-zA-Z0-9_-]+\.(svg|png|jpg|webp|gif|avif)$/.test(value) ? value : 'assets/placeholder.svg';
    return embeddedAssets[asset] || asset;
  };
  function renderComments(item) {
    $('comments-panel').hidden = true; $('comments-toggle').setAttribute('aria-expanded', 'false');
    $('card').classList.remove('comments-open');
    const comments = item.comments || [], snapshot = item.commentSnapshot;
    const cached = snapshot?.cachedCount ?? comments.reduce((n,c) => n + 1 + (c.replies?.length || 0), 0);
    $('comments-toggle').textContent = `查看评论 · 已缓存 ${cached} 条`;
    $('comments-summary').textContent = !snapshot || snapshot.status === 'unavailable' ? '此包未获取评论，联网重新准备后可查看。' :
      `已缓存 ${cached} 条评论与回复${snapshot.total != null ? `，原文显示 ${snapshot.total} 条` : ''}。${snapshot.status === 'partial' ? '仅包含已获取部分，更多评论或回复未缓存。' : '这是准备时保存的评论快照。'}`;
    $('comments-list').replaceChildren();
    function row(comment, reply = false) {
      const node = document.createElement('article'); node.className = reply ? 'comment reply' : 'comment';
      const name = document.createElement('strong'); name.textContent = comment.author?.name || '未知用户';
      const text = document.createElement('p'); text.textContent = comment.text || '';
      const likes = document.createElement('small'); likes.textContent = `赞 ${comment.likes ?? '—'}`;
      node.append(name, text, likes);
      for (const child of comment.replies || []) node.append(row(child, true));
      if ((comment.replyCount || 0) > (comment.replies?.length || 0)) {
        const missing = document.createElement('p'); missing.className = 'comment-missing'; missing.textContent = '还有回复未缓存'; node.append(missing);
      }
      return node;
    }
    for (const comment of comments) $('comments-list').append(row(comment));
    if (!comments.length && snapshot?.status === 'complete') $('comments-summary').textContent = '准备时没有评论。';
    $('comments-panel').scrollTop = 0;
  }
  function record() {
    if (!feed.length || started == null) return;
    const dwell = (performance.now() - started) / 1000;
    const id = `${feed[index].source}:${feed[index].id}`;
    const old = history[id] || { dwellSeconds: 0, imageIndexViewed: 0 };
    history[id] = { viewed: true, dwellSeconds: (Number(old.dwellSeconds) || 0) + dwell, skipped: dwell < 5, imageIndexViewed: Math.max(Number(old.imageIndexViewed) || 0, imageIndex), endedAt: new Date().toISOString() };
    try { localStorage.setItem(key, JSON.stringify(history)); } catch {}
    started = performance.now();
  }
  function showImage() {
    const item = feed[index]; const hasImages = item.localImages.length > 0;
    $('image').hidden = !hasImages; $('no-image').hidden = hasImages;
    $('image-controls').hidden = item.localImages.length < 2;
    if (hasImages) {
      $('image').src = safeAsset(item.localImages[imageIndex]);
      $('image').alt = `笔记图片 ${imageIndex + 1} / ${item.localImages.length}`;
    } else $('image').removeAttribute('src');
    $('image-counter').textContent = `${imageIndex + 1} / ${item.localImages.length}`;
    $('image-prev').disabled = imageIndex === 0; $('image-next').disabled = imageIndex >= item.localImages.length - 1;
  }
  function render() {
    if (!feed.length) { $('card').hidden = true; $('empty').hidden = false; $('next').disabled = $('prev').disabled = true; $('counter').textContent = '0 条'; return; }
    const item = feed[index]; imageIndex = 0; expanded = false;
    $('title').textContent = item.title || ''; $('title').hidden = !item.title;
    $('text').textContent = item.text || ''; $('text').className = ''; $('text').scrollTop = 0;
    $('expand').textContent = '展开全文'; $('expand').setAttribute('aria-expanded', 'false');
    $('expand').hidden = $('text').scrollHeight <= $('text').clientHeight + 1;
    $('author').textContent = item.author?.name || '未知作者';
    $('avatar').textContent = (item.author?.name || '文').slice(0, 1);
    $('published').textContent = item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : '已保存在本地';
    $('viewed').textContent = history[`${item.source}:${item.id}`]?.viewed ? '已看过' : '';
    $('stats').replaceChildren();
    for (const [field, label] of [['likes','赞'],['comments','评论'],['collects','收藏']]) {
      const span = document.createElement('span'); span.textContent = `${label} ${item.stats?.[field] ?? '—'}`; $('stats').append(span);
    }
    $('source').hidden = true; $('source').removeAttribute('href');
    try { const url = new URL(item.sourceUrl); if (url.protocol === 'https:' && (url.hostname === 'www.xiaohongshu.com' || url.hostname === 'xiaohongshu.com') && !url.username && !url.password) { $('source').href = url.href; $('source').hidden = false; } } catch {}
    $('counter').textContent = `${index + 1} / ${feed.length}`;
    $('progress').style.width = `${(index + 1) / feed.length * 100}%`;
    $('prev').disabled = index === 0; $('next').disabled = index === feed.length - 1;
    $('hint').textContent = index === feed.length - 1 ? '本次离线时光，到这里' : '上滑，继续发现';
    renderComments(item);
    showImage(); started = performance.now();
  }
  function goTo(next) { if (!feed.length || next === index) return; record(); index = next; render(); savePosition(); }
  function move(delta) { goTo(Math.max(0, Math.min(feed.length - 1, index + delta))); }
  function moveImage(delta) { if (!feed.length) return; imageIndex = Math.max(0, Math.min(feed[index].localImages.length - 1, imageIndex + delta)); if (imageIndex < 0) imageIndex = 0; showImage(); savePosition(); }
  $('restart').onclick = () => { goTo(0); imageIndex = 0; if (feed.length) showImage(); savePosition(); };
  $('font-toggle').onclick = () => {
    const large = document.body.classList.toggle('large-text'); $('font-toggle').setAttribute('aria-pressed', String(large));
    $('expand').hidden = !expanded && $('text').scrollHeight <= $('text').clientHeight + 1; savePosition();
  };
  $('search').oninput = () => {
    const query = $('search').value.trim().toLocaleLowerCase(); $('search-results').replaceChildren();
    if (!query) { $('search-status').textContent = ''; return; }
    let found = 0;
    feed.forEach((item, i) => {
      const comments = (item.comments || []).flatMap(c => [c.author?.name, c.text, ...(c.replies || []).flatMap(r => [r.author?.name, r.text])]);
      if (![item.title, item.text, item.author?.name, ...comments].some(text => String(text || '').toLocaleLowerCase().includes(query))) return;
      found++; if (found > 50) return;
      const button = document.createElement('button'); button.textContent = `${i + 1} · ${item.title || '无标题'} · ${item.author?.name || '未知作者'}`;
      button.onclick = () => { goTo(i); $('search-panel').open = false; }; $('search-results').append(button);
    });
    $('search-status').textContent = `找到 ${found} 条笔记${found > 50 ? '，显示前 50 条，请细化关键词' : ''}；仅搜索已经缓存的内容。`;
  };
  $('image').onerror = () => { const fallback = safeAsset('assets/placeholder.svg'); if ($('image').getAttribute('src') !== fallback) $('image').src = fallback; };
  $('comments-toggle').onclick = () => {
    const open = $('comments-panel').hidden; $('comments-panel').hidden = !open;
    $('comments-toggle').setAttribute('aria-expanded', String(open)); $('card').classList.toggle('comments-open', open);
    $('comments-toggle').textContent = open ? '收起评论' : `查看评论 · 已缓存 ${feed[index]?.commentSnapshot?.cachedCount ?? 0} 条`;
  };
  $('prev').onclick = () => move(-1); $('next').onclick = () => move(1);
  $('image-prev').onclick = () => moveImage(-1); $('image-next').onclick = () => moveImage(1);
  $('expand').onclick = () => { expanded = !expanded; $('text').className = expanded ? 'expanded' : ''; $('expand').textContent = expanded ? '收起全文' : '展开全文'; $('expand').setAttribute('aria-expanded', String(expanded)); };
  const canScrollText = delta => expanded && (delta > 0 ? $('text').scrollTop + $('text').clientHeight < $('text').scrollHeight - 2 : $('text').scrollTop > 2);
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if ($('search-panel').contains(event.target) || event.target.matches('input,textarea,select')) return;
    if ($('comments-panel').contains(event.target)) return;
    if (['ArrowDown','PageDown','ArrowUp','PageUp'].includes(event.key)) {
      const delta = ['ArrowDown','PageDown'].includes(event.key) ? 1 : -1;
      if (event.target === $('text') && canScrollText(delta)) return;
      event.preventDefault(); move(delta);
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); moveImage(event.key === 'ArrowRight' ? 1 : -1); }
  });
  $('card').addEventListener('wheel', event => {
    if (event.ctrlKey) return;
    if ($('comments-panel').contains(event.target)) return;
    if ($('text').contains(event.target) && canScrollText(event.deltaY)) return;
    event.preventDefault();
    if (Math.abs(event.deltaY) < 25 || performance.now() - lastWheel < 500) return;
    lastWheel = performance.now(); move(event.deltaY > 0 ? 1 : -1);
  }, { passive: false });
  $('card').addEventListener('touchstart', event => {
    if (event.touches.length !== 1 || event.target.closest('button,a') || $('comments-panel').contains(event.target)) { touch = null; return; }
    const point = event.touches[0]; touch = { x: point.clientX, y: point.clientY, photo: $('photo').contains(event.target), text: $('text').contains(event.target), top: $('text').scrollTop };
  }, { passive: true });
  $('card').addEventListener('touchend', event => {
    if (!touch) return;
    const point = event.changedTouches[0]; const dx = point.clientX - touch.x, dy = point.clientY - touch.y;
    if (touch.photo && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) moveImage(dx < 0 ? 1 : -1);
    else if (Math.abs(dy) > 55 && Math.abs(dy) > Math.abs(dx)) {
      const scrolling = touch.text && expanded && (Math.abs($('text').scrollTop - touch.top) > 2 || canScrollText(-dy));
      if (!scrolling) move(dy < 0 ? 1 : -1);
    }
    touch = null;
  }, { passive: true });
  $('card').addEventListener('touchcancel', () => { touch = null; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { record(); started = null; } else started = performance.now(); });
  window.addEventListener('pagehide', record);
  render();
  if (feed.length && restoredIndex >= 0 && Number.isInteger(savedPosition.imageIndex)) {
    imageIndex = Math.max(0, Math.min(feed[index].localImages.length - 1, savedPosition.imageIndex)); showImage();
  }
  savePosition();
})();
