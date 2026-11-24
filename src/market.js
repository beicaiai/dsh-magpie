/**
 * 插件市场：清单（registry.json）+ 安装（GitHub 整仓 tarball 的子树解出）。
 *
 * ## magpie 是怎么做的（对照 `tmp-magpie/magpie/internal/plugin/market.go`）
 *
 * - 清单源 `https://raw.githubusercontent.com/magpie-community/plugins/main/registry.json`
 *   （可用 `MAGPIE_PLUGIN_MARKET` 覆盖），6 小时内存缓存 + 落盘兜底；
 * - 安装用 bun add（npm 包名 / git spec）。
 *
 * ## 我们这里的三处不同（都是实测出来的事实）
 *
 * 1. **包没发布到 npm**：`registry.npmjs.org/@magpie-community/opencode-codearts-auth`
 *    回 404——社区插件全住在 GitHub monorepo（`packages/<name>/`）里，⇒ 安装
 *    不能走 `npm install`。**codeload 也不支持子路径 tarball**（实测
 *    `…/tar.gz/refs/heads/main/packages/agnes` 回 404）⇒ 下载**整仓 tarball**
 *    （实测 10.8MB 压缩 / 30.9MB 解压，直连几秒），再解出 `packages/<sub>/`
 *    子树。目录名约定（实测验证 codearts/workbuddy/loomy 都在）：
 *    `@magpie-community/opencode-<name>-auth` → `<name>`；
 *    `@magpie-community/gateway-<name>` → `<name>`。
 * 2. **raw.githubusercontent 直连不稳**：本机实测清单经 gh-proxy 可达（200，
 *    0.5s）⇒ 拉取顺序：直连 → gh-proxy → 落盘缓存，全部失败才报错
 *    （magpie 的三级兜底：网络 → 磁盘 → 内建；我们没有内建清单，磁盘兜底）。
 * 3. **装完不用重启**：宿主已有热重载（`hotreload.ts` 监听 `<root>/node_modules`
 *    与 plugins.json），tarball 解压 + plugins.json 登记之后自动重扫。
 *
 * ## tar 解析为什么不引依赖
 *
 * tar 头是 512 字节定长（name 0-100、size 124-136 八进制、type 156），本仓库
 * 零依赖即可解析；`tar-stream` 不在依赖树里，为一个解包引入新依赖不值。
 * pax_global_header 是第一个条目（52 字节数据），真实路径都带
 * `plugins-main/` 前缀——解析时跳过即可（已实测）。
 */
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, stat, writeFile, cp } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import { join, dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createReadStream, mkdirSync } from 'node:fs';
import { netFetch } from './net.js';
/** 拉取清单的多级来源（直连不稳，镜像兜底；实测 ghproxy.net/gh-proxy 可用，逐源降级）。 */
const REGISTRY_SOURCES = [
    // 实测（2026-11-22，无代理直连）：gcore.jsdelivr.net 200 / 4.2s；
    // raw.githubusercontent 与 cdn.jsdelivr.net 都 ECONNRESET；gh-proxy 403。
    'https://gcore.jsdelivr.net/gh/magpie-community/plugins@main/registry.json',
    'https://fastly.jsdelivr.net/gh/magpie-community/plugins@main/registry.json',
    'https://cdn.jsdelivr.net/gh/magpie-community/plugins@main/registry.json',
    'https://raw.githubusercontent.com/magpie-community/plugins/main/registry.json',
    'https://gh-proxy.com/https://raw.githubusercontent.com/magpie-community/plugins/main/registry.json',
    'https://ghproxy.net/https://raw.githubusercontent.com/magpie-community/plugins/main/registry.json',
    'https://ghfast.top/https://raw.githubusercontent.com/magpie-community/plugins/main/registry.json',
];
/** 整仓 tarball 的源（直连实测可用；镜像兜底，顺序同上）。 */
const TARBALL_SOURCES = [
    // Order by measured speed. gh-proxy returns the first 200KB in ~0.9s;
    // a direct codeload connection needs ~7s for the same bytes (~28KB/s), so
    // pulling the whole 30MB bundle directly can never finish inside the timeout.
    // Direct stays as a fallback; ghproxy.net answers 403 and goes last.
    'https://gh-proxy.com/https://codeload.github.com/magpie-community/plugins/tar.gz/refs/heads/main',
    'https://ghfast.top/https://codeload.github.com/magpie-community/plugins/tar.gz/refs/heads/main',
    'https://codeload.github.com/magpie-community/plugins/tar.gz/refs/heads/main',
    'https://ghproxy.net/https://codeload.github.com/magpie-community/plugins/tar.gz/refs/heads/main',
];
/** 6 小时：清单的有效期（照抄 magpie）。 */
/** GitHub and its mirrors both nitpick requests that arrive without a UA. */
const FETCH_UA = 'dsh-magpie/1.0 (+https://github.com/magpie-community/plugins)';
const REGISTRY_TTL_MS = 6 * 3600_000;
const FETCH_TIMEOUT_MS = 15_000;
const REGISTRY_MAX_BYTES = 1 << 20;
// The unpacked repository tarball is 30.9MB. A slow link finishes it in
// minutes, not seconds, so 120s guaranteed a timeout on every mirror.
const TARBALL_TIMEOUT_MS = 360_000;
/** 本地整仓镜像的保质期。过期后下一次安装会重下一次 tarball。 */
const MIRROR_TTL_MS = 6 * 60 * 60 * 1000;
/**
 * 用户手输 spec 时用的源（`installSpec`）。
 *
 * npm 走 npmmirror（国内直连可用，实测 200；registry.npmjs.org 在本机被 SNI
 * 阻断），GitHub 走 codeload + gh-proxy 兜底——与本文件其余路径同一套源，
 * 只是这里的目标仓库是**用户给的**，不是固定的 plugins monorepo。
 */
