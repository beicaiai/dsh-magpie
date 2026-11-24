# dsh-magpie 版本说明

| | |
|---|---|
| 许可 | **AGPL-3.0-only**（全文见 [LICENSE](LICENSE)） |
| Web UI | 来自 **magpie**（MIT），逐文件拷贝，见 [THIRD-PARTY.md](THIRD-PARTY.md) |
| 宿主实现 | 演化自 **dsh-magpie-hub**（AGPL-3.0），原始版权归 **LingMowen** |

本文件记录本版相对上述宿主实现的**全部差异**，同时满足 AGPL 对「标明修改」的要求。原始版权与许可声明一律保留，未做任何删除。

---

## 修复（功能性，共 12 项）

### 1. 商店里装了插件，供应商列表永远不出现

- **现象**：商店点安装 → 提示成功 → 切到供应商页签看不见，刷新多少次都没用。
- **原因**：`marketInstall` 只有 `market.install(pkg, signal)` 一行 —— 只把文件放进 `node_modules`，**从不写 `plugins.json`**。而宿主只装载 `plugins.json` 里登记过的包，没登记 = 装了也不存在。
- **修法**：`src/index.js` 的 `marketInstall` 改成完整链路：装文件 → 剥版本号 → 按裸名判重 → 登记 → `reload()` → `refresh()`。登记失败不掩盖「文件已装好」这个事实，只跳过登记。

### 2. 传带版本的 spec 会被判成「市场里没有」

- **现象**：`market.install('@scope/x@latest')` 返回「市场里没有」，但裸名能装上。
- **原因**：市场清单里的 `package` 是裸名（`@scope/x`），页面可能传 `@scope/x@latest`，拿它比对清单必然失败，随后退回 npm 路线换一个误导性的 404。
- **修法**：`src/index.js` 与 `src/ui-api.js` 的安装入口都先过 `moduleNameOf()` 剥掉 `@version`。

### 3. 插件页「已安装」列表空白，底部挂一条 `not-implemented`

- **现象**：插件页签表头在、列表全空，页面下方一直飘 `not-implemented`。
- **原因**：`ui/plugins.js` 的 `installedRow` 读 `e.providers.length`，而 `plugins` 接口只回 `{spec, name}` → `e.providers` 是 `undefined` → 抛 `TypeError` → 整个 `fill()` 中断。每次切页签重绘一次，所以红字「一直在」。
- **修法**：两端都补 ——
  - `src/ui-api.js` 的 `plugins` handler 补全字段：`providers`（显示名）/ `providerIds` / `off` / `enabled` / `isMiddleware` / `middlewareOnly` / `moved` / `serves` / `clashes` / `tools` / `panels` / `actions` / `named`；
  - `ui/plugins.js` 三处 `e.providers.length` → `e.providers?.length`。

### 4. 卸载插件后，供应商还在列表里显示「异常 / 没有插件提供这个平台」

- **原因**：`src/host.js` 的 `assemble()` 从不重置 `this.config.provider`。插件卸载后它的 `config` 钩子不再跑，但上一轮的空壳还留在内存里，`providerIds()` 照样把它列出来。
- **修法**：`assemble` 开头重建 `this.config = { provider: {} }`（用户偏好由 `applyUserPrefs` 在 assemble 之后补回）；`src/index.js` 的 `buildSnapshot` 再过滤一遍「无 owner + 无账号 + 无模型」的幽灵条目。

### 5. 顶栏刷新按钮点了没反应

- **原因**：三处叠加
  1. 面板调的 `refresh` 不带 force，被 `REFRESH_MIN_MS`（2 秒）节流后**裸 return**，不报错也不重建，随后照样把旧快照返给前端；
  2. 只 refresh 不 reload：新装插件不被宿主装载，快照里永远看不到它；
  3. 没有任何结果反馈，用户分不清「刷了」和「坏了」。
- **修法**：`refresh` 默认 `force=true`；刷新链路改成「先 `reload()` 再 `refresh(true)`」；顶栏加 flash 气泡，成功显示「已刷新 · N 个供应商 · N 个账号 · N 个模型」，失败显示淡红错误条。

### 6. 面板不跟随深色模式

- **现象**：切到深色，外层顶栏变深，下面一整块面板还是白的。
- **原因**：面板是 `iframe`，`src` 写死 `/magpie-hub/`，主题只作用在外层容器的 `data-theme`。面板内 `ui/theme.js` 优先读 URL 的 `?theme=`，拿不到就跟随系统，系统是浅色 → 永远白。
- **修法**：`client/magpie-hub.js` 的 iframe `src` 改成 `/magpie-hub/?theme=" + theme`，并把 `theme` 加进 `useMemo` 依赖。代价是切主题时 iframe 重载、页签回首页 —— 切主题是主动动作，可接受。

### 7. 「添加供应商」里点任何一个都显示「登录未完成」

