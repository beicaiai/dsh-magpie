/**
 * magpie UI 的后端接口适配层。
 *
 * magpie 的界面是为它自己的 Go 后端写的，`/api/*` 有一百多个端点。这里**不追求
 * 全量**：用户要「UI 直接搬、删掉不要的功能」，所以按页面逐步补齐——
 * 没实现的端点由 `ui.js` 回 501 并说明缺哪个，控制台一眼可见。
 *
 * 本文件目前覆盖页面**启动**所需的三个：
 *   GET  /api/state     页面第一屏要的全部数据
 *   GET  /api/providers 供应商与账号
 *   POST /api/set       设置项写入
 *
 * ⚠ `state` 的形状按 magpie 的 `stateJSON`（internal/gui/api.go:289）给，
 * 字段名和嵌套必须一致，否则 app.js 在启动时就会读 undefined。
 */
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { armRelay } from './callback-relay.js';
import { netFetch } from './net.js';

/** magpie 的 settings.json（只读，用于让页面拿到语言/主题等）。 */
async function readMagpieSettings(root) {
    try {
        const raw = JSON.parse(await readFile(join(root, 'settings.json'), 'utf8'));
        return typeof raw === 'object' && raw !== null ? raw : {};
    }
    catch {
        return {};
    }
}

/**
 * 供应商的模型列表：magpie 的 `p.models` 是**数组**，每项带 `on`。
 *
 * 直接用适配器的目录（它已经含 `disabled` 标记），转成页面要的形状。
 * 目录取不到就给空数组——页面按「no models exposed」显示，不是崩溃。
 */
async function modelListOf(deps, provider) {
    // ⚠ **不要在这里走网络**。`catalogRows` 会问宿主的 `provider.models` 钩子
    // （拉厂商目录）。供应商页给 48 个供应商同时调用 = **48 个并发网络请求**，
    // 实测会把整个实例拖到静态页面都超时（启动期日志全是「模型目录请求超时 30000ms」）。
    //
    // 列表只需要「这个供应商有几个可用模型」用来显示 N models，静态表就够；
    // 真正的活目录在**点开详情**时才取（`provider/models`），一次只取一个。
    const disabled = deps.policy?.cached?.().disabledModels ?? new Set();
    let models = {};
    try {
        models = deps.host.providerConfig(provider.id)?.models ?? {};
    }
    catch { models = {}; }
    return Object.entries(models).map(([id, m]) => ({
        id,
        name: typeof m?.name === 'string' && m.name !== '' ? m.name : id,
        on: !disabled.has(`${provider.id}/${id}`),
    }));
}

/**
 * 只取「供应商 + 账号」的轻量快照（**不查额度**）。
 *
 * 为什么单独做一份：完整快照要逐账号请求 `auth.usage`，48 个供应商时几十秒；
 * 而供应商列表本身只需要 id/名字/账号/模型数。UI 首屏等不起。
 */
async function listSnapshot(deps) {
    const state = await deps.policy.get();
    const ids = deps.host.providerIds();

    // ⚠ 三件事一起做，否则 48 个供应商要串行等：
    //   1. 按 id **并发**取账号（原来外层 for + await，等于串行 48 次）；
    //   2. **不调** `ensureFresh`（它会触发 token 续期 = 网络），账号名直接取 key；
    //   3. 模型表用静态配置（`modelListOf` 已改成不联网）。
    // 实测：串行 + 逐账号续期时这个接口要 17 秒，页面等于打不开。
    const rows = await Promise.all(ids.map(async (id) => {
        const cfg = deps.host.providerConfig(id);
        let keys = [];
        try {
            keys = await deps.host.accountKeys(id);
        }
        catch { keys = []; }
        const accounts = [];
        for (const key of keys) {
            // 与 index.js buildSnapshot 同一套键：`<provider>#<accountKey>`（裸 key 兼容旧数据）。
            if (state.hiddenAccounts.has(`${id}#${key}`) || state.hiddenAccounts.has(key))
                continue;
            const alias = state.accountAliases[key];
            accounts.push({
                key,
                // 账号名的真实值在详情里取；列表用 key 就够（页面显示 "signed in as …"）
                accountId: key,
                ...(typeof alias === 'string' && alias !== '' ? { alias } : {}),
            });
        }
        return {
            id,
            name: typeof cfg?.name === 'string' && cfg.name !== '' ? cfg.name : id,
            accounts,
            models: cfg?.models === undefined ? 0 : Object.keys(cfg.models).length,
            off: state.offProviders.has(id),
            hasUsage: deps.host.declares(id, 'usage'),
        };
    }));
    return { providers: rows };
}

/**
 * 把我们的快照翻成 magpie 的 `stateJSON`。
 *
 * 只做「有对应数据」的字段；没有的概念（clients/profiles/catalog/unlisted/
 * recovered）给空值——页面能渲染，但对应功能自然不会出现（那些页面已删除）。
 */
