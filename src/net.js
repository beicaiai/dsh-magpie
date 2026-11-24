import http from 'node:http';
import { Readable } from 'node:stream';
import https from 'node:https';
import tls from 'node:tls';
import { execFileSync } from 'node:child_process';
/**
 * 代理感知的网络层。
 *
 * Node 的 fetch 不读 Windows 系统代理，只认 HTTPS_PROXY/HTTP_PROXY 环境变量；
 * 而环境变量要用户在启动前设好，换代理端口就错乱。所以这里每次请求前自己读一次
 * 注册表（30 秒缓存），用 CONNECT 隧道走代理，读不到或代理坏了就退回直连。
 *
 * 设置 MAGPIE_NO_PROXY=1 可以强制直连。
 */
const PROXY_TTL_MS = 30_000;
let cachedProxy = null;
let cachedAt = 0;
export function systemProxy() {
    const now = Date.now();
    if (now - cachedAt < PROXY_TTL_MS)
        return cachedProxy;
    cachedAt = now;
    cachedProxy = detectProxy();
    return cachedProxy;
}
export function forgetProxy() {
    cachedAt = 0;
    cachedProxy = null;
}
function detectProxy() {
    if (process.env.MAGPIE_NO_PROXY === '1')
        return null;
    for (const key of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) {
        const value = process.env[key];
        if (typeof value === 'string' && value.trim() !== '') {
            const parsed = parseProxy(value);
            if (parsed !== null)
                return parsed;
        }
    }
    if (process.platform !== 'win32')
        return null;
    try {
        const out = execFileSync('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'], { encoding: 'utf8', windowsHide: true, timeout: 4000 });
        const enable = /ProxyEnable\s+REG_DWORD\s+0x([0-9a-fA-F]+)/.exec(out);
        if (enable === null || Number.parseInt(enable[1], 16) !== 1)
            return null;
        const server = /ProxyServer\s+REG_SZ\s+(.+)/.exec(out);
        if (server === null)
            return null;
        return parseProxy(server[1].trim());
    }
    catch {
        return null;
    }
}
function parseProxy(raw) {
    let text = raw.trim();
    if (text === '')
        return null;
    if (text.includes('=')) {
        const parts = new Map();
        for (const segment of text.split(';')) {
            const at = segment.indexOf('=');
            if (at <= 0)
                continue;
            parts.set(segment.slice(0, at).trim().toLowerCase(), segment.slice(at + 1).trim());
        }
        text = parts.get('https') ?? parts.get('http') ?? '';
        if (text === '')
            return null;
    }
    if (!text.includes('://'))
        text = 'http://' + text;
    try {
        const url = new URL(text);
        const host = url.hostname;
        const port = url.port === '' ? 80 : Number(url.port);
        if (host === '' || !Number.isInteger(port) || port <= 0 || port > 65_535)
            return null;
        return { host, port };
    }
    catch {
        return null;
    }
}
function tunnel(proxy, host, port, signal) {
    return new Promise((resolve, reject) => {
        const request = http.request({
            host: proxy.host,
            port: proxy.port,
            method: 'CONNECT',
            path: host + ':' + port,
            headers: { host: host + ':' + port },
            agent: false,
            timeout: 15_000,
        });
        const onAbort = () => { request.destroy(new Error('aborted')); };
        if (signal !== undefined)
            signal.addEventListener('abort', onAbort, { once: true });
        request.once('connect', (response, socket) => {
            if (signal !== undefined)
                signal.removeEventListener('abort', onAbort);
            if (response.statusCode !== 200) {
                socket.destroy();
                reject(new Error('proxy CONNECT ' + String(response.statusCode)));
                return;
            }
            resolve(socket);
        });
        request.once('timeout', () => { request.destroy(new Error('proxy CONNECT timeout')); });
        request.once('error', reject);
        request.end();
    });
}
function collect(module, options, signal) {
    return new Promise((resolve, reject) => {
        const request = module.request(options, (response) => {
            const chunks = [];
            response.on('data', (chunk) => { chunks.push(chunk); });
            response.on('end', () => {
                resolve({
                    status: response.statusCode ?? 0,
                    statusText: response.statusMessage ?? '',
                    headers: response.headers,
                    body: Buffer.concat(chunks),
                    url: options.__url ?? '',
                });
            });
            response.on('error', reject);
        });
        const onAbort = () => { request.destroy(new Error('aborted')); };
        if (signal !== undefined)
            signal.addEventListener('abort', onAbort, { once: true });
        request.once('close', () => {
            if (signal !== undefined)
                signal.removeEventListener('abort', onAbort);
        });
        request.once('timeout', () => { request.destroy(new Error('request timeout')); });
        request.once('error', reject);
        request.end();
    });
}
function asResponse(raw) {
    const body = raw.body;
    return {
        ok: raw.status >= 200 && raw.status < 300,
        status: raw.status,
        statusText: raw.statusText,
        headers: new Headers(raw.headers),
        url: raw.url,
        redirected: false,
        type: 'basic',
        /** node Readable（不是 web ReadableStream）—— 想按流消费就用它。 */
        get body() { return Readable.from([body]); },
        async text() { return body.toString('utf8'); },
        async json() { return JSON.parse(body.toString('utf8')); },
        async arrayBuffer() {
            const copy = new ArrayBuffer(body.byteLength);
            new Uint8Array(copy).set(body);
            return copy;
        },
        async blob() { return new Blob([new Uint8Array(body)]); },
    };
}
async function viaProxy(url, options, proxy, hops) {
    const target = new URL(url);
    const isHttps = target.protocol === 'https:';
    const host = target.hostname;
    const port = target.port === '' ? (isHttps ? 443 : 80) : Number(target.port);
    const headers = { ...(options.headers ?? {}) };
    headers.host = target.host;
    headers['accept-encoding'] = 'identity';
    if (headers['user-agent'] === undefined && headers['User-Agent'] === undefined)
        headers['user-agent'] = 'dsh-magpie';
    const method = options.method ?? 'GET';
    const path = target.pathname + target.search;
    let raw;
    if (isHttps) {
        const socket = await tunnel(proxy, host, port, options.signal);
        raw = await collect(https, {
            host,
            port,
            path,
            method,
            headers,
            agent: false,
            createConnection: () => tls.connect({ socket, servername: host }),
            __url: url,
        }, options.signal);
    }
    else {
        raw = await collect(http, { host: proxy.host, port: proxy.port, path: url, method, headers, agent: false, __url: url }, options.signal);
    }
    raw.url = url;
    const location = raw.headers.location;
    if ([301, 302, 303, 307, 308].includes(raw.status) && typeof location === 'string' && hops < 4) {
        return viaProxy(new URL(location, url).href, options, proxy, hops + 1);
    }
    return asResponse(raw);
}
/**
 * 代理感知的 fetch。返回一个和 Response 形状兼容的对象。
 */
export async function netFetch(url, options = {}) {
    const proxy = systemProxy();
    if (proxy === null)
        return fetch(url, options);
    try {
        return await viaProxy(url, options, proxy, 0);
    }
    catch (error) {
        if (options.signal?.aborted === true)
            throw error;
        return fetch(url, options);
    }
}
