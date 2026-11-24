# dsh-magpie

在 **DeepSeek Harness（DSH）进程内**直接运行 magpie 的供应商插件：登录、列模型、转发请求、看额度、签到、装插件。桌面与手机共用同一份数据。

**不需要安装 magpie 桌面程序**——本插件读写的正是 magpie 自己的数据目录（`~/.config/magpie`），所以装过的插件、登录过的账号直接继承。

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%5E22.19.0%20%7C%7C%20%3E%3D24.0.0-brightgreen.svg)](https://nodejs.org)
[![Providers](https://img.shields.io/badge/providers-51-orange.svg)](PROVIDERS.md)
[![Login methods](https://img.shields.io/badge/login%20methods-101-orange.svg)](PROVIDERS.md)

| | |
|---|---|
| 版本 | 0.3.0 |
| 运行环境 | Node `^22.19.0 \|\| >=24.0.0` |
| 形态 | 纯 ESM，无可编译步骤 |
| 许可 | AGPL-3.0-only |

> **默认零供应商**。装完本插件只是搭好宿主，供应商要靠「商店」或手输包名一个个装——这是设计，不是缺陷。

---

## 一句话

magpie 的价值在**插件生态**——一批国内外 AI 平台各自提供了供应商插件。那些插件是普通 ESM 模块，导出一个函数、返回一组钩子；本插件在 DSH 里实现这些钩子的宿主，于是**为 magpie 写的插件不改一行就能在 DSH 里用**。

装完之后：面板里点「安装」→ 选一个供应商 → 点「登录」→ 弹出一个专用登录小窗 → 授权完关掉 → 它的模型就出现在 DSH 的模型选择器里。

---

## 支持的供应商

实测 **51 个 provider、101 种登录方式**（完整逐条列表见 [PROVIDERS.md](PROVIDERS.md)）：

| 形态 | 条数 | 交互 |
|---|---|---|
| 网页登录 | 19 | 弹登录窗，登录完关掉 |
| 网页登录 + 本机回调 | 11 | 弹登录窗，授权后自动回跳到本机端口 |
| 设备码 | 7 | 弹登录窗显示一个短码，粘回页面确认 |
| 需要先填参数 | 12 | 先填企业域名 / 用户名，再弹窗 |
| 本机凭据 / 手工填 Key | 52 | 不弹窗，直接读本机客户端或在面板里粘 Key |

少数名字（不止这些）：

<p>
<img src="ui/icons/anthropic.svg" width="28" height="28" alt="Anthropic" title="Anthropic">&nbsp;
<img src="ui/icons/claude-color.svg" width="28" height="28" alt="Claude" title="Claude">&nbsp;
<img src="ui/icons/codex-color.svg" width="28" height="28" alt="Codex" title="Codex">&nbsp;
<img src="ui/icons/gemini-color.svg" width="28" height="28" alt="Gemini" title="Gemini">&nbsp;
<img src="ui/icons/qwen-color.svg" width="28" height="28" alt="Qwen" title="Qwen">&nbsp;
<img src="ui/icons/deepseek-color.svg" width="28" height="28" alt="DeepSeek" title="DeepSeek">&nbsp;
<img src="ui/icons/chatglm-color.svg" width="28" height="28" alt="GLM" title="GLM">&nbsp;
<img src="ui/icons/baichuan-color.svg" width="28" height="28" alt="Baichuan" title="Baichuan">&nbsp;
<img src="ui/icons/minimax-color.svg" width="28" height="28" alt="MiniMax" title="MiniMax">&nbsp;
<img src="ui/icons/moonshot.svg" width="28" height="28" alt="Moonshot" title="Moonshot">&nbsp;
<img src="ui/icons/stepfun-color.svg" width="28" height="28" alt="StepFun" title="StepFun">&nbsp;
<img src="ui/icons/hunyuan-color.svg" width="28" height="28" alt="Hunyuan" title="Hunyuan">&nbsp;
<img src="ui/icons/aws.svg" width="28" height="28" alt="AWS" title="AWS Bedrock">&nbsp;
<img src="ui/icons/azureai-color.svg" width="28" height="28" alt="Azure" title="Azure AI">&nbsp;
<img src="ui/icons/cloudflare-color.svg" width="28" height="28" alt="Cloudflare" title="Cloudflare Workers AI">&nbsp;
<img src="ui/icons/openrouter.svg" width="28" height="28" alt="OpenRouter" title="OpenRouter">&nbsp;
<img src="ui/icons/cerebras.svg" width="28" height="28" alt="Cerebras" title="Cerebras">&nbsp;
<img src="ui/icons/groq.svg" width="28" height="28" alt="Groq" title="Groq">&nbsp;
<img src="ui/icons/together-color.svg" width="28" height="28" alt="Together" title="Together">&nbsp;
<img src="ui/icons/atomcode.png" width="28" height="28" alt="AtomCode" title="AtomCode">&nbsp;
<img src="ui/icons/cline.svg" width="28" height="28" alt="Cline" title="Cline">&nbsp;
<img src="ui/icons/trae.svg" width="28" height="28" alt="Trae" title="Trae">&nbsp;
<img src="ui/icons/qoder.svg" width="28" height="28" alt="Qoder" title="Qoder">&nbsp;
<img src="ui/icons/codebuddy-color.svg" width="28" height="28" alt="CodeBuddy" title="CodeBuddy">
</p>

`ui/icons/` 下有 **194 个**供应商图标，全部随仓库分发。

---

## 安装

### 1. 克隆

```sh
git clone https://github.com/<你的用户名>/dsh-magpie.git
```

### 2. 装进 DSH profile

```sh
cd ~/.dsh/profiles/desktop     # web profile 就换成 profiles/web
npm i /绝对路径/dsh-magpie
```

### 3. 加进 bundle 列表

编辑 profile 的 `package.json`：

```json
{
  "dependencies": { "dsh-magpie": "file:/绝对路径/dsh-magpie" },
  "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "dsh-magpie"] } }
}
```

### 4. 重启 DSH

- **桌面端**：左侧栏出现「插件」页，`/magpie-hub/` 托管 magpie Web UI；
- **手机端**：全部功能 → 插件 → **Magpie** 卡片打开原生面板。

> `/magpie-hub/` 是**内部路由前缀**（历史命名）不是包名，包名是 `dsh-magpie`。

### 5. 装第一个供应商

打开 magpie 面板 → **插件** → **商店** → 选一个 → **安装** → 回到 **平台** → **登录**。

---

## 登录窗

登录页不是嵌在面板里，而是拉起一个**独立的应用窗口**（Chromium 的 `--app` 模式）：

- 没有地址栏、没有标签页、没有书签栏，看起来就是一个登录框；
- 固定 **540×820**，屏幕居中；
- 用单独的 `user-data-dir`（`%TEMP%\magpie-login-profile`），**不动你日常浏览器的配置、扩展和登录态**；
- 授权完成、窗口里显示结果后直接关掉即可。

浏览器顺序 **Chrome → Edge → 系统默认浏览器**，前两个都没装才退到最后一级。

> 点名 Chromium 系是有原因的：部分平台（例如华为云码道）在 Edge 下会判定授权不可用、
> 只回 `secret` 不回 `code`，换成 Chrome 就正常。这个现象在 2026-11 实测复现过多次。

---

## 商店安装

第一次从商店装插件时，会先把整仓 tarball（约 12 MB）拉下来解成一个本地镜像，
存到 `<数据根>/.mirror/repo`，这一步**十几秒**；之后 100 多个插件全部本地命中，
点安装基本**毫秒级**完成。镜像六小时过期，过期后下一次安装会静默刷新一次。

实测（同一台机器）：

```
建镜像（13.65 MB tarball + 解包）    4.7 s
首个插件                          1.4 s
连装 8 个                         217 ms   （平均 27 ms/个）
镜像命中                             0 ms
```

网络层自己实现，**自动跟系统代理走**（读 `HKCU\...\Internet Settings` 的 `ProxyEnable` / `ProxyServer`），
不写死端口、不要求你设环境变量。Clash 开着关着、换端口，都不影响。

CDN 顺序：`gcore.jsdelivr.net` → `fastly` → `cdn` → `gh-proxy` → `codeload` 整仓。

---

## 数据从哪来

本插件不自己造数据，读的是 magpie 的目录。按顺序找，**目录里真有 magpie 文件才算命中**：

1. `MAGPIE_HUB_ROOT`
2. `$XDG_CONFIG_HOME/magpie`
3. `<USERPROFILE|HOME>/.config/magpie`
4. `<DSH_HOME>/magpie`
5. `<DSH_HOME>`
6. `<HOME>/.dsh/magpie`、`<HOME>/.dsh`

全都没有时建在 `<DSH_HOME>/magpie`。插件装在 `<数据根>/plugins/node_modules/`。

| 文件 | 用途 |
|---|---|
| `plugins.json` | 已装插件 spec 列表（**只有登记过的才会被装载**） |
| `plugin-providers.json` | 供应商与登录方式 |
| `plugin-auth.json` | 登录态 |
| `usage.jsonl` | 请求记录（算用量） |
| `hub-settings.json` | 本插件自己的设置（显示偏好、仓库密钥） |

---

## 手机端面板

五个自绘页签（不用 App 的页签控件——它会按宽度折行）：

| 页签 | 内容 |
|---|---|
| **平台** | 每个平台一张卡片（账号数、模型数、登录态、剩余额度），点开进详情；顶部搜索框 |
| **额度** | 按账号列额度窗口（剩余条 + 到期时间），拿不到的显示原因而不是原始报错 |
| **用量** | Token / 请求数 / 费用 / 缓存命中率 + 按平台明细 + 请求流水 |
| **插件** | 已装插件（点进配置页）、检查更新、可安装列表（商店）、手输包名安装 |
| **设置** | 显示偏好、模型列表排法、仓库密钥、这次扫描的结果（排障用） |

面板还占用了两个原生位置：

- **输入框上方的状态条**：`灵犀 · 剩 2,299`（当前平台 + 剩余额度），可在设置里关掉；
- **每回合的脚注**：`12K`（这一回合消耗的 token 或额度），可在设置里关掉或切换内容。

> 脚注必须短（App 的降级链是「放不下就整条丢弃」，不会缩略），所以只写纯 ASCII 的数量。

---

## 桌面端

`/magpie-hub/` 托管 magpie 的 Web UI（`ui/` 目录），配合 `src/ui-api.js` 的后端适配层工作。页面结构、配色、i18n 保持原样，本仓库只补后端接口。

**顶栏右上角的 ⟳ 是全局刷新**：重扫插件目录 → 重建快照 → 所有页签一起更新（商店页也会重拉「已安装」状态）。
**商店页自己的刷新只管商店**：重拉插件清单 + 已装状态，用来确认「刚装的到底登记上没有」。

**顶栏第三颗按钮是界面语言**：中文界面显示 `EN`、英文界面显示 `中`，点一下切换，写进 `localStorage.magpie-hub-locale`，下次打开还是这个语言。不点就跟随宿主。

> 截图：`docs/screenshots/` 目录留给你放实际界面图（平台页 / 额度页 / 商店页 / 登录窗）。
> 本仓库不预置截图，避免与将来版本不一致。

---

## 结构

```
dsh-magpie/
├── package.json         两份清单：dsh.bundle（桌面）+ dshGo（手机）
├── cordis.patch.yml     把本包挂进 DSH
├── src/                 纯 ESM JavaScript，无编译步骤
│   ├── index.js         入口：装载 → 注册路由 → 面板 → 状态条/脚注
│   ├── panel.js         手机端视图 + 数据（纯函数，可独立测）
│   ├── protocols.js     三套 SDK 协议：OpenAI 兼容 / Anthropic / Gemini
│   ├── market.js        插件市场：清单 + 本地镜像 + 安装
│   ├── net.js           网络层：系统代理感知、CDN 多源、CONNECT 隧道
│   ├── callback-relay.js 回跳中继（按需接管本机 80 端口）
│   ├── rpc.js           桌面端管理 API（含登录窗拉起）
│   ├── host.js          钩子编排（登录/续期/loader/models/usage/checkin）
│   ├── ui-api.js        桌面面板的后端接口适配
│   ├── adapter.js       DSH LlmAdapter：stream / listModels
│   ├── runtime.js       插件加载（入口解析、函数身份去重）
│   ├── store.js         数据文件读写（原子写、登录记录）
│   ├── state.js         面板策略：模型开关、平台启停、隐藏账号、路由
│   ├── ui.js            托管 Web UI
│   ├── surfaces.js      状态条与脚注的文案（纯函数）
│   ├── hotreload.js     插件目录热重载
│   ├── deadline.js      给可选数据加硬性超时上限
│   ├── types.js         钩子契约的类型面
│   └── scope.js         账号作用域
├── client/              桌面客户端 UI
├── ui/                  Web UI 静态资源（含 194 个供应商图标）
├── selfcheck.mjs        逐供应商自检（实跑每个插件的 authorize()）
├── PROVIDERS.md         51 个供应商 × 101 种登录方式的实测表
└── NOTICE.md            本版说明（改了什么、为什么）
```

**为什么是纯 ESM**：`package.json` 的 `main` 直接指 `src/index.js`，没有编译中间层。

---

## 模型注册

```js
ctx.llm.registerAdapter(providers, adapter)   // 一次把全部 provider 交给一个适配器
```

- 每个 provider 各自成为模型选择器里的一条路由；
- 名字来自插件的 `config().name`（插件自己声明的显示名）；
- **整批注册被别的插件占用时会退化成逐个注册**：`registerAdapter` 是整批语义，列表里只要有一个 provider 已被别的插件占用，整批都会失败，而错误又被当成正常竞态吞掉。本插件捕获这种错误后逐个注册，被占用的跳过、其余接上；
- **适配器自己解析平台**：DSH 传给 `stream()` 的模型 id 是裸名（`deepseek-v4.1-flash`，不带平台前缀），所以适配器要反查「哪个平台声明了这个模型」，否则会拿到空 loader、请求退化成不带凭据的直连。

---

## 自检

```sh
npm test                # 13 个核心文件的 node --check 链
node selfcheck.mjs      # 逐供应商实跑 authorize()，输出每个 provider 的登录方式
```

`selfcheck.mjs` 只调「拿地址」的入口，不点「我已完成」——**不会改任何状态**。
最近一次结果：**51 个 provider / 101 条登录方式**，明细见 [PROVIDERS.md](PROVIDERS.md)。

---

## 已知边界

- **git spec 不会自动安装**（`https://github.com/xxx/yyy` 这类写进 `plugins.json` 的）：magpie 用 bun 装，本插件不代劳，面板会提示「没有找到插件目录」。
- **面板里的 `hub-*` 这类 provider** 来自某个供应商插件自己声明的集合，不是本仓库重复实现。
- **签到**依赖插件声明的 `auth.checkin`；没声明就没有签到入口。
- **Windows DPAPI 凭据不能跨系统**：桌面 magpie 用 Windows DPAPI 加密部分凭据，拷到安卓/Linux 解不开。这种情况面板会给出「请在手机上重新登录一次」，而不是抛原始报错。
- **手机端回合号是近似值**：App 不向插件暴露「第几回合」，本插件按会话内的调用次数累加，多对话并行时会串号。
- **华为云码道 / OfficeAce 要靠 80 端口中继**：这两个 provider 的回跳不是标准 `redirect_uri`，而是 `uri_scheme=<client>&port=<随机高位端口>`；华为云回跳时会把端口丢掉（落到 80）。本插件用 `src/callback-relay.js` 把 `127.0.0.1:80` 接管成中继，按 authorize 里给的 `port` 转发。**80 端口如果被 IIS / 其它 web 服务占着就接管不了**，这时面板会提示改用粘贴 Token。
- **个别平台只在 Chrome 下正常**：见上面「登录窗」一节。
- **`gateway-*` 一类插件不是供应商**：它们是网关服务，没有 auth 钩子，装上也不会出现在平台列表里。

---

## 授权与来源

本仓库使用 **GNU Affero General Public License v3.0**（AGPL-3.0，全文见 [LICENSE](LICENSE)）。简单说：你可以自由使用、修改、分发，但**分发或作为网络服务提供时必须同样以 AGPL-3.0 开源**。

它**建立在别人的工作之上**，完整清单见 [THIRD-PARTY.md](THIRD-PARTY.md)：

- **magpie**（MIT）—— 插件协议、数据格式、`ui/` 下的 Web UI 与图标；
- **DeepSeek Harness**（`@deepseek-ai/*`）—— 宿主运行时与扩展点；
- **dsh-Go** —— 手机端原生插件协议（`panels` / `composer.strip` / `turn.note`）；
- **dsh-magpie-hub 0.2.0**（AGPL-3.0）—— 本版的宿主实现演化自该项目，原始版权归 **LingMowen**。

本仓库与上述项目的作者没有隶属关系，也未经他们背书。

---

## 变更记录

见 [CHANGELOG.md](CHANGELOG.md)。0.3.0 的主要变化：

| 项 | 变化 |
|---|---|
| 登录窗 | 专用 Chromium 应用窗口（`--app` + 独立 `--user-data-dir`），Chrome → Edge → 默认浏览器 |
| 商店安装 | 本地整仓镜像，首次十几秒，之后每个插件毫秒级（原来单包 234 秒） |
| 网络 | 代理感知，自动跟系统代理走，不写死端口 |
| CDN | `gcore.jsdelivr.net` 优先 |
| 华为云码道 | `redirect` 跟跳 / POST 回调 / 补 `plugin-name` 头 / 回调等 300 秒 |
| 回跳中继 | 不再依赖 `uri_scheme` 判端口，只认 `port` 参数 |

---

## 发布到自己的仓库

`package.json` 里的 `homepage` / `repository` / `bugs` 是占位 `YOUR_GITHUB_NAME`，推之前换掉：

```sh
sed -i 's/YOUR_GITHUB_NAME/<你的用户名>/g' package.json README.md
```

然后：

```sh
git init
git add .
git commit -m "dsh-magpie 0.3.0"
git branch -M main
git remote add origin https://github.com/<你的用户名>/dsh-magpie.git
git push -u origin main
```