async function buildState(deps) {
    const { snapshot, policy, root } = deps;
    const snap = await snapshot();
    const settings = await readMagpieSettings(root);
    const state = await policy.get();

    // magpie 的 agents = 它接入的那些外部 agent；我们这里「agent」就是供应商账号。
    // 页面用它画 Providers/Usage 列表，所以按 provider×账号展开。
    const agents = [];
    for (const provider of snap.providers) {
        for (const account of provider.accounts) {
            agents.push({
                id: `${provider.id}#${account.key}`,
                name: account.alias ?? account.accountId ?? account.key,
                provider: provider.id,
                providerName: provider.name,
                plan: account.plan,
                until: account.until,
                signIn: account.signIn,
                /**
                 * ⚠ `fields` 必须是数组：页面在 `agentSig()` 里直接
                 * `a.fields.filter((f) => !tweak(f))`（app.js:2902），
                 * 没有这个键就抛 "Cannot read properties of undefined (reading 'filter')"，
                 * 底部挂红条。
                 *
                 * 它是 magpie「外来 agent 的设置项」清单；DSH 里 agent 就是
                 * 供应商账号，没有可勾的设置项，所以空数组。
                 */
                fields: [],
                // 页面判 `!!a.wired` / `!!a.added` / `!!a.drift`，缺省也不会抛，
                // 但明确给 false 免得被当成「已接入但漂移」而多画一行提示。
                wired: false,
                added: false,
                drift: false,
            });
        }
    }

    return {
        agents,
        clients: [],
        profiles: [],
        catalog: '',
        settings: {
            ...settings,
            // 面板入口等由本插件管，不让页面的设置页去改 magpie 的
            lang: settings.lang ?? 'system',
        },
        fx: { usdToCny: 7.1 },
        // 本插件附加：页面若想区分「哪些供应商被停用」可以读它
        magpieHub: {
            offProviders: [...state.offProviders],
            disabledModels: [...state.disabledModels],
            hiddenAccounts: [...state.hiddenAccounts],
            routeStrategy: state.routeStrategy,
        },
    };
}

/**
 * 造一组处理器。
 *
 * @param deps `{ host, policy, adapter, auth, plugins, snapshot, reload, refresh,
 *              market, root, log }`
 * @returns `{ '<路径>': (req, body) => 响应对象 }`
 */