- **现象**：面板里点任意供应商，红字「登录未完成 / not-implemented」。
- **原因**：抽屉列的是原版 magpie 的 **CLI agent**（Claude / ChatGPT / Grok / Copilot / Cursor / Gemini CLI / Kiro / Zed…），走 `api("signin")`；而这个接口在本插件里根本没实现 → 501 → 前端把 `error` 字段直接显示出来。
- **修法**：
  - `src/ui.js` 的 `serveApi` 加**逐段回退**，`/api/signin/<id>` 与 `/api/signin/<id>/cancel` 能落到 `signin` handler；
  - 失败时把真实原因放进 `error` 字段（原来固定写 `'handler-failed'`，界面上只有这四个字）；
  - `src/ui-api.js` 的 `providers` handler 补 `plugins` 字段（原来是写死的空数组），把 hub 真正的供应商送进抽屉 → 点它走 `plugin-signin`；
  - 新增 `plugin-signin` / `plugin-signin/prompt` / `signin` 三个 handler，映射到宿主真实的 `startSignIn` / `finishSignIn`。
- **注意**：`session.warm` 是**预热**（无 url 的登录方式提前把本机应用拉起来），不是完成信号。拿它当结果会立刻抛「登录没有完成」，必须等 `callback(code)`。

### 8. 插件包下载在国内几乎不可用

- **现象**：商店点安装，转十几分钟，最后报 `HTTP 403`。
- **原因**：走整仓 tarball（压缩 10.8 MB / 解开 30.9 MB）。实测直连 `codeload.github.com` 前 200 KB 要 7 秒（≈28 KB/s），30 MB 需要一千秒以上；而 `fetchTo` 只保留**最后一个源**的错误，前几个超时、最后一个 403，于是永远显示 `HTTP 403`，看起来像 GitHub 拒绝。
- **修法**：
  - 改成 **GitHub Contents API 递归列目录 + 逐文件下载**（`downloadSubtree`），单文件三源兜底（jsDelivr → raw → gh-proxy），每个源两轮尝试，模块级记住上次成功的源；
  - **串行下载**而不是 `Promise.all` —— 并发 10 个 TLS 握手会把本机网络打崩，全部回报 `fetch failed`；
  - tarball 只作兜底（目录 404 时）；
  - 源顺序改成 gh-proxy 前置、超时 120 s → 360 s、加 `User-Agent`、错误汇总所有源的原因。
- **实测**：copilot 包从 741 s 失败 → **36.5 s / 10 文件**成功。

### 9. 刷新气泡把 ⟳ 与 ☾ 两个按钮从右上角挤到中间

- **原因**：右推规则是 `.mg-brand-sub + .mg-icon-btn { margin-left: auto }`，**相邻选择器只匹配紧邻元素**。刷新气泡插在中间后失配。
- **修法**：补三条规则 —— 气泡自己吃 `margin-left: auto`，气泡之后的第一个按钮给 `margin-left: 8px`，按钮之间 `margin-left: 6px`。

### 10. 界面语言只能跟随宿主，没法自己切

- **现象**：面板本身是双语的（`t(locale, zh, en)`），但 `locale` 只从宿主 `props` 来，用户想用英文（或想从英文切回中文）没有入口。
- **修法**：顶栏 ⟳ / ☾ 后面加第三颗按钮，中文界面显示 `EN`、英文界面显示 `中`，点一下切换并写进 `localStorage.magpie-hub-locale`，下次打开还是这个语言。按钮沿用同一套液态玻璃样式，只把 `width` 放开、字号降到 10.5px、字重提到 700。

### 11. 插件写的英文提示原样显示在中文界面上

- **现象**：点 CODEARTS 的「登录」，卡片下方黄条是 `Sign in to Huawei Cloud in the browser. This signs in CodeArts only — ...`。这句话是 `opencode-codearts-auth/index.mjs:4716` 硬编码的，hub 拿到的只是字符串，翻译不了语义。
- **修法**：`instructions` 只作为**英文界面**的文案；**中文界面**用我们自己的模板「已打开登录页，登录完回到这里点『我已完成』」。没给 `instructions` 时也走同一套兜底。

### 12. 华为云系登录后浏览器停在「无法访问此页面」

- **现象**：CodeArts / OfficeAce 点登录 → 华为云登录成功 → 浏览器跳到 `http://127.0.0.1/oauth/callback?secret=...` → `ERR_CONNECTION_REFUSED`，插件在它自己的端口上永远等不到授权码。
- **根因**：这两个 provider 的回调不走标准 `redirect_uri`，而是 `uri_scheme=codearts-agent&port=<随机高位端口>`，等于假设本机装了 CodeArts IDE、由它注册的 `codearts-agent://` 协议处理器接住回跳。浏览器里没有那个处理器时，华为云退化成打开 `http://127.0.0.1/oauth/callback` —— **端口丢了（落到 80）**，参数名也从 `code` 变成了 `secret`，而插件的回调只认 `code`（`index.mjs:911`）。两个问题叠加，登录 100% 卡死。
- **修法**：新增 `src/callback-relay.js`，**把本机 80 端口接管过来当回跳中继**：
  - `armRelay(authUrl)` 从 authorize 地址里（本机层，或国际站塞进 `service` 参数的那一层）读出插件真正监听的 `port`，然后在 `127.0.0.1:80` 起一个只认 `/oauth/callback` 的监听；
  - 收到回跳后把 `secret` **改名成 `code`**，连同其余参数一起转发到 `127.0.0.1:<port>/oauth/callback`，上游的 status 与 header 原样写回浏览器；
  - 插件算 `redirect_uri` 用的是 `request.socket.localPort`，转发过去之后仍然是它自己的端口，与授权时发给华为云的 `port` 完全一致 —— **token 交换不会因 `redirect_uri` 不匹配被拒**；
  - 80 被占用、端口解析失败、插件没起来时一律回 `{ armed: false, reason }`，**绝不让这一步影响登录本身**（面板会退回原来的警告文案）。
