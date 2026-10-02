# 飞机离线阅读器

有网时提前准备图文，没网时也能慢慢看。飞机离线阅读器希望让飞机、旅途等网络受限场景下的阅读更方便。

**本仓库首先发布小红书分支 `xiaohongshu`，当前为试验版。** 通过 Red Skill 分发，为现有小红书 Skill / MCP 增加本地离线图文包能力。当前使用流程是：电脑上的 AI 工具准备内容 → 导出完整离线包 → 复制到安卓手机 → 打开本地阅读页，断网连续翻阅。

## 后续开发方向

后续会针对不同的媒体平台开发，包括 **知乎、X 等**。我们会优先使用各平台自带的 **Skill 或小工具** 开发，评估内容获取、本地保存和断网阅读能否实现；如果平台能力无法满足需求，会考虑做成独立的 **App 工具**。

目前先推进小红书版本，持续更新、测试真实内容接入和安卓手机体验。知乎、X 版本属于后续计划，尚未实现。敬请期待，也欢迎通过 GitHub Issues 反馈使用场景、问题和建议。

## 当前版本与验证进度

- 小红书 SkillHub 展示名称：**小红书飞机离线阅读器**，平台版本 V1.0.0；管理页面已显示“生效中”。
- Red Skill 的入口可通过小红书笔记挂载，用于获取并安装到支持 Skill 的 AI 工具。当前版本需要 Node.js 环境和已有内容来源。
- 已实现：按时长构建离线图文包、查询库存、列出及删除包、导出静态阅读页。
- 已验证：演示数据的本地离线阅读、23 项核心测试和 3 项浏览器测试。详细记录见 [TEST-RESULTS.md](TEST-RESULTS.md)。
- 待验证：真实小红书账号内容及图片获取、安卓真机文件打开和飞行模式阅读。
- 当前版本没有手机一键缓存或小红书 App 内直接离线刷的入口。阅读页依赖手机允许打开本地 HTML 和关联图片，出行前需要实测。

## 源码与 Red Skill 版本

- [`xhs-offline-skill/`](xhs-offline-skill/)：开发源码，下面的运行示例使用此目录。
- [`redskill-release/xhs-offline-skill/`](redskill-release/xhs-offline-skill/)：提交到 SkillHub 的兼容源码，使用 `.js` 文件及 `type: module`，可独立运行。平台展示版本 V1.0.0 与源码内部的 0.1.0 开发版本分别管理。
- [`scripts/prepare-redskill-directory.py`](scripts/prepare-redskill-directory.py)：从开发源码生成兼容目录；为保留已有提交，它不会覆盖现存目录。上传打包由官方 CLI 完成。

## 笔记配图

| 设想封面 | 作用与测试流程 |
| --- | --- |
| ![起飞前备好，上飞机离线刷](docs/images/01-cover.png) | ![工具作用与目前测试方式](docs/images/02-how-it-works.png) |

## 快速运行

需要 Node.js 22.12 或更高版本。运行工具不需要安装依赖、不需要编译。以下命令在本项目根目录运行。

```powershell
# 准备 30 分钟演示内容，实际目标含 25% 冗余 = 37.5 分钟
node xhs-offline-skill/scripts/offline.mjs prepare_offline --target-minutes 30 --adapter mock

# 查询、列出包
node xhs-offline-skill/scripts/offline.mjs offline_status
node xhs-offline-skill/scripts/offline.mjs list_offline_packs

# 将返回的 id 替换到下面的 PACK_ID
node xhs-offline-skill/scripts/offline.mjs export_offline --pack-id PACK_ID --output exports/my-trip

# 双击 exports/my-trip/index.html；也可直接打开准备结果中的 viewer 路径

# 删除原始包，保留去重历史与导出副本
node xhs-offline-skill/scripts/offline.mjs clear_offline --pack-id PACK_ID
```

也可用 `npm run offline -- <动作> <参数>`。JSON 输出在 stdout，进度输出在 stderr。`--quiet` 隐藏进度。

目标可用 30、60、120、240 分钟或自定义值。数据默认保存在工作目录下 `data/`，可用 `--data-dir` 或环境变量 `XHS_OFFLINE_DATA_DIR` 固定位置。不同工作目录下应显式传入同一个数据目录。