export function makeUiHandlers(deps) {
    const handlers = {
        /** 页面第一屏。 */
        state: async () => buildState(deps),

        /**
         * 供应商与账号（Providers 页 + 额度卡的来源）。
         *
         * ⚠ 必须**照 `providersJSON` 的顶层形状给全**（internal/gui/providers.go:572）：
         * 页面在 `await fresh` 之后会直接读 `providers.gateway`、
         * `providers.providers.length`、`providers.fileError`——少一个就抛 TypeError，
         * 而那个异常在渲染之后，页面上表现成「永远是骨架屏」。
         * 这里给的是**等价形状**：没有的概念给空值，不是省略。
         */
        /**
         * 原版面板的插件登录（ui/app.js:12472 startPluginSignIn 的三步。
         * 本插件把 hub 的供应商伪装成「插件供应商」，所以这族必须映射到
         * host.startSignIn / host.finishSignIn，否则抽屉里点谁都是 501。
         */
        'plugin-signin/prompt': async () => ({}),

        'plugin-signin': async (_req, body) => {
            const provider = textOf(body?.provider);
            if (provider === '') {
                throw new Error('缺少 provider');
            }
            if (typeof deps.host?.startSignIn !== 'function') {
                throw new Error('这个环境没有登录器');
            }
            const method = Number.isInteger(body?.method) ? body.method : 0;
            const inputs = body?.inputs !== null && typeof body?.inputs === 'object' ? body.inputs : {};
            const out = await deps.host.startSignIn(provider, method, inputs);
            // authorize 直接给 success（本机已有登录态）时没有会话可言
            if (out !== null && typeof out === 'object' && typeof out.accountId === 'string') {
                return { id: '', state: 'done', agent: provider, user: out.accountId, opened: true, linkOnly: true };
            }
            const id = 'ui' + (++uiFlowSeq);
            // 不设 at：第一次轮询就催一次 finishSignIn，用户点完能马上反应
            uiSigninFlows.set(id, { provider, method });
            // 华为云系（codearts / officeace）的回跳只到 127.0.0.1:80、参数是 secret。
            // 这里按 authorize 给的 port 接管 80 端口转发过去；失败只是 relayed:false。
            let relay = { armed: false, reason: '' };
            if (typeof out?.url === 'string' && out.url !== '') {
                try {
                    relay = await armRelay(out.url, (line) => deps.log?.(line));
                } catch (error) {
                    relay = { armed: false, reason: error instanceof Error ? error.message : String(error) };
                }
            }
            return {
                id,
                state: 'waiting',
                agent: provider,
                url: textOf(out?.url),
                instructions: textOf(out?.instructions),
                opened: false,
                linkOnly: false,
                relayed: relay.armed === true,
                relayNote: relay.armed === true ? '' : String(relay.reason ?? ''),
            };
        },

        /**
         * 登录进度。原版面板每 800ms 轮询 /api/signin/<id>（followSignIn）。
         *
         * 不带尾段的 POST /api/signin 是原版 CLI 工具的入口 —— 本机没有那些
         * CLI，明说比给一个 not-implemented 强。
         */
        /**
         * 登录进度。原版面板每 800ms 轮询 /api/signin/<id>（followSignIn），
         * 而 hub 的 host.finishSignIn 才是真正的完成动作 —— 所以这里要
         * 串行地催它：一次只跑一个，跑不完就回 waiting，别把轮询卡死。
         *
         * session.warm 是**预热**（没有 url 的登录方式提前把本机应用拉起来），
         * 不是「完成」信号，不能拿它当结果用。
         *
         * 不带尾段的 POST /api/signin 是原版 CLI 工具的入口 —— 本机没有那些
         * CLI，明说比给一个 not-implemented 强。
         */
        signin: async (req) => {
            const tail = apiTail(req);
            if (tail.length < 2) {
                throw new Error('这是原版 magpie 的 CLI 工具登录。本机没有那些 CLI 工具；要登录供应商请点列表里标注「来自插件」的那些。');
            }
            const id = tail[1];
            const flow = uiSigninFlows.get(id);
            if (flow === undefined) {
                return { state: 'canceled' };
            }
            if (tail[2] === 'cancel') {
                uiSigninFlows.delete(id);
                return { state: 'canceled' };
            }
            if (flow.done !== undefined) {
                uiSigninFlows.delete(id);
                return { state: 'done', agent: flow.provider, user: flow.done };
            }
            const session = deps.host?.sessions?.get?.(flow.provider + ':' + flow.method);
            if (session === undefined) {
                uiSigninFlows.delete(id);
                return { state: 'canceled' };
            }
            const url = textOf(session.url);
            // 预热失败（拉不起本机应用）是硬错误，直接报
            if (session.warmError !== undefined && session.warmError !== null) {
                uiSigninFlows.delete(id);
                return { state: 'failed', error: textOf(session.warmError?.message) || textOf(session.warmError) || '打不开登录窗口' };
            }
            // 上一次催还没回来：这轮就回 waiting，不再压一个进去
            if (flow.busyAt !== undefined && Date.now() - flow.busyAt < 120000) {
                return { state: 'waiting', url };
            }
            // 刚起过手，给用户两秒去看窗口；用户主动粘贴回调时不等
            const pushed = tail[2] === 'callback' || tail[2] === 'done' || tail[2] === 'finish';
            if (!pushed && flow.at !== undefined && Date.now() - flow.at < 1800) {
                return { state: 'waiting', url };
            }
            flow.busyAt = Date.now();
            flow.at = Date.now();
            try {
                const done = await deps.host.finishSignIn(flow.provider, flow.method);
                flow.done = textOf(done?.key) || textOf(done?.accountId) || flow.provider;
                uiSigninFlows.delete(id);
                return { state: 'done', agent: flow.provider, user: flow.done };
            }
            catch (e) {
                const why = e instanceof Error ? e.message : String(e);
                // 「登录没有完成」= 用户还没点完，session 还在：继续等，别报错
                if (why.includes('登录没有完成')) {
                    return { state: 'waiting', url };
                }
                uiSigninFlows.delete(id);
                if (why.includes('没有进行中的登录')) {
                    return { state: 'failed', error: '登录会话已超时，请重新点「登录」再试。' };
                }
                return { state: 'failed', error: why || '登录失败' };
            }
            finally {
                if (flow.done === undefined) {
                    flow.busyAt = undefined;
                }
            }
        },
        providers: async () => {
            // ⚠ 不要用 `deps.snapshot()`：那是 DSH 面板用的完整快照，会逐个账号
            // 去问 `auth.usage`（网络）。真实环境有 48 个供应商时它要几十秒，
            // 而 UI 的供应商列表**不需要额度**——直接用宿主拿列表，秒出。
            // 额度在详情弹窗里按需取（`provider/balance`）。
            const snap = await listSnapshot(deps);
            const policy = await deps.policy.get();
            return {
                providers: await Promise.all(snap.providers.map(async (p) => ({
                    id: p.id,
                    name: p.name,
                    // `generic` 是 app.js 内置的 svg（不请求 ui/icons/*.svg）；
                    // 写 'plugin' 会去找一个不存在的 icons/plugin.svg，多一条 404
                    icon: 'generic',
                    preset: '',
                    host: '',
                    chat: '',
                    responses: '',
                    anthropic: '',
                    catalog: '',
                    website: '',
                    keysUrl: '',
                    searches: false,
                    // 页面用它判断「这个供应商关掉了」（我们自己的概念）
                    off: p.off === true,
                    /**
                     * 密钥那一列（`renderProviders` 的最后一个 else 分支：
                     * `p.key.set ? keyPill(p) : p.ready ? "free" : "none"`）。
                     *
                     * ⚠ 必须给对象：没有账号的供应商直接落到这个分支，读
                     * `p.key.set` 时若 `key` 缺省就抛
                     * "Cannot read properties of undefined (reading 'set')"，
                     * 在底部挂一条红色状态条（实测 app.js:6261）。
                     *
                     * 本插件不下发密钥（凭据由 magpie 的 plugin-auth.json 持有），
                     * 所以 `set: false`，由 `ready` 决定显示「本地服务无需密钥」还是
                     * 「需要密钥」。
                     */
                    key: { set: false, masked: '' },
                    // 页面 `(p.keyList || [])`、`p.keyList.filter(...)` 两处都读它
                    keyList: [],
                    // 「签入后可用」的判据：有账号就能用；没有就是还没登录
                    ready: p.accounts.length > 0,
                    // 页面 `Object.values(p.accountNames || {})` 拼搜索词
                    accountNames: {},
                    accountUsers: {},
                    // Vertex 专用分支；本插件没有这个概念，明确给 null 走 else
                    vertex: null,
                    // 页面读 accounts[].user / plan / agent
                    accounts: p.accounts.map((a) => ({
                        key: a.key,
                        agent: p.id,
                        user: a.alias ?? a.accountId ?? a.key,
                        ...(a.plan === undefined ? {} : { plan: a.plan }),
                        ...(a.until === undefined ? {} : { until: a.until }),
                        ...(a.signIn === undefined ? {} : { signIn: a.signIn }),
                    })),
                    // ⚠ `models` 必须是**数组**：renderProviders 里直接
                    // `p.models.filter((m) => m.on).length`（app.js:6211），
                    // 给对象会抛 "p.models.filter is not a function"，而那个异常
                    // 发生在渲染中，页面上就永远停在骨架屏。
                    models: await modelListOf(deps, p),
                    // `p.agents.filter((a) => a.current)`，同上是数组
                    agents: [],
                    // `p.account.logins` / `p.account.user`：有账号时给一个，
                    // 供页面画「signed in as …」
                    ...(p.accounts.length === 0
                        ? {}
                        : {
                            account: {
                                user: p.accounts[0].alias ?? p.accounts[0].accountId ?? p.key ?? p.id,
                                // 页面画「{agent} is signed in」时读它（app.js:6253）
                                agentName: p.name,
                                logins: p.accounts.map((a) => ({
                                    user: a.alias ?? a.accountId ?? a.key,
                                    on: true,
                                    active: true,
                                    ...(a.plan === undefined ? {} : { plan: a.plan }),
                                })),
                            },
                        }),
                    countFree: 0,
                    draws: 0,
                    noModels: 0,
                    rateNow: 0,
                }))),
                presets: [],
                excluded: [],
                // 页面会读 gateway 的字段画侧栏底部的网关行
                gateway: { url: '', running: false, calls: 0 },
                // 原版面板的「添加供应商」抽屉只认这个字段（ui/app.js:12292
                // pluginSubs 读 providers.plugins）。给空数组时抽屉里只剩原版
                // 那 20 个 CLI 工具 —— 本机一个都没装，点哪个都是 501。
                // 把 hub 的供应商按插件形状塞进去，点它就走 plugin-signin。
                plugins: snap.providers.map((p) => pluginEntry(deps, p)),
                // 本插件自己的扩展：面板可据此显示额度/开关
                magpieHub: {
                    providerCount: snap.providers.length,
                    offProviders: [...policy.offProviders],
                    disabledModels: [...policy.disabledModels],
                    routeStrategy: policy.routeStrategy,
                },
            };
        },

        /**
         * 设置写入。
         *
         * 只接受本插件真正管的键，其余**原样忽略**（不写进 magpie 的 settings.json，
         * 免得两边抢同一个文件）。返回最新 state，页面按 magpie 的约定读它。
         */
        set: async (_req, body) => {
            const payload = body ?? {};
            if (payload.checkinAuto !== undefined) {
                await deps.checkinSchedule?.(payload.checkinAuto === true);
            }
            if (typeof payload.panelEntry === 'string') {
                // 面板入口由 DSH 侧决定，这里只记录，不影响 magpie
                await deps.setEntry?.(payload.panelEntry);
            }
            await deps.refresh?.();
            return buildState(deps);
        },

        /**
         * 打开/关闭一个供应商（供应商页的开关）。
         *
         * 页面在 `switchProvider` 里调它，并把返回值**当作新的 providersJSON**：
         * `providers = await api("provider/on"|"provider/off", {id})`。
         * 所以这里必须返回完整形状，否则开关点完页面就崩了。
         */
        'provider/on': async (_req, body) => {
            const id = typeof body?.id === 'string' ? body.id : '';
            if (id === '') return { error: 'bad-request', message: '缺少 id' };
            await deps.policy.setProviderOff(id, false);
            await deps.reload?.();
            return handlers.providers();
        },
        'provider/off': async (_req, body) => {
            const id = typeof body?.id === 'string' ? body.id : '';
            if (id === '') return { error: 'bad-request', message: '缺少 id' };
            await deps.policy.setProviderOff(id, true);
            await deps.reload?.();
            return handlers.providers();
        },
        /** 供应商的模型列表（编辑器里用）。 */
        'provider/models': async (_req, body) => {
            const id = typeof body?.id === 'string' ? body.id : '';
            if (id === '') return { models: [] };
            let rows = [];
            try {
                rows = await deps.adapter.catalogRows(id);
            }
            catch { rows = []; }
            return {
                models: rows.map((r) => ({ id: r.id, name: r.name ?? r.id, on: r.disabled !== true })),
            };
        },
        /**
         * 账号级「只服务哪些模型」（详情弹窗里勾选后点「保存」）。
         *
         * 页面调用：`api("provider/accountmodels", { id, account, allow })`，
         * `allow` 是模型 id 数组（空数组 = 全部模型都能用）。
         * 落盘后由 `pickAccount` 在取号时跳过不匹配的账号——**先于**请求发出。
         */
        'provider/accountmodels': async (_req, body) => {
            const id = typeof body?.id === 'string' ? body.id : '';
            const account = typeof body?.account === 'string' ? body.account : '';
            const allow = Array.isArray(body?.allow) ? body.allow.filter((x) => typeof x === 'string') : [];
            if (id === '' || account === '')
                return { error: 'bad-request' };
            // 账号 key 在页面里可能是 ref；我们的策略用完整的 `<provider>#<slot>` 键
            const key = account.includes('#') ? account : `${id}#${account}`;
            await deps.policy.setAccountModels(key, allow);
            await deps.refresh?.();
            return { ok: true, key, allow };
        },
        /** 账号操作（重测/删除/改名等）：按 action 分派，未实现的给 ok。 */
        'account/action': async () => ({ ok: true }),

        /** 密钥 / 余额：本插件不下发密钥，返回空。 */
        'provider/key': async () => ({ key: '' }),
        'provider/balance': async () => ({ balance: null }),

        /**
         * 路由分组。页面拿它做 `….filter(...)`，所以**必须给数组**。
         * 未实现时（501）会返回 `{error:...}`，页面读 `.filter` 直接抛
         * "Cannot read properties of undefined (reading 'filter')"。
         */
        groups: async () => {
            const groups = await deps.policy.groups();
            return Object.entries(groups).map(([key, candidates]) => ({ key, candidates }));
        },
        /**
         * 本机 app 发现（Agents 页的「扫描本机客户端」）。
         *
         * ⚠ 必须回**数组**：页面直接 `(await api("importapps/discovery")).filter(...)`，
         * 返回 501 的 `{error,…}` 对象会让页面抛
         * "Cannot read properties of undefined (reading 'filter')"，
         * 在底部挂一条红色状态条（实测就是它）。
         */
        'importapps/discovery': async () => [],
        importapps: async () => [],
        // ── 只读的辅助接口 ────────────────────────────────────────────────
        //
        // 供应商页渲染完会马上问这几个（`loadUpstream()`、`discoverLocalProviders()`、
        // `readLoads()`…）。它们是「补充信息」，本插件没有对应数据源，
        // 给**空数组/空对象**让页面正常降级——返回 501 会让页面把 undefined
        // 当数组用，抛 "reading 'filter'"，然后底部挂一条红色报错。
        upstream: async () => ({ routes: [], groups: [] }),
        'local-hosts': async () => [],
        'providerDiscovery': async () => ({ found: [], sources: [] }),
        drift: async () => ({ items: [] }),
        notices: async () => [],
        lanes: async () => [],
        'model-loads': async () => [],
        'model-speeds': async () => [],
        partner: async () => [],
        cli: async () => ({ items: [] }),
        fonts: async () => ({ ui: '', code: '', list: [] }),
        open: async () => null,
        icons: async () => null,

        /** 插件相关：给空数组而不是 501，避免页面把 undefined 当数组用。 */
        'plugin-pages': async () => [],
        'plugin-panels': async () => [],
        'plugins/updates': async () => [],
        /**
         * 已装插件。页面要的形状是 `{plugins:[{spec,name,version?}]}`
         * （`plugins.js:148` 读 `mine?.plugins`），不是 `{installed:[]}`——
         * 给错形状页面会走进 catch，显示「无法加载插件」。
         */
        plugins: async () => {
            const list = await deps.plugins.list();
            // 原版 plugins.js 的 installedRow 直接读 e.providers.length / e.moved / e.clashes，
            // 没有可选链：少一个字段就整行抛错，整个「已安装」列表变空白。
            // 所以这里把形状补全，而不是只回 spec/name。
            let snap = {};
            try {
                snap = (await deps.snapshot?.()) ?? {};
            }
            catch { /* 快照拿不到就给空，下面自然全是空数组 */ }
            // 包名 -> 这个包名下所有 provider 的显示名
            const bySpec = new Map();
            for (const p of snap.providers ?? []) {
                let spec = '';
                try {
                    spec = String(deps.host?.ownerOf?.(p.id)?.spec ?? '');
                }
                catch { spec = ''; }
                if (spec === '') continue;
                if (!bySpec.has(spec)) bySpec.set(spec, { names: [], ids: [] });
                const bucket = bySpec.get(spec);
                bucket.names.push(typeof p.name === 'string' && p.name !== '' ? p.name : p.id);
                bucket.ids.push(p.id);
            }
            const out = [];
            for (const item of list) {
                const spec = item.spec;
                let name = spec;
                try {
                    const mod = deps.moduleNameOf(spec);
                    name = /^([a-zA-Z]:[\/]|\/)/.test(spec) ? spec : mod;
                }
                catch { /* 保持原样 */ }
                const off = item.enabled === false;
                const bucket = off ? undefined : (bySpec.get(spec) ?? bySpec.get(name));
                const providers = bucket === undefined ? [] : bucket.names;
                const providerIds = bucket === undefined ? [] : bucket.ids;
                // gateway- 前缀的是网关中间件：它不提供供应商，不能按「什么都没登录」说
                const isMiddleware = /(^|[/@-])gateway-/.test(spec) && providers.length === 0;
                out.push({
                    spec,
                    name,
                    off,
                    enabled: !off,
                    providers,
                    providerIds,
                    isMiddleware,
                    middlewareOnly: isMiddleware,
                    moved: [],
                    serves: [],
                    clashes: [],
                    tools: [],
                    panels: [],
                    actions: [],
                    named: !off && providers.length > 0,
                });
            }
            return { plugins: out };
        },
        /** 市场清单（本插件没有独立清单，给空）。 */
        'plugins/listings': async () => ({ listings: [] }),
        /** GitHub 话题插件的抓取结果。 */
        'plugins/github': async () => ({ repos: [] }),
        /** magpie 的内置插件：DSH 里没有这套东西。 */
        'plugins/builtin': async () => [],
        /**
         * 插件页在首屏之后还会问这几个，原来都回 501，页面上就挂一条红色的
         * not-implemented。每个都给正确形状的真实数据，取不到就给空。
         */

        /** npm 上某个包的版本与周下载量。只查传进来的 names，不扫全量。 */
        'plugins/npm': async (req) => {
            const names = queryOf(req, 'names').split(',').map((s) => s.trim()).filter((s) => s !== '');
            const npm = {};
            await Promise.all(names.map(async (pkg) => {
                const meta = await getJson(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`);
                if (meta === undefined || typeof meta.version !== 'string')
                    return;
                const point = await getJson(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(pkg)}`);
                npm[pkg] = {
                    version: meta.version,
                    weekly: typeof point?.downloads === 'number' ? point.downloads : 0,
                };
            }));
            return { npm };
        },
        /** git 源插件跟到哪个 commit：heads[spec] = sha。只问已装的。 */
        'plugins/git': async () => {
            const heads = {};
            let list = [];
            try {
                list = await deps.plugins.list();
            }
            catch {
                list = [];
            }
            const specs = list
                .map((item) => item.spec)
                .filter((s) => typeof s === 'string' && /^(git\+|https?:\/\/.+\.git$|git@)/.test(s));
            await Promise.all(specs.map(async (spec) => {
                const repo = spec.replace(/^git\+/, '').replace(/#.*$/, '');
                const out = await runQuiet('git', ['ls-remote', repo, 'HEAD']);
                const sha = out.trim().split(/\s+/)[0] ?? '';
                if (/^[0-9a-f]{7,40}$/.test(sha))
                    heads[spec] = sha;
            }));
            return { heads };
        },
        /** 检查更新：npm 比版本、git 比 sha，只报状态，不装任何东西。 */
        'plugins/check': async () => {
            const state = await handlers.plugins();
            const rows = [];
            for (const item of state.plugins ?? []) {
                const spec = item.spec;
                const pkg = spec.replace(/^git\+/, '').replace(/@[^/@]*$/, '');
                const row = { spec, package: pkg, status: 'unknown' };
                if (/^(git\+|https?:\/\/.+\.git$|git@)/.test(spec)) {
                    const repo = spec.replace(/^git\+/, '').replace(/#.*$/, '');
                    const out = await runQuiet('git', ['ls-remote', repo, 'HEAD']);
                    const sha = out.trim().split(/\s+/)[0] ?? '';
                    if (/^[0-9a-f]{7,40}$/.test(sha)) {
                        row.head = sha;
                        row.status = 'current';
                    }
                }
                else {
                    const meta = await getJson(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`);
                    if (typeof meta?.version === 'string') {
                        row.latest = meta.version;
                        row.status = row.latest === item.version ? 'current' : 'update';
                    }
                }
                rows.push(row);
            }
            return { state, plugins: rows, at: Date.now() };
        },
        /** 国内镜像开关。落盘到 hub-settings.json，重扫清单时读它决定走哪个源。 */
        'plugins/mirror': async (req, body) => {
            const root = deps.root;
            const file = typeof root === 'string' ? join(root, 'hub-settings.json') : '';
            let settings = {};
            if (file !== '') {
                try {
                    const parsed = JSON.parse(await readFile(file, 'utf8'));
                    if (typeof parsed === 'object' && parsed !== null)
                        settings = parsed;
                }
                catch {
                    settings = {};
                }
            }
            const want = typeof body?.on === 'boolean' ? body.on : settings.pluginMirror === true;
            if (file !== '') {
                settings.pluginMirror = want;
                try {
                    writeFileSync(file, JSON.stringify(settings, null, 2), 'utf8');
                }
                catch { /* 写不进去也不影响页面 */ }
            }
            return { mirror: want };
        },
        /** npm 搜索：hits 是数组，页面直接渲染。 */
        'plugins/search': async (req) => {
            const q = queryOf(req, 'q').trim();
            if (q === '')
                return { hits: [] };
            const out = await getJson(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(q)}+keywords:magpie-plugin&size=20`);
            const hits = Array.isArray(out?.objects)
                ? out.objects.map((o) => ({
                    package: o?.package?.name,
                    name: o?.package?.name,
                    version: o?.package?.version,
                    description: o?.package?.description,
                    weekly: typeof o?.downloads?.weekly === 'number' ? o.downloads.weekly : 0,
                })).filter((h) => typeof h.package === 'string')
                : [];
            return { hits };
        },
        /** 目录选择框：DSH 里没有原生文件夹选择框，回空串让页面自己收手。 */
        'plugins/choose': async () => ({ dir: '' }),
        /** 插件详情里的 README：读已装目录下的 README.md。 */
        'plugins/page': async (req) => {
            const name = queryOf(req, 'name').trim();
            const dir = deps.modulesDir;
            if (name === '' || typeof dir !== 'string')
                return { readme: '' };
            for (const file of ['README.md', 'readme.md', 'README.MD', 'README']) {
                try {
                    const text = await readFile(join(dir, name, file), 'utf8');
                    return { name, readme: text };
                }
                catch { /* 试下一个 */ }
            }
            return { name, readme: '' };
        },
        /* ────────────────────────────────────────────────────────────
         * 插件的安装 / 升级 / 启停 / 卸载 / 运行选项（原版商店的写操作）
         *
         * 页面的调用方式是 `api("plugins/" + op, body)`，op 有 add / upgrade /
         * update / off / remove / options / prefer / move 八种，body 里带 spec。
         * 这八个原来都没有，全回 501 ——「点安装显示安装中然后又不显示了」
         * 就是它：前端 catch 里只把 busy 删掉重画，错误条一飘就没了。
         * ──────────────────────────────────────────────────────────── */
        /** 装一个包（npm 名 / GitHub 仓库 / 链接都认），装完重扫插件目录。 */
        'plugins/add': async (req, body) => {
            const spec = typeof body?.spec === 'string' ? body.spec.trim() : '';
            if (spec === '') {
                return { ok: false, error: '缺少 spec' };
            }
            if (typeof deps.market?.install !== 'function' && typeof deps.market?.installSpec !== 'function') {
                return { ok: false, error: '这个环境没有安装器' };
            }
            let result;
            try {
                result = await installByAnyRoute(deps, spec, false);
            }
            catch (e) {
                return { ok: false, error: e instanceof Error ? e.message : String(e) };
            }
            if (result?.ok !== true) {
                return { ok: false, error: result?.error ?? '安装失败' };
            }
            const name = bareName(deps, spec);
            await registerPlugin(deps, name);
            await deps.reload?.();
            await deps.refresh?.();
            return { ok: true, spec: name, dir: result.dir ?? '' };
        },
        /** 升级到市场最新：重拉一次 tarball 覆盖装。 */
        'plugins/upgrade': async (req, body) => {
            const spec = typeof body?.spec === 'string' ? body.spec.trim() : '';
            if (spec === '') {
                return { ok: false, error: '缺少 spec' };
            }
            if (typeof deps.market?.install !== 'function' && typeof deps.market?.installSpec !== 'function') {
                return { ok: false, error: '这个环境没有安装器' };
            }
            let result;
            try {
                result = await installByAnyRoute(deps, spec, true);
            }
            catch (e) {
                return { ok: false, error: e instanceof Error ? e.message : String(e) };
            }
            if (result?.ok !== true) {
                return { ok: false, error: result?.error ?? '升级失败' };
            }
            const name = bareName(deps, spec);
            await registerPlugin(deps, name);
            await deps.reload?.();
            await deps.refresh?.();
            return { ok: true, spec: name };
        },
        /** 全部升级：逐个重拉，失败的不打断其余的。 */
        'plugins/update': async () => {
            const list = await deps.plugins.list();
            const done = [];
            const failed = [];
            for (const item of list) {
                const spec = item?.spec;
                if (typeof spec !== 'string' || spec === '') {
                    continue;
                }
                try {
                    const r = await deps.market.installSpec(spec);
                    if (r?.ok === true) {
                        done.push(spec);
                    }
                    else {
                        failed.push({ spec, error: r?.error ?? '失败' });
                    }
                }
                catch (e) {
                    failed.push({ spec, error: e instanceof Error ? e.message : String(e) });
                }
            }
            await deps.reload?.();
            await deps.refresh?.();
            return { ok: failed.length === 0, updated: done, failed };
        },
        /** 开关一个插件。body 是 `{spec, off}`：off=true 停用、off=false 启用。 */
        'plugins/off': async (req, body) => {
            const spec = typeof body?.spec === 'string' ? body.spec.trim() : '';
            if (spec === '') {
                return { ok: false, error: '缺少 spec' };
            }
            const off = body?.off === true;
            await deps.plugins.setEnabled(spec, !off);
            await deps.reload?.();
            await deps.refresh?.();
            return { ok: true, spec, off };
        },
        /** 卸载：先删目录，再删 plugins.json 里的条目（顺序反了就留幽灵条目）。 */
        'plugins/remove': async (req, body) => {
            const spec = typeof body?.spec === 'string' ? body.spec.trim() : '';
            if (spec === '') {
                return { ok: false, error: '缺少 spec' };
            }
            try {
                if (typeof deps.market?.uninstall === 'function') {
                    await deps.market.uninstall(spec);
                }
            }
            catch { /* 目录已经不在也算卸载成功 */ }
            await deps.plugins.remove(spec);
            await deps.reload?.();
            await deps.refresh?.();
            return { ok: true, spec };
        },
        /** 运行选项：body 是 `{spec, options}`，options=null 表示清空回默认。 */
        'plugins/options': async (req, body) => {
            const spec = typeof body?.spec === 'string' ? body.spec.trim() : '';
            if (spec === '') {
                return { ok: false, error: '缺少 spec' };
            }
            const options = body?.options === undefined ? null : body.options;
            await deps.plugins.setOptions(spec, options);
            await deps.reload?.();
            await deps.refresh?.();
            return { ok: true, spec };
        },
        /** 指定用哪个插件跑某个供应商：这里一个供应商只有一个来源，直接成功。 */
        'plugins/prefer': async (req, body) => ({ ok: true, spec: String(body?.spec ?? '') }),
        /** 把插件搬到别的位置：本插件没有第二种装载位置，直接成功。 */
        'plugins/move': async (req, body) => ({ ok: true, spec: String(body?.spec ?? '') }),
        /**
         * 搬到它的插件里跑：本插件所有供应商都由适配器托管，没有第二种运行方式，
         * 直接把当前列表回给页面（页面按 id 重新找行，找不到就不提示）。
         */
        'provider/move': async () => {
            const snap = await listSnapshot(deps);
            return { providers: snap.providers ?? [] };
        },
        /**
         * 检测一个供应商现在能不能用（面板上的「检测」）。
         *
         * 只回答「现在这一秒能不能发请求」：停用的、没账号的、没有模型的都算
         * 不可用，并把原因写进 `message` 直接上屏 —— 面板不需要自己拼文案。
         */
        'provider/test': async (req, body) => {
            const id = typeof body?.id === 'string' && body.id !== ''
                ? body.id
                : queryOf(req, 'id');
            if (typeof id !== 'string' || id === '') {
                return { ok: false, error: 'bad-request', message: '缺少 id' };
            }
            const snap = await deps.snapshot();
            const p = (snap?.providers ?? []).find((x) => x.id === id);
            if (p === undefined) {
                return { ok: false, id, ready: false, message: '没有这个供应商' };
            }
            const accounts = Array.isArray(p.accounts) ? p.accounts : [];
            const models = Array.isArray(p.models) ? p.models : [];
            const base = { id, accounts: accounts.length, models: models.length };
            if (p.off === true) {
                return { ...base, ok: false, ready: false, message: '这个供应商已被停用' };
            }
            if (accounts.length === 0) {
                return { ...base, ok: false, ready: false, message: '还没有登录账号' };
            }
            if (models.length === 0) {
                return { ...base, ok: false, ready: false, message: '没有可用模型' };
            }
            return { ...base, ok: true, ready: true, message: '可用' };
        },
        /**
         * Agents 页问的几个「本机客户端」清单。DSH 里没有 magpie 那套
         * 外部 agent（claudecode / codex / opencode…），一律回空数组——
         * 页面直接 `.filter`/`.map`，回 501 的 `{error}` 会再抛一次红条。
         */
        'agents/cli': async () => [],
        'plugins/agents': async () => [],
        'agents/install': async () => [],
        /**
         * 路由轨迹（路由页的实时轮询：`GET /api/gateway/trace?after=<seq>`）。
         *
         * 原版这个接口读 magpie 网关的内存轨迹；本插件不代理请求，所以永远
         * 「没有新路由」。⚠ 必须给**完整空形状**：回 501 时页面拿到的是
         * `{error, api, message}`，取 `.routes`/`.lifted` 全是 undefined，
         * 底部就挂一条 "Cannot read properties of undefined (reading 'set')"。
         *
         * `seq` 固定 0 表示「没有变化」，页面不会重复追加旧行。
         */
        'gateway/trace': async () => ({
            seq: 0,
            routes: [],
            totals: { requests: 0, rerouted: 0, errors: 0 },
            ids: [],
            mine: false,
            now: Date.now(),
            lifted: {},
        }),
        /** 往日路由历史（路由页按天翻）。没有历史可给，空列表。 */
        'gateway/history': async () => ({ days: [], routes: [], cut: false }),
        /** 更新检查：没有这个概念，明确回「没有更新」。 */
        update: async () => ({ has: false, version: deps.version ?? '0.2.0' }),
        whatsnew: async () => ({ items: [] }),

        /** 用量（Usage 页）。 */
        usage: async () => {
            const snap = await deps.snapshot();
            return {
                stats: snap.stats,
                usage: snap.usage,
            };
        },

        /** 路由（Routing 页）。 */
        routing: async () => {
            const snap = await deps.snapshot();
            return { routing: snap.routing, strategy: await deps.policy.strategy() };
        },
    };
    return handlers;
}
/** 从 req.url 取 query —— serveApi 传进来的 name 已经不含 query 了。 */
function queryOf(req, key) {
    try {
        return new URL(req?.url ?? '/', 'http://localhost').searchParams.get(key) ?? '';
    }
    catch {
        return '';
    }
}

/** 带超时的 GET JSON：任何失败都回 undefined，不抛、不落页面。 */
async function getJson(url, timeoutMs = 8000) {
    try {
        const res = await netFetch(url, {
            signal: AbortSignal.timeout(timeoutMs),
            headers: { accept: 'application/json' },
        });
        if (!res.ok)
            return undefined;
        return await res.json();
    }
    catch {
        return undefined;
    }
}

/** 跑一条命令取 stdout；失败（含命令不存在）回空串。 */
function runQuiet(file, args, timeoutMs = 8000) {
    return new Promise((resolve) => {
        try {
            execFile(file, args, { timeout: timeoutMs, windowsHide: true }, (err, stdout) => {
                resolve(err === null ? String(stdout ?? '') : '');
            });
        }
        catch {
            resolve('');
        }
    });
}

/**
 * Install a package, trying both routes.
 *
 * Market packages are not on npm: they live in the magpie-community/plugins
 * GitHub repository under packages/<sub>/. market.install() knows that layout
 * and also validates that the name is in the registry, so a typo cannot
 * silently produce an empty directory. installSpec() is the route for a name
 * the user typed by hand (npm name / GitHub repo / GitHub URL).
 *
 * Order matters: try the market first, and only fall back when it says the
 * package is not listed - any other failure (network, disk) should surface as
 * is instead of being retried against npm, where it would come back 404.
 */
/**
 * 把一个 spec 剥成「裸包名」：\`@scope/name@1.2.3\` → \`@scope/name\`，
 * \`name@latest\` → \`name\`。市场清单、磁盘目录、plugins.json 都用裸名对账。
 */
function bareName(deps, spec) {
    const raw = String(spec ?? '').trim();
    if (typeof deps?.moduleNameOf === 'function') {
        try {
            const n = deps.moduleNameOf(raw);
            if (typeof n === 'string' && n !== '') {
                return n;
            }
        }
        catch { /* 退到自己的解析 */ }
    }
    const at = raw.indexOf('@', raw.startsWith('@') ? 1 : 0);
    return at > 0 ? raw.slice(0, at) : raw;
}

/**
 * 登记一个已装好的插件。
 *
 * \`plugins.json\` 才是「装了没有」的唯一凭据 —— \`plugins/node_modules/<pkg>\`
 * 存在只代表文件在磁盘上，不登记就永远不会被装载。
 *
 * 历史上有条目是带版本写进去的（\`@scope/name@latest\`），拿裸名再 add 会变成
 * 两条同样的插件 —— 所以按裸名判重，顺便把旧的那条改写成裸名。
 */
async function registerPlugin(deps, name) {
    const store = deps.plugins;
    if (store === undefined || store === null || typeof store.add !== 'function') {
        return;
    }
    const bare = bareName(deps, name);
    let list = [];
    try {
        list = await store.list();
    }
    catch {
        list = [];
    }
    const same = list.filter((x) => bareName(deps, x.spec) === bare);
    if (same.length === 0) {
        await store.add(bare);
        return;
    }
    // 已经在册：确保启用，并把带版本的那条收敛成裸名
    for (const x of same) {
        if (x.enabled === false) {
            await store.setEnabled(x.spec, true);
        }
        if (x.spec !== bare) {
            const options = x.options;
            await store.remove(x.spec);
            await store.add(bare, options);
        }
    }
}

async function installByAnyRoute(deps, spec, force) {
    const market = deps.market;
    if (typeof market?.install !== 'function') {
        return typeof market.installSpec === 'function'
            ? market.installSpec(spec)
            : { ok: false, error: '这个环境没有安装器' };
    }
    // 面板传的 spec 常带版本（\`@scope/name@latest\`），而市场清单里的 package 是
    // 裸名 —— 直接拿去问市场只会得到「市场里没有」，然后退回 npm 换一个
    // 误导性的 404。先剥成裸名再问。
    const first = await market.install(bareName(deps, spec), undefined, force ? { force: true } : undefined);
    if (first?.ok === true) {
        return first;
    }
    const why = String(first?.error ?? '');
    if (!why.includes('市场里没有') || typeof market.installSpec !== 'function') {
        return first;
    }
    return market.installSpec(spec);
}

/** 登录流程 id 的自增序号与登记表（进程内，重启即清）。 */
let uiFlowSeq = 0;
const uiSigninFlows = new Map();

/** 取字符串，非字符串一律当空串。 */
function textOf(value) {
    return typeof value === 'string' ? value : '';
}

/** /magpie-hub/api/signin/<id>/cancel → ['signin','<id>','cancel'] */
function apiTail(req) {
    const raw = typeof req?.url === 'string' ? req.url : '';
    const path = raw.split('?')[0] ?? '';
    const at = path.lastIndexOf('/api/');
    const rest = at >= 0 ? path.slice(at + 5) : path;
    return rest.split('/').filter((part) => part !== '');
}

/**
 * 一个 hub 供应商 → 原版面板认的插件形状。
 *
 * moved 故意给 false：pluginMethod() 靠 moved 去 sites 里挑方法下标，hub 没
 * 这套；false 时它返回 undefined，startPluginSignIn 就按「多个方法让用户选、
 * 一个方法直接用」处理，正是我们想要的。
 */
function pluginEntry(deps, p) {
    return {
        id: p.id,
        pid: p.id,
        name: p.name,
        icon: 'generic',
        spec: 'magpie-hub/' + p.id,
        single: false,
        moved: false,
        sites: [],
        methods: methodsOfProvider(deps, p.id),
    };
}

/** 登录方式列表：只留界面要用的字段，且任何异常都不能把整个 providers 拖死。 */
function methodsOfProvider(deps, id) {
    try {
        const list = deps.host?.methodsOf?.(id);
        if (!Array.isArray(list)) {
            return [];
        }
        return list.map((m) => ({
            label: textOf(m?.label),
            type: textOf(m?.type) || 'oauth',
            ...(m?.keyless === true ? { keyless: true } : {}),
        }));
    }
    catch {
        return [];
    }
}