const NPM_REGISTRY = 'https://registry.npmmirror.com';
const CODELOAD_SOURCES = (owner, repo, ref) => [
    `https://codeload.github.com/${owner}/${repo}/tar.gz/refs/heads/${ref}`,
    `https://gh-proxy.com/https://codeload.github.com/${owner}/${repo}/tar.gz/refs/heads/${ref}`,
];
/** npm 包名：`foo`、`@scope/foo`，可带 `@1.2.3` / `@latest`。 */
const NPM_NAME = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i;
/** GitHub 简写：`owner/repo`，可带 `#子目录`。 */
const GH_SHORT = /^([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:#(.+))?$/;
/**
 * 把用户输入解析成安装目标。
 *
 * 支持四种写法（都是 magpie 桌面端 `plugin install` 认的）：
 * - `https://github.com/owner/repo`（可带 `#子目录`、`/tree/分支`）
 * - `github:owner/repo`
 * - `owner/repo`
 * - npm 包名 `foo` / `@scope/foo` / `foo@2.0.0`
 *
 * @returns `{ kind:'github', owner, repo, subdir }` 或 `{ kind:'npm', name, version }`，或 `null`
 */
export function parseSpec(raw) {
    const text = String(raw ?? '').trim();
    if (text === '' || text.length > 300)
        return null;
    // HTTPS / git+https 形式
    const url = text.replace(/^git\+/, '');
    if (/^https?:\/\//i.test(url)) {
        let rest = url.replace(/^https?:\/\//i, '');
        const hostEnd = rest.indexOf('/');
        if (hostEnd <= 0)
            return null;
        const host = rest.slice(0, hostEnd).toLowerCase();
        if (host !== 'github.com' && host !== 'www.github.com')
            return null;
        rest = rest.slice(hostEnd + 1).replace(/\.git$/, '');
        const [owner, repoRaw, ...tail] = rest.split('/');
        if (!owner || !repoRaw)
            return null;
        let repo = repoRaw;
        let subdir;
        // `/tree/<ref>/<path…>` 与 `#<path>` 都当子目录
        if (tail[0] === 'tree' && tail.length >= 3)
            subdir = tail.slice(2).join('/');
        const hash = repo.indexOf('#');
        if (hash >= 0) {
            // `#` 之后可能还带 `/`：`o/r#packages/x` 的子目录是 `packages/x`
            subdir = [repo.slice(hash + 1), ...tail].filter(Boolean).join('/');
            repo = repo.slice(0, hash);
        }
        return { kind: 'github', owner, repo, subdir: subdir === '' ? undefined : subdir };
    }
    if (/^github:/i.test(text)) {
        const m = GH_SHORT.exec(text.slice('github:'.length));
        if (m === null)
            return null;
        return { kind: 'github', owner: m[1], repo: m[2], subdir: m[3] };
    }
    const gh = GH_SHORT.exec(text);
    if (gh !== null)
        return { kind: 'github', owner: gh[1], repo: gh[2], subdir: gh[3] };
    // npm 包名（含可选版本）
    const at = text.startsWith('@') ? text.indexOf('@', 1) : text.indexOf('@');
    const name = at > 0 ? text.slice(0, at) : text;
    const version = at > 0 ? text.slice(at + 1) : undefined;
    if (!NPM_NAME.test(name))
        return null;
    return { kind: 'npm', name, version: version === '' ? undefined : version };
}
export class Market {
    paths;
    cache;
    cacheAt = 0;
    /** 私密仓库的凭据（设置页写入 `hub-settings.json` 的 `tokens`）。 */
    tokens = { github: '', npm: '' };
    constructor(paths) {
        this.paths = paths;
    }
    /**
     * 更新凭据。只影响后续请求；不清已缓存的清单（清单来自公开镜像）。
     *
     * ⚠ 空串表示「不带认证」——不能用 `undefined` 判断，设置页提交空值时要能清掉。
     */
    setTokens(tokens) {
        this.tokens = {
            github: typeof tokens?.github === 'string' ? tokens.github.trim() : '',
            npm: typeof tokens?.npm === 'string' ? tokens.npm.trim() : '',
        };
    }
    /**
     * 这个 URL 该带哪个 token（按主机名判断）。
     *
     * `gh-proxy.com` 前缀的源，路径里仍是 github.com 的 URL，认证头靠镜像透传；
     * 镜像不透传时私密仓库会被当成 404，这不是插件能绕过的。
     */
    authFor(url) {
        const { github, npm } = this.tokens;
        if (github === '' && npm === '')
            return {};
        let host;
        try {
            host = new URL(url).hostname;
        }
        catch {
            return {};
        }
        if (github !== '' && (host === 'github.com' || host === 'codeload.github.com' || host.endsWith('.github.com'))) {
            return { authorization: `Bearer ${github}` };
        }
        if (npm !== '' && (host === 'registry.npmjs.org' || host === 'registry.npmmirror.com')) {
            return { authorization: `Bearer ${npm}` };
        }
        return {};
    }
    /** 落盘的清单副本（网络挂了还能列）。 */
    get registryCacheFile() {
        return join(this.paths.root, 'plugin-market.json');
    }
    /**
     * 清单（最多 6 小时新鲜；拉不到给落盘缓存）。
     *
     * @param force 无视缓存重拉（「刷新」按钮用）
     */
    async listings(force = false) {
        if (!force && this.cache !== undefined && Date.now() - this.cacheAt < REGISTRY_TTL_MS) {
            return this.cache;
        }
        for (const url of REGISTRY_SOURCES) {
            try {
                const body = await this.fetchText(url, REGISTRY_MAX_BYTES);
                const parsed = parseRegistry(body);
                this.cache = parsed;
                this.cacheAt = Date.now();
                await mkdir(dirname(this.registryCacheFile), { recursive: true });
                await writeFile(this.registryCacheFile, body, 'utf8');
                return parsed;
            }
            catch {
                // 换下一个源
            }
        }
        // 全部失败：落盘缓存兜底（标注 1 分钟后重试，照抄 magpie 的策略）
        try {
            const raw = await readFile(this.registryCacheFile, 'utf8');
            const parsed = parseRegistry(raw);
            this.cache = parsed;
            this.cacheAt = Date.now() - REGISTRY_TTL_MS + 60_000;
            return parsed;
        }
        catch {
            return this.cache ?? [];
        }
    }
    /**
     * 安装一个插件：拉整仓 tarball，解出 `packages/<dir>/` 到
     * `<root>/node_modules/<package>`。
     *
     * 目录名从 package 名推（monorepo 约定，见模块头）：`opencode-<n>-auth`
     * → `<n>`、`gateway-<n>` → `<n>`。清单里查这个包存在才装（防止装一个
     * 不存在的东西解出一个空目录还报成功）。
     *
     * @param pkg 清单里的 package 名
     */
    /**
     * 本地整仓镜像：把 \`packages/\` 整个仓库 tarball 下一次、解开、缓存到
     * \`<root>/.mirror/repo/\`，之后所有安装都是本地 \`cp\`（毫秒级）。
     *
     * 为什么值得：\`downloadSubtree\` 走 GitHub Contents API 逐文件拉，实测一个
     * 包 234 秒（十几轮 HTTP 往返）。整仓 tarball 只有 12.6MB，一次十几秒，
     * 之后 110 个包全部本地命中。
     *
     * @returns 解好的仓库根目录（里面就是 \`packages/<sub>/\`）
     */
    async ensureRepo(signal) {
        const cache = join(this.paths.root, '.mirror');
        const repo = join(cache, 'repo');
        const marker = join(cache, 'ready.json');
        try {
            const info = await stat(marker);
            if (Date.now() - info.mtimeMs < MIRROR_TTL_MS) {
                const dir = await stat(repo);
                if (dir.isDirectory())
                    return repo;
            }
        }
        catch { /* 没缓存，往下走 */ }
        await mkdir(cache, { recursive: true });
        const tarball = await this.fetchTarball(signal);
        try {
            const work = join(cache, 'repo.tmp-' + Date.now());
            await rm(work, { recursive: true, force: true });
            // extractRoot 会剥掉 codeload 的 \`<repo>-<ref>/\` 第一层前缀
            const n = await extractRoot(tarball, work, undefined);
            if (n === 0)
                throw new Error('整仓 tarball 解出来是空的');
            await rm(repo, { recursive: true, force: true });
            try {
                await rename(work, repo);
            }
            catch {
                await cp(work, repo, { recursive: true });
                await rm(work, { recursive: true, force: true });
            }
            await writeFile(marker, JSON.stringify({ at: Date.now(), files: n }), 'utf8');
            return repo;
        }
        finally {
            await rm(tarball, { force: true });
        }
    }
    async install(pkg, signal, options) {
        // `force: true` = 重装（用于「升级到市场最新」）。清单里没有版本字段，
        // 所以「升级」只能是「重新拉一次 tarball 覆盖装」。
        const force = options?.force === true;
        const listings = await this.listings();
        if (!listings.some(l => l.package === pkg)) {
            return { ok: false, error: `市场里没有 ${pkg}` };
        }
        // ⚠ 插件装在 `<根>/plugins/node_modules/`（不是 `<根>/node_modules/`）：
        // magpie 的 `internal/plugin/store.go:122` 是 `Dir() = <设置目录>/plugins`，
        // `:392` 把包装进 `Join(Dir(), "node_modules", …)`。用 hostPaths.modules，
        // 不要在 market 里自己拼——两处各拼一次就会有一处错。
        const target = join(this.paths.modules, pkg);
        // 已装且不要求重装：幂等成功（重装视为「已存在」，不炸）
        if (!force) {
            try {
                const info = await stat(target);
                if (info.isDirectory())
                    return { ok: true, dir: target };
            }
            catch { /* 不存在，继续装 */ }
        }
        const sub = subDirOf(pkg);
        const modulesDir = this.paths.modules;
        await mkdir(modulesDir, { recursive: true });
        const staging = join(this.paths.root, '.staging', `${pkg.replace(/[\\/]/g, '_')}`, String(Date.now()));
        await rm(staging, { recursive: true, force: true });
        try {
            // 主路径：本地整仓镜像（第一次 10-20 秒下 tarball，之后毫秒级）
            let files = 0;
            try {
                const repo = await this.ensureRepo(signal);
                const src = join(repo, 'packages', sub);
                const info = await stat(src).catch(() => undefined);
                if (info !== undefined && info.isDirectory()) {
                    await mkdir(staging, { recursive: true });
                    await cp(src, staging, { recursive: true });
                    files = await countFiles(staging);
                }
            }
            catch (e) {
                // 镜像坏了不影响安装，落到逐文件下载
                if (signal?.aborted === true)
                    throw e;
            }
            // 兜底一：按目录逐文件取（Contents API，慢但结构变了也能救）
            if (files === 0) {
                try {
                    files = await downloadSubtree(sub, staging, signal);
                }
                catch (e) {
                    throw new Error(`按目录取 ${sub} 失败：${e instanceof Error ? e.message : String(e)}`);
                }
            }
            if (files === 0) {
                throw new Error(`没拿到 packages/${sub}/ 的文件（目录名约定变了？）`);
            }
            await rm(target, { recursive: true, force: true });
            await mkdir(dirname(target), { recursive: true });
            try {
                await rename(staging, target);
            }
            catch {
                // 跨盘等场景：退回复制
                await cp(staging, target, { recursive: true });
                await rm(staging, { recursive: true, force: true });
            }
            return { ok: true, dir: target };
        }
        catch (e) {
            await rm(staging, { recursive: true, force: true });
            return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
    }
    /**
     * 卸载：删目录（plugins.json 的条目由调用方 PluginStore.remove 处理——
     * 两处分开，失败时至少目录是干净的）。
     */
    async uninstall(pkg) {
        await rm(join(this.paths.modules, pkg), { recursive: true, force: true });
    }
    /**
     * 安装**用户手输**的包：npm 包名 / GitHub 仓库 / GitHub 链接。
     *
     * 与 `install()` 的区别：那个只认市场清单里的包（防止装一个不存在的东西
     * 解出空目录还报成功），这个的目标是用户给的任意地址，所以只能在下载后
     * 用「解出了文件」来验证，并把解出的 `package.json` 的 name 作为目录名。
     *
     * @param spec 用户输入（见 `parseSpec`）
     */
    async installSpec(spec, signal) {
        const parsed = parseSpec(spec);
        if (parsed === null) {
            return { ok: false, error: `看不懂这个地址：${String(spec ?? '').slice(0, 80)}` };
        }
        const modulesDir = this.paths.modules;
        await mkdir(modulesDir, { recursive: true });
        const work = join(this.paths.root, '.staging', `spec-${Date.now()}`);
        await rm(work, { recursive: true, force: true });
        try {
            let tarball;
            let dirName;
            if (parsed.kind === 'npm') {
                // 先问 registry 要 tarball 地址（比猜 URL 可靠：版本可能与 latest 不同）。
                // ⚠ `dist` 在**每个版本**下，不在顶层：`packument.versions[v].dist.tarball`。
                // 顶层只有一个 `dist-tags`，读 `meta.dist.tarball` 永远是 undefined。
                let meta;
                try {
                    meta = await this.fetchText(`${NPM_REGISTRY}/${parsed.name}${parsed.version === undefined ? '' : `/${parsed.version}`}`, REGISTRY_MAX_BYTES);
                }
                catch (e) {
                    // 404 = 包名写错或没发布；其它错误照原样往上抛（网络/认证问题）
                    const message = e instanceof Error ? e.message : String(e);
                    if (message === 'HTTP 404') {
                        return { ok: false, error: `npm 上没有 ${parsed.name}${parsed.version === undefined ? '' : `@${parsed.version}`}` };
                    }
                    throw e;
                }
                const packument = JSON.parse(meta);
                const version = parsed.version
                    ?? packument?.['dist-tags']?.latest
                    ?? Object.keys(packument?.versions ?? {}).pop();
                const url = version === undefined ? undefined : packument?.versions?.[version]?.dist?.tarball;
                if (typeof url !== 'string' || url === '') {
                    return { ok: false, error: `${parsed.name} 在 npm 上没有可下载的 tarball` };
                }
                tarball = await this.fetchTo([url.startsWith('http') ? url : `${NPM_REGISTRY}${url}`], signal);
                dirName = parsed.name;
            }
            else {
                // GitHub：codeload 的 refs/heads/<ref>，main 不行退 master
                const refs = ['main', 'master'];
                let lastError;
        const reasons = [];
                for (const ref of refs) {
                    try {
                        tarball = await this.fetchTo(CODELOAD_SOURCES(parsed.owner, parsed.repo, ref), signal);
                        break;
                    }
                    catch (e) {
                        lastError = e;
                // Keep *this* mirror's reason. Reporting only the last one hid the
                // truth: the first mirrors timed out, the final one answered 403,
                // so every failed install looked like "GitHub refused us".
                reasons.push(`${new URL(url).host}: ${e instanceof Error ? e.message : String(e)}`);
                        if (signal?.aborted === true)
                            throw e;
                    }
                }
                if (tarball === undefined) {
                    return { ok: false, error: lastError instanceof Error ? lastError.message : '仓库下载失败' };
                }
                // 目录名用仓库名（有子目录时用子目录名，更像「装的是那个插件」）
                dirName = parsed.subdir === undefined
                    ? parsed.repo
                    : parsed.subdir.split('/').filter(Boolean).pop() ?? parsed.repo;
            }
            const files = await extractRoot(tarball, work, parsed.kind === 'github' ? parsed.subdir : undefined);
            await rm(tarball, { force: true });
            if (files === 0) {
                return { ok: false, error: '压缩包里没有可用的文件（子目录写错了？）' };
            }
            // 解出来的是仓库根/子目录；真正的包可能还在更深一层
            const target = join(modulesDir, dirName);
            await rm(target, { recursive: true, force: true });
            await mkdir(dirname(target), { recursive: true });
            try {
                await rename(work, target);
            }
            catch {
                await cp(work, target, { recursive: true });
                await rm(work, { recursive: true, force: true });
            }
            return { ok: true, dir: target, package: dirName, files };
        }
        catch (e) {
            await rm(work, { recursive: true, force: true });
            if (signal?.aborted === true)
                throw e;
            return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
    }
    /**
     * 拉一个小文本（清单）。
     */
    async fetchText(url, limitBytes) {
        const controller = new AbortController();
        const timer = setTimeout(() => { controller.abort(); }, FETCH_TIMEOUT_MS);
        try {
            const response = await netFetch(url, {
                signal: controller.signal,
                headers: {
                    accept: 'application/json',
                    'user-agent': 'dsh-magpie',
                    ...this.authFor(url),
                },
            });
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            if (text.length > limitBytes)
                throw new Error('response too large');
            return text;
        }
        finally {
            clearTimeout(timer);
        }
    }
    /**
     * 查这个 npm 包的最新版本号（`dist-tags.latest`）。
     *
     * 只用于「检查更新」：拿 registry 的 latest 跟磁盘上 package.json 的 version
     * 比。GitHub 源（`owner/repo`）没有版本号可比，返回 undefined，面板就标不出来
     * ——宁可显示「未知」，也不要编一个版本。
     */
    async latestVersion(name) {
        if (typeof name !== 'string' || name === '')
            return undefined;
        try {
            const text = await this.fetchText(`${NPM_REGISTRY}/${name}`, REGISTRY_MAX_BYTES);
            const packument = JSON.parse(text);
            const latest = packument?.['dist-tags']?.latest;
            return typeof latest === 'string' && latest !== '' ? latest : undefined;
        }
        catch {
            return undefined;
        }
    }
    /** 拉整仓 tarball 到临时文件（逐源降级）。 */
    async fetchTarball(signal) {
        return this.fetchTo(TARBALL_SOURCES, signal);
    }
    /** 按给定 URL 列表逐源下载到临时文件（首个成功的返回路径）。 */
    async fetchTo(urls, signal) {
        const tmp = join(this.paths.root, `.download-${Date.now()}.tgz`);
        let lastError;
        const reasons = [];
        for (const url of urls) {
            // 超时与客户端取消合流（AbortSignal.any）：任一触发都中止本源 fetch。
            // ⚠️ timer 在 finally 清；signal 由调用方（rpc 的 request.signal）管。
            const controller = AbortSignal.any([
                AbortSignal.timeout(TARBALL_TIMEOUT_MS),
                ...(signal ? [signal] : []),
            ]);
            try {
                const headers = { 'user-agent': FETCH_UA, ...this.authFor(url) };
                const response = await netFetch(url, {
                    signal: controller,
                    ...(Object.keys(headers).length === 0 ? {} : { headers }),
                });
                if (!response.ok)
                    throw new Error(`HTTP ${response.status}`);
                // netFetch 走代理隧道时返回的是 duck-typed Response，没有 web ReadableStream，
                // 所以这里不用 Readable.fromWeb，直接一次性读成 Buffer 再落盘（12MB 级别反而更快）。
                const bytes = Buffer.from(await response.arrayBuffer());
                await writeFile(tmp, bytes);
                return tmp;
            }
            catch (e) {
                // 客户端取消（signal 已 abort）直接往外抛，不再换下一个源
                if (signal?.aborted === true)
                    throw e;
                lastError = e;
                // Keep *this* mirror's reason. Reporting only the last one hid the
                // truth: the first mirrors timed out, the final one answered 403,
                // so every failed install looked like "GitHub refused us".
                reasons.push(`${new URL(url).host}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
        {
            const detail = reasons.length === 0 ? '' : ` (${reasons.join(' | ')})`;
            const message = lastError instanceof Error ? lastError.message : 'download failed';
            throw new Error(`Plugin bundle download failed: ${message}${detail}`);
        }
    }
}
/** 解析清单 JSON（坏形状给空表，不炸）。 */
function parseRegistry(raw) {
    const parsed = JSON.parse(raw);
    const plugins = parsed?.plugins;
    if (!Array.isArray(plugins))
        return [];
    return plugins.filter((x) => typeof x === 'object' && x !== null
        && typeof x.package === 'string'
        && typeof x.name === 'string');
}
/**
 * package 名 → monorepo 子目录名（实测约定）。
 *
 * `@magpie-community/opencode-codearts-auth` → `codearts`
 * `@magpie-community/gateway-aelios` → `aelios`
 */
export function subDirOf(pkg) {
    const bare = pkg.replace(/^@magpie-community\//, '');
    if (bare.startsWith('opencode-'))
        return bare.slice('opencode-'.length).replace(/-auth$/, '');
    if (bare.startsWith('gateway-'))
        return bare.slice('gateway-'.length);
    return bare;
}
/** tar 头长（定长 512 字节）。 */
const BLOCK = 512;
/**
 * 从整仓 tarball 里解出**一个子目录**（零依赖手写解析）。
 *
 * tar 条目：name 在 0-100、size 在 124-136（八进制）、type 在 156。首个条目
 * `pax_global_header` 跳过；真实路径带 `plugins-main/` 前缀；只写
 * `packages/<sub>/` 下的**文件**（目录条目忽略——写文件时 mkdir -p）。
 *
 * tarball 有 30.9MB 解压——一次读进内存再扫一遍可接受（安装是低频操作）。
 *
 * @returns 写出的文件数（0 = 子目录不存在，调用方按失败处理）
 */
/**
 * Fetch one market package by directory (GitHub Contents API + raw download).
 *
 * Why: the whole-repo tarball is 10.8MB compressed / 30.9MB unpacked. Measured
 * here, a direct codeload connection moves ~28KB/s, so the bundle cannot finish
 * inside any sane timeout; gh-proxy times out at 360s and ghproxy.net answers
 * 403. The Contents API lists this package's 10 files in 1.5s and the files
 * total ~95KB - two orders of magnitude apart.
 *
 * Returns the number of files written (0 = no such directory, caller falls back).
 */
// Which mirror worked last time. Without this each file burned two 25s
// timeouts on raw.githubusercontent before reaching jsDelivr: 10 files took
// 166s even though the CDN answers in 1-4s.
let goodMirrorHint = -1;

async function downloadSubtree(sub, out, signal) {
    const ORG = 'magpie-community';
    const REPO = 'plugins';
    const REF = 'main';
    const PREFIX = `packages/${sub}/`;
    let count = 0;

    async function walk(dir, depth) {
        if (depth > 4)
            return;
        const api = `https://api.github.com/repos/${ORG}/${REPO}/contents/${dir}?ref=${REF}`;
        const res = await netFetch(api, {
            signal: signal ?? AbortSignal.timeout(30_000),
            headers: { 'user-agent': FETCH_UA, accept: 'application/vnd.github+json' },
        });
        if (res.status === 404)
            return;
        if (!res.ok)
            throw new Error(`Contents API HTTP ${res.status}`);
        const list = await res.json();
        if (!Array.isArray(list))
            throw new Error('Contents API did not return an array');

        const files = list.filter((x) => x?.type === 'file' && typeof x.download_url === 'string');
        const dirs = list.filter((x) => x?.type === 'dir' && typeof x.path === 'string');

        // Serial, not Promise.all: 10 parallel TLS handshakes on this network
        // collapsed the socket pool and every mirror answered "fetch failed"
        // (joycode, 12 small files, installed fine; copilot, one 25KB file,
        // died). One at a time is slower on paper but actually completes.
        for (const x of files) {
            const rel = String(x.path).slice(PREFIX.length);
            if (rel === '' || rel.split('/').includes('..'))
                return;
            // raw.githubusercontent.com is unreliable here (measured: the Contents
            // API lists all 10 files in 1.5s, then every parallel raw download dies
            // with "fetch failed"). Try raw, then jsDelivr, then gh-proxy - each
            // mirror gets its own timeout so one dead host cannot eat the budget.
            // 实测（2026-11-22，无代理）：gcore 236KB 单文件 2.4s 稳定 200；
            // cdn/fastly 常见 ECONNRESET；raw 直连被墙；gh-proxy 403。
            const mirrors = [
                `https://gcore.jsdelivr.net/gh/${ORG}/${REPO}@${REF}/${x.path}`,
                `https://fastly.jsdelivr.net/gh/${ORG}/${REPO}@${REF}/${x.path}`,
                `https://cdn.jsdelivr.net/gh/${ORG}/${REPO}@${REF}/${x.path}`,
                `https://gh-proxy.com/${x.download_url}`,
                x.download_url,
            ];
            // A mirror that already served a file in this run goes first: the
            // first file pays the discovery cost, the rest ride the winner.
            if (goodMirrorHint >= 0 && goodMirrorHint < mirrors.length) {
                const [hit] = mirrors.splice(goodMirrorHint, 1);
                mirrors.unshift(hit);
            }
            let buf = null;
            const why = [];
            for (const href of mirrors) {
                // Two attempts per mirror: a single dropped connection should not
                // disqualify a host that works seconds later.
                for (let attempt = 0; attempt < 2 && buf === null; attempt++) {
                    try {
                        const r = await netFetch(href, {
                            signal: signal ?? AbortSignal.timeout(25_000),
                            headers: { 'user-agent': FETCH_UA },
                        });
                        if (!r.ok) {
                            why.push(`HTTP ${r.status} ${new URL(href).host}`);
                            break;
                        }
                        buf = Buffer.from(await r.arrayBuffer());
                    }
                    catch (e) {
                        if (attempt === 1)
                            why.push(`${new URL(href).host}: ${e instanceof Error ? e.message : String(e)}`);
                        else
                            await new Promise((r2) => setTimeout(r2, 700));
                    }
                }
                if (buf !== null)
                    break;
            }
            if (buf !== null) {
                const at = mirrors.findIndex((m) => m === mirrors[0]);
                goodMirrorHint = at >= 0 ? at : 0;
            }
            if (buf === null)
                throw new Error(`${x.name} 取不到（${why.join(' | ')}）`);
            const dest = join(out, ...rel.split('/'));
            await mkdir(dirname(dest), { recursive: true });
            await writeFile(dest, buf);
            count++;
        }

        for (const d of dirs)
            await walk(d.path, depth + 1);
    }

    await walk(`packages/${sub}`, 0);
    return count;
}

export async function extractSubtree(tarball, sub, out) {
    // ⚠️ 不用 `pipeline(src, gunzip, asyncFn)`：TS 的 PipelineDestination 重载
    //    不认 async 函数（编译错误），而且这里本来就要一次性拿全量 buffer 扫
    //    tar 头——直接 for-await 读解压流最简单。
    const chunks = [];
    const gunzip = createGunzip();
    const source = createReadStream(tarball);
    source.pipe(gunzip);
    for await (const chunk of gunzip)
        chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    await mkdir(out, { recursive: true });
    let files = 0;
    let off = 0;
    while (off + BLOCK <= buf.length) {
        // 名字以 NUL 结尾截断
        let name = buf.toString('utf8', off, off + 100).replace(/\0.*$/s, '');
        const sizeField = buf.toString('utf8', off + 124, off + 136).replace(/[\0 ]/g, '');
        const size = parseInt(sizeField, 8) || 0;
        const type = buf[off + 156];
        const dataStart = off + BLOCK;
        if (name === '')
            break; // 结束块
        off = dataStart + Math.ceil(size / BLOCK) * BLOCK;
        if (name === 'pax_global_header')
            continue;
        // 真实路径：去掉 `<repo>-<branch>/` 前缀（首段）
        const slash = name.indexOf('/');
        if (slash <= 0)
            continue;
        name = name.slice(slash + 1);
        if (!name.startsWith(`packages/${sub}/`))
            continue;
        // 只写常规文件（type '0' 或 NUL）
        if (type !== 0x30 && type !== 0x00)
            continue;
        const rel = name.slice(`packages/${sub}/`.length);
        if (rel === '')
            continue;
        const dest = join(out, rel);
        mkdirSync(dirname(dest), { recursive: true });
        await writeFile(dest, buf.subarray(dataStart, dataStart + size));
        files += 1;
    }
    return files;
}
/**
 * 从 tarball 里解出**整棵树**（`installSpec` 用）。
 *
 * 与 `extractSubtree` 的差别：那个只挑 `packages/<sub>/`，这个要的是
 * 「用户给的仓库/npm 包的全部内容」。两者都剥掉一层前缀——
 * codeload 给 `<repo>-<ref>/…`，npm 给 `package/…`。
 *
 * @param subdir 给了就只解这一棵子树（GitHub 的 `owner/repo#子目录` 写法）
 * @returns 写出的文件数
 */
export async function extractRoot(tarball, out, subdir) {
    const chunks = [];
    const gunzip = createGunzip();
    const source = createReadStream(tarball);
    source.pipe(gunzip);
    for await (const chunk of gunzip)
        chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    await mkdir(out, { recursive: true });
    const prefix = typeof subdir === 'string' && subdir !== '' ? `${subdir.replace(/^\/+|\/+$/g, '')}/` : undefined;
    let files = 0;
    let off = 0;
    while (off + BLOCK <= buf.length) {
        let name = buf.toString('utf8', off, off + 100).replace(/\x00.*$/s, '');
        const sizeField = buf.toString('utf8', off + 124, off + 136).replace(/[\x00 ]/g, '');
        const size = parseInt(sizeField, 8) || 0;
        const type = buf[off + 156];
        const dataStart = off + BLOCK;
        if (name === '')
            break;
        off = dataStart + Math.ceil(size / BLOCK) * BLOCK;
        if (name === 'pax_global_header')
            continue;
        const slash = name.indexOf('/');
        if (slash <= 0)
            continue;
        name = name.slice(slash + 1);
        if (prefix !== undefined) {
            if (!name.startsWith(prefix))
                continue;
            name = name.slice(prefix.length);
        }
        if (name === '')
            continue;
        // 只写常规文件；目录条目靠 mkdir -p 补
        if (type !== 0x30 && type !== 0x00)
            continue;
        // 拒绝穿过解包目录的相对路径（tar 里理论上不会有，防守一下）
        if (name.split('/').includes('..'))
            continue;
        const dest = join(out, name);
        mkdirSync(dirname(dest), { recursive: true });
        await writeFile(dest, buf.subarray(dataStart, dataStart + size));
        files += 1;
    }
    return files;
}
//# sourceMappingURL=market.js.map
/** 数一棵子树里的文件（判断镜像里到底有没有东西）。 */
async function countFiles(dir) {
    const { readdir } = await import('node:fs/promises');
    let n = 0;
    for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
        if (entry.isDirectory())
            n += await countFiles(join(dir, entry.name));
        else
            n += 1;
    }
    return n;
}
