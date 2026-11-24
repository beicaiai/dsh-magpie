/**
 * 华为云系供应商（codearts / officeace）的登录回跳转发。
 *
 * 病灶：这两个插件调 authorize() 时给华为云的是 `uri_scheme=codearts-agent&port=<随机高端口>`，
 * 也就是说它假设本机装了 CodeArts IDE，由那个 IDE 注册的 `codearts-agent://` 协议处理器
 * 接住回跳。浏览器里没有那个协议处理器时，华为云会退化成打开
 *
 *     http://127.0.0.1/oauth/callback?secret=<hex>&redirect=<门户结果页>
 *
 * ——端口丢了（落到 80），参数名也不是插件唯一认的 `code`。于是浏览器显示
 * 「无法访问此页面」，插件在它那个高端口上永远等不到授权码，登录 100% 卡死。
 *
 * 这里在 80 端口起一个只监听回环地址的转发器：把 `/oauth/callback` 上的 secret（或 code）
 * 转发到插件真正在听的端口，再把插件的响应原样回给浏览器。插件看到的
 * `request.socket.localPort` 仍然是它自己的端口，所以它算出来的 redirect_uri 与授权时
 * 发给华为云的 `port` 一致，token 交换不会被 redirect_uri 不匹配挡掉。
 *
 * 国内站和国际站的插件端口不同（各起一个回调服务器），所以这里记最近 3 个端口，
 * 转发时挨个试 —— 谁接住就用谁，避免同时开两个站时转错。
 *
 * **绝不阻塞登录**：`armRelay` 只记端口、立刻返回，监听在后台做。80 端口起不来
 * （被占 / 权限不够 / listen 迟迟不回调）一律当没接管，登录本身照走。
 *
 * 拿不到端口、或 80 被别的程序占着时，一律安静地不接管 —— 绝不因为这一步让登录本身失败。
 *
 * 每次命中都写一行到 `~/.dsh/magpie/relay.log`，登录不对时先看这个文件：
 * 里面没有记录 = 华为云根本没打到 80（它带着插件端口直接打了），
 * 有记录但全部 FAILED = 插件已经把回调服务器关了（等太久超时）。
 */
import { createServer, request as httpRequest } from 'node:http';
import { appendFileSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const RELAY_PORT = 80;
const RELAY_PATH = '/oauth/callback';
const UPSTREAM_TIMEOUT_MS = 20_000;
const LOG_FILE = join(homedir(), '.dsh', 'magpie', 'relay.log');
const LOG_MAX_BYTES = 1_048_576;
const MAX_TARGETS = 3;

let server = null;
let listening = false;
let starting = null;
/** 最近武装过的插件端口，最新的在最前。 */
let targets = [];
let lastError = '';
let hits = 0;
let lastHit = '';
let lastForward = '';

/** 追加一行到 relay.log；日志本身出任何问题都不许影响转发。 */
function logLine(text) {
  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true });
    try {
      if (statSync(LOG_FILE).size > LOG_MAX_BYTES) {
        renameSync(LOG_FILE, LOG_FILE + '.1');
      }
    } catch {
      // 文件还不存在，正常
    }
    appendFileSync(LOG_FILE, new Date().toISOString() + ' ' + text + '\n', 'utf8');
  } catch {
    // 写不了就不写，绝不让日志拖垮登录
  }
}

/**
 * 从 authorize 返回的地址里抠出插件真正监听的端口。
 *
 * 国内站：`codearts.huaweicloud.com/portal/authorize?...&uri_scheme=codearts-agent&port=38269`
 * 国际站：`auth.huaweicloud.com/authui/login?site=intl&service=<编码后的 authorize 地址>`
 * ——两种情况都把真正的 authorize 参数放在本层或 `service` 里，都要能读。
 */
function portFromAuthUrl(authUrl) {
  try {
    const outer = new URL(authUrl);
    const service = outer.searchParams.get('service');
    const inner = service === null || service === '' ? outer : new URL(service);
    // 本机补丁 2026-11-22：不再要求 uri_scheme。
    // 带 uri_scheme 时华为云会去唤起本机 CodeArts IDE；唤不起就回 authorizationAvailable=false，
    // 而且只给 secret（不是 code）。去掉之后它走纯 HTTP 回跳、给真 code。
    // 所以这里改成只认 port 参数，与 uri_scheme 是否出现无关。
    const raw = Number(inner.searchParams.get('port') ?? '0');
    return Number.isInteger(raw) && raw > 0 && raw < 65_536 ? raw : 0;
  } catch {
    return 0;
  }
}

