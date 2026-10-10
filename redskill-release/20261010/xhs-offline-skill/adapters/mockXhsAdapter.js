const topics = [
  ['把周末留给一段河岸', '散步', '沿着河岸慢慢走，不必给每个路口安排目的地。桥下有人练琴，水面把午后的光切成碎片。我在长椅上坐了一会儿，把手机放进口袋，只记住风吹过树叶的声音。'],
  ['一杯手冲，等水慢慢落下', '咖啡', '今天尝试把注水分成三段，先闻干香，再看粉层慢慢膨胀。杯子温热的时候，味道更柔和。记录只是为了下次有个参照，喜欢的口感也可以每天不同。'],
  ['窗边的一平方米', '日常', '整理窗边时只留下书、台灯和一盆绿植。桌面空出来以后，坐下来写东西轻松了很多。下午的阳光移过书页，这个小角落不需要更多装饰。'],
  ['山路尽头的那片海', '旅行', '从山路转过最后一个弯，远处的海才完整出现。云影经过的时候，水面会一层一层变色。我们带了水和简单的午餐，停下来以后再决定往哪边走。'],
  ['给自己煮一碗热面', '厨房', '锅里的水烧开，把洗好的青菜放在手边。面条煮到自己喜欢的软硬，最后加一点葱花。没有复杂的配方，一顿安静的晚饭也能让人缓下来。'],
  ['旧书里的折角', '阅读', '翻到以前折过角的那一页，才发现当时在意的句子，现在有了不同的意思。我把新的想法写在纸上夹进去，不急着把一本书一次读完。'],
  ['城市里的几何练习', '摄影', '观察墙面、窗框和楼梯之间的线条。退后一步，画面常常比靠近时更清楚。拍照之前先找光，拍完之后留下少量真正想再看的照片。'],
  ['雨天也有自己的颜色', '天气', '雨水在玻璃上留下细小的轨迹，路边的招牌映在地面。我撑着伞走得很慢，忽然发现熟悉的街道，在这样的天气里像换了一个名字。'],
  ['在车窗旁留十分钟', '通勤', '今天没有一上车就戴耳机。沿线的树、屋顶和行人依次向后退。把十分钟从任务清单里拿出来，看看窗外，也是一种休息。'],
  ['阳台上的小小花园', '植物', '浇水之前先摸一摸土，看看叶子的状态。植物长得慢，照顾它们也让我少一点着急。新叶展开那天，我拍了一张照片作为记录。'],
  ['收集日落的方法', '天空', '不一定要走到很远的地方。在楼下等天色一点点变暗，也能看见漂亮的云。日落没有两次完全相同，今天的颜色适合安静地记住。'],
  ['出发前，把行李变轻', '出行', '先把物品铺开，再按真正会用到的顺序收进去。留一点空位，比把箱子塞满更从容。带一本薄书、一支笔，路上就有了自己的小空间。'],
  ['听一张完整的唱片', '音乐', '从第一首开始，按原来的顺序听到最后。有些歌单独听很普通，放在整张专辑里却刚好。今天不跳过间奏，给音乐一点完整的时间。'],
  ['用铅笔画一棵树', '手绘', '先画树干的走向，再观察枝条如何分开。叶子不必一片片描出来，深浅的块面就能留下形状。画得不像也没关系，观察的过程已经足够有趣。'],
  ['清晨菜场的声音', '生活', '摊主把新鲜的蔬菜摆好，袋子和秤盘发出细小的声音。我挑了几样当季食材，回家的路上想好今天吃什么。这是周末最具体的开始。'],
  ['走一条没走过的小路', '探索', '提前一站下车，给自己留出绕路的时间。小路里有面包店，也有晒太阳的猫。我没有标注所有地点，只想下次还能偶然经过。'],
  ['慢一点整理照片', '记录', '不按数量挑照片，而是看看哪一张能让我想起当时的心情。把相似的照片放在一起，再留出空白。记录不需要占满每一天。'],
  ['把一封信写在纸上', '书写', '手写的时候，句子会变得慢一些。写到一半停下来想想，有些话可以更简单。最后把日期写在角落，留给以后某个偶然翻到它的人。'],
  ['一个人的小野餐', '户外', '准备容易携带的食物，找一块可以坐下来的草地。吃完把东西全部带走，再绕公园走一圈。普通的午餐换个地方，也有一点新鲜感。'],
  ['重新认识家里的光', '居家', '早晨和傍晚的光落在不同位置。我把椅子移到窗边试了一天，发现读书时不再需要开灯。有时候改变生活，只需要挪动一点距离。'],
  ['今天，只写三件小事', '随记', '一是早餐的面包还温热，二是路口等到了绿灯，三是朋友发来一句问候。写下来以后，忙碌的一天也有了可以辨认的细节。'],
  ['在雨后找倒影', '观察', '地上的水洼像一面不规则的镜子。换一个角度，楼房就和树枝重叠在一起。我试着蹲下来拍，才看见平时站着看不到的世界。'],
  ['这张图故意没有缓存成功', '失败示例', '这是一条故障测试笔记。其中一张图片被故意设为不可用，离线阅读时应显示占位图，其他图片和正文依然可以阅读。'],
  ['一张很长很长的标题：把没有安排的时间留给没有目的地的散步，慢慢观察这座熟悉的城市', '长标题', '长标题也是测试内容的一部分。阅读器需要在窄屏里自然换行，按钮仍然可以操作，正文也可以展开。'],
  ['', '无标题', '有时候只有一段话，没有标题。没有标题的笔记也应该能自然地进入信息流，让图片和文字自己讲述。'],
  ['一页纯文字', '文字', '这一条不配图片。读完以后向上滑，仍然可以继续下一条。图文信息流也应该为纯文字留出位置。'],
  ['今天晴', '短文', '晴。'],
  ['十二帧散步记录', '多图', '从出门到回家，把不同时间的光留在十二张图里。左右滑动可以逐张看，向上滑动会切换到下一条笔记。'],
  ['一篇可以慢慢读的长记录', '长文', '沿途的记录并不需要按时间排列。先写下最清楚的片段，再把细节补上。有时候走过同一条路很多次，才会注意到一扇窗和一棵树。'],
  ['给下一段旅程留白', '留白', '把行程表里没有安排的地方留着。在路上发现想看的东西，就停一停。不必把每次出发都变成任务，带着好奇心已经很好。'],
];
export class MockXhsAdapter {
  mode = 'mock';
  constructor({ total = 300, failures = true } = {}) { this.total = total; this.failures = failures; }
  async listFeeds(cursor = '0') {
    const start = Number(cursor); const end = Math.min(start + 20, this.total);
    return { items: Array.from({ length: end - start }, (_, i) => ({ source: 'xiaohongshu', id: `demo-${start + i + 1}` })), nextCursor: end < this.total ? String(end) : undefined };
  }
  async getFeedDetail(preview) {
    const n = Number(preview.id.split('-')[1]) - 1; const t = n % topics.length;
    const [title, tag, paragraph] = topics[t];
    const imageCount = t === 25 ? 0 : t === 27 ? 12 : t % 3 + 1;
    const remoteImages = Array.from({ length: imageCount }, (_, i) => `mock://${n + 1}/${i + 1}`);
    if (t === 22 && this.failures) remoteImages[0] = 'mock://failure';
    return { id: preview.id, source: 'xiaohongshu', title: title && `${title}${n >= 30 ? ` · 演示变体 ${Math.floor(n / 30) + 1}` : ''}`,
      text: t === 26 ? paragraph : Array.from({ length: t === 28 ? 40 : 7 + t % 4 }, (_, i) => `${i + 1}. ${paragraph}`).join('\n\n'),
      author: { name: `${tag}记录员 · 虚构作者` }, remoteImages, localImages: [],
      stats: { likes: (n * 37) % 2000, comments: 2, collects: n % 80 },
      comments: [{ id: `${preview.id}-comment`, author: { name: '旅途读者 · 虚构用户' }, text: '读完这段文字，想把脚步放慢一点。', likes: 3,
        replyCount: 1, replies: [{ id: `${preview.id}-reply`, author: { name: '记录员 · 虚构用户' }, text: '谢谢你，也祝你一路有好风景。', likes: 1, replies: [] }] }],
      commentSnapshot: { status: 'complete', cachedCount: 2, total: 2, capturedAt: new Date().toISOString() },
      estimatedReadSeconds: 0, cachedAt: '', cacheStatus: 'pending', demo: true,
    };
  }
  async getImage(url) {
    if (url === 'mock://failure') throw new Error('预设图片失败');
    const [, a, b] = url.match(/^mock:\/\/(\d+)\/(\d+)$/) ?? [];
    if (!a) throw new Error('无效演示图片');
    const palettes = [['#e7ddd0','#64816c','#354c48'], ['#dce7e6','#698e9b','#345260'], ['#f0dcca','#c58d6d','#675b4b']];
    const [bg, mid, dark] = palettes[(Number(a) + Number(b)) % 3];
    const tag = topics[(Number(a) - 1) % 30][1];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1050" viewBox="0 0 900 1050"><rect width="900" height="1050" fill="${bg}"/><circle cx="670" cy="240" r="120" fill="#fff4d6"/><path d="M0 700Q230 290 480 600T900 440V1050H0Z" fill="${mid}"/><path d="M0 820Q300 590 510 800T900 720V1050H0Z" fill="${dark}"/><path d="M400 1050Q650 820 490 690" fill="none" stroke="${bg}" stroke-width="40" opacity=".6"/><text x="64" y="100" font-family="sans-serif" font-size="24" fill="${dark}" letter-spacing="6">OFFLINE NOTES / ${a.padStart(3,'0')}</text><text x="64" y="177" font-family="sans-serif" font-size="48" fill="${dark}">${tag} · ${b}</text><text x="64" y="995" font-family="sans-serif" font-size="22" fill="${bg}">本地生成的演示插图 · 非真实小红书内容</text></svg>`;
    return { bytes: Buffer.from(svg), mime: 'image/svg+xml' };
  }
}
