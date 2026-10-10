# 飞机离线阅读器

有网时提前准备图文，没网时也能慢慢看。飞机离线阅读器希望让飞机、旅途等网络受限场景下的阅读更方便。

**本仓库首先发布小红书分支 `xiaohongshu`，当前为试验版。** 通过 Red Skill 分发，为现有小红书 Skill / MCP 增加离线图文与评论包能力。2026-10-09 开发源码支持一次准备并生成单文件：有执行能力的手机本机 Agent 可以本地保存；手机控制远程 Agent 时由宿主附件工具交付；电脑准备时也可用同网二维码接收。阅读文件独立运行，断网阅读无需 Agent、Node 或 MCP。

## 使用前先确认

**安装本 Skill 不会自动获得小红书内容读取能力。** 本工具由本项目开发，通过 Red Skill 分发，是已有内容工具的离线扩展，不是小红书官方离线接口，也不是安装即用的客户端。

准备真实内容前，需要：

1. 实际执行主机可运行 Node.js 22.12+，具有可写数据目录和完整 Skill 文件。
2. 已有兼容且正常登录的小红书内容来源，能真实返回推荐列表、笔记详情及图片；本工具不捆绑、不自动安装或启动上游。手机 App 的登录不会自动授权另一个 Agent。
3. 电脑能把文件传给手机，或远程 Agent 有真实附件交付能力。二维码只适用于同网传输，返回磁盘路径不等于手机已经收到文件。
4. 手机有可运行本地 HTML 脚本的文件入口，并在出发前通过保存文件、开启飞行模式、关闭重开和交互阅读检查。

**真实小红书账号获取与 Android/iPhone 完整离线流程仍未验收；Mock 和电脑自动测试不代表上述前置条件成立。** 如果目前只有手机上的小红书 App 或仅能聊天的 Agent，不建议直接尝试自动缓存。详细条件、适用范围和本次发现见 [使用前置条件与方案反思](docs/usage-prerequisites.md)。

## 后续开发方向

后续先围绕实际目的与使用便利性验证方案：普通用户能否以少量操作取得真实内容、保存到手机，并在断网后可靠重新打开。先完成真实最小流程，再决定使用 Skill、独立网页、浏览器扩展或 App；不再预设优先使用平台自带的 Skill 或小工具。

现有 Skill 保留为已有环境用户的辅助入口与分发渠道，内容打包、评论快照和阅读器模块可继续复用。换载体并不会自动解决内容来源。知乎、X 等平台仍只是后续设想，尚未实现；是否推进取决于内容来源和便利性验证。欢迎通过 GitHub Issues 反馈实际使用条件和问题。

## 当前版本与验证进度

- 小红书 SkillHub 展示名称：**小红书飞机离线阅读器**；V1.1.0 已于 2026-10-10 由用户手动发布完成（依据用户确认）。此前官方 CLI 提交返回“Skill ID 已被占用”，该失败仅对应当次 CLI 提交；历史回执保留。
- Red Skill 的入口可通过小红书笔记挂载，用于获取并安装到支持 Skill 的 AI 工具。当前版本需要 Node.js 环境和已有内容来源。
- 已实现：按时长准备、库存管理、评论与回复快照、单文件与文件夹导出、同网二维码传输。新增一次准备并交付、宿主位置检查、交付失败恢复、文件体积/评论覆盖报告，以及阅读进度恢复、离线搜索和大字模式。
- 内容范围：缓存图文、图片及评论/回复；当前会过滤视频笔记，暂不支持视频缓存或断网播放。
- 已验证：31 项核心测试与 6 项浏览器测试，包含断网重新打开、评论搜索、位置与字体恢复、不能保存进度时的阅读、附件待交付状态与导出失败重试。详细记录见 [TEST-RESULTS.md](TEST-RESULTS.md)。
- 待验证：真实小红书账号内容、Mac 运行、Android/iPhone 本地文件入口与飞行模式阅读，以及具体手机 Agent 的执行、内容来源与附件能力。
- 二维码适用于手机与执行主机同网的场景，传输时主机保持运行。远程 Agent 优先通过真实附件工具交付；脚本返回文件路径和待交付描述，不会自动发送附件。手机本机流程不需要电脑参与，但需要宿主满足准备与文件打开能力。
- V1.1.0 兼容源码已保存到 `redskill-release/20261010/xhs-offline-skill/`，官方 CLI 生成的本地上传文件为 `exports/xhs-offline-skill-1.1.0-20261010.zip`（不纳入 Git）。SkillHub 已由用户手动发布新版。2026-10-10 后续核验从官方 API 下载的 V1.1.0 包，22 个文件与本地兼容源码一致，并完成本机安装；该核验只证明文件一致与安装完成，不证明真实内容获取或手机离线流程可用。

