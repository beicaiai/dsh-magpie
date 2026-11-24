# 变更记录

## 当前

### 登录

- `open.external` 改成**专用 Chromium 应用窗口**（`--app=` + 独立 `--user-data-dir`）：
  没有地址栏、没有标签页，就是一个登录框；登完直接关掉，不污染日常浏览器的配置和登录态。
  打开顺序：Chrome → Edge → 系统默认浏览器，一个都找不到才降级，绝不吞掉登录。
  原因：实测华为云 CodeArts 在 Edge 下回 `authorizationAvailable=false`、只给 `secret` 不给 `code`，
  浏览器在 Chrome 下才正常返回授权码。

### 商店安装

- 新增**本地整仓镜像**（`<数据目录>/.mirror/repo`）：整仓 tarball 下一次、解开缓存，
  之后所有插件的安装都是本地拷贝（毫秒级）。之前走 GitHub Contents API 逐文件拉，单包实测 234 秒。
- 下载链路改为**代理感知**（`src/net.js`）：运行时读系统代理设置，
  Clash 开不开、端口换成什么都不影响。
- CDN 首选换成 `gcore.jsdelivr.net`（实测唯一稳定可用的 jsDelivr 节点）。
- 修复 `fetchTo` 用 `Readable.fromWeb()` 消费 duck-typed Response 导致的
  `The "readableStream" argument must be an instance of ReadableStream` —— 之前所有 tarball 源全灭的真因。

### 华为云码道（CodeArts）

- 回调支持 `?redirect=` 跟跳，以及 POST 回传 `code`。
- 换 token 时补 `plugin-name` / `plugin-version` 头。
- 回调等待 180 秒 → 300 秒。
- 登录方式只保留国内站一条（原来那条「国际版」其实是华为云企业账号登录页）。

### 修复

- `auth.signInFinish`：会话已超时但账号已经存下来时不再报错，直接当成功返回。
- 业务错误补上 `details` 字段，面板不再显示 `connection: invalid server-response failure`。
- 卸载插件后面板即时刷新，不再残留幽灵供应商。
- 插件登录方式为空时按钮不再消失。