## 自然语言调用与集成

[SKILL.md](xhs-offline-skill/SKILL.md) 将“给我准备两小时小红书”“我还有多少离线内容”等请求映射到五个动作。克隆仓库会获得源码；需要将 Skill 安装到支持它的宿主，或直接使用以下 CLI 命令。

已有 Skill 可以直接调用 [createOfflineModule](xhs-offline-skill/offline/index.mjs)，或执行 CLI。已有 MCP 连接可以注入 `callTool`。详细示例见 [接入说明](xhs-offline-skill/references/integration.md)。

### 当前真实小红书能力

适配 [xpzouying/xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp) 的 `list_feeds` 与 `get_feed_detail`；支持宿主 MCP 调用和该 MCP 的本机 REST 接口。没有实现小红书私有协议。

开发环境未发现可直接复用的已安装小红书 Skill / MCP 工具，本机 `127.0.0.1:18060` 也未运行。**真实账号推荐流、图片下载尚未联网验收**；契约测试使用本地服务响应。正常启动并登录上游后：

```powershell
node xhs-offline-skill/scripts/offline.mjs prepare_offline --target-minutes 30 --adapter xhs --mcp-url http://127.0.0.1:18060
```

工具不会在真实接口失败时静默切换 Mock。现有 `list_feeds` 没有分页参数，因此真实适配器读取一批后结束；不够目标时显示 `partial`。Offline 模块已支持标准 `nextCursor`，可接入底层确实支持分页的实现。

## Mock 是什么

30 种原创文字样例，包含纯文字、单图、多图、长文、极短文、空标题、超长标题、12 图、图片失败；图片是本地生成的 SVG 插图。全部使用虚构作者、虚构互动数字，并在 Viewer 中显示“演示内容”。

默认扩展为 300 条**测试变体**，用于验证大时长与分页；变体会重复模板，不能视为 300 条独立真实笔记。阅读估时按实际生成正文计算。固定 ID 可测试跨包去重，数据耗尽后不会无限生成。

```powershell
# 只用基础 30 条，测试内容不足与图片失败
node xhs-offline-skill/scripts/offline.mjs prepare_offline --target-minutes 240 --adapter mock --mock-total 30 --data-dir data-boundaries

# 无故障样例，用于测试达到 1 小时 + 冗余的 ready 状态
node xhs-offline-skill/scripts/offline.mjs prepare_offline --target-minutes 60 --adapter mock --mock-no-failures --data-dir data-duration
```

## 目录与职责

```text
xhs-offline-skill/
  SKILL.md                 自然语言调用说明
  scripts/offline.mjs       五个 CLI 动作
  adapters/                XhsAdapter / MockXhsAdapter
  offline/
    index.mjs              宿主集成入口
    types.d.ts             数据与适配器合约
    packBuilder.mjs        按时长选择、去重、构建与部分失败
    durationEstimator.mjs  阅读估时
    cacheManager.mjs       图片缓存、并发与失败占位
    storage.mjs            JSON、历史、操作锁
    exporter.mjs           生成静态附件
    network.mjs            超时、重试、响应大小限制
  viewer/                  极轻 HTML / CSS / JS 模板
  references/              接入已有 MCP 的说明
tests/                     核心测试和浏览器断网测试
data/
  history.json             source / feedId / cachedAt / packId
  packs/<pack-id>/
    index.html             可直接双击的完整 Viewer
    feed.json              正文与元数据
    manifest.json          包状态、时长、空间和问题
    assets/                本地图片与占位图
```

`index.html` 内嵌 Viewer 样式、脚本和 JSON，无 CDN、字体下载、fetch 或 Service Worker。图片用相对文件路径读取；`remoteImages` 仅保留溯源信息，不参与显示。`feed.json` 便于其他工具复用。复制时保留整个包目录。

## 估时、状态与限额

正文按非空白 Unicode 字符计数：

```text
seconds = clamp(ceil(8 + 字数 / 350 × 60 + 图片时间), 30, 300)
图片时间 = 0（无图），或 5 + (图片数 - 1) × 4
目标秒数 = ceil(targetMinutes × reserveRatio × 60)
```