## 源码与 Red Skill 版本

- [`xhs-offline-skill/`](xhs-offline-skill/)：开发源码，下面的运行示例使用此目录。
- [`redskill-release/xhs-offline-skill/`](redskill-release/xhs-offline-skill/)：提交到 SkillHub 的兼容源码，使用 `.js` 文件及 `type: module`，可独立运行。平台展示版本 V1.0.0 与源码内部的 0.1.0 开发版本分别管理。
- [`redskill-release/20261010/xhs-offline-skill/`](redskill-release/20261010/xhs-offline-skill/)：V1.1.0 兼容源码，含评论、手机交付和新版阅读功能；旧版目录保留。历史 CLI 提交失败记录见 [`publish-attempt.json`](redskill-release/20261010/publish-attempt.json)，后续手动发布完成情况见 [测试与发布记录](TEST-RESULTS.md)。
- [`scripts/prepare-redskill-directory.py`](scripts/prepare-redskill-directory.py)：从开发源码生成兼容目录；为保留已有提交，它不会覆盖现存目录。上传打包由官方 CLI 完成。

## 笔记配图

| 设想封面 | 作用与测试流程 |
| --- | --- |
| ![起飞前备好，上飞机离线刷](docs/images/01-cover.png) | ![工具作用与目前测试方式](docs/images/02-how-it-works.png) |

## 快速运行

需要 Node.js 22.12 或更高版本。运行工具不需要安装依赖、不需要编译。以下命令在本项目根目录运行。