function replyPage(response, status, title, detail) {
  const body = '<!doctype html><meta charset="utf-8">'
    + '<title>' + title + '</title>'
    + '<body style="font:15px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;margin:56px auto;max-width:520px;color:#222">'
    + '<h2 style="font-size:17px;margin:0 0 10px;font-weight:650">' + title + '</h2>'
    + '<p style="margin:0;color:#666">' + detail + '</p></body>';
  response.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(body);
}

/** 把请求打到某一个候选端口；成功（拿到 HTTP 响应）就 resolve，失败 resolve 错误。 */
function tryTarget(port, path) {
  return new Promise((resolve) => {
    const upstream = httpRequest(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'GET',
        timeout: UPSTREAM_TIMEOUT_MS,
        // 把「浏览器实际打到的端口」告诉插件。华为云没装 CodeArts IDE 时会把
        // 浏览器甩到 80，插件拿自己的随机端口拼 redirect_uri，换 token 时和
        // 华为云记的地址对不上，STS 直接回 STS5.1805 invalid authorization code。
        headers: { 'x-relay-port': String(RELAY_PORT) },
      },
      (answer) => {
        // 顺手攒一段响应体预览。插件收下 code 之后：成功还是失败、为什么给你
        // 一个 307，全在 Location 头和 body 里 —— 只看状态码根本分不清
        // 「正常跳转到成功页」和「没认这个 code、把你甩回去」。
        let preview = '';
        answer.on('data', (chunk) => {
          if (preview.length < 1200) preview += chunk.toString('utf8');
        });
        resolve({ port, answer, preview: () => preview });
      },
    );
    upstream.on('timeout', () => {
      upstream.destroy(new Error('插件 20 秒没响应'));
    });
    upstream.on('error', (error) => {
      resolve({ port, error: error instanceof Error ? error.message : String(error) });
    });
    upstream.end();
  });
}

async function forward(response, query, keys, code) {
  if (targets.length === 0) {
    logLine('[forward] 没有已知的插件端口，回 503');
    replyPage(response, 503, '回跳端口还没接管', '请回到面板，重新点一次「登录」。');
    return;
  }
  const tried = [];
  for (const port of targets) {
    const result = await tryTarget(port, RELAY_PATH + '?' + query);
    if (result.answer !== undefined) {
      const status = result.answer.statusCode ?? 502;
      const location = String(result.answer.headers?.location ?? '');
      // codeLen 是最省事的一条判据：华为云把 code 放在 `secret` 里，值可能是空串
      // （登录页没真的授权成功）。codeLen=0 就说明白跑了一趟，不用再猜。
      const codeLen = typeof code === 'string' ? code.length : -1;
      logLine('[forward] -> ' + port + ' status=' + status + ' keys=' + keys
        + ' codeLen=' + codeLen + (location === '' ? '' : ' location=' + location));
      lastForward = new Date().toISOString() + ' -> ' + port + ' status=' + status;
      response.writeHead(status, result.answer.headers);
      result.answer.pipe(response);
      response.on('finish', () => {
        const body = result.preview().replace(/\s+/g, ' ').trim();
        if (body !== '') {
          logLine('[forward-body] ' + body.slice(0, 300));
        }
      });
      return;
    }
    tried.push(port + '(' + result.error + ')');
    logLine('[forward] -> ' + port + ' FAILED ' + result.error);
  }
  lastForward = new Date().toISOString() + ' 全部失败 ' + tried.join(' ');
  replyPage(response, 502, '转发给插件失败',
    '试过这些端口都没人接：' + tried.join('、') + '。'
    + '这通常是因为登录等太久，插件的回调服务器已经关了 —— 重新点一次「登录」，并在 15 分钟内走完。');
}

/**
 * 在 80 端口起服务。**永远不抛，也永远不无限等**：
 * listen 超过 2 秒没回调就当失败，内部静默，不影响调用方。
 */