默认 `reserveRatio=1.25`、`maxItems=300`、`maxPages=30`；详情逐个获取，媒体最多 4 个并发。实际 HTTP 请求超时 20 秒，最多重试 2 次，4xx（429 除外）不重试。单张图上限 25MB，单包媒体预算默认 5GB（`--max-mb`），元数据与 Viewer 不计入预算，但计入最终 `sizeBytes`。MVP 保留原图片格式，不做 WebP 转码。

- `ready`：达到含冗余的目标，且无已知失败。
- `partial`：至少有一条可读内容，但时长不足、详情失败或图片失败；图片失败显示本地占位图。
- `failed`：没有可读内容。
- `building`：正在准备，或之前的进程异常退出。不能当作完成包导出。

`estimatedMinutes` 是实际存入内容的规则估时；不会把请求目标直接当成结果。库存按包累计，未扣除已读；开启重复缓存时会重复计数。

默认按 `source + id` 去重。删除包后历史仍保留，避免下次又缓存同一批；需要重新测试时用独立数据目录，或明确使用 `--allow-seen-content`。

```powershell
# 明确清空原始包并重置去重历史；不会删除导出副本
node xhs-offline-skill/scripts/offline.mjs clear_offline --all --reset-history
```

单一数据目录通过 `.offline.lock` 排他写入。若进程被强制终止，先读取锁文件中的 PID、确认对应任务确实已结束，再移除该锁文件。新构建会从现存包恢复去重信息；中断包可删除后重新构建。不要在构建过程中手工改写包文件。

## 怎么验证离线

1. 先准备和导出一个 Mock 包。
2. 完全断网，再双击导出目录的 `index.html`；无须启动 Node 或 MCP。
3. 用上下方向键、PageUp / PageDown、滚轮或上下滑切换；左右键、图片箭头或左右滑看多图。
4. 展开长文。长文仍可滚动，滚动到边界后才换笔记；也可直接按下方“下一条”。
5. 打开“离线包信息”，检查实际时长、数量和部分失败说明；刷新后继续使用。

手机需把完整目录传到设备，并用能够打开本地 HTML 的浏览器或文件工具打开。iOS 文件预览、某些 Android 文件管理器可能限制脚本或关联资源；当前不承诺所有手机入口可用。这里没有实现手机安装、PWA 或专用客户端，出行前应在目标设备验收。

Viewer 可将简单已读/停留记录写入当前浏览器 localStorage，不回传 Skill、不用于推荐。部分 `file://` 环境不允许 localStorage 时会退化为本次会话记录，不影响阅读。

## 自动测试

核心测试使用 Node 内置测试框架，运行无需 npm 安装：

```powershell
npm test
```

浏览器测试才需要下载开发依赖与 Chromium：

```powershell
npm ci --cache .npm-cache
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $PWD 'node_modules/.cache/ms-playwright'
npx playwright install chromium
npm run test:e2e
```

浏览器测试在断网状态下打开 `file://`，遍历 30 条样例和全部图片，验证刷新、占位图、键盘、滚轮与模拟手机触摸，并断言没有 HTTP 请求。截图输出 `output/playwright/`。测试结果与真实手机验收是两回事。

## 复用与许可证

- `xpzouying/xiaohongshu-mcp`：Apache-2.0，**适配它的接口**；未捆绑、复制其实现代码。使用者独立安装并遵守上游许可。
- Playwright / `@playwright/test`：Apache-2.0，仅开发与浏览器测试使用，锁定版本见 `package-lock.json`。
- Offline 逻辑与 Viewer、Mock 文字和插图为本项目编写；运行时只使用 Node 内置模块。

仅供当前用户个人离线阅读；保留原作者和来源链接，不绕过登录、付费或访问限制，不公开分发缓存内容。

## 最值得做的下一步

1. 接上用户已登录的小红书 MCP，验证一包真实图文与 CDN 下载。
2. 在实际出行手机上验证整包传入与本地 HTML 打开方式。
3. 若上游确有分页能力，再接入真实游标，提高较长时长包的备满率。