- **接线**：`src/rpc.js` 的 `auth.signIn` 与 `src/ui-api.js` 的 `plugin-signin` 拿到 `url` 后都调 `armRelay`，结果里带 `relayed` / `relayNote`；`client/magpie-hub.js` 的 `start` 读 `out.relayed`，成功时把黄条换成「✓ 回跳已自动接管（本机 80 端口 → 插件监听端口），浏览器跳回来后无需任何操作」。
- **实测**（`C:\WINDOWS\TEMP\relay-test.mjs`）：假插件监听 11531 → `armRelay` 返回 `{"armed":true,"port":80,"target":11531}` → 打 `http://127.0.0.1:80/oauth/callback?secret=DEADBEEF1234` → 假插件收到的 query 是 `{"redirect":"...","code":"DEADBEEF1234"}` 且 `localPort=11531`，浏览器拿到 200 + 插件原文；打非回调路径回 404。
- **另外 13 个 provider 不经过 80 端口、不受影响**：`qwenwork` 用 `qwenwork-cn://` 自定义协议、`raccoon` 用 `desktop_callback=loopback&redirect=http://127.0.0.1:63842/auth/callback`、`joycode` 用 `authPort=63841`、`qoder` / `github-copilot` 走 device code 轮询、`agnes` / `doubao-work` / `loomy` 走本机应用窗口。

---

## 界面（桌面面板）

### 卸载：自绘玻璃确认浮层

原生 `confirm()` 换成自绘弹层：`blur(28px) saturate(190%)` + 五层阴影 + 18px 圆角，浅/深两套；遮罩 `radial-gradient` + `blur(9px)`。只有「取消 / 卸载」两个按钮，点遮罩即关。

### 卸载按钮位置

从卡片头部（红色，和登录按钮并列）移到「调整」展开区、**「停用此供应商」之前**，降为 ghost 样式。理由：停用可逆且常用，卸载破坏性且低频，两个都留、卸载靠左且弱化。

### 商店页重写

原来复用账号卡结构（又方又空）。新的独立版式：搜索框（内凹液态玻璃）+ 刷新按钮 + 结果通知条 + 计数行 + 卡片列表（彩色首字母方块图标、包名等宽、描述两行截断、右侧动作区）。

**已安装判定**：商店清单给裸名、`plugins.json` 可能存带版本形式，所以比对前先 `norm()` 剥 `@version` 与 scope。已装 → 绿边 + 「已安装」徽章 + 「重装」；安装中 → 转圈；否则「安装」。

### 液态玻璃按钮族

`.mg-btn-ghost` / `.mg-btn-accent` / `.mg-btn-on` / `.mg-btn-mini` 统一改成玻璃白渐变 + 内高光 + `backdrop-filter`，`:active` 内凹。

### 模型勾选改绿

勾选框淡绿底 + 深绿勾（`#10855a`），**卡片底色保持中性**——不做整块泛绿。选绿不选红：红色在本面板已被「删除账号」「停用供应商」占住语义。

### 打码改为按供应商独立

去掉顶栏全局打码按钮，每个供应商卡片自己的锁按钮控制自己的账号。

### 搜索框去紫

focus 态从 `var(--accent)` 改成中性环，符合内凹液态玻璃的观感。

---

## 刻意不改的部分

以下标识**保留原名**，改了只会引入 bug：

| 项 | 值 | 原因 |
|---|---|---|
| UI 挂载点 | `MOUNT = '/magpie-hub'` | `ui/app.js` 里 10+ 处 `/magpie-hub/api/` 硬编码 `fetch` |
| RPC 端点 | `MAGPIE_HUB_ENDPOINT = 'magpie-hub'`（`/api/magpie-hub`） | 客户端与服务端共用常量，改就要同步两处且无收益 |
| 客户端 ENDPOINT | `var ENDPOINT = "magpie-hub"` | 与上一行必须一致 |
| localStorage 键 | `magpie-hub-theme` / `magpie-hub-mask` / `magpie-hub-mask-map` | 改了会丢掉用户已存的偏好 |

这些都是**内部标识**，用户看到的是包名 `dsh-magpie`。
