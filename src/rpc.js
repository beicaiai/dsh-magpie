/**
 * magpie-hub 的管理 API：服务端一侧。
 *
 * ## 这是给谁用的
 *
 * **桌面端（DSH Web 界面）** 的面板要读服务端状态（装了哪些 magpie 插件、每个
 * provider 登录了什么、额度、用量、路由），这走不了 `dshGo`（那是手机 App 的原生
 * 面板通道），于是走 DSH 自己的客户端↔服务端 RPC：
 *
 * ```
 * Client: connection.rpc.call('/api', 'magpie-hub', { method, payload })
 * Host:   connection.fetch.register({ path: '/api/magpie-hub', methods: ['POST'] })
 * ```
 *
 * ## 为什么端点是 `/api/magpie-hub` 而不是别的
 *
 * `/api/` 前缀下的路由会先过 DSH 自己的会话认证（只有登录了 Web 界面的人能打），
 * 等于白拿了一层鉴权。**不要**把这类端点挂到 `/dsh-go/` 之类自建前缀上。
 *
 * ## 信封格式（照抄 DSH 的 connection.rpc 约定）
 *
 * 请求 `{ type: 'client-request', rpcId, method, payload: { method, payload } }`
 * 响应 `{ type: 'server-response', rpcId, result }`
 * 失败一律包成 `{ ok: false, error: { code, message } }` 放在 `result` 里 ——
 * **不要**用 HTTP 4xx 表达业务错误：客户端 `rpc.call` 只看 `result.ok`，
 * HTTP 状态码会被它当成传输层故障。
 */
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { armRelay } from './callback-relay.js';
import { currentScope } from './scope.js';
/** 通道名（`/api/<这个名字>`）。 */
export const MAGPIE_HUB_ENDPOINT = 'magpie-hub';
/** 把结果包成 DSH 的 server-response。 */
function reply(rpcId, result) {
    return Response.json({ type: 'server-response', rpcId, result });
}
/** 包一个成功值。 */
function ok(value) {
    return { ok: true, value };
}
/** 包一个业务错误（不用 HTTP 状态码表达）。 */
function fail(code, message) {
    // DSH 的 connection 层会**校验** server-response 信封（见 app.asar 里的
    // parseConnectionResponse）：error.code / error.message 必须是 string，
    // error.details 必须是对象。少一个 details，客户端就把整条响应判成
    // `connection: invalid server-response failure`，真正的业务错误被完全盖掉 ——
    // 用户只看到一句莫名其妙的红字，看不到「登录已超时」这类原因。
    // 所以这里永远补齐三个字段，details 起码带上是哪个 code 出了问题。
    return {
        ok: false,
        error: { code: String(code), message: String(message), details: { code: String(code) } },
    };
}
/**
 * 注册 `/api/magpie-hub`。
 *
 * ## ⚠️ 必须走 `ctx.inject(['connection'], …)`
 *
 * `connection` 这个服务**只由 Web bundle（`dsh-client-connection`）提供**，
 * headless / CLI profile 里根本不存在。它也不在本插件的静态 `inject` 里
 * （声明了会让那些 profile 整个插件 pending，进而 profile 启动失败）。
 *
 * 所以取它的**唯一正确姿势**是与 codearts 相同的那一种：
 * ```js
 * ctx.inject(['connection'], (scoped) => { /* 在这里注册 *\/ })
 * ```
 * 直接把 `ctx.connection` 当属性读是拿不到的（cordis 未声明服务读取即抛，
 * 我先前用 try/catch 包了一层 → 静默 undefined → 端点从未注册 → 客户端
 * 一直 `transport failure for /api/magpie-hub HTTP 404`）。
 *
 * @param ctx DSH 上下文（要能用 `inject`）
 * @param deps 宿主依赖
 * @returns 注销函数（`ctx.effect` 用）；没有 `inject` 能力时返回 undefined
 */
export function registerMagpieHubApi(ctx, deps) {
    const withInject = ctx;
    if (typeof withInject.inject !== 'function') {
        deps.log('[magpie-hub] ctx.inject 不可用，桌面面板的 RPC 端点未注册（手机原生面板不受影响）');
        return undefined;
    }
    // ⚠️ 回调里**返回 disposer**：cordis 把 `inject` 回调的返回值当作该作用域的
    //    清理函数（与 `ctx.effect` 同一语义）。早先这里返回 undefined，端点注册
    //    后永远撤不掉 —— 热替换一次就多一个 handler，`path` 冲突时后注册的会被
    //    拒或遮住前一个，而两种都不报错。
    let stop;
    withInject.inject(['connection'], (scoped) => {
        stop = registerInScope(scoped, deps);
        return () => {
            stop?.();
            stop = undefined;
        };
    });
    // 返回一个手动撤销入口（`ctx.effect` 里调用时同样有效）
    return () => {
        stop?.();
        stop = undefined;
    };
}
/**
 * 在持有 `connection` 的作用域里注册端点（从 `registerMagpieHubApi` 抽出，
 * 便于单测直接用假作用域调用）。
 */