function ensureServer(log) {
  if (server !== null) {
    return Promise.resolve(true);
  }
  if (starting !== null) {
    return starting;
  }
  starting = new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled === true) {
        return;
      }
      settled = true;
      starting = null;
      resolve(ok);
    };
    const guard = setTimeout(() => {
      logLine('[listen] 2 秒没等到 listen 回调，放弃接管');
      try { created.close(); } catch { /* 还没 listen 成功，关不掉也无所谓 */ }
      finish(false);
    }, 2000);
    const created = createServer((request, response) => {
      const raw = request.url ?? '/';
      const at = raw.indexOf('?');
      const path = at < 0 ? raw : raw.slice(0, at);
      if (path !== RELAY_PATH) {
        replyPage(response, 404, '这个端口只接收登录回跳', '不要在这里做别的事。');
        return;
      }
      if (request.method !== 'GET') {
        response.writeHead(405, { allow: 'GET' }).end();
        return;
      }
      hits += 1;
      const query = at < 0 ? '' : raw.slice(at + 1);
      const params = new URLSearchParams(query);
      // 原始回落参数先记一份（只记键名 + 值长度，不把值写进日志）：
      // 华为云到底传的是 `secret` 还是 `code`、值有多长，全靠这一行定性。
      // 之前日志是在「secret 改名成 code」之后打的，键名被洗掉了，
      // 结果连「华为云有没有真给授权码」都看不出来。
      const rawEntries = [...params.entries()];
      const arrived = rawEntries.map(([k, v]) => k + ':' + v.length + 'B').join(' ') || '（无参数）';
      const secret = params.get('secret');
      if (params.get('code') === null && secret !== null) {
        params.set('code', secret);
        params.delete('secret');
      }
      const code = params.get('code');
      const keys = [...params.keys()].join(',') || '（无参数）';
      lastHit = new Date().toISOString() + ' 原始 ' + arrived;
      // host 也记一笔：`127.0.0.1` 和 `127.0.0.1:80` 在 STS 眼里是两个 redirect_uri，
      // 出问题时要能一眼看出浏览器到底打的是哪种写法。
      logLine('[hit ' + hits + '] host=' + String(request.headers.host ?? '?')
        + ' 原始参数 ' + arrived + ' 候选端口=' + (targets.join(',') || '无'));
      // 值的原文也留一份（截断 300 字）：`secret` 到底是不是授权码、
      // `redirect` 指向哪儿，只能靠这一行定性。
      logLine('[hit-raw] ' + rawEntries.map(([k, v]) => k + '=' + String(v).slice(0, 300)).join(' & '));
      void forward(response, params.toString(), keys, code);
    });
    created.on('error', (error) => {
      clearTimeout(guard);
      lastError = error instanceof Error ? error.message : String(error);
      server = null;
      listening = false;
      logLine('[listen] 失败 ' + lastError);
      finish(false);
    });
    created.listen(RELAY_PORT, '127.0.0.1', () => {
      clearTimeout(guard);
      server = created;
      listening = true;
      lastError = '';
      logLine('[listen] 已接管 127.0.0.1:' + RELAY_PORT);
      if (typeof log === 'function') {
        log('[relay] 已接管 127.0.0.1:' + RELAY_PORT + '，插件端口随每次登录切换');
      }
      finish(true);
    });
  });
  return starting;
}

/**
 * 启动时预热：把 80 端口提前拿下来，之后每次登录都不必再等 listen。
 * 失败无所谓（被别的程序占着就占着），永远不抛。
 */
export function warmRelay(log) {
  void ensureServer(log).catch(() => {});
}

/**
 * 按 authorize 返回的地址武装转发器。
 *
 * **只记端口，立刻返回** —— listen 在后台跑，绝不阻塞 `auth.signIn`。
 * 这样即使 80 端口状况不好，登录本身照常进行，只是回跳没人兜底而已。
 */
export function armRelay(authUrl, log) {
  const port = portFromAuthUrl(typeof authUrl === 'string' ? authUrl : '');
  if (port === 0) {
    logLine('[arm] 这个登录方式不带 port 参数，不接管');
    return { armed: false, reason: '' };
  }
  targets = [port, ...targets.filter((p) => p !== port)].slice(0, MAX_TARGETS);
  hits = 0;
  lastHit = '';
  const alreadyUp = server !== null;
  logLine('[arm] 候选端口 = ' + targets.join(',') + (alreadyUp ? '（80 已在监听）' : '（80 后台启动中）'));
  if (alreadyUp === false) {
    warmRelay(log);
  }
  // 已经监听着 = 确定能兜；还没起来 = 说不上，但也不拦着登录
  return { armed: alreadyUp, port: RELAY_PORT, target: port, pending: alreadyUp === false };
}

/** 给自检/诊断用：现在是接管的还是没接管、收过几次回跳、最后转发到哪。 */
export function relayState() {
  return {
    listening,
    port: RELAY_PORT,
    targets: [...targets],
    error: lastError,
    hits,
    lastHit,
    lastForward,
    logFile: LOG_FILE,
  };
}