```powershell
# 一次准备真实内容并生成独立阅读文件；真实 MCP 须已启动并登录
node xhs-offline-skill/scripts/offline.mjs prepare_and_deliver --target-minutes 30 --output exports/trip.html

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

CLI 默认真实 `xhs`，演示需显式 `--adapter mock`。手机操作宿主选择见 [手机交付说明](xhs-offline-skill/references/mobile-delivery.md)；诊断可用 `node xhs-offline-skill/scripts/doctor.mjs --host mobile-local`（手机本机）或 `--host remote`（远程执行）。已有缓存使用 `deliver_offline --pack-id PACK_ID`，不需要重新获取。一次准备后若文件生成失败，原包保留，退出码 3；换路径或导出方式重试即可。

## 二维码传到手机与评论

新包会保存详情接口返回的评论与回复；阅读页点击“查看评论”即可离线阅读。当前保存初始返回的评论，每条笔记最多 200 条评论与回复，不保证覆盖全部评论；页面会区分“部分缓存”“未获取”和准备时无评论。旧包不会自动补评论。阅读时长仍按笔记正文与图片估算，不包含评论。

准备完成后运行（将 `PACK_ID` 换为返回的真实 ID）：

```powershell
node xhs-offline-skill/scripts/offline.mjs share_offline --pack-id PACK_ID
```

Agent 在电脑浏览器打开返回的 `desktopUrl` 展示二维码，传输进程保持运行。手机连接同一 Wi-Fi 或电脑连接手机热点，扫码打开接收页，点击“下载离线阅读文件”。文件包含正文、图片和已缓存评论，不需要解压或拷贝图片文件夹。下载后从手机“下载”目录打开 HTML；开飞行模式，关闭页面再重新打开文件，检查翻页、图片和评论。接收页的在线预览依赖电脑连接，不能代替下载保存。

默认 30 分钟自动停止；在电脑按 Ctrl+C 可提前结束。二维码本地生成、接收链接含随机令牌，服务只提供指定离线包，不上传云端。多网卡时可传 `--host-ip 本机Wi-Fi地址`；若手机访问失败，检查是否同网、Wi-Fi 是否隔离设备、电脑是否允许局域网访问。工具不自动改防火墙。

也可先导出单文件，再自行传到手机：

```powershell
node xhs-offline-skill/scripts/offline.mjs export_offline --pack-id PACK_ID --single-file --output exports/my-trip.html
```

单文件模式限制图片合计 64 MB、最终文件 100 MB，避免手机载入过大；超限时准备更小的包或用原来的文件夹导出。手机系统及文件入口是否允许执行本地 HTML 脚本仍需真机验证。

目标可用 30、60、120、240 分钟或自定义值。数据默认保存在工作目录下 `data/`，可用 `--data-dir` 或环境变量 `XHS_OFFLINE_DATA_DIR` 固定位置。不同工作目录下应显式传入同一个数据目录。

## 自然语言调用与集成

[SKILL.md](xhs-offline-skill/SKILL.md) 将准备、库存、删除、导出和手机交付请求映射到对应动作。克隆仓库获得源码；需要将整个 Skill 目录安装到具备脚本执行、内容来源和交付能力的宿主，或使用 CLI。现有导出文件独立运行，但是否满足手机使用需求仍需真机验收。

已有 Skill 可以直接调用 [createOfflineModule](xhs-offline-skill/offline/index.mjs)，或执行 CLI。已有 MCP 连接可以注入 `callTool`。详细示例见 [接入说明](xhs-offline-skill/references/integration.md)。

### 当前真实小红书能力

适配 [xpzouying/xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp) 的 `list_feeds` 与 `get_feed_detail`；支持宿主 MCP 调用和该 MCP 的本机 REST 接口。没有实现小红书私有协议。

当前真实内容适配依赖独立的上游工具；安装本 Skill 或 Red Skill 商店不会自动接通该来源。**真实账号推荐流、图片下载尚未验收**；契约测试使用本地服务响应。`127.0.0.1:18060` 指实际执行脚本那台主机上的服务。已有来源正常启动、登录且确实可读取内容后：

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
  scripts/offline.mjs       准备、库存、导出、交付与同网传输
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
5. 打开“离线包信息”，检查实际时长、数量和部分失败说明。打开“搜索与阅读进度”，搜索本包正文、作者及评论，切换大字或从头开始。刷新后恢复笔记、图片位置与字体；进度只存在原浏览器入口，未与 Agent 库存同步。

手机优先保存单文件 HTML，文件夹模式则需完整复制。使用能执行本地 HTML 脚本的文件入口；受限文件预览可能无法翻页或展开评论。入口禁止本地存储时页面提示无法保存进度，仍可阅读、搜索和翻页。移动文件、更换入口或浏览器可能无法恢复旧位置，出行前应在目标设备验收。

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
- QR Code Generator 2.0.4：MIT，本地内置二维码编码器，来源与许可证见 [`vendor/THIRD_PARTY.md`](xhs-offline-skill/vendor/THIRD_PARTY.md)。不使用远程二维码服务。
- Offline 逻辑与 Viewer、Mock 文字和插图为本项目编写；运行时只使用 Node 内置模块。

仅供当前用户个人离线阅读；保留原作者和来源链接，不绕过登录、付费或访问限制，不公开分发缓存内容。

## 最值得做的下一步

1. 先验证普通用户能完成的真实最小流程：获取一条笔记、生成小包、交付到实际手机，飞行模式关闭重开后仍可阅读。
2. 记录获取、登录、安装和传输的实际操作成本；若需要复杂环境排障，先重新评估方案，不继续堆功能来维持原载体。
3. 内容来源和手机流程验证通过后，再决定载体与功能范围；尚不承诺一键批量缓存推荐流、完整评论或指定时长的内容。