export function registerInScope(scoped, deps) {
    const connection = connectionOf(scoped);
    if (connection === undefined) {
        deps.log('[magpie-hub] 作用域里没有 connection，桌面面板的 RPC 端点未注册');
        return undefined;
    }
    /** 方法表：客户端能调的全在这里。 */
    const handlers = {
        /** 面板快照（四页签的全部数据）。 */
        'panel.snapshot': async () => ok(await deps.snapshot()),
        /**
         * 强制重建快照并返回（本机补丁 2026-11-15）。
         *
         * `panel.snapshot` 只读内存里的 latest，不重建；顶栏的刷新按钮要的是
         * 「重新问一遍上游」，所以单独给一个能触发 refresh(true) 的入口。
         */
        'panel.refresh': async () => {
            // 本机补丁 2026-11-18：刷新 = 重扫插件目录 + 强制重建快照。
            // 只 refresh 不 reload，新装/新登记的插件根本没被 host 装载，
            // 面板永远不可能看到它；而旧的 `deps.refresh()` 不带 force，
            // 2 秒节流会把它整个吞掉 —— 两个坑合起来就是「点了没反应」。
            let reloaded;
            try {
                reloaded = await deps.reload?.();
            }
            catch (caught) {
                reloaded = { reloadError: caught instanceof Error ? caught.message : String(caught) };
            }
            let out;
            try {
                out = await deps.refresh?.(true);
            }
            catch (caught) {
                out = { refreshError: caught instanceof Error ? caught.message : String(caught) };
            }
            return ok({ ...(reloaded ?? {}), ...(out ?? {}), at: Date.now(), snapshot: await deps.snapshot() });
        },
        /** 重新扫描插件目录。 */
        'plugins.reload': async () => {
            const out = await deps.reload();
            return ok(out);
        },

        /**
         * 已安装清单（商店页用来标「已安装」）。
         *
         * 只回 spec 与启用状态：商店页要判断的是「这个包在不在册」，
         * 不关心版本号和选项，少一点字段少一次序列化。
         */
        'plugins.list': async () => {
            const rows = await deps.plugins.list();
            return ok(rows.map((x) => ({ spec: x.spec, enabled: x.enabled !== false })));
        },
        /**
         * 商店：市场清单。
         *
         * ⚠️ 安装是慢操作（整仓 tarball ~10MB，实测 ~2 分钟），**不在清单请求里
         * 做任何下载**——客户端先拿列表渲染，点「安装」再单独调 `market.install`。
         *
         * @param payload `{ force?: boolean }` 强制刷新缓存
         */
        'market.list': async (payload) => {
            const force = payload?.force === true;
            const listings = await deps.marketListings(force);
            // 只回面板用得上的字段（icon 可能是几 MB 的 data URI，截掉超大的）
            return ok(listings.map((l) => ({
                package: l.package,
                name: l.name,
                icon: l.icon === undefined ? undefined : String(l.icon).length > 100_000 ? undefined : l.icon,
                providers: l.providers,
                community: l.community,
                kind: l.kind,
                summary: l.summary,
            })));
        },
        /**
         * 商店：安装一个插件（**慢**，客户端要给 loading 态；AbortSignal 可取消下载）。
         *
         * 安装成功后宿主的热重载会自动重扫，客户端再调 `panel.snapshot` 就能看到。
         */
        'market.install': async (payload, signal) => {
            const pkg = payload?.package;
            if (typeof pkg !== 'string' || pkg === '')
                return fail('bad-request', '缺少 package');
            const out = await deps.marketInstall(pkg, signal);
            return out.ok ? ok({ dir: out.dir }) : fail('install-failed', out.error ?? '安装失败');
        },
        /** 商店：卸载（删目录 + 从 plugins.json 移除）。 */
        'market.uninstall': async (payload) => {
            const pkg = payload?.package;
            if (typeof pkg !== 'string' || pkg === '')
                return fail('bad-request', '缺少 package');
            await deps.marketUninstall(pkg);
            return ok({ removed: pkg });
        },
        /** 切时间窗。 */
        'stats.period': async (payload) => {
            const raw = payload?.period;
            if (raw !== 'today' && raw !== '7d' && raw !== '30d' && raw !== 'all') {
                return fail('bad-request', 'period 必须是 today / 7d / 30d / all');
            }
            await deps.setPeriod(raw);
            return ok({ period: deps.period() });
        },
        /** 概览文本（「复制概览」用）。 */
        'panel.summary': async (payload) => {
            const locale = payload?.locale;
            return ok({ text: deps.summary(typeof locale === 'string' ? locale : undefined) });
        },
        /**
         * 读「面板入口」偏好（`sidebar` / `settings`，二选一）。
         *
         * 桌面端的两处入口靠它互斥：任一时刻只有一个存在。
         */
        'panel.entry': async () => ok({ entry: await deps.entry() }),
        /** 写「面板入口」偏好。非法值不落盘（回 `bad-request`）。 */
        'panel.setEntry': async (payload) => {
            const raw = payload?.entry;
            if (raw !== 'sidebar' && raw !== 'settings') {
                return fail('bad-request', 'entry 必须是 sidebar / settings');
            }
            await deps.setEntry(raw);
            return ok({ entry: await deps.entry() });
        },
        /**
         * 用系统默认程序打开一个链接。
         *
         * 为什么不让前端 `window.open`：面板跑在 DSH 的插件 UI 里，`window.open`
         * 在 `await` 之后已经丢了用户手势，弹窗拦截器一律拦；拦了以后用户看到
         * 的就是「点了登录没反应」。这里由 Node 直接 `start` / `open` / `xdg-open`，
         * 既不经过浏览器权限，也能拉起 `office-raccoon://` 这类自定义协议把登录态
         * 交回本机客户端。
         */
        'open.external': async (payload) => {
            const body = (payload ?? {});
            const url = typeof body.url === 'string' ? body.url.trim() : '';
            if (url === '')
                return fail('bad-request', '缺少 url');
            if (!/^[a-z][a-z0-9+.\-]*:/i.test(url))
                return fail('bad-request', '只能打开带协议头的链接');
            try {
                if (process.platform === 'win32') {
                    // 本机补丁 2026-11-24：登录页一律用「专用 Chromium 应用窗口」打开。
                    //   1) 点名 Chrome —— 11-17 成功那次默认浏览器就是 Chrome；Edge 下华为云
                    //      回 authorizationAvailable=false，只给 secret 不给 code（STS5.1805）；
                    //   2) 没装 Chrome 就退 Edge（同内核，同样支持 --app）；
                    //   3) 两个都没有才退系统默认浏览器，绝不吞掉登录。
                    // 独立 --user-data-dir + --app：没有地址栏、没有标签页，看起来就是一个
                    // 登录框；不污染日常浏览器配置，登完直接关掉。
                    const httpUrl = /^https?:\/\//i.test(url);
                    const profileDir = join(tmpdir(), 'magpie-login-profile');
                    const win = [
                        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                        join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
                        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
                    ].find((c) => {
                        try {
                            return existsSync(c);
                        }
                        catch {
                            return false;
                        }
                    });
                    if (win !== undefined) {
                        const args = httpUrl
                            ? [`--app=${url}`, `--window-size=540,820`, `--window-position=center`, `--user-data-dir=${profileDir}`, '--no-first-run', '--no-default-browser-check', '--disable-features=Translate']
                            : [url, `--user-data-dir=${profileDir}`];
                        execFile(win, args, { windowsHide: true });
                    }
                    else {
                        execFile('cmd', ['/c', 'start', '', url], { windowsHide: true });
                    }
                }
                else if (process.platform === 'darwin') {
                    execFile('open', [url]);
                }
                else {
                    execFile('xdg-open', [url]);
                }
                return ok({ opened: url });
            }
            catch (e) {
                return fail('open-failed', e instanceof Error ? e.message : String(e));
            }
        },
        /**
         * 把某个本机窗口提到前台。
         *
         * 为什么需要它：不少供应商的登录不是「打开一个网页」，而是「拉起本机
         * 客户端」（豆包工作、商汤桌面端，以及商店里陆续会装的那些）。插件
         * spawn 出来的进程默认在后台，用户点完「登录」屏幕上什么都不动，就
         * 以为按钮没反应 —— 豆包那次的 52×52 托盘悬浮球就是这么被误判的。
         *
         * 定位顺序：pid → port（netstat 反查监听进程）→ title（标题包含）→
         * since（最近 N 秒内启动的进程里挑面积最大的可见窗口）。
         * 提窗实现见同目录 focus.ps1（EnumWindows + 面积最大 + SW_RESTORE +
         * SetForegroundWindow），因为 MainWindowHandle 常指向托盘小窗。
         */
        'window.focus': async (payload) => {
            if (process.platform !== 'win32')
                return ok({ focused: false, reason: 'win32-only' });
            const body = (payload ?? {});
            const pid = Number.isInteger(body.pid) && body.pid > 0 ? body.pid : 0;
            const port = Number.isInteger(body.port) && body.port > 0 ? body.port : 0;
            const title = typeof body.title === 'string' ? body.title : '';
            const since = Number.isInteger(body.since) && body.since > 0 ? Math.min(body.since, 600) : 0;
            // 脚本整体编码后交给 -EncodedCommand：不再有外部 .ps1 文件，
            // 也不受过引号 / 换行 / 控制台代码页影响（-File 那套三样都踩过）。
            const head = [
                '$ProcessId = ' + pid,
                '$Port = ' + port,
                "$Title = '" + title.replace(/'/g, "''") + "'",
                '$SinceSecs = ' + since,
                // PowerShell 默认按系统代码页写 stdout，Node 按 UTF-8 读 ——
                // 不先切输出编码，窗口标题里的中文会变成一串问号。
                '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
                "$ErrorActionPreference = 'Stop'",
            ].join('\n');
            const script = head + '\n' + FOCUS_PS_BODY;
            try {
                const out = await runPowerShell([
                    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
                    '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64'),
                ], 20000);
                const text = String(out ?? '').trim();
                if (text === '' || text === 'null')
                    return ok({ focused: false, reason: 'no-window' });
                return ok({ focused: true, ...JSON.parse(text) });
            }
            catch (e) {
                return fail('focus-failed', e instanceof Error ? e.message : String(e));
            }
        },
        /** 一个 provider 的登录方式（面板据此画登录按钮）。 */
        'auth.methods': async (payload) => {
            const provider = payload?.provider;
            if (typeof provider !== 'string' || provider === '')
                return fail('bad-request', '缺少 provider');
            const methods = deps.host.methodsOf(provider).map((m, i) => ({
                index: i,
                type: m.type,
                label: m.label,
            }));
            return ok({ provider, methods });
        },
        /**
         * 开始登录：**只取 flow 就返回**（契约：authorize 里不能等用户）。
         *
         * 需要用户在浏览器里完成时回 `{ url, instructions, method }`；`api` 型
         * （粘贴 key）直接回 `{ done: true, accountId }`。手机/桌面之后调
         * `auth.signInFinish` 收尾。
         */
        'auth.signIn': async (payload) => {
            const body = (payload ?? {});
            const provider = typeof body.provider === 'string' ? body.provider : '';
            if (provider === '')
                return fail('bad-request', '缺少 provider');
            const index = typeof body.index === 'number' ? body.index : 0;
            const out = await deps.host.startSignIn(provider, index, body.inputs);
            // 本机补丁 2026-11-16：判据从「没有 url」改成「有 accountId」。
            // 豆包工作插件的 authorize() 返回 url:""（它靠 callback 里拉起客户端），
            // 原判据会当成「登录已完成」直接返回 done:true，窗口根本没开，
            // 用户看到的就是「点登录没效果」。只有粘贴 key 型（api）才同步落盘并带 accountId。
            if (out.accountId !== undefined) {
                return ok({ done: true, accountId: out.accountId });
            }
            // 华为云系（codearts / officeace）的回跳只有 127.0.0.1:80、参数还是 secret。
            // 这里按 authorize 给的 port 把 80 端口接管过来，转发给插件真正在听的端口；
            // 失败也只是 relayed:false，不影响登录流程本身。
            let relay = { armed: false, reason: '' };
            if (typeof out.url === 'string' && out.url !== '') {
                try {
                    relay = await armRelay(out.url, (line) => deps.log?.(line));
                } catch (error) {
                    relay = { armed: false, reason: error instanceof Error ? error.message : String(error) };
                }
            }
            return ok({
                done: false,
                url: out.url,
                instructions: out.instructions ?? '',
                method: out.method ?? 'auto',
                relayed: relay.armed === true,
                relayNote: relay.armed === true ? '' : String(relay.reason ?? ''),
            });
        },
        /** 收尾登录（浏览器回调返回后）。 */
        'auth.signInFinish': async (payload) => {
            const body = (payload ?? {});
            const provider = typeof body.provider === 'string' ? body.provider : '';
            if (provider === '')
                return fail('bad-request', '缺少 provider');
            const index = typeof body.index === 'number' ? body.index : 0;
            const code = typeof body.code === 'string' ? body.code : undefined;
            try {
                const out = await deps.host.finishSignIn(provider, index, code);
                await deps.refresh?.();
                return ok({ key: out.key, accountId: out.accountId });
            }
            catch (e) {
                return fail('sign-in-failed', e instanceof Error ? e.message : String(e));
            }
        },
        /** 直接用 key 登录（`api` 型，等价于 `client.auth.set`）。 */
        'auth.saveKey': async (payload) => {
            const body = (payload ?? {});
            const provider = typeof body.provider === 'string' ? body.provider : '';
            const key = typeof body.key === 'string' ? body.key : '';
            if (provider === '' || key === '')
                return fail('bad-request', '缺少 provider 或 key');
            // 走 startSignIn 的 api 路径：它会做 settle/freshKey 并把记录落盘，
            // 与插件自己调 `client.auth.set` 的结果一致。
            const out = await deps.host.startSignIn(provider, 0, { key });
            await deps.refresh?.();
            return ok({ accountId: out.accountId ?? '' });
        },
        /** 删账号。 */
        'auth.remove': async (payload) => {
            const key = payload?.key;
            if (typeof key !== 'string' || key === '')
                return fail('bad-request', '缺少 key');
            await deps.auth.remove(key);
            await deps.refresh?.();
            return ok({ removed: key });
        },
        /** 额度（重跑 `auth.usage`）。 */
        'usage.refresh': async (payload) => {
            const body = (payload ?? {});
            const provider = typeof body.provider === 'string' ? body.provider : '';
            const key = typeof body.key === 'string' ? body.key : '';
            if (provider === '' || key === '')
                return fail('bad-request', '缺少 provider 或 key');
            const usage = await deps.host.usageOf(provider, key);
            return ok(usage ?? null);
        },
        /** 签到（慢操作，逐账号）。 */
        'checkin': async (payload, signal) => {
            const provider = payload?.provider;
            const target = typeof provider === 'string' ? provider : '';
            const out = await deps.checkin(target, signal);
            await deps.refresh?.();
            return ok(out);
        },
        /**
         * 某个供应商的模型目录**含被禁用的**（面板画开关要用）。
         *
         * 与 `listModels` 的区别：那个是给 DSH 模型选择器的（已过滤），
         * 这个是给面板的（一条不少，带 `disabled` 标记）。
         */
        'catalog.rows': async (payload) => {
            const provider = typeof payload?.provider === 'string' ? payload.provider : '';
            if (provider === '')
                return fail('bad-request', '缺少 provider');
            try {
                const rows = await deps.adapter.catalogRows(provider);
                return ok({ provider, rows });
            }
            catch (e) {
                return fail('catalog-failed', e instanceof Error ? e.message : String(e));
            }
        },
        /** 模型目录（失效后重取）。 */
        'catalog.refresh': async () => {
            // 模型目录缓存在 adapter 里，这里只让面板快照重算（下次读会重取）
            await deps.reload();
            return ok({ ok: true });
        },
        // ── 模型开关 ──────────────────────────────────────────────────────────
        /**
         * 启停一个模型。
         *
         * `off: true` 禁用（从模型选择器消失），`off: false` 恢复。
         * 被禁用的模型**仍然**在面板目录里可见（带 `disabled` 标记），否则
         * 关掉之后就再也没有入口能把它打开。
         */
        'model.toggle': async (payload) => {
            const body = (payload ?? {});
            const provider = typeof body.provider === 'string' ? body.provider : '';
            const model = typeof body.model === 'string' ? body.model : '';
            if (provider === '' || model === '')
                return fail('bad-request', '缺少 provider 或 model');
            await deps.policy.setModelDisabled(provider, model, body.off === true);
            return ok({ disabled: await deps.policy.isModelDisabled(provider, model) });
        },
        /** 批量启停：一次给一串模型。 */
        'model.setMany': async (payload) => {
            const body = (payload ?? {});
            const provider = typeof body.provider === 'string' ? body.provider : '';
            const models = Array.isArray(body.models) ? body.models.filter((m) => typeof m === 'string') : [];
            if (provider === '' || models.length === 0)
                return fail('bad-request', '缺少 provider 或 models');
            await deps.policy.setModelsDisabled(models.map((model) => ({ provider, model })), body.off === true);
            return ok({ count: models.length, off: body.off === true });
        },
        /**
         * 失效模型清理：把「已禁用但目录里已经没有」的键删掉。
         *
         * 为什么要清：供应商会下线模型，这些键留在状态里越积越多，
         * 将来同名模型重新上线时会被静默禁用，而用户找不到原因。
         */
        'model.clearDead': async () => {
            const state = await deps.policy.get();
            const alive = new Set();
            for (const provider of deps.host.providerIds()) {
                let rows = [];
                try {
                    rows = await deps.adapter.catalogRows(provider);
                }
                catch { /* 目录取不到就跳过这个 provider，别误删 */ }
                for (const row of rows) alive.add(`${provider}/${row.id}`);
            }
            const dead = [...state.disabledModels].filter((key) => !alive.has(key));
            if (dead.length > 0) {
                // 逐个恢复：它们本来就已经不在目录里，恢复后也不会冒出来
                await deps.policy.setModelsDisabled(dead.map((key) => {
                    const slash = key.indexOf('/');
                    return { provider: key.slice(0, slash), model: key.slice(slash + 1) };
                }), false);
            }
            return ok({ cleared: dead.length, keys: dead.slice(0, 20) });
        },
        // ── 供应商启停 ────────────────────────────────────────────────────────
        /** 停用/启用一个供应商（停用后不进模型选择器）。 */
        'provider.setOff': async (payload) => {
            const body = (payload ?? {});
            const provider = typeof body.provider === 'string' ? body.provider : '';
            if (provider === '')
                return fail('bad-request', '缺少 provider');
            await deps.policy.setProviderOff(provider, body.off === true);
            // 注册表要跟着变：停用 = 从 DSH 的 provider 列表里摘掉
            await deps.reload();
            return ok({ off: await deps.policy.isProviderOff(provider) });
        },
        // ── 账号 ──────────────────────────────────────────────────────────────
        /** 给账号起个别名（空名字 = 清除，回到真实名字）。 */
        'account.rename': async (payload) => {
            const body = (payload ?? {});
            const key = typeof body.key === 'string' ? body.key : '';
            if (key === '')
                return fail('bad-request', '缺少 key');
            await deps.policy.setAccountAlias(key, typeof body.name === 'string' ? body.name : '');
            await deps.refresh?.();
            return ok({ alias: (await deps.policy.aliasOf(key)) ?? null });
        },
        /** 隐藏账号（面板不显示，路由/请求照常可用）。 */
        'account.setHidden': async (payload) => {
            const body = (payload ?? {});
            const key = typeof body.key === 'string' ? body.key : '';
            const provider = typeof body.provider === 'string' ? body.provider : '';
            if (key === '')
                return fail('bad-request', '缺少 key');
            // hiddenAccounts 一律存 `<provider>#<accountKey>`（state.js:18 的设计形状）：
            // 面板靠 `provider` 把记录归到对应供应商卡片下。只存裸 key 的话
            // `account.hidden` 切不出归属，账号会从所有卡片里消失且无从恢复。
            const id = key.includes('#') || provider === '' ? key : `${provider}#${key}`;
            await deps.policy.setAccountHidden(id, body.hidden === true);
            // 旧数据里的裸 key 记录顺手清掉，否则同一个账号两处各藏一次。
            if (id !== key)
                await deps.policy.setAccountHidden(key, false);
            await deps.refresh?.();
            return ok({ hidden: await deps.policy.isAccountHidden(id) });
        },
        /**
         * 已隐藏的账号清单（本机补丁 2026-11-15）。
         *
         * 隐藏只是从 buildSnapshot 里 `continue` 掉，凭证仍在 plugin-auth.json，
         * 但面板上没有入口恢复——所以单独开这个接口给「已隐藏 N 个账号」用。
         */
        'account.hidden': async () => {
            const state = await deps.policy.get();
            const keys = Array.from(state.hiddenAccounts ?? []);
            const aliases = state.accountAliases ?? {};
            // 旧数据里只有裸 account key（没有 `#`），切不出供应商 —— 只能反过来
            // 问 host 谁认领这个 key。新数据走复合键，不需要这一步。
            const owners = new Map();
            if (keys.some((k) => !k.includes('#'))) {
                const ids = typeof deps.host?.providerIds === 'function' ? deps.host.providerIds() : [];
                await Promise.all(ids.map(async (pid) => {
                    let owned = [];
                    try {
                        owned = await deps.host.accountKeys(pid);
                    }
                    catch {
                        owned = [];
                    }
                    for (const k of owned)
                        if (!owners.has(k))
                            owners.set(k, pid);
                }));
            }
            return ok({
                keys: keys.map((key) => {
                    const cut = key.indexOf('#');
                    const accountKey = cut < 0 ? key : key.slice(cut + 1);
                    const provider = cut < 0 ? (owners.get(key) ?? '') : key.slice(0, cut);
                    const alias = aliases[key] ?? aliases[accountKey];
                    return {
                        key,
                        provider,
                        accountKey,
                        ...(typeof alias === 'string' && alias !== '' ? { alias } : {}),
                    };
                }),
            });
        },
        /**
         * 这个账号只能跑哪些模型（`[]` = 取消限制）。
         *
         * 取号时会跳过不允许当前模型的账号，所以这比「发出去被上游 403」更早。
         */
        'account.setModels': async (payload) => {
            const body = (payload ?? {});
            const key = typeof body.key === 'string' ? body.key : '';
            if (key === '')
                return fail('bad-request', '缺少 key');
            await deps.policy.setAccountModels(key, Array.isArray(body.models) ? body.models : []);
            return ok({ models: (await deps.policy.modelsOfAccount(key)) ?? [] });
        },
        /**
         * 重测账号：再问一次额度、再看一次模型目录，把结果回报给调用方。
         *
         * 失败也返回 `ok`（带 `error` 字段）：这是「测一下看看」的动作，
         * 探测失败本身就是结果，不应该让整个请求变成错误。
         */
        'account.retest': async (payload) => {
            const body = (payload ?? {});
            const key = typeof body.key === 'string' ? body.key : '';
            const provider = typeof body.provider === 'string'
                ? body.provider
                : key.includes('#') ? key.slice(0, key.indexOf('#')) : key;
            if (key === '' || provider === '')
                return fail('bad-request', '缺少 provider 或 key');
            let usage;
            let models;
            try {
                usage = await deps.host.usageOf(provider, key);
            }
            catch (e) {
                usage = { error: e instanceof Error ? e.message : String(e) };
            }
            try {
                models = Object.keys(await deps.host.modelsOf(provider, key)).length;
            }
            catch {
                models = undefined;
            }
            await deps.refresh?.();
            return ok({
                provider,
                key,
                ...(models === undefined ? {} : { models }),
                ...(usage?.error === undefined ? {} : { error: String(usage.error) }),
                ...(usage?.plan === undefined ? {} : { plan: usage.plan }),
                windows: Array.isArray(usage?.windows) ? usage.windows.length : 0,
            });
        },
        /**
         * 清除某个账号的额度缓存（`fastest` 排序不再参考它）。
         *
         * magpie 的「重置」清的是限流标记；这里清的是**我自己算出来的额度缓存**
         * ——额度刚被上游重置时，缓存里的旧百分比会把账号排到队尾。
         */
        'account.resetQuota': async (payload) => {
            const body = (payload ?? {});
            const key = typeof body.key === 'string' ? body.key : '';
            const provider = typeof body.provider === 'string'
                ? body.provider
                : key.includes('#') ? key.slice(0, key.indexOf('#')) : key;
            if (key === '' || provider === '')
                return fail('bad-request', '缺少 provider 或 key');
            deps.clearQuota?.(provider, key);
            return ok({ cleared: `${provider}#${key}` });
        },
        // ── 路由 ──────────────────────────────────────────────────────────────
        /** 路由策略：`first`（按顺序）/ `fastest`（按剩余额度）/ `cheapest`。 */
        'route.strategy': async (payload) => {
            const next = payload?.strategy;
            if (next !== 'first' && next !== 'fastest' && next !== 'cheapest')
                return fail('bad-request', 'strategy 只能是 first / fastest / cheapest');
            return ok({ strategy: await deps.policy.setStrategy(next) });
        },
        /** 设置某个聚合键的候选顺序（`[]` = 清掉这组）。 */
        'route.setGroup': async (payload) => {
            const body = (payload ?? {});
            const key = typeof body.key === 'string' ? body.key : '';
            if (key === '')
                return fail('bad-request', '缺少 key');
            await deps.policy.setGroup(key, Array.isArray(body.candidates) ? body.candidates : []);
            return ok({ key, candidates: (await deps.policy.groups())[key] ?? [] });
        },
        // ── 插件升级 ──────────────────────────────────────────────────────────
        /**
         * 已装插件的版本与来源。
         *
         * 市场清单里**没有版本字段**（只有 package/name/icon/providers/summary），
         * 所以这里报的是「本地 package.json 里的版本」，不是「有没有新版」——
         * 不编造一个「最新版」来对比。
         */
        'plugins.versions': async () => {
            const rows = [];
            for (const spec of await deps.plugins.list()) {
                // spec 有两种：npm 包名（在 modulesDir 下）与**本地绝对路径 / git URL**
                // （插件直接指向磁盘目录或仓库，不在 node_modules 里）。
                // 后者不能拿 moduleNameOf 当包名拼路径，要直接用它自己。
                const raw = spec.spec;
                const local = /^([a-zA-Z]:[\\/]|\\\\|\/)/.test(raw) || raw.startsWith('file:') || raw.startsWith('github:') || /^https?:/.test(raw);
                const name = local ? raw : deps.moduleNameOf(raw);
                const dir = local && !raw.startsWith('github:') && !/^https?:/.test(raw)
                    ? raw.replace(/^file:/, '')
                    : join(deps.modulesDir, name);
                let version = null;
                let error = null;
                try {
                    const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
                    version = typeof pkg.version === 'string' ? pkg.version : null;
                }
                catch (e) {
                    error = e instanceof Error ? e.message : String(e);
                }
                rows.push({
                    spec: raw,
                    name,
                    source: local ? 'local' : 'npm',
                    ...(version === null ? {} : { version }),
                    ...(error === null ? {} : { error }),
                });
            }
            return ok({ plugins: rows, total: rows.length });
        },
        /**
         * 升级一个插件：从市场**重新拉最新**并覆盖安装，然后重载。
         *
         * ⚠ 清单没有版本号，所以无法判断「有没有新版」，只能重新装一次。
         * 调用方应该把它当「重装」而不是「升级」来理解（返回里也如实说明）。
         */
        'plugins.update': async (payload, signal) => {
            const pkg = typeof payload?.package === 'string' ? payload.package : '';
            if (pkg === '')
                return fail('bad-request', '缺少 package');
            const result = await deps.marketInstall(pkg, signal, { force: true });
            if (result?.ok === false)
                return fail('install-failed', String(result.error ?? '安装失败'));
            // 装完必须重载：否则模块缓存里还是旧代码
            await deps.reload();
            return ok({ package: pkg, reinstalled: true });
        },
        // ── 签到排期 ──────────────────────────────────────────────────────────
        /** 自动签到开关与状态（每天固定时段跑一次，见 index.js 的调度器）。 */
        'checkin.schedule': async (payload) => {
            const body = (payload ?? {});
            if (body.enabled === undefined) {
                return ok(await deps.checkinSchedule());
            }
            const state = await deps.checkinSchedule(body.enabled === true);
            return ok(state);
        },
    };
    const stop = connection.fetch.register({
        path: `/api/${MAGPIE_HUB_ENDPOINT}`,
        methods: ['POST'],
        requestBody: 'buffered',
        async fetch(request) {
            if (request.method !== 'POST') {
                return new Response('method not allowed', { status: 405 });
            }
            const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
            if (contentType !== 'application/json') {
                return new Response('content type must be application/json', { status: 415 });
            }
            let message;
            try {
                message = await request.json();
            }
            catch {
                return new Response('body is not JSON', { status: 400 });
            }
            const rpcId = typeof message.rpcId === 'string' ? message.rpcId : 'invalid-request';
            const call = message.payload;
            if (message.type !== 'client-request'
                || typeof message.rpcId !== 'string'
                || message.method !== MAGPIE_HUB_ENDPOINT
                || call === undefined
                || typeof call.method !== 'string'
                || !Object.prototype.hasOwnProperty.call(call, 'payload')) {
                return reply(rpcId, fail('bad-request', 'Invalid magpie-hub management request.'));
            }
            const handler = handlers[call.method];
            if (handler === undefined) {
                return reply(rpcId, fail('unknown-method', `未知方法：${call.method}`));
            }
            try {
                return reply(rpcId, await handler(call.payload, request.signal));
            }
            catch (e) {
                return reply(rpcId, fail('internal', e instanceof Error ? e.message : String(e)));
            }
        },
    });
    return typeof stop === 'function' ? stop : undefined;
}
/**
 * 取 `connection`：DSH 的 ctx 有两个访问路径（属性与 `get()`），两种都试。
 *
 * ⚠️ 不能只用 `ctx.connection`：cordis 里未声明的服务是**取值即抛**的，
 * 而 `inject` 只对本插件的顶层声明生效 —— 这里用 `get()` 更稳。
 */
