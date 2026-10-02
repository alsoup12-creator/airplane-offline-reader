(() => {
  'use strict';
  const { pack, feed } = JSON.parse(document.getElementById('offline-data').textContent);
  const $ = id => document.getElementById(id);
  const key = `xhs-offline:${pack.id}`;
  let history = {};
  try { history = JSON.parse(localStorage.getItem(key) || '{}'); } catch { /* file storage can be disabled */ }
  if (!history || typeof history !== 'object' || Array.isArray(history)) history = {};
  let index = 0, imageIndex = 0, expanded = false, started = performance.now(), touch = null, lastWheel = -Infinity;
  const mins = value => { const m = Math.floor(value); return m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60} 分` : `${m} 分钟`; };
  const size = n => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1024).toFixed(1)} KB`;
  $('mode').textContent = pack.mode === 'mock' ? '演示内容 · 本地离线包' : '小红书图文 · 本地离线包';
  const statuses = { ready: '准备完成', partial: '部分完成', failed: '准备失败', building: '构建中' };
  $('pack-summary').textContent = `${statuses[pack.status] ?? pack.status} · ${pack.itemCount} 条 · 预计 ${mins(pack.estimatedMinutes)} · ${pack.imageCount} 张图片 · ${size(pack.sizeBytes)}。目标 ${mins(pack.targetMinutes)}，含冗余目标 ${mins(pack.targetMinutes * pack.reserveRatio)}。`;
  $('pack-issues').textContent = pack.issues.join('；');
  $('pack-id').textContent = pack.id;
  $('info-toggle').onclick = () => { const open = $('pack-info').hidden; $('pack-info').hidden = !open; $('info-toggle').setAttribute('aria-expanded', String(open)); };
  const safeAsset = value => /^assets\/[a-zA-Z0-9_-]+\.(svg|png|jpg|webp|gif|avif)$/.test(value) ? value : 'assets/placeholder.svg';
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
    showImage(); started = performance.now();
  }
  function move(delta) { const next = Math.max(0, Math.min(feed.length - 1, index + delta)); if (!feed.length || next === index) return; record(); index = next; render(); }
  function moveImage(delta) { if (!feed.length) return; imageIndex = Math.max(0, Math.min(feed[index].localImages.length - 1, imageIndex + delta)); if (imageIndex < 0) imageIndex = 0; showImage(); }
  $('image').onerror = () => { if (!$('image').getAttribute('src')?.endsWith('placeholder.svg')) $('image').src = 'assets/placeholder.svg'; };
  $('prev').onclick = () => move(-1); $('next').onclick = () => move(1);
  $('image-prev').onclick = () => moveImage(-1); $('image-next').onclick = () => moveImage(1);
  $('expand').onclick = () => { expanded = !expanded; $('text').className = expanded ? 'expanded' : ''; $('expand').textContent = expanded ? '收起全文' : '展开全文'; $('expand').setAttribute('aria-expanded', String(expanded)); };
  const canScrollText = delta => expanded && (delta > 0 ? $('text').scrollTop + $('text').clientHeight < $('text').scrollHeight - 2 : $('text').scrollTop > 2);
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (['ArrowDown','PageDown','ArrowUp','PageUp'].includes(event.key)) {
      const delta = ['ArrowDown','PageDown'].includes(event.key) ? 1 : -1;
      if (event.target === $('text') && canScrollText(delta)) return;
      event.preventDefault(); move(delta);
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); moveImage(event.key === 'ArrowRight' ? 1 : -1); }
  });
  $('card').addEventListener('wheel', event => {
    if (event.ctrlKey) return;
    if ($('text').contains(event.target) && canScrollText(event.deltaY)) return;
    event.preventDefault();
    if (Math.abs(event.deltaY) < 25 || performance.now() - lastWheel < 500) return;
    lastWheel = performance.now(); move(event.deltaY > 0 ? 1 : -1);
  }, { passive: false });
  $('card').addEventListener('touchstart', event => {
    if (event.touches.length !== 1 || event.target.closest('button,a')) { touch = null; return; }
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
})();
