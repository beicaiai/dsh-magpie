# 供应商登录方式实测表

生成方式：用本仓库自己的 `loadPlugin`（`src/runtime.js`）加载市场里全部
45 个 `*-auth` 包，对每个 provider 的每个 `methods[i].authorize({})` 取返回值。

- **provider 合计 51 个，登录方式 101 条**
- 形态分布：本机凭据 / 手工填 Key 52 ｜ 网页登录 19 ｜ 网页登录 + 本机回调 11 ｜ 需要先填参数 12 ｜ 设备码（浏览器里输验证码） 7

会真的拉起浏览器窗口的（前三类，共 37 条）全部是 `https://` 地址，
所以都走同一个"专用应用窗口"（Chromium `--app`，无地址栏、独立 profile）。

> 「本机凭据 / 手工填 Key」这一类不弹浏览器：它读本机已装客户端的登录态，
> 或者直接在面板里给一个输入框让你填 Key。

---

| provider | 登录方式 | 形态 | 窗口 |
|---|---|---|---|
| `agnes` | Agnes browser sign-in (plan key) | 本机凭据 / 手工填 Key | — |
| `agnes` | Agnes browser sign-in (personal key) | 本机凭据 / 手工填 Key | — |
| `agnes` | Agnes browser sign-in (enterprise key) | 本机凭据 / 手工填 Key | — |
| `agnes` | Agnes API key | 本机凭据 / 手工填 Key | — |
| `agnes-code` | 读取 Agnes Code 桌面端登录态 | 网页登录 | 应用窗口 |
| `agnes-code` | 粘贴 accessToken | 本机凭据 / 手工填 Key | — |
| `astudio` | 浏览器登录（推荐，可多账号） | 本机凭据 / 手工填 Key | — |
| `astudio` | 读取 AStudio 桌面端登录态 | 网页登录 | 应用窗口 |
| `astudio` | 粘贴 modelBearerToken | 本机凭据 / 手工填 Key | — |
| `atomcode` | AtomGit 登录（浏览器） | 网页登录 | 应用窗口 |
| `atomcode` | 使用本机 AtomCode 登录 | 本机凭据 / 手工填 Key | — |
| `autoclaw` | AutoClaw 网页登录（Google / z.ai） | 网页登录 + 本机回调 | 应用窗口 |
| `autoclaw-cn` | AutoClaw 手机验证码登录（国内） | 需要先填参数 | — |
| `catpaw` | 网页登录（妙手官方授权页，Web sign-in） | 网页登录 + 本机回调 | 应用窗口 |
| `catpaw` | 妙手桌面端登录态（CatPaw desktop sign-in） | 本机凭据 / 手工填 Key | — |
| `catpaw` | 手动粘贴 token（Paste token） | 本机凭据 / 手工填 Key | — |
| `cline` | Sign in to Cline (browser) | 设备码（浏览器里输验证码） | 应用窗口 |
| `cline` | Cline API key (app.cline.bot → Setting | 本机凭据 / 手工填 Key | — |
| `cloudflare-workers-ai` | Cloudflare API Token (requires Workers | 本机凭据 / 手工填 Key | — |
| `codearts` | Sign in with Huawei Cloud | 网页登录 | 应用窗口 |
| `codearts` | Sign in with Huawei Cloud (Internation | 网页登录 | 应用窗口 |
| `commandcode-plan` | Command Code (browser) | 网页登录 + 本机回调 | 应用窗口 |
| `commandcode-plan` | Command Code CLI's sign-in | 本机凭据 / 手工填 Key | — |
| `commandcode-plan` | API key (commandcode.ai/settings/keys) | 本机凭据 / 手工填 Key | — |
| `cursor` | Cursor (browser) | 网页登录 | 应用窗口 |
| `cursor` | cursor-agent's sign-in | 本机凭据 / 手工填 Key | — |
| `cursor` | Cursor API key (cursor.com/dashboard → | 本机凭据 / 手工填 Key | — |
| `devin` | Devin (browser) | 网页登录 + 本机回调 | 应用窗口 |
| `devin` | Devin CLI's sign-in | 本机凭据 / 手工填 Key | — |
| `devin` | Devin API key (cog_…) | 本机凭据 / 手工填 Key | — |
| `doubao-work` | 在豆包窗口中登录 | 本机凭据 / 手工填 Key | — |
| `factory` | Sign in with Factory (device code) | 设备码（浏览器里输验证码） | 应用窗口 |
| `factory` | Factory API key (fk-…) | 本机凭据 / 手工填 Key | — |
| `gcp-ai` | Google Cloud ADC / gcloud account (Chr | 本机凭据 / 手工填 Key | — |
| `gemini-web` | 在单独的浏览器窗口登录 Google 账号 | 本机凭据 / 手工填 Key | — |
| `gemini-web` | 不登录使用 | 本机凭据 / 手工填 Key | — |
| `github-copilot` | Login with GitHub Copilot | 设备码（浏览器里输验证码） | 应用窗口 |
| `grok` | Sign in with Grok Build (device code) | 需要先填参数 | — |
| `grok` | Use Grok Build's current sign-in | 需要先填参数 | — |
| `grok` | Import CPA Grok account JSON | 需要先填参数 | — |
| `gumloop` | Gumloop API key | 本机凭据 / 手工填 Key | — |
| `intern-inkstone` | Browser sign-in (ink credits + creates | 本机凭据 / 手工填 Key | — |
| `intern-inkstone` | Browser sign-in + reuse an existing AP | 本机凭据 / 手工填 Key | — |
| `intern-inkstone` | API key only (models, no ink-credit ca | 本机凭据 / 手工填 Key | — |
| `intern-inkstone` | API key + console token (models + ink- | 本机凭据 / 手工填 Key | — |
| `joycode` | 浏览器登录（京东账号） | 网页登录 | 应用窗口 |
| `joycode` | JoyCode ptKey | 本机凭据 / 手工填 Key | — |
| `kimi-work` | 使用本机 Kimi Work 登录 | 本机凭据 / 手工填 Key | — |
| `kiro` | Kiro (Google, GitHub, AWS Builder ID,  | 网页登录 + 本机回调 | 应用窗口 |
| `kiro` | Kiro CLI's or Kiro IDE's sign-in | 本机凭据 / 手工填 Key | — |
| `kiro` | Kiro API key (ksk_…) | 本机凭据 / 手工填 Key | — |
| `loomy` | 短信验证码登录（SMS sign-in） | 本机凭据 / 手工填 Key | — |
| `loomy` | 手动粘贴 session（Paste token） | 本机凭据 / 手工填 Key | — |
| `mclaw` | 浏览器登录（登录一次，凭证全自动） | 本机凭据 / 手工填 Key | — |
| `mimo-app` | Xiaomi account | 网页登录 | 应用窗口 |
| `minimax-code` | MiniMax Code account | 网页登录 | 应用窗口 |
| `minimax-code-global` | MiniMax Code (Global) account | 网页登录 | 应用窗口 |
| `nous-portal` | Nous Portal (device code) | 网页登录 | 应用窗口 |
| `officeace` | Sign in with Huawei Cloud | 网页登录 | 应用窗口 |
| `openai-decisions` | OpenAI API key | 本机凭据 / 手工填 Key | — |
| `opencode-zen-free` | Zen 免费访问（密钥填 public；自己的 OpenCode Key 请 | 本机凭据 / 手工填 Key | — |
| `opendesign` | Open Design account | 设备码（浏览器里输验证码） | 应用窗口 |
| `opendesign` | Open Design API key | 本机凭据 / 手工填 Key | — |
| `orcaterm` | WeChat QR sign-in (recommended: smalle | 网页登录 + 本机回调 | 应用窗口 |
| `orcaterm` | Paste the OrcaTerm cookie pair (uin=…; | 本机凭据 / 手工填 Key | — |
| `qoder` | Sign in with Qoder | 设备码（浏览器里输验证码） | 应用窗口 |
| `qoder` | Sign in with Qoder PAT | 需要先填参数 | — |
| `qoder-cn` | Sign in with Qoder CN | 设备码（浏览器里输验证码） | 应用窗口 |
| `qoder-cn` | Sign in with Qoder CN PAT | 需要先填参数 | — |
| `qoder-cn` | Sign in with Qoder CN Enterprise (VPC) | 需要先填参数 | — |
| `qoder-cn` | Sign in with Qoder CN Enterprise dedic | 需要先填参数 | — |
| `qwenwork` | Sign in with QwenWork | 设备码（浏览器里输验证码） | 应用窗口 |
| `qwenwork-enterprise` | Sign in with QwenWork 企业版（输入企业域名） | 需要先填参数 | — |
| `raccoon` | 商汤小浣熊账号 (浏览器登录 / 自动返回) | 网页登录 + 本机回调 | 应用窗口 |
| `raccoon` | 商汤小浣熊桌面端登录态（读取本机客户端） | 本机凭据 / 手工填 Key | — |
| `raccoon` | 手动粘贴回调链接或 Token（非短信验证码） | 网页登录 | 应用窗口 |
| `river` | River API key | 本机凭据 / 手工填 Key | — |
| `sap-aicore` | SAP AI Core credential file | 本机凭据 / 手工填 Key | — |
| `sensenova-token-plan` | Browser sign-in (creates an API key) | 本机凭据 / 手工填 Key | — |
| `sensenova-token-plan` | Account password (headless fallback) | 需要先填参数 | — |
| `sensenova-token-plan` | API key only (models, no credit pools) | 本机凭据 / 手工填 Key | — |
| `tabbit` | Read the Tabbit app's sign-in (macOS) | 本机凭据 / 手工填 Key | — |
| `tabbit` | Paste Tabbit token (the browser's `tok | 本机凭据 / 手工填 Key | — |
| `trae-cn` | Trae CN account (browser) | 网页登录 + 本机回调 | 应用窗口 |
| `trae-cn` | Trae CN enterprise account (browser) | 网页登录 + 本机回调 | 应用窗口 |
| `trae-global` | Trae Global account (browser) | 网页登录 + 本机回调 | 应用窗口 |
| `trae-global` | Trae Global enterprise account (browse | 网页登录 + 本机回调 | 应用窗口 |
| `warp` | Use the Warp app's sign-in | 需要先填参数 | — |
| `warp` | Warp refresh token | 需要先填参数 | — |
| `workbuddy` | WorkBuddy account (browser) | 网页登录 | 应用窗口 |
| `workbuddy` | WorkBuddy desktop's sign-in | 本机凭据 / 手工填 Key | — |
| `workbuddy` | WorkBuddy API key | 本机凭据 / 手工填 Key | — |
| `workbuddy-ai` | WorkBuddy AI account (browser) | 网页登录 | 应用窗口 |
| `workbuddy-ai` | WorkBuddy AI desktop's sign-in | 本机凭据 / 手工填 Key | — |
| `workbuddy-ai` | WorkBuddy AI API key | 本机凭据 / 手工填 Key | — |
| `zcode` | ZCode: Z.ai GLM Coding Plan | 网页登录 | 应用窗口 |
| `zcode` | ZCode: BigModel (智谱) GLM Coding Plan | 网页登录 | 应用窗口 |
| `zcode` | ZCode: a team's GLM Coding Plan | 网页登录 | 应用窗口 |
| `zcode` | ZCode app's sign-in | 本机凭据 / 手工填 Key | — |
| `zcode` | GLM Coding Plan API key | 本机凭据 / 手工填 Key | — |
| `zed` | Sign in with Zed (browser) | 网页登录 | 应用窗口 |

---

## 怎么用

- **网页登录 / 网页登录 + 本机回调**：点「登录」，应用窗口弹出来，登录完窗口自己显示结果，关掉即可。
- **设备码**：应用窗口里会显示一个短码，粘到页面上确认。
- **需要先填参数**：面板会先让你填企业域名 / 用户名之类，再弹窗口。
- **本机凭据 / 手工填 Key**：不弹窗口，直接读本机客户端，或在面板里填 Key。

## 端点与回调

绝大多数插件把回调指到 `http://127.0.0.1:<端口>/`，端口由插件在 `authorize()` 时随机申请。
个别平台（华为云码道）会把结果投到 **80 端口**，所以宿主起了一个 80 端口的 relay，
把请求转给插件真正监听的端口——见 `src/callback-relay.js`。
