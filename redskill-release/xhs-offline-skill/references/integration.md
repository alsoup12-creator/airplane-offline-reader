# 集成已有小红书 Skill / MCP

## 当前适配对象

参考并适配 [xpzouying/xiaohongshu-mcp](https://github.com/xpzouying/xiaohongshu-mcp)，上游为 [Apache-2.0](https://github.com/xpzouying/xiaohongshu-mcp/blob/main/LICENSE)。本仓库不包含上游实现、不重新实现平台协议、不自动安装或启动上游。

上游能力已查阅：`list_feeds`（首页推荐）、`get_feed_detail`（详情）、`search_feeds`（搜索）。本 MVP 使用前两项，不提供搜索界面。接口字段依据上游 [types.go](https://github.com/xpzouying/xiaohongshu-mcp/blob/main/xiaohongshu/types.go)、[service.go](https://github.com/xpzouying/xiaohongshu-mcp/blob/main/service.go)、[handlers_api.go](https://github.com/xpzouying/xiaohongshu-mcp/blob/main/handlers_api.go)。核对日期：2026-10-02。

## 方式 A：已有宿主 MCP 连接

在已有 Skill 的动作处理代码中导入工厂。`hostMcpClient` 是宿主已有的、已经建立连接的客户端；本模块不另建登录系统。

```javascript
import { XhsAdapter } from './xhs-offline-skill/adapters/xhsAdapter.js';
import { createOfflineModule } from './xhs-offline-skill/offline/index.js';

const adapter = new XhsAdapter({
  callTool: (name, args) => hostMcpClient.callTool({ name, arguments: args }),
});
const offline = createOfflineModule({
  dataDir: '/your/private/data',
  adapter,
  onProgress: progress => hostLog(progress),
});

const pack = await offline.prepare_offline({ targetMinutes: 120 });
// 同一对象包含 offline_status / list_offline_packs / clear_offline / export_offline。
```

宿主给注入的 `callTool` 配置超时与重试；本模块内置 REST 与媒体请求已自行限制。原有 MCP 的 `content: [{type:'text',text:'JSON'}]` 结果会被解包。如果原 Skill 返回自定义文本而非 JSON，应在宿主端转换成标准结果，或实现自己的 FeedAdapter。

## 方式 B：已有 MCP 的本机 REST 外观

先按上游说明启动本机服务并完成正常登录。本工具只请求：

| 能力 | 请求 | 参数 |
| --- | --- | --- |
| 首页推荐 | GET `/api/v1/feeds/list` | 无 |
| 图文详情 | POST `/api/v1/feeds/detail` | `feed_id`、`xsec_token`、`load_all_comments: false` |

```powershell
node xhs-offline-skill/scripts/offline.js prepare_offline --target-minutes 30 --adapter xhs --mcp-url http://127.0.0.1:18060
```

MCP 地址限制为本机，`xsec_token` 只在请求过程中使用，不写进离线包。推荐结果和详情都过滤视频。图片仅从 `xhscdn.com` 及其子域下载，并禁止重定向；如果上游更换 CDN，会显式生成 partial 包，应先核对官方资源域再更新适配规则。

## FeedAdapter 合约

见 [types.md](../offline/types.md)。每页返回 `{ items, nextCursor? }`，预览项包含 `source`、`id`，可携带适配器所需 token。详情返回同一 source/id 的标准内容。

- 平台解析仅在 `adapters/` 内。
- `offline/` 不读取小红书特有字段。
- 可选 `getImage(url)` 用于宿主已有下载能力。宿主应限制网络来源、响应大小和超时。内置 Mock 用它生成测试插图。
- 若底层没有游标，返回一页后结束。不可用随机数字假装分页。

## 安装为可发现的 Skill

当前交付为工作区内的可携带 Skill，未修改用户全局配置。可以让宿主直接读取本目录 `SKILL.md`；如需全局安装，将整个 `xhs-offline-skill` 文件夹复制到宿主的 skills 目录，保持 `scripts/`、`offline/`、`adapters/`、`viewer/`、`references/` 一起移动。数据目录应单独指定，不要存在 Skill 安装目录中。
