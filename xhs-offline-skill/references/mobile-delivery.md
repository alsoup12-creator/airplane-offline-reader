# 手机本机与远程 Agent 交付

## 必要能力

准备端需要 Node.js 22.12+、可读写的数据目录，以及现有小红书工具的真实读取能力。手机本机可执行程序的 Agent 满足这些能力时可在手机准备；远程 Agent 在它的执行主机准备。手机上的小红书登录不会自动变成另一个 Agent 的登录授权。只读已有离线文件无需准备端运行环境。

阅读端需要能执行 HTML 脚本、显示内嵌图片的本地文件入口；保存进度还需要该入口允许本地存储。受限的文件预览可能只显示静态页面。不要承诺任意手机 Agent、任意文件管理器都兼容。

`doctor.mjs --host mobile-local` 或 `--host remote` 记录调用者声明的位置并建议交付模式，不识别真实手机型号，不验证宿主附件能力。未知位置依据宿主工具与执行路径确认，不从聊天客户端外观猜测。真实 MCP 注入方式见 [integration.md](integration.md)。

## 一次准备并生成文件

路径以 Skill 根目录为基准，跨工作目录使用绝对脚本路径；数据位置按宿主选择实际可写目录。以下是跨平台示例：

```sh
node scripts/offline.mjs prepare_and_deliver --target-minutes 30 --data-dir ./private-xhs-data --delivery local-file --output ./trip.html
```

返回原包 ID、实际状态与 `artifact`；`artifact.viewer` 是执行主机上的绝对路径。手机本机用已有文件工具定位并打开该文件。电脑生成的文件仍需发送或同网扫码传给手机。

远程宿主用 `--delivery attachment`。核对 `artifact.mode`（mock 必须标演示）、`status`、`comments`、`sizeBytes` 与文件存在，再用宿主确实提供的附件功能发给当前用户。文本中提到附件不等于实际附件；发送工具成功才报告已交付。手机保存的是下载文件，不是聊天页面预览。

`savedOnPhone:false` 表示尚未确认手机接收，脚本不推断手机完成下载。`requiresAgentWhileReading:false` 表示文件独立运行，不证明手机入口兼容。

## 已缓存内容与交付失败

```sh
node scripts/offline.mjs deliver_offline --pack-id PACK_ID --data-dir ./private-xhs-data --delivery attachment --output ./trip-copy.html
```

准备完成但导出失败时返回原包信息与 `delivery.status:failed`，退出码 3；源包保留。例如输出文件已存在，选择新路径再交付，不重新获取内容。单文件上限见 SKILL.md；超限时可导出文件夹，由宿主提供保持目录结构的交付方式，或下次控制条数与媒体预算。

没有附件能力的远程宿主可以完成缓存，手机接收仍未打通；不自动建立公网服务，不把私网二维码当远程下载方案。用户只要求缓存时无需自动发送附件。

## 宿主 MCP 集成

```js
const result = await offline.prepare_and_deliver({
  targetMinutes: 30,
  output: '/actual/writable/trip.html',
  delivery: 'attachment',
});
if (result.artifact) {
  // hostSendAttachment 是宿主已有能力的示意名称，不是本 Skill API。
  await hostSendAttachment(result.artifact.viewer);
}
```

无准备适配器也可用 `createOfflineModule({dataDir})` 管理、导出和交付已有包。手机阅读只打开交付文件。

## 断网检查

保存到手机本地；关闭在线接收或聊天预览，启用飞行模式，从本地重新打开。确认正文、图片、评论、搜索和翻页；关闭重开检查位置恢复。若入口不允许保存进度，页面明确提示；换入口或移动文件可能改变存储范围。单文件无需解压，不依赖 Agent、服务器或小红书 App 在线运行。

Windows 浏览器验证、移动尺寸模拟与真实 iPhone/Android 验收分别记录，不能相互代替。Mac 能运行 Node 也不能推断手机本机 Agent 可运行当前真实内容工具。