function connectionOf(ctx) {
    if (ctx === null || typeof ctx !== 'object')
        return undefined;
    const withProps = ctx;
    const direct = withProps.connection;
    if (isConnectionLike(direct))
        return direct;
    if (typeof withProps.get === 'function') {
        try {
            const viaGet = withProps.get('connection');
            if (isConnectionLike(viaGet))
                return viaGet;
        }
        catch {
            // 未注入：没有 connection
        }
    }
    return undefined;
}
function isConnectionLike(v) {
    return v !== null
        && typeof v === 'object'
        && typeof v.fetch?.register === 'function';
}
//# sourceMappingURL=rpc.js.map

// ── 提窗辅助（只给 window.focus 用） ────────────────────────────────────────

/**
 * 提窗脚本正文（已内联，随插件一起分发，不需要任何外部 .ps1）。
 *
 * 变量前缀由 `window.focus` 现拼，所以这里从 `if ($ProcessId …` 开始。
 * 为什么不用 MainWindowHandle：很多 Electron/Chromium 应用（豆包就是）的
 * 它指向托盘那个 52×52 悬浮球；这里枚举该进程全部可见窗口、按面积取最大。
 */
const FOCUS_PS_BODY = "if ($ProcessId -le 0 -and $Port -gt 0) {\n    try {\n        $line = \u0026 netstat -ano -p TCP 2\u003e$null | Select-String -Pattern \":$Port\\s+\\S+\\s+LISTENING\\s+(\\d+)\" | Select-Object -First 1\n        if ($line -ne $null) {\n            $m = [regex]::Match($line.Line, \u0027(\\d+)\\s*$\u0027)\n            if ($m.Success) { $ProcessId = [int]$m.Groups[1].Value }\n        }\n    } catch { }\n}\n\nAdd-Type -TypeDefinition @\u0027\nusing System;\nusing System.Collections.Generic;\nusing System.Diagnostics;\nusing System.Runtime.InteropServices;\nusing System.Text;\n\npublic class MagpieFocus\n{\n    [DllImport(\"user32.dll\")]\n    static extern bool EnumWindows(EnumProc cb, IntPtr p);\n    delegate bool EnumProc(IntPtr h, IntPtr p);\n\n    [DllImport(\"user32.dll\")]\n    static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);\n\n    [DllImport(\"user32.dll\")]\n    static extern bool IsWindowVisible(IntPtr h);\n\n    [DllImport(\"user32.dll\")]\n    static extern bool GetWindowRect(IntPtr h, out RECT r);\n\n    [DllImport(\"user32.dll\")]\n    static extern bool ShowWindow(IntPtr h, int cmd);\n\n    [DllImport(\"user32.dll\")]\n    static extern bool SetForegroundWindow(IntPtr h);\n\n    [DllImport(\"user32.dll\", CharSet = CharSet.Unicode)]\n    static extern int GetWindowTextLengthW(IntPtr h);\n\n    [DllImport(\"user32.dll\", CharSet = CharSet.Unicode)]\n    static extern int GetWindowTextW(IntPtr h, StringBuilder sb, int max);\n\n    [StructLayout(LayoutKind.Sequential)]\n    struct RECT { public int L; public int T; public int R; public int B; }\n\n    public static string Pick(int pid, string title, int since)\n    {\n        var allowed = new HashSet\u003cuint\u003e();\n\n        if (pid \u003e 0)\n        {\n            allowed.Add((uint)pid);\n        }\n        else if (since \u003e 0)\n        {\n            DateTime floor = DateTime.Now.AddSeconds(-since);\n            foreach (Process p in Process.GetProcesses())\n            {\n                try\n                {\n                    if (p.StartTime \u003e= floor) { allowed.Add((uint)p.Id); }\n                }\n                catch { }\n            }\n        }\n\n        IntPtr best = IntPtr.Zero;\n        long bestArea = -1;\n        uint bestPid = 0;\n        string bestTitle = \"\";\n\n        EnumWindows(delegate(IntPtr h, IntPtr l)\n        {\n            if (!IsWindowVisible(h)) { return true; }\n\n            uint wp;\n            GetWindowThreadProcessId(h, out wp);\n            if (allowed.Count \u003e 0 \u0026\u0026 !allowed.Contains(wp)) { return true; }\n\n            int len = GetWindowTextLengthW(h);\n            if (len \u003c= 0) { return true; }\n\n            var sb = new StringBuilder(len + 2);\n            GetWindowTextW(h, sb, sb.Capacity);\n            string t = sb.ToString();\n\n            if (title != null \u0026\u0026 title.Length \u003e 0 \u0026\u0026 t.IndexOf(title, StringComparison.OrdinalIgnoreCase) \u003c 0) { return true; }\n\n            RECT r;\n            if (!GetWindowRect(h, out r)) { return true; }\n\n            long w = r.R - r.L;\n            long hh = r.B - r.T;\n            if (w \u003c= 0 || hh \u003c= 0) { return true; }\n\n            long area = w * hh;\n            if (area \u003c= bestArea) { return true; }\n\n            bestArea = area;\n            best = h;\n            bestPid = wp;\n            bestTitle = t;\n            return true;\n        }, IntPtr.Zero);\n\n        if (best == IntPtr.Zero) { return \"null\"; }\n\n        ShowWindow(best, 9);\n        SetForegroundWindow(best);\n\n        return \"{\\\"hwnd\\\":\" + best.ToInt64()\n             + \",\\\"pid\\\":\" + bestPid\n             + \",\\\"area\\\":\" + bestArea\n             + \",\\\"title\\\":\" + Quote(bestTitle) + \"}\";\n    }\n\n    static string Quote(string s)\n    {\n        var b = new StringBuilder(\"\\\"\");\n        foreach (char c in s)\n        {\n            if (c == \u0027\"\u0027 || c == \u0027\\\\\u0027) { b.Append(\u0027\\\\\u0027).Append(c); }\n            else if (c \u003c \u0027 \u0027) { b.Append(\u0027 \u0027); }\n            else { b.Append(c); }\n        }\n        return b.Append(\"\\\"\").ToString();\n    }\n}\n\u0027@\n\n[MagpieFocus]::Pick($ProcessId, $Title, $SinceSecs)";

/** 跑一段 PowerShell，返回 stdout。 */
function runPowerShell(args, timeoutMs = 20000) {
    return new Promise((resolvePromise, rejectPromise) => {
        execFile(
            'powershell',
            args,
            { windowsHide: true, timeout: timeoutMs, maxBuffer: 1024 * 1024 },
            (e, stdout) => {
                if (e) { rejectPromise(e); return; }
                resolvePromise(stdout);
            },
        );
    });
}
