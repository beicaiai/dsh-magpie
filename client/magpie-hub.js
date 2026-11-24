window.__ModuleLoader__.load({
  id: "dsh-magpie",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// plugin-src/client/index.js
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  callMagpieRpc: () => callMagpieRpc,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);
var React3 = __toESM(require("react"), 1);

// plugin-src/client/MagpiePage.jsx
var React = __toESM(require("react"), 1);
var { useCallback, useEffect, useMemo, useState, useRef } = React;
var TABS = [
  { id: "agents", zh: "供应商", en: "Providers" },
  { id: "quotas", zh: "额度", en: "Quotas" },
  { id: "usage", zh: "用量", en: "Usage" },
  { id: "routing", zh: "路由", en: "Routing" },
  { id: "store", zh: "商店", en: "Store" },
  // 面板：直接 iframe 嵌 magpie 原版 UI（模型 / 供应商 / 路由 / 用量 / 插件 / 设置六页签）。
  { id: "full", zh: "面板", en: "Panel" }
];
var PERIODS = [
  { id: "today", zh: "今天", en: "Today" },
  { id: "7d", zh: "7 天", en: "7 days" },
  { id: "30d", zh: "30 天", en: "30 days" },
  { id: "all", zh: "全部", en: "All" }
];
var PALETTE = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)", "var(--c7)"];
function t(locale, zh, en) {
  return String(locale ?? "").toLowerCase().startsWith("en") ? en : zh;
}
function fmt(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US");
}
function fmtN(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e8) return `${(n / 1e8).toFixed(1)}亿`;
  if (a >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  return fmt(n);
}
function fmtShort(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}
function clock(at) {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function resetsText(at, locale) {
  if (at === void 0 || at === null) return "";
  const when = typeof at === "number" ? at : new Date(at).getTime();
  if (!Number.isFinite(when)) return "";
  const left = when - Date.now();
  if (left <= 0) return t(locale, "已过期", "expired");
  const mins = Math.floor(left / 6e4);
  if (mins < 60) return t(locale, `${mins} 分钟后`, `in ${mins}m`);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t(locale, `${hours} 小时后`, `in ${hours}h`);
  const days = Math.floor(hours / 24);
  return t(locale, `${days} 天后`, `in ${days}d`);
}
function Blk({ label, value, sub, tone, title }) {
  return React.createElement(
    "div",
    { className: "blk", title },
    React.createElement("span", { className: "k" }, label),
    React.createElement("span", { className: `v${tone === void 0 ? "" : ` ${tone}`}` }, value),
    sub === void 0 ? null : React.createElement("span", { className: "sub" }, sub)
  );
}
function Dial({ pct, label }) {
  const value = typeof pct === "number" && Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : null;
  const full = value !== null && value >= 100;
  return React.createElement(
    "div",
    { className: `pq-ring${full ? " full" : ""}` },
    React.createElement(
      "div",
      { className: "pq-dial", style: { "--p": value === null ? 0 : value } },
      React.createElement("b", null, value === null ? "—" : `${Math.round(value)}%`)
    ),
    label ? React.createElement("span", { className: "pq-rn", title: label }, label) : null
  );
}
function Chart({ series, height = 200, valueOf }) {
  const boxRef = useRef(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = boxRef.current;
    if (el === null) return void 0;
    const update = () => setWidth(Math.max(160, el.clientWidth));
    update();
    if (typeof ResizeObserver === "undefined") return void 0;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const points = Array.isArray(series) ? series : [];
  const values = points.map(valueOf);
  const max = Math.max(0, ...values);
  if (points.length === 0 || max <= 0) {
    return React.createElement(
      "div",
      { className: "led-chart" },
      React.createElement(
        "div",
        { className: "plot", ref: boxRef },
        React.createElement("div", { className: "none" }, t(void 0, "这段时间没有请求", "Nothing in this period"))
      )
    );
  }
  const padLeft = 46;
  const padRight = 8;
  const padTop = 8;
  const padBottom = 20;
  const plotW = Math.max(40, width - padLeft - padRight);
  const plotH = Math.max(40, height - padTop - padBottom);
  const rough = max / 4;
  const mag = 10 ** Math.floor(Math.log10(rough));
  let step = mag;
  for (const scale of [1, 2, 2.5, 5, 10]) {
    if (scale * mag >= rough) {
      step = scale * mag;
      break;
    }
  }
  const top = step * 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);
  const barW = Math.max(1, Math.min(18, plotW / points.length * 0.66));
  const gap = plotW / Math.max(1, points.length);
  return React.createElement(
    "div",
    { className: "led-chart" },
    React.createElement(
      "div",
      { className: "plot", ref: boxRef, style: { height } },
      React.createElement(
        "svg",
        { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none", role: "img" },
        // 网格 + 纵轴刻度
        ticks.map((v) => {
          const y = padTop + plotH - (top > 0 ? v / top * plotH : 0);
          return React.createElement(
            "g",
            { key: `t${v}` },
            React.createElement("line", { className: "grid", x1: padLeft, x2: width - padRight, y1: y, y2: y }),
            React.createElement("text", { className: "axis", x: padLeft - 7, y: y + 3.5, textAnchor: "end" }, fmtShort(v))
          );
        }),
        // 柱子
        points.map((p, i) => {
          const v = values[i];
          const h = top > 0 ? Math.max(1, v / top * plotH) : 1;
          return React.createElement("rect", {
            key: `b${i}`,
            className: "col",
            x: padLeft + gap * i + (gap - barW) / 2,
            y: padTop + plotH - h,
            width: barW,
            height: h,
            rx: 2,
            fill: "var(--c1)"
          }, React.createElement("title", null, `${p.label} · ${fmt(v)}`));
        }),
        // 横轴标签（最多 8 个，避免拥挤）
        points.map((p, i) => {
          const every = Math.ceil(points.length / 8);
          if (i % every !== 0) return null;
          return React.createElement("text", {
            key: `x${i}`,
            className: "axis",
            x: padLeft + gap * i + gap / 2,
            y: height - 6,
            textAnchor: "middle"
          }, p.label);
        })
      )
    )
  );
}
function Rank({ rows, valueOf, locale }) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  if (list.length === 0) return null;
  list.sort((a, b) => valueOf(b) - valueOf(a));
  return React.createElement(
    "div",
    { className: "led-rank" },
    list.slice(0, 7).map((r, i) => React.createElement(
      "div",
      { key: r.id ?? i, className: "rank-row" },
      React.createElement("i", { style: { background: PALETTE[i % PALETTE.length] } }),
      React.createElement("span", { className: "nm", title: r.name ?? r.id }, r.name ?? r.id),
      React.createElement("em", null, fmtShort(valueOf(r)))
    ))
  );
}
function DeleteModal({ account, locale, busy, error, onCancel, onConfirm, display }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { onCancel(); } };
    globalThis.addEventListener?.("keydown", onKey);
    return () => globalThis.removeEventListener?.("keydown", onKey);
  }, [onCancel]);
  return React.createElement(
    "div",
    {
      className: "mg-modal-mask",
      onClick: (e) => { if (e.target === e.currentTarget) { onCancel(); } }
    },
    React.createElement(
      "div",
      { className: "mg-modal", role: "dialog", "aria-modal": "true" },
      React.createElement("div", { className: "mg-modal-title" }, t(locale, "删除这个账号？", "Delete this account?")),
      React.createElement(
        "div",
        { className: "mg-modal-body" },
        t(
          locale,
          "这条登录凭证会从本机删掉，之后要重新登录才能用。这个操作不能撤销。",
          "This credential will be removed from this machine. You will need to sign in again. This cannot be undone."
        )
      ),
      React.createElement("code", { className: "mg-modal-acct", title: display ?? account.key }, display ?? (account.alias || account.accountId || account.key)),
      error ? React.createElement("div", { className: "mg-modal-err" }, error) : null,
      React.createElement(
        "div",
        { className: "mg-modal-acts" },
        React.createElement(
          "button",
          { type: "button", className: "mg-btn", disabled: busy, onClick: onCancel },
          t(locale, "取消", "Cancel")
        ),
        React.createElement(
          "button",
          { type: "button", className: "mg-btn mg-btn-danger-solid", disabled: busy, onClick: onConfirm },
          busy ? t(locale, "删除中…", "Deleting…") : t(locale, "确认删除", "Delete")
        )
      )
    )
  );
}

/**
 * 从上游报错里挑出「人话」那一句。
 *
 * 额度用完时上游回的是整段 JSON，例如：
 *   upstream responded 400: {"error_code":"TM.00001050","error_msg":"您的积分已耗尽…"}
 * 直接上屏是一屏乱码，所以优先解出 `error_msg` / `message`，退而求其次从第一个
 * 汉字起截断，最后才兜底原文。
 */
function pickAcctErr(caught) {
  const raw = caught instanceof Error ? caught.message : String(caught ?? "");
  const text = raw.trim();
  if (text === "") { return ""; }
  const m = /"(?:error_msg|error_message|message|msg)"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text);
  if (m !== null) {
    try { return JSON.parse('"' + m[1] + '"'); }
    catch { return m[1]; }
  }
  const han = text.search(/[\u4e00-\u9fa5]/);
  if (han > 0) { return text.slice(han).replace(/[\s)\]}"]+$/, "").trim(); }
  return text.length > 180 ? text.slice(0, 180) + "…" : text;
}

function AgentsTab({ snapshot, locale, rpcCall, onRefresh, mask, maskOverrides, onMaskFor }) {
  const providers = Array.isArray(snapshot?.providers) ? snapshot.providers : [];
  // 每个 provider 一个 busy 标记：值是要说明的字符串（"登录中" / "删除" ...）
  const [busy, setBusy] = useState({});
  const [err, setErr] = useState({});
  const [note, setNote] = useState({});
  const [renaming, setRenaming] = useState(null);
  const [draft, setDraft] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [delErr, setDelErr] = useState("");
  const [pending, setPending] = useState({});
  // 国内站 / 国际站选哪个。同一个供应商给了多条区域站登录方式时（codearts 的国内
  // 站与国际站），先在这里选，下面的按钮按选中的那条走。
  const [stationPick, setStationPick] = useState({});
  // 本机补丁 2026-11-17：每个账号自己的刷新结果。额度用尽 / key 失效这类错误是
  // **账号级**的，只写在供应商头的提示条里，用户根本对不上是哪张卡出的问题。
  // 键是 `providerId#accountKey`。
  const [acctErr, setAcctErr] = useState({});
  const [hiddenKeys, setHiddenKeys] = useState([]);
  const [hiddenOpen, setHiddenOpen] = useState({});
  // 本机补丁 2026-11-17：把原版「调整 <供应商>」搬进来 —— 模型勾选、单模型启停、
  // 供应商整体停用。后端 rpc 早就有 catalog.rows / model.toggle / model.setMany /
  // provider.setOff，前端一个都没接，所以这些功能在面板里等于不存在。
  const [tuning, setTuning] = useState({});
  const [catalog, setCatalog] = useState({});
  const [catBusy, setCatBusy] = useState({});
  // 本机补丁 2026-11-17：登录要跳转时把 url 一起记下来，渲染成可点的按钮 ——
  // await 之后调 window.open 会丢用户手势、被浏览器弹窗拦截，必须给用户一个手点的地方。
  const [noteUrl, setNoteUrl] = useState({});
  const noteTimers = useRef({});
  // 确认弹窗（自绘，不用原生 confirm）：系统弹窗方、丑、还不受主题控制。
  // askConfirm({...}) 把问题塞进来，渲染成列表末尾的一块液态玻璃浮层。
  const [confirmAsk, setConfirmAsk] = useState(null);
  const askConfirm = useCallback((cfg) => { setConfirmAsk(cfg); }, []);

  const loadHidden = useCallback(async () => {
    if (typeof rpcCall !== "function") { return; }
    try {
      const out = await rpcCall("account.hidden", {});
      setHiddenKeys(Array.isArray(out?.keys) ? out.keys : []);
    }
    catch { /* 老后端没有这个接口就当没有隐藏账号 */ }
  }, [rpcCall]);

  useEffect(() => { void loadHidden(); }, [loadHidden]);

  useEffect(() => () => {
    const timers = noteTimers.current;
    for (const k of Object.keys(timers)) { clearTimeout(timers[k]); }
  }, []);

  // 一句话提示，6 秒自动消失（点登录没反应时用户至少能看到"正在拉起窗口"）
  // text 可以是字符串，也可以是 { zh, en } 双语对。存双语是为了让顶栏切
  // 语言时已经挂在卡片上的那句提示跟着翻译，而不是留一段英文卡在那里。
  const say = useCallback((id, text, url) => {
    const pair = text !== null && typeof text === "object"
      ? { zh: String(text.zh ?? ""), en: String(text.en ?? text.zh ?? "") }
      : { zh: String(text ?? ""), en: String(text ?? "") };
    setNote((n) => ({ ...n, [id]: pair }));
    setNoteUrl((u) => {
      const next = { ...u };
      if (typeof url === "string" && url !== "") { next[id] = url; }
      else { delete next[id]; }
      return next;
    });
    clearTimeout(noteTimers.current[id]);
    noteTimers.current[id] = setTimeout(() => {
      setNote((n) => {
        const next = { ...n };
        delete next[id];
        return next;
      });
      setNoteUrl((u) => {
        const next = { ...u };
        delete next[id];
        return next;
      });
    }, url === undefined || url === "" ? 6000 : 20000);
  }, []);

  const act = async (id, label, fn) => {
    setBusy((b) => ({ ...b, [id]: label }));
    setErr((e) => ({ ...e, [id]: "" }));
    try {
      await fn();
      await onRefresh?.();
      await loadHidden();
    }
    catch (caught) {
      setErr((e) => ({ ...e, [id]: caught instanceof Error ? caught.message : String(caught) }));
    }
    finally {
      setBusy((b) => { const next = { ...b }; delete next[id]; return next; });
    }
  };

  const start = (id, index = 0) => act(id, "signIn", async () => {
    const out = await rpcCall("auth.signIn", { provider: id, index });
    if (out?.done === true) {
      say(id, { zh: "已登录", en: "Signed in" });
      return;
    }
    setPending((p) => ({ ...p, [id]: { index } }));
    const url = typeof out?.url === "string" ? out.url.trim() : "";
    // 插件给的 instructions 是它自己写死的英文（例如 CodeArts 的
    // "Sign in to Huawei Cloud in the browser. ..."）。中文界面下直接显示
    // 会让人以为界面坏了 —— 中文用我们自己的模板，英文才用插件原文。
    const pluginHint = typeof out?.instructions === "string" ? out.instructions.trim() : "";
    const fallback = url === ""
      ? { zh: "正在拉起登录窗口…窗口出来后在里面完成登录，再点「我已完成」", en: "Launching the sign-in window… finish there, then press Done" }
      : { zh: "已打开登录页，登录完回到这里点「我已完成」", en: pluginHint !== "" ? pluginHint : "Sign-in page opened. Finish there, then press Done" };
    if (url === "") {
      say(id, fallback);
      // 应用类登录：插件刚 spawn 的本机窗口默认躺在后台（豆包那次甚至是托盘上
      // 一个 52×52 的小方块），用户点完「登录」屏幕上什么都不动，就会以为按钮
      // 坏了。这里按「最近 8 秒内启动的进程」让服务端把最大的可见窗口提到前台。
      // 从进程启动到出现可见主窗口一般要 1.5~4 秒，所以错开两次试探。
      for (const wait of [1600, 3800]) {
        setTimeout(() => {
          try { void rpcCall("window.focus", { since: 8 })?.catch?.(() => {}); }
          catch { /* 提窗失败不影响登录本身 */ }
        }, wait);
      }
      return;
    }
    // 本机补丁 2026-11-17：跳转要能看见结果。
    // 第一步走服务端 `open.external`（Node 直接 start/open/xdg-open）—— 不经过浏览器
    // 弹窗权限，而且认 `office-raccoon://` 这类自定义协议，能把登录态交回本机客户端。
    // 第二步才退回 window.open；两条都不成时 note 上还留一个手点按钮。
    let opened = null;
    try {
      const r = await rpcCall("open.external", { url });
      opened = r !== null && r !== undefined ? url : null;
    }
    catch { opened = null; }
    if (opened === null) {
      try { opened = globalThis.open?.(url, "_blank", "noopener,noreferrer") ?? null; }
      catch { opened = null; }
    }
    // 有些供应商（华为云系的 CodeArts / OfficeAce）用 `uri_scheme` + `port` 回跳：
    // 华为云登录完会把端口丢掉、直接打开 http://127.0.0.1/oauth/callback，浏览器
    // 只会显示「无法访问此页面」。这不是我们猜的 —— 抓到的回跳 URL 里没有端口，
    // 参数名也从 code 变成了 secret。提前说清楚，别让人以为是界面坏了。
    // 服务端已经把本机 80 端口接管过来（src/callback-relay.js）：华为云回跳到
    // http://127.0.0.1/oauth/callback?secret=… 时，中继会把它转给插件真正监听的
    // 端口、顺便把 secret 改名成 code。接管成功就报好消息，没接管成才警告。
    const relayed = out?.relayed === true;
    const portWarn = relayed ? null : (() => {
      try {
        const u = new URL(url);
        const svc = u.searchParams.get("service");
        const inner = svc ? new URL(svc) : u;
        if (inner.searchParams.get("uri_scheme") !== null && inner.searchParams.get("port") !== null) {
          return {
            zh: "⚠ 这个登录方式要本机 IDE 的协议处理器配合。如果浏览器显示「无法访问此页面」，说明回跳端口没生效 —— 请改用「粘贴 Token」等其它方式。",
            en: "⚠ This sign-in relies on a local IDE protocol handler. If the browser says it cannot reach the page, the callback port did not survive the redirect — use a token/paste method instead."
          };
        }
      } catch { /* url 解析失败就当没有 */ }
      return null;
    })();
    const relayOk = relayed
      ? {
          zh: "✓ 回跳已接管（本机 80 端口转给插件）。华为云最后若显示「登录失败 / 请返回客户端查看」，是它在找本机的 CodeArts IDE —— 没装就一定这样，不代表登录没成。走完回来点「我已完成」看结果。",
          en: "✓ Callback capture armed (local port 80 → plugin listener). Huawei Cloud may still end on a “Sign-in failed / return to the client” page — that is it looking for the CodeArts IDE on this machine, which is expected without the IDE. Press Done here to see the real result."
        }
      : null;
    const mainText = opened === null
      ? { zh: "没能自动打开 —— 点右边「打开登录页」，或手动访问：" + url, en: "Could not open automatically — press Open sign-in page on the right, or visit: " + url }
      : fallback;
    // 站点提示。国内站和国际站的登录页都挂在 auth.huaweicloud.com 这个域上，
    // 页面语言是华为云前端按自己域下的 cookie 定的 —— URL 参数（locale / lang）
    // 传什么都不影响它。所以这里只说清楚两件事：这次打开的是哪个站、显示英文时
    // 去哪儿切一次。别写成"我们没做对"，那会让人以为切错了站。
    const stationHint = (() => {
      try {
        const raw = decodeURIComponent(url);
        if (/[?&]site=intl\b/.test(url) || /ap-southeast-1/.test(raw)) {
          return {
            zh: "这是国际站（海外区账号，和国内站不通用；免费额度池只有国内站有）。",
            en: "This is the international site (overseas account, separate from the China site; the free quota pool exists on the China site only)."
          };
        }
        if (/codearts\.huaweicloud\.com/.test(raw)) {
          return {
            zh: "这是国内站。登录页若显示英文，点它右上角 English 切一次「简体中文」，华为云会把这个选择记在该域下，之后一直是中文。",
            en: "This is the China site. If the page shows English, pick 简体中文 once in its top-right menu — Huawei Cloud remembers the choice for this domain."
          };
        }
      } catch { /* url 不是合法 URL 就不提示 */ }
      return null;
    })();
    const tailNote0 = relayOk !== null ? relayOk : portWarn;
    const tailNote = stationHint === null
      ? tailNote0
      : tailNote0 === null
        ? stationHint
        : { zh: tailNote0.zh + " " + stationHint.zh, en: tailNote0.en + " " + stationHint.en };
    const notePair = tailNote === null
      ? mainText
      : { zh: mainText.zh + " " + tailNote.zh, en: mainText.en + " " + tailNote.en };
    say(id, notePair, url);
  });

  // 「我已完成」等的是插件自己的回调 promise，插件侧已经把窗口拉到 15 分钟
  // （OAUTH_CALLBACK_TIMEOUT_MS = 900_000）。所以这里只是「这一轮先不等了」，
  // 不是「登录失败」—— 超时后按钮回到可点状态，浏览器那边走完再点一次即可。
  const FINISH_TIMEOUT_MS = 30_000;
  const finish = (id, index = 0) => act(id, "signInFinish", async () => {
    let timer = 0;
    const timeout = new Promise((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(t(locale,
          "还没等到结果（插件那边仍在等你，最多 15 分钟）。浏览器里走完后再点一次「我已完成」就行；已经走完还是这样，就点顶栏 ⟳ 刷新看看账号有没有进来。",
          "Still waiting (the plugin keeps waiting up to 15 minutes). Finish in the browser, then press Done once more; if you already did, press ⟳ above to refresh and check whether the account arrived.")));
      }, FINISH_TIMEOUT_MS);
    });
    let out;
    try {
      out = await Promise.race([rpcCall("auth.signInFinish", { provider: id, index }), timeout]);
    }
    finally {
      clearTimeout(timer);
    }
    setPending((p) => { const next = { ...p }; delete next[id]; return next; });
    const who = String(out?.accountId ?? out?.key ?? "").trim();
    say(id, who === ""
      ? { zh: "登录已完成，账号应该出现在下面了。没出现就点顶栏 ⟳ 刷新。", en: "Sign-in finished — the account should appear below. If not, press ⟳ above to refresh." }
      : { zh: `已登录：${who}`, en: `Signed in: ${who}` });
  });

  const refreshQuota = (pid, a) => act(a.key, "retest", async () => {
    await rpcCall("account.retest", { key: a.key, provider: pid });
    say(pid, { zh: "额度已刷新", en: "Quota refreshed" });
  });

  const doRename = (a) => act(a.key, "rename", async () => {
    await rpcCall("account.rename", { key: a.key, name: draft.trim() });
    setRenaming(null);
    setDraft("");
  });

  // `a.key` 是裸 accountKey（buildSnapshot 里就是 host.accountKeys 的返回值），
  // 不带供应商前缀 —— 必须由调用方把 `p.id` 一起传下去，否则服务端存进
  // hiddenAccounts 的记录切不出归属，账号会从所有卡片里消失且无从恢复。
  const doHide = (a, pid) => act(a.key, "hide", async () => {
    await rpcCall("account.setHidden", { key: a.key, provider: pid, hidden: true });
  });

  const doDelete = async () => {
    const a = deleting;
    if (a === null) { return; }
    setBusy((b) => ({ ...b, [a.key]: "delete" }));
    setDelErr("");
    try {
      await rpcCall("auth.remove", { key: a.key });
      setDeleting(null);
      await onRefresh?.();
      await loadHidden();
    }
    catch (caught) {
      setDelErr(caught instanceof Error ? caught.message : String(caught));
    }
    finally {
      setBusy((b) => { const next = { ...b }; delete next[a.key]; return next; });
    }
  };

  // 一键刷新：把这个供应商的每个账号都重新问一遍额度。
  // 逐个顺序发 —— 上游是同一家，并发反而容易被限流，而这里最多几个账号。
  const refreshAll = (id, list) => act(id, "retestAll", async () => {
    const rows = Array.isArray(list) ? list : [];
    if (rows.length === 0) {
      say(id, { zh: "这个供应商还没有账号", en: "No accounts yet" });
      return;
    }
    let okCount = 0;
    let badCount = 0;
    const fails = {};
    for (const a of rows) {
      const mark = id + "#" + a.key;
      try {
        await rpcCall("account.retest", { key: a.key, provider: id });
        okCount += 1;
        fails[mark] = "";
      }
      catch (caught) {
        badCount += 1;
        fails[mark] = pickAcctErr(caught) !== ""
          ? pickAcctErr(caught)
          : t(locale, "刷新失败", "Refresh failed");
      }
    }
    // 成功的账号把旧错误擦掉，失败的写上新错误 —— 只动本次刷新涉及的那几个键
    setAcctErr((prev) => {
      const next = { ...prev };
      for (const mark of Object.keys(fails)) {
        if (fails[mark] === "") { delete next[mark]; }
        else { next[mark] = fails[mark]; }
      }
      return next;
    });
    say(id, badCount === 0
      ? { zh: `额度已刷新（${okCount} 个账号）`, en: `Refreshed (${okCount})` }
      : { zh: `刷新完成：成功 ${okCount} 个，失败 ${badCount} 个`, en: `Refreshed ${okCount}, failed ${badCount}` });
  });

  // ── 卸载供应商 ─────────────────────────────────────────────────────────
  // 用户要的语义是「不想用就删掉，想再用回商店重装」，所以这里连包一起删：
  // rpc 的 market.uninstall 走 index.js 的 marketUninstall —— 删包目录 + 从
  // plugins.json 摘掉登记 + reload + refresh（那是唯一不可撤回的供应商级操作）。
  // 和「停用」区分开：停用只是把开关关掉，包还在。
  const doUninstall = (p) => {
    const label = p.name || p.id;
    askConfirm({
      title: t(locale, "卸载「" + label + "」？", "Uninstall \"" + label + "\"?"),
      body: t(locale,
        "会把插件包从磁盘删掉，这个供应商下的登录状态一起清掉。以后想再用，去商店重新安装。",
        "The plugin package is deleted from disk and its sign-in state is cleared. Reinstall it from Store whenever you want it back."),
      confirm: t(locale, "卸载", "Uninstall"),
      danger: true,
      onOk: () => {
        void act(p.id, "uninstall", async () => {
          await rpcCall("market.uninstall", { package: p.spec });
          say(p.id, { zh: "已卸载，去商店可以重装", en: "Uninstalled — reinstall from Store" });
        });
      }
    });
  };

  const doCheckin = (id) => act(id, "checkin", async () => {
    const out = await rpcCall("checkin", { provider: id });
    const okCount = Array.isArray(out?.results) ? out.results.filter((r) => r?.ok !== false).length : 0;
    say(id, { zh: okCount > 0 ? `签到完成（${okCount} 个账号）` : "签到完成", en: okCount > 0 ? `Checked in (${okCount})` : "Checked in" });
  });

  const unhide = (key) => act(key, "unhide", async () => {
    await rpcCall("account.setHidden", { key, hidden: false });
  });

  // ── 调整供应商（原版「调整 <名字>」） ────────────────────────────────────
  // 展开时才去取目录：4 个供应商各 3~10 个模型，一次全拉没必要。
  const readCatalog = useCallback(async (pid) => {
    setCatBusy((b) => ({ ...b, [pid]: true }));
    try {
      const out = await rpcCall("catalog.rows", { provider: pid });
      const rows = Array.isArray(out?.rows) ? out.rows : [];
      setCatalog((m) => ({ ...m, [pid]: rows }));
    }
    catch (caught) {
      setErr((e) => ({ ...e, [pid]: caught instanceof Error ? caught.message : String(caught) }));
    }
    finally {
      setCatBusy((b) => { const next = { ...b }; delete next[pid]; return next; });
    }
  }, [rpcCall]);

  const openTuning = (pid) => {
    const willOpen = tuning[pid] !== true;
    setTuning((o) => ({ ...o, [pid]: willOpen }));
    if (willOpen && catalog[pid] === undefined) { void readCatalog(pid); }
  };

  // 重新问一次上游目录（供应商上线/下线模型后要重取）
  const refreshCatalog = (pid) => act(pid, "catalog", async () => {
    await rpcCall("catalog.refresh", {});
    await readCatalog(pid);
    say(pid, { zh: "模型目录已更新", en: "Model catalog refreshed" });
  });

  // 单个模型开关
  const toggleModel = (pid, model, off) => act(pid + "/" + model, "model", async () => {
    await rpcCall("model.toggle", { provider: pid, model, off });
    setCatalog((m) => ({
      ...m,
      [pid]: (m[pid] ?? []).map((r) => (r.id === model ? { ...r, disabled: off } : r)),
    }));
  });

  // 全部启用 / 全部停用（一次 model.setMany，别逐个打）
  const toggleAllModels = (pid, off) => act(pid, "models", async () => {
    const rows = catalog[pid] ?? [];
    if (rows.length === 0) { return; }
    await rpcCall("model.setMany", { provider: pid, models: rows.map((r) => r.id), off });
    setCatalog((m) => ({ ...m, [pid]: (m[pid] ?? []).map((r) => ({ ...r, disabled: off })) }));
    say(pid, off
      ? { zh: `已停用 ${rows.length} 个模型`, en: `Disabled ${rows.length} models` }
      : { zh: `已启用 ${rows.length} 个模型`, en: `Enabled ${rows.length} models` });
  });

  // 供应商整体停用：会把它从 DSH 的 provider 列表里摘掉
  const toggleProvider = (pid, off) => act(pid, "provider", async () => {
    await rpcCall("provider.setOff", { provider: pid, off });
  });

  const usageOfKey = (pid, key) => (Array.isArray(snapshot?.usage) ? snapshot.usage : []).find((u) => u.provider === pid && u.accountKey === key);

  // 账号打码：只留头 2 尾 2，够认人又不至于截图就把号卖了。
  // 每个供应商可以单独开/关（maskOverrides），没单独设过的跟随顶栏那个全局值。
  const maskOn = useCallback((pid) => {
    if (pid !== undefined && maskOverrides && maskOverrides[pid] !== undefined) {
      return maskOverrides[pid] === true;
    }
    return mask === true;
  }, [mask, maskOverrides]);
  const mk = useCallback((s, pid) => {
    const str = String(s ?? "");
    if (maskOn(pid) !== true) { return str; }
    if (str.length <= 4) { return "••••"; }
    return str.slice(0, 2) + "•••" + str.slice(-2);
  }, [maskOn]);

  const hiddenOf = (pid) => (hiddenKeys ?? []).filter((h) => h.provider === pid);

  if (providers.length === 0) {
    return React.createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 12 } },
      React.createElement(
        "div",
        { className: "none-box" },
        t(
          locale,
          "还没有安装 magpie 插件。去「商店」页装一个，或把插件放进 magpie 的数据目录后重新扫描。",
          "No magpie plugins installed yet. Install one from Store, or drop a plugin into the magpie data directory and rescan."
        )
      )
    );
  }

  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 12 } },
    // 确认浮层：没有待确认的事就是 null，不占位。
    confirmAsk === null || confirmAsk === void 0
      ? null
      : React.createElement(
        "div",
        { className: "mg-modal-mask", onClick: () => setConfirmAsk(null) },
        React.createElement(
          "div",
          { className: "mg-modal", onClick: (e) => e.stopPropagation() },
          React.createElement("div", { className: "mg-modal-title" }, confirmAsk.title),
          React.createElement("div", { className: "mg-modal-body" }, confirmAsk.body),
          React.createElement(
            "div",
            { className: "mg-modal-acts" },
            React.createElement(
              "button",
              { type: "button", className: "mg-btn mg-btn-mini mg-btn-ghost", onClick: () => setConfirmAsk(null) },
              t(locale, "取消", "Cancel")
            ),
            React.createElement(
              "button",
              {
                type: "button",
                className: "mg-btn mg-btn-mini " + (confirmAsk.danger === true ? "mg-btn-danger" : "mg-btn-accent"),
                onClick: () => {
                  const fn = confirmAsk.onOk;
                  setConfirmAsk(null);
                  if (typeof fn === "function") { fn(); }
                }
              },
              confirmAsk.confirm === void 0 ? t(locale, "确定", "OK") : confirmAsk.confirm
            )
          )
        )
      ),
    providers.map((p) => {
      const busyLabel = busy[p.id];
      const isBusy = typeof busyLabel === "string" && busyLabel !== "";
      const pend = pending[p.id] ?? p.pending;
      const methods = Array.isArray(p.methods) ? p.methods : [];
    // 华为云系的 CodeArts 给了两条登录方式：第 0 条是国内站（中文），第 1 条
    // 是国际站（英文界面、海外区账号）。默认走第 0 条，但国际站必须能点到 ——
    // 海外区账号在国内站登录不上，反过来也一样，两条路的凭证是分开的。
    const intlIndex = methods.findIndex((m, k) => k > 0 && typeof m?.label === "string" && /international|国际|海外/i.test(m.label));
      // 传给 rpc 的是 method 自带的 index；站内默认第一条（国内站）。
      const intlPick = intlIndex >= 0
        ? (typeof methods[intlIndex].index === "number" ? methods[intlIndex].index : intlIndex)
        : -1;
      const pickIdx = typeof stationPick[p.id] === "number" ? stationPick[p.id] : (methods[0]?.index ?? 0);
      const hasAccounts = (p.accounts ?? []).length > 0;
      return React.createElement(
        "div",
        { key: p.id, className: "pq-group" },
        React.createElement(
          "div",
          { className: "pq-gh" },
          React.createElement("span", { className: "pq-gn" }, p.name || p.id),
          p.off === true
            ? React.createElement("span", { className: "mg-badge mg-badge-off" }, t(locale, "已停用", "off"))
            : null,
          p.error
            ? React.createElement("span", { className: "mg-badge mg-badge-off" }, t(locale, "异常", "error"))
            : null,
          (p.accounts?.length ?? 0) > 1
            ? React.createElement("span", { className: "pq-count", title: t(locale, `${p.accounts.length} 个账号`, `${p.accounts.length} accounts`) }, String(p.accounts.length))
            : null,
          p.hasUsage === false
            ? null
            : React.createElement("span", { className: "mg-badge" }, `${p.models ?? 0} ${t(locale, "个模型", "models")}`),
          p.hasCheckin
            ? React.createElement(
              "button",
              {
                type: "button",
                className: "mg-btn mg-btn-mini mg-btn-checkin",
                disabled: isBusy,
                title: t(locale, "签到领额度（同一天重复点只会签到一次）", "Daily check-in"),
                onClick: () => void doCheckin(p.id)
              },
              t(locale, "签到", "Check in")
            )
            : null,
          // 一键刷新额度：跟「签到」并排，多账号时不用一个个进账号行点。
          (p.accounts?.length ?? 0) > 0 && p.hasUsage !== false
            ? React.createElement(
              "button",
              {
                type: "button",
                className: "mg-btn mg-btn-mini mg-btn-refresh",
                disabled: isBusy,
                title: t(locale, `把这个供应商的 ${p.accounts.length} 个账号额度都重新问一遍`, "Re-read quota for every account"),
                onClick: () => void refreshAll(p.id, p.accounts)
              },
              isBusy && busyLabel === "retestAll" ? t(locale, "刷新中…", "Refreshing…") : t(locale, "刷新额度", "Refresh")
            )
            : null,
          React.createElement(
            "div",
            { className: "mg-acts" },
            React.createElement(
                "button",
                {
                  type: "button",
                  className: "mg-btn mg-btn-done",
                  disabled: isBusy,
                  onClick: () => {
                    // 走「国内 / 国际」切换器当前选中的那条；没有切换器的供应商就是
                    // 它官方的第一条路（raccoon 拉起浏览器、doubao 拉起本机客户端）。
                    void start(p.id, pickIdx);
                  }
                },
                isBusy && busyLabel === "signIn" ? t(locale, "正在启动…", "Starting…") : (hasAccounts ? t(locale, "添加账号", "Add account") : t(locale, "登录", "Sign in"))
              ),
            intlPick >= 0
              ? React.createElement(
                "div",
                {
                  className: "mg-seg",
                  role: "group",
                  title: t(locale, "选哪个站登录。国内站和国际站是两套账号，凭证不通用。", "Which station to sign in on. The two stations hold separate accounts.")
                },
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "mg-seg-btn" + (pickIdx === intlPick ? "" : " mg-seg-on"),
                    disabled: isBusy,
                    "aria-pressed": String(pickIdx !== intlPick),
                    onClick: () => setStationPick((st) => ({ ...st, [p.id]: methods[0]?.index ?? 0 }))
                  },
                  t(locale, "国内", "CN")
                ),
                React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "mg-seg-btn" + (pickIdx === intlPick ? " mg-seg-on" : ""),
                    disabled: isBusy,
                    "aria-pressed": String(pickIdx === intlPick),
                    onClick: () => setStationPick((st) => ({ ...st, [p.id]: intlPick }))
                  },
                  t(locale, "国际", "Intl")
                )
              )
              : null,
            pend !== undefined
              ? React.createElement(
                "button",
                {
                  type: "button",
                  className: "mg-btn mg-btn-done",
                  disabled: isBusy,
                  onClick: () => void finish(p.id, pend && typeof pend.index === "number" ? pend.index : 0)
                },
                isBusy && busyLabel === "signInFinish" ? t(locale, "等待中…", "Waiting…") : t(locale, "我已完成", "Done")
              )
              : null,
            React.createElement(
              "button",
              {
                type: "button",
                className: "mg-btn mg-btn-mini mg-lock-btn" + (maskOn(p.id) === true ? " mg-lock-on" : ""),
                title: maskOn(p.id) === true
                  ? t(locale, "这个供应商的账号已锁起来（只留头尾几位）。点一下解锁显示全名", "Account names locked here — click to unlock")
                  : t(locale, "点一下把账号名锁起来，截图或录屏时不露全名", "Lock account names so screenshots do not leak them"),
                "aria-pressed": String(maskOn(p.id) === true),
                onClick: () => { if (typeof onMaskFor === "function") { onMaskFor(p.id, maskOn(p.id) !== true); } }
              },
              // 锁体：圆角矩形 + 锁扣。上锁时扣子搭在锁体上，解锁时向右上弹开。
              React.createElement(
                "svg",
                {
                  viewBox: "0 0 16 16",
                  width: 13,
                  height: 13,
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: 1.7,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  "aria-hidden": "true"
                },
                React.createElement("rect", { x: 3.1, y: 7.1, width: 9.8, height: 6.9, rx: 1.9 }),
                maskOn(p.id) === true
                  ? React.createElement("path", { d: "M5.5 7.1V5.2a2.5 2.5 0 0 1 5 0v1.9" })
                  : React.createElement("path", { d: "M6.3 7.1V4.9a2.4 2.4 0 0 1 4.7-.6" })
              )
            ),
            React.createElement(
              "button",
              {
                type: "button",
                className: "mg-btn mg-btn-mini mg-btn-ghost" + (tuning[p.id] === true ? " mg-btn-on" : ""),
                title: t(locale, "模型勾选、单个模型启停、本供应商整体停用", "Pick models, toggle each, disable this provider"),
                onClick: () => openTuning(p.id)
              },
              t(locale, "调整", "Tune"),
              React.createElement("span", { className: "mg-caret" + (tuning[p.id] === true ? " mg-caret-open" : "") }, "›")
            )
          )
        ),
        p.error
          ? React.createElement("div", { className: "pq-say err" }, p.error)
          : null,
        note[p.id] !== undefined
          ? React.createElement(
            "div",
            { className: "mg-note" },
            React.createElement("span", {
              className: "mg-note-text"
            }, t(locale, note[p.id]?.zh ?? note[p.id], note[p.id]?.en ?? note[p.id])),
            noteUrl[p.id] !== undefined
              ? React.createElement(
                "button",
                {
                  type: "button",
                  className: "mg-note-link",
                  onClick: () => {
                    try { globalThis.open?.(noteUrl[p.id], "_blank", "noopener,noreferrer"); }
                    catch { /* 用户手点的，基本不会失败 */ }
                  }
                },
                t(locale, "打开登录页", "Open sign-in page")
              )
              : null
          )
          : null,
        err[p.id] !== undefined && err[p.id] !== ""
          ? React.createElement("div", { className: "pq-say err" }, err[p.id])
          : null,
        // ── 调整区（原版「调整 <供应商>」） ────────────────────────────────
        tuning[p.id] === true
          ? React.createElement(
            "div",
            { className: "mg-tuning" },
            React.createElement(
              "div",
              { className: "mg-tuning-head" },
              React.createElement("span", { className: "mg-tuning-title" }, t(locale, "模型目录", "Models")),
              React.createElement(
                "span",
                { className: "mg-tuning-count" },
                (catalog[p.id] ?? []).length === 0
                  ? (catBusy[p.id] === true ? t(locale, "读取中…", "Loading…") : "—")
                  : t(locale, `${(catalog[p.id] ?? []).filter((r) => r.disabled !== true).length} / ${(catalog[p.id] ?? []).length} 启用`, `${(catalog[p.id] ?? []).filter((r) => r.disabled !== true).length} / ${(catalog[p.id] ?? []).length} on`)
              ),
              React.createElement(
                "div",
                { className: "mg-acts" },
                React.createElement(
                  "button",
                  { type: "button", className: "mg-btn mg-btn-mini mg-btn-ghost", disabled: isBusy || catBusy[p.id] === true, onClick: () => void refreshCatalog(p.id) },
                  catBusy[p.id] === true ? t(locale, "获取中…", "Fetching…") : t(locale, "重新获取", "Refetch")
                ),
                React.createElement(
                  "button",
                  { type: "button", className: "mg-btn mg-btn-mini mg-btn-accent", disabled: isBusy || (catalog[p.id] ?? []).length === 0, onClick: () => void toggleAllModels(p.id, false) },
                  t(locale, "全部启用", "All on")
                ),
                React.createElement(
                  "button",
                  { type: "button", className: "mg-btn mg-btn-mini mg-btn-ghost", disabled: isBusy || (catalog[p.id] ?? []).length === 0, onClick: () => void toggleAllModels(p.id, true) },
                  t(locale, "全部停用", "All off")
                )
              )
            ),
            (catalog[p.id] ?? []).length === 0
              ? React.createElement(
                "div",
                { className: "mg-tuning-empty" },
                catBusy[p.id] === true
                  ? t(locale, "正在向供应商要模型列表…", "Asking the provider for its model list…")
                  : t(locale, "没拿到模型列表。点「重新获取」再试一次。", "No models returned. Press Refetch to retry.")
              )
              : React.createElement(
                "div",
                { className: "mg-models" },
                (catalog[p.id] ?? []).map((row) => {
                  const mBusy = busy[p.id + "/" + row.id] === "model";
                  const on = row.disabled !== true;
                  return React.createElement(
                    "button",
                    {
                      key: "md-" + row.id,
                      type: "button",
                      className: "mg-model" + (on ? " mg-model-on" : ""),
                      disabled: mBusy,
                      title: row.id,
                      onClick: () => void toggleModel(p.id, row.id, on)
                    },
                    React.createElement("span", { className: "mg-model-box" }, on ? "✓" : ""),
                    React.createElement("span", { className: "mg-model-name" }, row.name || row.id),
                    row.context !== undefined
                      ? React.createElement("span", { className: "mg-model-ctx", title: t(locale, "上下文窗口", "Context window") }, fmtShort(row.context))
                      : null,
                    row.free === true
                      ? React.createElement("span", { className: "mg-badge mg-badge-ok" }, t(locale, "免费", "free"))
                      : null
                  );
                })
              ),
            React.createElement(
              "div",
              { className: "mg-tuning-foot" },
              React.createElement(
                "span",
                { className: "pq-sub" },
                p.off === true
                  ? t(locale, "本供应商当前已停用，模型选择器里看不到它。", "This provider is off and hidden from the model picker.")
                  : t(locale, "停用后它整个从模型选择器里消失（账号不会丢）。", "Disabling hides it from the model picker; accounts are kept.")
              ),
              // 卸载在停用前面：停用是可逆的常用操作，卸载是破坏性且不可撤回。
              // 两个都在，但卸载靠左、低强调（ghost），停用保持原样。
              typeof p.spec === "string" && p.spec !== ""
                ? React.createElement(
                  "button",
                  {
                    type: "button",
                    className: "mg-btn mg-btn-mini mg-btn-ghost",
                    disabled: isBusy,
                    title: t(locale, "把这个插件包从磁盘删掉；以后想再用去商店重装", "Delete the plugin package; reinstall from Store later"),
                    onClick: () => doUninstall(p)
                  },
                  t(locale, "卸载", "Uninstall")
                )
                : null,
              React.createElement(
                "button",
                {
                  type: "button",
                  className: "mg-btn mg-btn-mini " + (p.off === true ? "mg-btn-accent" : "mg-btn-danger"),
                  disabled: isBusy,
                  onClick: () => void toggleProvider(p.id, p.off !== true)
                },
                p.off === true
                  ? t(locale, "启用此供应商", "Enable provider")
                  : t(locale, "停用此供应商", "Disable provider")
              )
            )
          )
          : null,
        (p.accounts ?? []).map((a) => {
          const u = usageOfKey(p.id, a.key);
          const aBusy = typeof busy[a.key] === "string" && busy[a.key] !== "";
          const isRenaming = renaming === a.key;
          return React.createElement(
            "div",
            { key: a.key, className: "mg-acct" + (a.signIn === "expired" ? " mg-acct-bad" : "") },
            React.createElement(
              "div",
              { className: "mg-acct-head" },
              isRenaming
                ? React.createElement("input", {
                  className: "mg-rename",
                  value: draft,
                  autoFocus: true,
                  placeholder: a.accountId || a.key,
                  onChange: (e) => setDraft(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === "Enter") { void doRename(a); }
                    if (e.key === "Escape") { setRenaming(null); setDraft(""); }
                  }
                })
                : React.createElement("span", { className: "mg-acct-name", title: mk(a.key, p.id) }, mk(a.alias || a.accountId || a.key, p.id)),
              a.alias !== undefined && a.alias !== ""
                ? React.createElement("span", { className: "mg-badge", title: mk(a.accountId || a.key, p.id) }, mk(a.accountId || a.key, p.id))
                : null,
              a.signIn === "expired"
                ? React.createElement("span", { className: "mg-badge mg-badge-bad" }, t(locale, "失效", "expired"))
                : a.signIn === "kept"
                  ? React.createElement("span", { className: "mg-badge mg-badge-ok" }, t(locale, "有效", "ok"))
                  : null,
              React.createElement(
                "div",
                { className: "mg-acts" },
                isRenaming
                  ? React.createElement(React.Fragment, null,
                    React.createElement("button", { type: "button", className: "mg-btn mg-btn-mini mg-btn-accent", disabled: aBusy, onClick: () => void doRename(a) }, t(locale, "保存", "Save")),
                    React.createElement("button", { type: "button", className: "mg-btn mg-btn-mini mg-btn-ghost", disabled: aBusy, onClick: () => { setRenaming(null); setDraft(""); } }, t(locale, "取消", "Cancel")))
                  : React.createElement(React.Fragment, null,
                    React.createElement("button", { type: "button", className: "mg-btn mg-btn-mini mg-btn-ghost", disabled: aBusy, onClick: () => { setRenaming(a.key); setDraft(typeof a.alias === "string" ? a.alias : ""); } }, t(locale, "重命名", "Rename")),
                    React.createElement("button", { type: "button", className: "mg-btn mg-btn-mini mg-btn-ghost", disabled: aBusy, title: t(locale, "从列表里收起来，不影响请求；收起的账号在本供应商卡片下方的「已隐藏」里恢复", "Hide from list; requests still work. Restore below."), onClick: () => void doHide(a, p.id) }, t(locale, "隐藏", "Hide")),
                    React.createElement("button", { type: "button", className: "mg-btn mg-btn-mini mg-btn-danger", disabled: aBusy, onClick: () => { setDelErr(""); setDeleting(a); } }, t(locale, "删除账号", "Delete"))
                  )
              )
            ),
            (acctErr[p.id + "#" + a.key] ?? "") !== ""
              ? React.createElement("div", { className: "mg-acct-err" }, acctErr[p.id + "#" + a.key])
              : null,
            u !== undefined
              ? React.createElement(
                "div",
                { className: "mg-quota" },
                u.plan !== undefined ? React.createElement("span", { className: "mg-quota-plan" }, String(u.plan)) : null,
                u.label !== undefined && u.label !== "" ? React.createElement("span", { className: "mg-badge" }, String(u.label)) : null,
                u.balance !== undefined ? React.createElement("span", { className: "mg-quota-plan" }, String(u.balance)) : null,
                u.error !== undefined ? React.createElement("span", { className: "pq-say err" }, String(u.error)) : null,
                (Array.isArray(u.windows) ? u.windows : []).map((w, i) => React.createElement(
                  "span",
                  { key: "w-" + String(i), className: "mg-qw", title: w.resetsAt !== undefined ? resetsText(w.resetsAt, locale) : "" },
                  String(w.name ?? ""),
                  " ",
                  w.display !== undefined ? String(w.display) : `${w.used ?? 0} / ${w.limit ?? 0}`
                )),
                u.until !== undefined && u.until !== null
                  ? React.createElement("div", { className: "pq-sub" }, resetsText(u.until, locale))
                  : null
              )
              : null,
            err[a.key] !== undefined && err[a.key] !== ""
              ? React.createElement("div", { className: "pq-say err" }, err[a.key])
              : null
          );
        }),
        hiddenOf(p.id).length === 0
          ? null
          : React.createElement(
            "div",
            { className: "mg-hidden" },
            React.createElement(
              "button",
              {
                type: "button",
                className: "mg-hidden-toggle",
                onClick: () => setHiddenOpen((o) => ({ ...o, [p.id]: o[p.id] !== true }))
              },
              React.createElement("span", { className: "mg-hidden-caret" + (hiddenOpen[p.id] === true ? " mg-hidden-open" : "") }, "›"),
              t(locale, `已隐藏 ${hiddenOf(p.id).length} 个账号`, `${hiddenOf(p.id).length} hidden`)
            ),
            hiddenOpen[p.id] === true
              ? React.createElement(
                "div",
                { className: "mg-hidden-list" },
                hiddenOf(p.id).map((h) => React.createElement(
                  "div",
                  { key: h.key, className: "mg-hidden-row" },
                  React.createElement("span", { className: "mg-hidden-name", title: mk(h.key, h.provider) }, mk(h.alias || h.key, h.provider)),
                  React.createElement(
                    "button",
                    { type: "button", className: "mg-btn mg-btn-mini mg-btn-accent", disabled: busy[h.key] === "unhide", onClick: () => void unhide(h.key) },
                    t(locale, "恢复显示", "Restore")
                  )
                ))
              )
              : null
          )
      );
    }),
    deleting !== null
      ? React.createElement(DeleteModal, {
        account: deleting,
        locale,
        busy: busy[deleting.key] === "delete",
        error: delErr,
        display: mk(deleting.alias || deleting.accountId || deleting.key, deleting.provider),
        onCancel: () => { if (busy[deleting.key] !== "delete") { setDeleting(null); setDelErr(""); } },
        onConfirm: () => void doDelete()
      })
      : null
  );
}

function QuotasTab({ snapshot, locale }) {
  const usage = Array.isArray(snapshot?.usage) ? snapshot.usage : [];
  const [expanded, setExpanded] = useState({});
  if (usage.length === 0) {
    return React.createElement(
      "div",
      { className: "none-box" },
      t(
        locale,
        "没有额度信息（插件的 auth.usage 没回报，或还没登录）。",
        "No allowances reported (the plugin's auth.usage returned nothing, or nobody is signed in)."
      )
    );
  }
  const groups = [];
  const byName = /* @__PURE__ */ new Map();
  for (const u of usage) {
    const name2 = u.provider;
    if (!byName.has(name2)) {
      byName.set(name2, []);
      groups.push({ name: name2, rows: byName.get(name2) });
    }
    byName.get(name2).push(u);
  }
  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 14 } },
    groups.map((g) => {
      const open = expanded[g.name] === true;
      const shown = open ? g.rows : g.rows.slice(0, 1);
      const hidden = g.rows.length - shown.length;
      return React.createElement(
        "div",
        { key: g.name, className: "pq-group" },
        React.createElement(
          "div",
          { className: "pq-gh" },
          React.createElement("span", { className: "pq-gn" }, shown[0]?.label?.split(" · ")[0] ?? g.name),
          g.rows.length > 1 ? React.createElement("span", { className: "pq-count" }, String(g.rows.length)) : React.createElement("span", { className: "pq-gnote" }, shown[0]?.plan ?? "")
        ),
        shown.map((u, i) => React.createElement(
          "div",
          { key: `${u.accountKey}-${i}`, className: "pq-card" },
          React.createElement(
            "div",
            { className: "pq-who" },
            React.createElement("span", { className: "pq-user" }, u.label || u.provider)
          ),
          React.createElement(
            "div",
            { className: "pq-rings" + ((u.windows?.length ?? 0) > 3 ? " many" : "") },
            (u.windows ?? []).filter((w) => typeof w.used === "number").slice(0, 4).map((w, j) => React.createElement(Dial, { key: j, pct: w.used, label: w.name })),
            (u.windows ?? []).filter((w) => typeof w.used !== "number").slice(0, 2).map((w, j) => React.createElement(Dial, { key: `t${j}`, pct: null, label: w.name }))
          ),
          React.createElement(
            "div",
            { className: "pq-say" },
            [
              u.plan,
              u.balance ? t(locale, `余额 ${u.balance}`, `balance ${u.balance}`) : "",
              resetsText((u.windows ?? []).find((w) => w.resetsAt !== void 0)?.resetsAt, locale)
            ].filter(Boolean).join(" · ") || (u.error ?? "")
          ),
          u.error ? React.createElement("div", { className: "pq-sub err", style: { gridColumn: "1 / -1" } }, u.error) : null
        )),
        hidden > 0 ? React.createElement("button", {
          type: "button",
          className: "more",
          onClick: () => setExpanded({ ...expanded, [g.name]: true })
        }, t(locale, `展开其余 ${hidden} 个账号`, `Show ${hidden} more`)) : null,
        open && g.rows.length > 1 ? React.createElement("button", {
          type: "button",
          className: "more",
          onClick: () => setExpanded({ ...expanded, [g.name]: false })
        }, t(locale, "收起", "Collapse")) : null
      );
    })
  );
}
function UsageTab({ snapshot, locale, period, onPeriod }) {
  const stats = snapshot?.stats ?? {};
  const series = Array.isArray(stats.series) ? stats.series : [];
  const byProvider = Array.isArray(stats.byProvider) ? stats.byProvider : [];
  const [metric, setMetric] = useState("tokens");
  const valueOf = (p) => {
    if (metric === "cost") return typeof p.cost === "number" ? p.cost : 0;
    if (metric === "calls") return typeof p.calls === "number" ? p.calls : 0;
    return typeof p.tokens === "number" ? p.tokens : 0;
  };
  const rankValueOf = (r) => {
    if (metric === "calls") return typeof r.calls === "number" ? r.calls : 0;
    return typeof r.tokens === "number" ? r.tokens : 0;
  };
  const cached = (stats.cacheReadTokens ?? 0) + (stats.cacheWriteTokens ?? 0);
  const prompt = (stats.inputTokens ?? 0) + (stats.cacheReadTokens ?? 0) + (stats.cacheWriteTokens ?? 0);
  const hitRate = prompt > 0 ? (stats.cacheReadTokens ?? 0) / prompt : null;
  return React.createElement(
    React.Fragment,
    null,
    // 工具条：时间段 + 刷新
    React.createElement(
      "div",
      { className: "pu-bar" },
      React.createElement(
        "div",
        { className: "segs" },
        PERIODS.map((p) => React.createElement("button", {
          key: p.id,
          type: "button",
          className: `opt${p.id === period ? " on" : ""}`,
          onClick: () => onPeriod(p.id)
        }, t(locale, p.zh, p.en)))
      )
    ),
    // 统计口径（magpie 原句）
    React.createElement(
      "p",
      { className: "usage-note" },
      t(
        locale,
        "统计网关调用与会话日志调用；本地拒绝的请求不计入汇总。",
        "Gateway and session-log calls; local rejections excluded from totals."
      )
    ),
    // 四张指标卡（magpie 的 .led-strip）
    React.createElement(
      "div",
      { className: "led-strip" },
      React.createElement(Blk, {
        label: "Tokens",
        value: fmtN(stats.tokens),
        sub: `${fmtN(stats.inputTokens)} in · ${fmtN(stats.outputTokens)} out${cached > 0 ? ` · ${fmtN(cached)} cached` : ""}`
      }),
      React.createElement(Blk, {
        label: t(locale, "请求", "Requests"),
        value: fmtN(stats.calls),
        sub: `${fmtN(stats.errors)} ${t(locale, "次失败", "failed")}`,
        tone: (stats.errors ?? 0) > 0 ? "bad" : void 0
      }),
      React.createElement(Blk, {
        label: t(locale, "输入", "Input"),
        value: fmtShort(stats.inputTokens),
        sub: t(locale, "未命中缓存", "uncached")
      }),
      React.createElement(Blk, {
        label: t(locale, "缓存命中率", "Cache hit rate"),
        value: hitRate === null ? "—" : `${Math.round(hitRate * 100)}%`,
        sub: t(locale, "占提示词", "of the prompt")
      })
    ),
    // 图表 + 排行（magpie 的 .led-trend > .led-body）
    React.createElement(
      "div",
      { className: "led-trend" },
      React.createElement(
        "div",
        { className: "pu-bar" },
        React.createElement(
          "div",
          { className: "segs" },
          [["tokens", t(locale, "Token", "Tokens")], ["calls", t(locale, "请求", "Requests")]].map(([id, label]) => React.createElement("button", {
            key: id,
            type: "button",
            className: `opt${id === metric ? " on" : ""}`,
            onClick: () => setMetric(id)
          }, label))
        ),
        React.createElement("span", { className: "grow" })
      ),
      React.createElement(
        "div",
        { className: "led-body" },
        React.createElement(Chart, { series, valueOf }),
        React.createElement(Rank, { rows: byProvider, valueOf: rankValueOf, locale })
      )
    )
  );
}
function RoutingTab({ snapshot, locale }) {
  const routing = Array.isArray(snapshot?.routing) ? snapshot.routing : [];
  if (routing.length === 0) {
    return React.createElement(
      "div",
      { className: "none-box" },
      t(locale, "还没有请求经过这个宿主。", "No requests have gone through this host yet.")
    );
  }
  return React.createElement(
    "table",
    { className: "rows" },
    React.createElement("thead", null, React.createElement(
      "tr",
      null,
      React.createElement("th", null, t(locale, "时间", "Time")),
      React.createElement("th", null, t(locale, "平台", "Provider")),
      React.createElement("th", null, t(locale, "模型", "Model")),
      React.createElement("th", null, t(locale, "状态", "Status")),
      React.createElement("th", null, t(locale, "耗时", "Latency"))
    )),
    React.createElement("tbody", null, routing.map((r, i) => React.createElement(
      "tr",
      { key: `${r.at}-${i}` },
      React.createElement("td", null, clock(r.at)),
      React.createElement("td", null, r.provider),
      React.createElement("td", null, r.model),
      React.createElement(
        "td",
        { className: r.status === "error" ? "bad" : void 0 },
        r.status === "error" ? t(locale, "失败", "failed") : "OK"
      ),
      React.createElement("td", null, typeof r.ms === "number" ? `${r.ms} ms` : "—")
    )))
  );
}
function StoreTab({ rpcCall, locale, snapshot, onRefresh, refreshRev }) {
  const [listings, setListings] = useState(null);
  const [mine, setMine] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  // 包名规范化：`@scope/x@latest`、`@scope/x`、`x` 都归一到 `x`。
  // 商店清单里的 package 是裸名，装机时传进来的可能是带版本的，
  // 不做这一步「已安装」永远判不出来。
  const norm = useCallback((spec) => {
    if (typeof spec !== "string") { return ""; }
    let v = spec.trim();
    if (v === "") { return ""; }
    const at = v.indexOf("@", v.startsWith("@") ? 1 : 0);
    if (at > 0) { v = v.slice(0, at); }
    const slash = v.lastIndexOf("/");
    return (slash >= 0 ? v.slice(slash + 1) : v).toLowerCase();
  }, []);

  const installedSet = useMemo(() => {
    const set = new Set();
    for (const x of mine) { set.add(norm(x.spec)); }
    // 兜底：快照里能追到 spec 的 provider 也算装了 —— 万一 plugins.list 拿不到
    for (const p of (Array.isArray(snapshot?.providers) ? snapshot.providers : [])) { set.add(norm(p.spec)); }
    set.delete("");
    return set;
  }, [mine, snapshot, norm]);

  const loadMine = useCallback(async () => {
    if (typeof rpcCall !== "function") { return []; }
    try {
      const out = await rpcCall("plugins.list", {});
      const rows = Array.isArray(out) ? out : [];
      setMine(rows);
      return rows;
    }
    catch { /* 老后端没这个接口，就只靠快照兜 */ }
    return [];
  }, [rpcCall]);

  const load = useCallback(async (force) => {
    setLoadError("");
    try {
      const out = await rpcCall("market.list", { force: force === true });
      setListings(Array.isArray(out) ? out : []);
      return Array.isArray(out) ? out.length : 0;
    }
    catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : String(caught));
      return -1;
    }
  }, [rpcCall]);

  useEffect(() => {
    void load(false);
    void loadMine();
  }, [load, loadMine]);

  // 右上角 ⟳ 是全局开关：它成功后 `refreshRev` 会变，这里跟着重读登记清单，
  // 否则商店的「已安装」徽章会一直停在旧状态。
  const revSeen = useRef(0);
  useEffect(() => {
    const rev = typeof refreshRev === "number" ? refreshRev : 0;
    if (rev === revSeen.current) { return; }
    revSeen.current = rev;
    if (rev > 0) { void loadMine(); }
  }, [refreshRev, loadMine]);

  const install = useCallback(async (pkg) => {
    if (working !== "") { return; }
    setWorking(pkg);
    setNotice(null);
    try {
      await rpcCall("market.install", { package: pkg });
      // reload 只重扫磁盘；供应商列表要 refresh 才会重建快照。
      // 少这一步就是「装好了但供应商里看不到」。
      await rpcCall("plugins.reload", {});
      if (typeof onRefresh === "function") { await onRefresh(); }
      await loadMine();
      setNotice({
        text: t(locale, pkg + " 装好了。左边「供应商」里已经能看到它，去那登录。", pkg + " installed. It is on the Providers tab now — sign in there."),
        bad: false
      });
    }
    catch (caught) {
      setNotice({ text: t(locale, "安装失败：", "Install failed: ") + (caught instanceof Error ? caught.message : String(caught)), bad: true });
    }
    finally { setWorking(""); }
  }, [rpcCall, onRefresh, loadMine, locale, working]);

  const refreshAll = useCallback(async () => {
    if (busy) { return; }
    setBusy(true);
    setNotice(null);
    try {
      const n = await load(true);
      const list = await loadMine();
      if (typeof onRefresh === "function") { await onRefresh(); }
      if (n >= 0) {
        setNotice({
          text: t(locale, "已刷新 · 商店 " + n + " 个插件 · 已装 " + list.length + " 个", "Refreshed · " + n + " plugins · " + list.length + " installed"),
          bad: false
        });
      }
    }
    finally { setBusy(false); }
  }, [busy, load, loadMine, onRefresh, mine, locale]);

  const rows = useMemo(() => {
    const items = Array.isArray(listings) ? listings : [];
    const q = query.trim().toLowerCase();
    if (q === "") { return items; }
    return items.filter((x) => String(x.name ?? "").toLowerCase().includes(q)
      || String(x.package ?? "").toLowerCase().includes(q)
      || JSON.stringify(x.summary ?? {}).toLowerCase().includes(q));
  }, [listings, query]);

  if (loadError !== "") {
    return React.createElement(
      "div",
      { className: "none-box", style: { color: "var(--red)" } },
      t(locale, "市场清单拉不到：", "Could not fetch the market: ") + loadError
    );
  }

  const hueOf = (text) => {
    let h = 0;
    const v = String(text ?? "");
    for (let i = 0; i < v.length; i++) { h = (h * 31 + v.charCodeAt(i)) % 360; }
    return h;
  };

  return React.createElement(
    "div",
    { className: "mg-store" },
    React.createElement(
      "div",
      { className: "mg-st-head" },
      React.createElement("input", {
        className: "mg-st-search",
        type: "search",
        placeholder: t(locale, "搜索插件…", "Search plugins…"),
        value: query,
        onChange: (e) => setQuery(e.target.value)
      }),
      React.createElement(
        "button",
        {
          type: "button",
          className: "mg-st-refresh" + (busy ? " mg-st-refresh-on" : ""),
          title: t(locale, "重新拉清单，同时刷新供应商列表", "Reload the list and refresh providers"),
          disabled: busy,
          onClick: () => { void refreshAll(); }
        },
        React.createElement("span", { className: "mg-st-refresh-ico" }, "⟳")
      )
    ),
    notice === null || notice === void 0
      ? null
      : React.createElement(
        "div",
        { className: "mg-st-notice" + (notice.bad === true ? " mg-st-notice-bad" : "") },
        React.createElement("span", { className: "mg-st-notice-dot" }),
        React.createElement("span", { className: "mg-st-notice-text" }, notice.text),
        React.createElement("button", {
          type: "button",
          className: "mg-st-notice-x",
          title: t(locale, "关闭", "Dismiss"),
          onClick: () => setNotice(null)
        }, "×")
      ),
    React.createElement(
      "div",
      { className: "mg-st-meta" },
      t(locale,
        "共 " + rows.length + " 个 · 已装 " + installedSet.size + " 个",
        rows.length + " plugins · " + installedSet.size + " installed")
    ),
    rows.length === 0
      ? React.createElement("div", { className: "mg-st-empty" }, t(locale, "没有匹配的插件。", "No plugins match."))
      : React.createElement(
        "div",
        { className: "mg-st-list" },
        rows.map((x) => {
          const key = norm(x.package);
          const on = installedSet.has(key);
          const isWorking = working === x.package;
          const hue = hueOf(x.name || x.package);
          return React.createElement(
            "div",
            { key: x.package, className: "mg-st-card" + (on ? " mg-st-card-on" : "") },
            React.createElement(
              "div",
              {
                className: "mg-st-ico",
                style: { background: "linear-gradient(160deg, hsl(" + hue + " 62% 62%), hsl(" + ((hue + 28) % 360) + " 58% 48%))" }
              },
              String(x.name || x.package || "?").slice(0, 1).toUpperCase()
            ),
            React.createElement(
              "div",
              { className: "mg-st-main" },
              React.createElement(
                "div",
                { className: "mg-st-line" },
                React.createElement("span", { className: "mg-st-name" }, x.name || x.package),
                x.kind ? React.createElement("span", { className: "mg-st-tag" }, x.kind) : null,
                x.community === true ? React.createElement("span", { className: "mg-st-tag mg-st-tag-mute" }, "community") : null,
                on ? React.createElement("span", { className: "mg-st-tag mg-st-tag-on" }, t(locale, "已安装", "installed")) : null
              ),
              React.createElement("div", { className: "mg-st-pkg" }, x.package),
              React.createElement(
                "div",
                { className: "mg-st-desc" },
                t(locale, x.summary?.zh ?? "", x.summary?.en ?? "") || x.package
              )
            ),
            React.createElement(
              "div",
              { className: "mg-st-act" },
              isWorking
                ? React.createElement(
                  "span",
                  { className: "mg-st-busy" },
                  React.createElement("span", { className: "mg-st-spin" }),
                  t(locale, "安装中…", "Installing…")
                )
                : on
                  ? React.createElement(
                    "button",
                    {
                      type: "button",
                      className: "mg-btn mg-btn-mini mg-btn-ghost",
                      title: t(locale, "重新下载覆盖安装", "Download again and overwrite"),
                      onClick: () => { void install(x.package); }
                    },
                    t(locale, "重装", "Reinstall")
                  )
                  : React.createElement(
                    "button",
                    {
                      type: "button",
                      className: "mg-btn mg-btn-mini mg-btn-accent",
                      disabled: working !== "",
                      onClick: () => { void install(x.package); }
                    },
                    t(locale, "安装", "Install")
                  )
            )
          );
        })
      )
  );
}

function SettingsTab({ locale, rpcCall, mask, onMask, theme, onTheme }) {
  const [entry, setEntry] = useState(void 0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  // 面板挂在哪：sidebar（侧栏图标）/ settings（设置页里的一节）
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const out = await rpcCall("panel.entry", {});
        if (alive) { setEntry(typeof out?.entry === "string" ? out.entry : void 0); }
      }
      catch { /* 老后端没这个接口，留空让用户点一次再定 */ }
    })();
    return () => { alive = false; };
  }, [rpcCall]);
  const setEntryTo = async (next) => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await rpcCall("panel.setEntry", { entry: next });
      setEntry(next);
      setMsg(t(locale, "已保存。侧栏入口的变化要重启 DSH 才看得到。", "Saved. Restart DSH to see the sidebar change."));
    }
    catch (caught) {
      setErr(caught instanceof Error ? caught.message : String(caught));
    }
    finally {
      setBusy(false);
    }
  };
  const row = (title, hint, control) => React.createElement(
    "div",
    { className: "mg-set-row" },
    React.createElement(
      "div",
      { className: "mg-set-info" },
      React.createElement("div", { className: "mg-set-title" }, title),
      hint !== "" ? React.createElement("div", { className: "mg-set-hint" }, hint) : null
    ),
    React.createElement("div", { className: "mg-set-ctl" }, control)
  );
  const seg = (options, value, pick) => React.createElement(
    "div",
    { className: "mg-set-seg" },
    options.map((o) => React.createElement(
      "button",
      {
        key: o.id,
        type: "button",
        className: o.id === value ? "on" : void 0,
        disabled: busy,
        onClick: () => pick(o.id)
      },
      o.label
    ))
  );
  return React.createElement(
    "div",
    { className: "mg-settings" },
    React.createElement("div", { className: "mg-set-group" }, t(locale, "外观", "Appearance"),
      row(
        t(locale, "色彩模式", "Color scheme"),
        t(locale, "只影响这个面板，不动 DSH 自己的主题。", "Affects this panel only."),
        seg([
          { id: "light", label: t(locale, "浅色", "Light") },
          { id: "dark", label: t(locale, "深色", "Dark") }
        ], theme, (v) => { if (typeof onTheme === "function") { onTheme(v); } })
      ),
      row(
        t(locale, "减少动态效果", "Reduce motion"),
        t(locale, "跟随系统设置。系统开了「减少动态效果」，按钮的光泽和呼吸会自动关掉。", "Follows the OS reduce-motion setting."),
        React.createElement("span", { className: "mg-set-ro" }, t(locale, "跟随系统", "System"))
      )
    ),
    React.createElement("div", { className: "mg-set-group" }, t(locale, "面板", "Panel"),
      row(
        t(locale, "显示位置", "Where it lives"),
        t(locale, "侧栏 = 左侧图标栏一个 Magpie 图标；设置页 = 只出现在设置里，不占侧栏。", "Sidebar = an icon in the left rail. Settings = only inside Settings."),
        seg([
          { id: "sidebar", label: t(locale, "侧栏", "Sidebar") },
          { id: "settings", label: t(locale, "设置页", "Settings") }
        ], entry, (v) => void setEntryTo(v))
      )
    ),
    React.createElement("div", { className: "mg-set-group" }, t(locale, "隐私", "Privacy"),
      row(
        t(locale, "账号打码", ""),
        t(locale, "列表里的账号名只留头尾几位，截图或录屏时不露全名。", "Mask account names in lists so screenshots do not leak them."),
        seg([
          { id: "off", label: t(locale, "显示全名", "Show") },
          { id: "on", label: t(locale, "打码", "Mask") }
        ], mask === true ? "on" : "off", (v) => { if (typeof onMask === "function") { onMask(v === "on"); } })
      )
    ),
    msg !== "" ? React.createElement("div", { className: "mg-set-msg" }, msg) : null,
    err !== "" ? React.createElement("div", { className: "pq-say err" }, err) : null,
    React.createElement(
      "div",
      { className: "mg-set-foot" },
      t(locale, "Magpie 只做「供应商 → DSH 原生模型」的接入，不代理请求，所以这里没有网关、端口、计费配置。", "Magpie only connects providers to DSH's native model picker. It proxies no traffic, so there is no gateway/port/billing config.")
    )
  );
}

function MagpiePage({ rpcCall, locale: hostLocale }) {
  // 界面语言：默认跟宿主，但允许在这里覆盖（顶栏那个「中 / EN」按钮）。
  // 存本地是有意的 —— 用户改过一次，下次打开还是这个语言，不必再点。
  // 空串表示「跟宿主」，非空时以本地方为准。
  const [localeOverride, setLocaleOverride] = useState(() => {
    try {
      const saved = globalThis.localStorage?.getItem("magpie-hub-locale");
      return saved === "zh" || saved === "en" ? saved : "";
    } catch { return ""; }
  });
  const locale = localeOverride !== "" ? localeOverride : String(hostLocale ?? "");
  const toggleLocale = useCallback(() => {
    setLocaleOverride((prev) => {
      const cur = prev !== "" ? prev : String(hostLocale ?? "");
      const next = cur.toLowerCase().startsWith("en") ? "zh" : "en";
      try { globalThis.localStorage?.setItem("magpie-hub-locale", next); } catch { /* 隐私模式写不进去 */ }
      return next;
    });
  }, [hostLocale]);
  const [tab, setTab] = useState("agents");
  const [snapshot, setSnapshot] = useState(null);
  const [period, setPeriod] = useState("today");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setSnapshot(await rpcCall("panel.snapshot", {}) ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }, [rpcCall]);
  useEffect(() => {
    void load();
  }, [load]);
  // 顶栏刷新：强制重建快照（panel.snapshot 只读内存，不会重新问上游）。
  // ⚠ 必须定义在 load 之后——useCallback 依赖数组里直接引用 load，
  // 写在前面会踩 TDZ（Cannot access 'load' before initialization）整页白屏。
  const [refreshing, setRefreshing] = useState(false);
  // 刷新的结果必须看得见：早先只转半圈图标、数据一样就完全不重画，
  // 用户根本分不清「已经刷了」和「点了没反应」。
  const [flash, setFlash] = useState(null);
  const flashRef = useRef(0);
  // 全局刷新计数器：右上角 ⟳ 成功一次 +1。
  // 快照是全局的（所有页签读同一个 `snapshot`），但商店页自己维护 `mine`
  // （plugins.json 的登记清单），不跟着快照走 —— 靠这个计数器通知它重拉。
  const [refreshRev, setRefreshRev] = useState(0);
  const showFlash = useCallback((text, bad) => {
    setFlash({ text: String(text ?? ""), bad: bad === true });
    if (flashRef.current !== 0) { globalThis.clearTimeout(flashRef.current); }
    flashRef.current = globalThis.setTimeout(() => { setFlash(null); flashRef.current = 0; }, 3600);
  }, []);
  useEffect(() => () => { if (flashRef.current !== 0) { globalThis.clearTimeout(flashRef.current); } }, []);
  const hardRefresh = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const out = await rpcCall("panel.refresh", {});
      if (out !== null && out !== void 0 && out.snapshot !== void 0) {
        setSnapshot(out.snapshot ?? null);
      } else {
        await load();
      }
      // 全局刷新：让商店页也重新读一次登记清单。
      // 放在 setSnapshot 之后，保证它拿到的 snapshot 已是新的。
      setRefreshRev((v) => v + 1);
      const ps = typeof out?.providers === "number" ? out.providers : null;
      const ac = typeof out?.accounts === "number" ? out.accounts : null;
      const md = typeof out?.models === "number" ? out.models : null;
      const bits = [];
      if (ps !== null) { bits.push(t(locale, ps + " 个供应商", ps + " providers")); }
      if (ac !== null) { bits.push(t(locale, ac + " 个账号", ac + " accounts")); }
      if (md !== null) { bits.push(t(locale, md + " 个模型", md + " models")); }
      const bad = typeof out?.reloadError === "string" && out.reloadError !== "" ? out.reloadError : (typeof out?.refreshError === "string" ? out.refreshError : "");
      if (bad !== "") {
        showFlash(t(locale, "刷新出错：" + bad, "Refresh error: " + bad), true);
      } else {
        showFlash(bits.length > 0 ? t(locale, "已刷新 · " + bits.join(" · "), "Refreshed · " + bits.join(" · ")) : t(locale, "已刷新", "Refreshed"));
      }
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : String(caught);
      setError(msg);
      showFlash(t(locale, "刷新失败：" + msg, "Refresh failed: " + msg), true);
    } finally {
      setRefreshing(false);
    }
  }, [rpcCall, load, locale, showFlash]);
  const changePeriod = useCallback(async (next) => {
    setPeriod(next);
    setBusy(true);
    try {
      await rpcCall("stats.period", { period: next });
      setSnapshot(await rpcCall("panel.snapshot", {}) ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }, [rpcCall]);
  // 主题：跟着 DSH 的 data-theme，没有就跟随系统
  const [theme, setTheme] = useState(() => {
    try {
      const saved = globalThis.localStorage?.getItem("magpie-hub-theme");
      if (saved === "dark" || saved === "light") return saved;
      const dark = globalThis.matchMedia?.("(prefers-color-scheme: dark)")?.matches === true;
      return dark ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try { globalThis.localStorage?.setItem("magpie-hub-theme", next); } catch { /* 隐私模式写不进去 */ }
      return next;
    });
  }, []);
  // 设置页要能直接指定浅/深，不能只会 toggle
  const setThemeTo = useCallback((next) => {
    if (next !== "dark" && next !== "light") { return; }
    setTheme(next);
    try { globalThis.localStorage?.setItem("magpie-hub-theme", next); } catch { /* 同上 */ }
  }, []);
  // 账号打码：和主题一样存本地，不落到插件状态里（换机器就恢复全名，符合直觉）
  const [mask, setMask] = useState(() => {
    try { return globalThis.localStorage?.getItem("magpie-hub-mask") === "1"; }
    catch { return false; }
  });
  // 每个供应商自己的打码开关。没设过的跟随顶栏那个全局值（mask）。
  const [maskOverrides, setMaskOverrides] = useState(() => {
    try {
      const raw = globalThis.localStorage?.getItem("magpie-hub-mask-map");
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (caught) { return {}; }
  });
  const setMaskFor = useCallback((pid, next) => {
    setMaskOverrides((prev) => {
      const out = { ...prev, [pid]: next === true };
      try { globalThis.localStorage?.setItem("magpie-hub-mask-map", JSON.stringify(out)); } catch (caught) { /* 隐私模式忽略 */ }
      return out;
    });
  }, []);
  const setMaskTo = useCallback((next) => {
    setMask(next === true);
    try { globalThis.localStorage?.setItem("magpie-hub-mask", next === true ? "1" : "0"); }
    catch { /* 同上 */ }
  }, []);
  // ⚠ body 必须排在 setMaskTo / setThemeTo 之后：它依赖这两个状态，
  // 写在前面会踩 TDZ（整页白屏，这个坑 11-15 已经踩过一次）。
  const body = useMemo(() => {
    if (tab === "full") {
      // 面板：原版 magpie 网页 UI，静态资源由 src/ui.js 挂在 /magpie-hub 下。
      return React.createElement("iframe", {
        className: "mg-frame",
        title: t(locale, "Magpie 面板", "Magpie panel"),
        // 主题必须走 query：iframe 里的原版 UI 由 ui/theme.js 读 ?theme=，
        // 它优先级最高，否则面板只会跟系统 prefers-color-scheme，切 ☾ 没反应。
        src: "/magpie-hub/?theme=" + theme,
        style: { width: "100%", height: "100%", border: "0", borderRadius: 12, background: "var(--card)" }
      });
    }
    if (snapshot === null) return null;
    if (tab === "agents") return React.createElement(AgentsTab, { snapshot, locale, rpcCall, onRefresh: load, mask, maskOverrides, onMaskFor: setMaskFor });
    if (tab === "quotas") return React.createElement(QuotasTab, { snapshot, locale });
    if (tab === "usage") return React.createElement(UsageTab, { snapshot, locale, period, onPeriod: changePeriod });
    if (tab === "store") return React.createElement(StoreTab, { rpcCall, locale, snapshot, onRefresh: load, refreshRev });
    return React.createElement(RoutingTab, { snapshot, locale });
  }, [snapshot, tab, locale, period, changePeriod, rpcCall, load, mask, maskOverrides, setMaskFor, theme, refreshRev]);
  return React.createElement(
    "div",
    { className: "mgh", "data-theme": theme },
    React.createElement(
      "div",
      { className: "mg-topbar" },
      React.createElement("span", { className: "mg-brand" }, "Magpie"),
      React.createElement("span", { className: "mg-brand-sub" }, t(locale, "模型供应商", "Providers")),
      flash !== null && flash !== void 0 && flash.text !== "" ? React.createElement("span", { className: "mg-flash" + (flash.bad === true ? " mg-flash-bad" : "") }, flash.text) : null,
      React.createElement(
        "button",
        {
          type: "button",
          className: "mg-icon-btn" + (refreshing ? " mg-spin" : ""),
          title: t(locale, "重新读取全部供应商（会重新问上游额度）", "Reload all providers"),
          disabled: refreshing,
          onClick: () => void hardRefresh()
        },
        "⟳"
      ),
      React.createElement(
        "button",
        {
          type: "button",
          className: "mg-icon-btn",
          title: t(locale, "切换深色 / 浅色", "Toggle theme"),
          onClick: toggleTheme
        },
        theme === "dark" ? "☀" : "☾"
      ),
      React.createElement(
        "button",
        {
          type: "button",
          className: "mg-icon-btn mg-locale-btn",
          title: t(locale, "切换界面语言（中文 / English）", "Switch language (Chinese / English)"),
          onClick: toggleLocale
        },
        t(locale, "EN", "CN")
      )
    ),
    React.createElement(
      "div",
      { className: "ptabs", role: "tablist" },
      TABS.map((x) => React.createElement("button", {
        key: x.id,
        type: "button",
        role: "tab",
        "aria-selected": String(x.id === tab),
        className: x.id === tab ? "on" : void 0,
        onClick: () => setTab(x.id)
      }, t(locale, x.zh, x.en)))
    ),
    React.createElement(
      "div",
      { className: "view" },
      error ? React.createElement("div", { className: "none-box", style: { color: "var(--red)" } }, error) : null,
      tab === "full" ? body : (busy && snapshot === null ? React.createElement("div", { className: "none-box" }, t(locale, "读取中…", "Loading…")) : body)
    )
  );
}


var VALID_ENTRIES = ["sidebar", "settings"];
var FALLBACK_ENTRY = "sidebar";
var MAGPIE_PANEL_KEY = "magpie";
var MAGPIE_SIDEBAR_ORDER = 30;
var MAGPIE_SETTINGS_ORDER = 55;
var current = null;
var listeners = /* @__PURE__ */ new Set();
function normalize(value) {
  return VALID_ENTRIES.includes(value) ? value : FALLBACK_ENTRY;
}
function panelEntryShowsSidebar() {
  return current === null ? true : normalize(current) === "sidebar";
}
function panelEntryShowsSettings() {
  return current === null ? false : normalize(current) === "settings";
}
function subscribePanelEntry(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function publishPanelEntry(value) {
  const next = normalize(value);
  if (current === next) return;
  current = next;
  for (const listener of listeners) {
    try {
      listener(next);
    } catch (caught) {
      console.warn("[magpie-hub] 面板入口订阅者出错", caught);
    }
  }
}
async function loadPanelEntry(rpcCall) {
  try {
    const value = await rpcCall();
    const entry = value !== null && typeof value === "object" ? value.entry : value;
    publishPanelEntry(typeof entry === "string" ? entry : FALLBACK_ENTRY);
  } catch {
  }
}

// plugin-src/client/panel-entry.js
var PANEL_LABEL = "Magpie";
function MagpieSidebarIcon({ size } = {}) {
  const px = typeof size === "number" && size > 0 ? size : 16;
  return React.createElement(
    "svg",
    {
      width: px,
      height: px,
      viewBox: "0 0 16 16",
      fill: "none",
      xmlns: "http://www.w3.org/2000/svg",
      "aria-hidden": "true"
    },
    // 一只侧面的鸟形（magpie 的名字），笔画风格与其它导航图标一致
    React.createElement("path", {
      d: "M2.6 9.2c0-2.9 2.3-5.2 5.2-5.2h2.3l1.9-1.6v2.1l1.4 1.1-1.4 1.1v.9c0 2.9-2.3 5.2-5.2 5.2H2.6z",
      stroke: "currentColor",
      strokeWidth: 1.25,
      strokeLinejoin: "round"
    }),
    React.createElement("path", { d: "M6.2 10.6 4.9 13.2", stroke: "currentColor", strokeWidth: 1.25, strokeLinecap: "round" }),
    React.createElement("circle", { cx: 9.9, cy: 6.6, r: 0.75, fill: "currentColor" })
  );
}
function registerMagpiePanelEntries(ctx, deps) {
  const { rpcCall, makeElement } = deps;
  const render = (props = {}) => makeElement({ rpcCall, ...props });
  ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: MAGPIE_PANEL_KEY,
    inject: () => ({ rpcCall })
  }, (props) => render(props)));
  let layout;
  ctx.inject(["layout"], (scoped) => {
    layout = scoped.layout;
    return () => {
      layout = void 0;
    };
  });
  const deselectIfActive = () => {
    try {
      if (layout?.panelInfo?.getSnapshot?.()?.activePanelId !== MAGPIE_PANEL_KEY) return;
      layout.selectPanel(null);
    } catch (caught) {
      console.warn("[magpie-hub] 撤销侧栏入口时取消选中失败", caught);
    }
  };
  ctx.slots.inject("sidebar.panellist", () => {
    let stopRow;
    const sync = (visible) => {
      if (visible && stopRow === void 0) {
        stopRow = ctx.slots.register({
          name: "sidebar.panellist",
          id: MAGPIE_PANEL_KEY,
          order: MAGPIE_SIDEBAR_ORDER,
          label: () => PANEL_LABEL
        }, MagpieSidebarIcon);
        return;
      }
      if (!visible && stopRow !== void 0) {
        const stop = stopRow;
        stopRow = void 0;
        stop();
        deselectIfActive();
      }
    };
    const unsubscribe = subscribePanelEntry(() => sync(panelEntryShowsSidebar()));
    sync(panelEntryShowsSidebar());
    let disposed = false;
    void loadPanelEntry(() => rpcCall("panel.entry", {})).then(() => {
      if (!disposed) sync(panelEntryShowsSidebar());
    });
    return () => {
      disposed = true;
      unsubscribe();
      if (stopRow !== void 0) {
        const stop = stopRow;
        stopRow = void 0;
        stop();
      }
    };
  });
  ctx.slots.inject("settings.section", () => {
    let stopSection;
    const sync = (visible) => {
      if (visible && stopSection === void 0) {
        stopSection = ctx.slots.register({
          name: "settings.section",
          id: MAGPIE_PANEL_KEY,
          order: MAGPIE_SETTINGS_ORDER,
          label: () => PANEL_LABEL,
          inject: () => ({ rpcCall })
        }, (props) => render(props));
        return;
      }
      if (!visible && stopSection !== void 0) {
        const stop = stopSection;
        stopSection = void 0;
        stop();
      }
    };
    const unsubscribe = subscribePanelEntry(() => sync(panelEntryShowsSettings()));
    sync(panelEntryShowsSettings());
    let disposed = false;
    void loadPanelEntry(() => rpcCall("panel.entry", {})).then(() => {
      if (!disposed) sync(panelEntryShowsSettings());
    });
    return () => {
      disposed = true;
      unsubscribe();
      if (stopSection !== void 0) {
        const stop = stopSection;
        stopSection = void 0;
        stop();
      }
    };
  });
}

// plugin-src/client/styles.js
var STYLE_ID = "dsh-magpie-styles";
var CSS = `
.mgh {
  /* ---- 浅色令牌（照抄 app.css:2-46） ---- */  --bg: #f4f4f6;
  --card: #ffffff;
  --card-2: #f9f9fb;
  --pill: #f1f1f4;
  --pill-hover: #e9e9ee;
  --line: #e3e3e8;
  --line-2: #ececf0;
  --fg: #1c1c21;
  --fg-2: #3f3f47;
  --muted: #6e6e78;
  --faint: #96969f;
  --accent: #5b4bf5;
  --accent-soft: #efedff;
  --green: #189a58;
  --red: #d64545;
  --amber: #b45309;
  --card-edge: 0 0 0 .5px rgba(20, 22, 30, .08);
  --shadow: 0 16px 44px rgba(20, 22, 30, .16), 0 2px 8px rgba(20, 22, 30, .06), 0 0 0 .5px rgba(20, 22, 30, .1);
  --c1: #4f46e5; --c2: #0ea5e9; --c3: #10b981; --c4: #d97706; --c5: #db2777; --c6: #7c3aed; --c7: #64748b;
  --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif;
  --code: ui-monospace, "SF Mono", Menlo, Consolas, "Cascadia Mono", monospace;

  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font);
  font-size: 13px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  /*
   * ⚠️ 布局要跟着**面板自己的宽度**收，不是窗口宽度：这个面板在桌面端既可能
   * 铺满中央主面板，也可能缩到侧栏旁边；在手机上是整屏。media 查询量的是视口，
   * 用一个 900px 宽的窗口装 390px 的面板时它不会收缩（4 列指标卡挤成一团）。
   * 容器查询量的是这里，两种情形都对。
   */
  container-type: inline-size;
  container-name: magh;
}

@media (prefers-color-scheme: dark) {
  .mgh {
    --bg: #1a1a1e;
    --card: #232327;
    --card-2: #1f1f23;
    --pill: #2d2d33;
    --pill-hover: #36363d;
    --line: #333339;
    --line-2: #2c2c32;
    --fg: #ededf1;
    --fg-2: #c9c9d1;
    --muted: #a3a3ad;
    --faint: #75757f;
    --accent: #b4bdff;
    --accent-soft: #2e3050;
    --green: #6fd99b;
    --red: #f28b82;
    --amber: #f2b544;
    --card-edge: inset 0 .5px 0 rgba(255, 255, 255, .06), 0 1px 2px rgba(0, 0, 0, .3);
    --shadow: 0 16px 44px rgba(0, 0, 0, .55), 0 2px 8px rgba(0, 0, 0, .3), 0 0 0 .5px rgba(255, 255, 255, .1);
    --c1: #a5b4fc; --c2: #7dd3fc; --c3: #6ee7b7; --c4: #fcd34d; --c5: #f9a8d4; --c6: #c4b5fd; --c7: #94a3b8;
  }
}

.mgh * { box-sizing: border-box; }

/* ---- 页签条：胶囊槽 + 浮起的选中块 ----
   原来是一排透明按钮 + 一层极淡阴影，选中态几乎看不出来。现在改成
   "内凹的槽 + 凸起的块"：槽有内阴影，选中块有白面渐变、主色描边、
   双层外投影和上沿高光，切换时带一次轻微回弹。 */
.mgh .ptabs {
  position: relative;
  display: flex;
  flex: none;
  gap: 3px;
  margin: 0 12px 10px;
  padding: 4px;
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(20, 22, 30, .085), rgba(20, 22, 30, .022)),
    var(--pill);
  box-shadow:
    inset 0 1.5px 3px rgba(20, 22, 30, .11),
    inset 0 -1px 0 color-mix(in srgb, #ffffff 22%, transparent),
    0 1px 0 color-mix(in srgb, #ffffff 26%, transparent);
}
.mgh .ptabs button {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 30px;
  padding: 0 6px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: .012em;
  color: var(--fg-2);
  cursor: pointer;
  transition:
    color 160ms ease,
    background-color 200ms ease,
    transform 160ms cubic-bezier(.22, 1, .36, 1),
    box-shadow 220ms ease;
  will-change: transform;
}
/* 悬停：不管选中没选中都回应 —— 抬 1px + 泛白，让人知道这里能点。 */
.mgh .ptabs button:hover:not(.on) {
  color: var(--fg-2);
  background: color-mix(in srgb, var(--card) 52%, transparent);
  transform: translateY(-1px);
  box-shadow: 0 2px 6px -3px rgba(20, 22, 30, .22);
}
.mgh .ptabs button:active:not(.on) {
  transform: translateY(0) scale(.96);
  transition-duration: 80ms;
}
/* 选中：无色液态玻璃。不带任何色相 —— 靠半透明白、内沿高光、多层投影
   做出"一片磨砂玻璃浮在凹槽上"的错觉，避免紫色描边抢戏。 */
.mgh .ptabs button.on {
  color: var(--fg);
  font-weight: 800;
  letter-spacing: .005em;
  background:
    linear-gradient(180deg,
      rgba(255, 255, 255, .97) 0%,
      rgba(255, 255, 255, .84) 44%,
      rgba(255, 255, 255, .72) 100%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  backdrop-filter: blur(16px) saturate(180%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 1),
    inset 0 -1px 0 rgba(20, 22, 30, .07),
    inset 0 0 0 1px rgba(20, 22, 30, .055),
    0 1px 2px rgba(20, 22, 30, .10),
    0 4px 10px -4px rgba(20, 22, 30, .18),
    0 12px 24px -14px rgba(20, 22, 30, .22);
  animation: mg-ptab-in 340ms cubic-bezier(.22, 1.35, .36, 1);
}
/* 玻璃顶部的折射亮带：只留白光，无色相。 */
.mgh .ptabs button.on::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 55%;
  border-radius: 9px 9px 44% 44%;
  background: linear-gradient(180deg, rgba(255, 255, 255, .88), rgba(255, 255, 255, 0) 78%);
  pointer-events: none;
}
@keyframes mg-ptab-in {
  0%   { transform: scale(.93); }
  55%  { transform: scale(1.025); }
  100% { transform: scale(1); }
}
.mgh .ptabs em {
  font-style: normal;
  font-weight: 400;
  color: var(--faint);
  font-variant-numeric: tabular-nums;
}

/* ---- 视图滚动区 ---- */
.mgh .view {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 2px 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ---- 说明行（.usage-note, app.css:1306） ---- */
.mgh .usage-note {
  margin: 0;
  padding: 3px 10px;
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1.55;
  color: var(--muted);
  border-left: 2px solid color-mix(in srgb, var(--fg) 13%, transparent);
  border-radius: 0 6px 6px 0;
  background: linear-gradient(90deg, color-mix(in srgb, var(--fg) 3.5%, transparent), transparent 72%);
  user-select: text;
}
.mgh[data-theme="dark"] .usage-note {
  color: rgba(255, 255, 255, .58);
  border-left-color: rgba(255, 255, 255, .17);
  background: linear-gradient(90deg, rgba(255, 255, 255, .045), transparent 72%);
}

/* ---- 工具条（.pu-bar / .led-bar, app.css:1352） ---- */
.mgh .pu-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
}
.mgh .pu-bar .grow { flex: 1; }

/* ---- 分段选择器：照抄 .segs / .opt（app.css:3348-3366） ---- */
.mgh .segs {
  position: relative;
  display: inline-flex;
  padding: 3px;
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(20, 22, 30, .062) 0%, rgba(20, 22, 30, .022) 100%);
  box-shadow: inset 0 1.5px 3px rgba(20, 22, 30, .095), inset 0 -1px 0 rgba(255, 255, 255, .62);
}
.mgh .segs .opt {
  position: relative;
  z-index: 1;
  white-space: nowrap;
  height: 26px;
  padding: 0 13px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--fg-2);
  cursor: pointer;
  transition: color 160ms ease, transform 130ms cubic-bezier(.22, 1, .36, 1),
    background 160ms ease, box-shadow 170ms ease;
}
.mgh .segs .opt:hover:not(.on) {
  color: var(--fg);
  transform: translateY(-1px);
  background: rgba(255, 255, 255, .52);
}
.mgh .segs .opt:active:not(.on) { transform: translateY(0) scale(.955); }
.mgh .segs .opt.on {
  color: var(--fg);
  font-weight: 750;
  background: linear-gradient(180deg, rgba(255, 255, 255, .99) 0%, rgba(255, 255, 255, .88) 52%, rgba(255, 255, 255, .78) 100%);
  backdrop-filter: blur(12px) saturate(170%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 1),
    inset 0 -1px 0 rgba(20, 22, 30, .065),
    inset 0 0 0 1px rgba(20, 22, 30, .055),
    0 1px 2px rgba(20, 22, 30, .08),
    0 3px 7px -4px rgba(20, 22, 30, .22);
}
.mgh[data-theme="dark"] .segs {
  background: linear-gradient(180deg, rgba(0, 0, 0, .34) 0%, rgba(0, 0, 0, .14) 100%);
  box-shadow: inset 0 1.5px 3px rgba(0, 0, 0, .42), inset 0 -1px 0 rgba(255, 255, 255, .05);
}
.mgh[data-theme="dark"] .segs .opt { color: rgba(255, 255, 255, .62); }
.mgh[data-theme="dark"] .segs .opt:hover:not(.on) {
  color: rgba(255, 255, 255, .90);
  background: rgba(255, 255, 255, .075);
}
.mgh[data-theme="dark"] .segs .opt.on {
  color: rgba(255, 255, 255, .97);
  background: linear-gradient(180deg, rgba(255, 255, 255, .225) 0%, rgba(255, 255, 255, .125) 54%, rgba(255, 255, 255, .075) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .34),
    inset 0 -1px 0 rgba(0, 0, 0, .22),
    inset 0 0 0 1px rgba(255, 255, 255, .075),
    0 2px 6px -2px rgba(0, 0, 0, .55);
}

/* ---- 指标条：照抄 .led-strip / .blk / .k / .v / .sub（app.css:1323-1345） ---- */
.mgh .led-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  background: linear-gradient(180deg, color-mix(in srgb, var(--card) 100%, #ffffff 7%) 0%, var(--card) 72%);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .70),
    0 1px 2px rgba(10, 12, 20, .055),
    0 4px 10px -6px rgba(10, 12, 20, .10),
    0 12px 28px -18px rgba(10, 12, 20, .22);
  overflow: hidden;
}
.mgh .led-strip .blk {
  position: relative;
  min-width: 0;
  padding: 13px 16px 12px;
  transition: background 180ms ease;
}
.mgh .led-strip .blk + .blk { border-left: 1px solid var(--line-2); }
.mgh .led-strip .blk:hover { background: color-mix(in srgb, var(--fg) 2.6%, transparent); }
.mgh .led-strip .k {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .045em;
  text-transform: uppercase;
  color: var(--muted);
}
.mgh .led-strip .v {
  display: block;
  margin-top: 4px;
  font-size: 24px;
  font-weight: 750;
  letter-spacing: -.028em;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
  line-height: 1.15;
  color: var(--fg);
}
.mgh .led-strip .v.cost { color: var(--green); }
.mgh .led-strip .v.bad { color: var(--red); }
.mgh .led-strip .sub {
  display: block;
  margin-top: 4px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mgh[data-theme="dark"] .led-strip {
  background: linear-gradient(180deg, rgba(255, 255, 255, .055) 0%, rgba(255, 255, 255, .015) 72%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .075),
    0 1px 2px rgba(0, 0, 0, .35),
    0 5px 14px -6px rgba(0, 0, 0, .45);
}
.mgh[data-theme="dark"] .led-strip .blk + .blk { border-left-color: rgba(255, 255, 255, .075); }
.mgh[data-theme="dark"] .led-strip .blk:hover { background: rgba(255, 255, 255, .030); }
.mgh[data-theme="dark"] .led-strip .k { color: rgba(255, 255, 255, .56); }
.mgh[data-theme="dark"] .led-strip .sub { color: rgba(255, 255, 255, .54); }
.mgh .led-strip .sub b { font-weight: 600; color: var(--fg-2); }

/* ---- 图表卡：照抄 .led-trend / .led-chart（app.css:1351, 1361-1372） ---- */
.mgh .led-trend {
  padding: 13px 16px 15px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--card) 100%, #ffffff 7%) 0%, var(--card) 72%);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .70),
    0 1px 2px rgba(10, 12, 20, .055),
    0 4px 10px -6px rgba(10, 12, 20, .10),
    0 12px 28px -18px rgba(10, 12, 20, .22);
}
.mgh .led-trend > .pu-bar { margin-bottom: 12px; }
.mgh[data-theme="dark"] .led-trend {
  background: linear-gradient(180deg, rgba(255, 255, 255, .055) 0%, rgba(255, 255, 255, .015) 72%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .075),
    0 1px 2px rgba(0, 0, 0, .35),
    0 5px 14px -6px rgba(0, 0, 0, .45);
}
.mgh .led-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 232px;
  gap: 18px;
}
@media (max-width: 720px) {
  .mgh .led-body { grid-template-columns: minmax(0, 1fr); }
  .mgh .led-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
/* 容器查询：面板比视口窄时（侧栏旁、手机上）按容器收 */
@container magh (max-width: 620px) {
  .mgh .led-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mgh .led-body { grid-template-columns: minmax(0, 1fr); }
  .mgh .led-chart .plot { height: 168px; }
  .mgh .pq-ring { gap: 2px; }
}
@container magh (max-width: 420px) {
  .mgh .led-strip { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .mgh .led-strip .blk { padding: 9px 11px 8px; }
  .mgh .led-strip .v { font-size: 19px; }
  .mgh .pq-rings { gap: 7px; }
}
.mgh .led-chart { min-width: 0; }
.mgh .led-chart .plot { position: relative; height: 200px; }
.mgh .led-chart svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  font-family: var(--font);
  font-variant-numeric: tabular-nums;
}
.mgh .led-chart .grid { stroke: var(--line-2); stroke-width: 1; stroke-dasharray: 2 3; }
.mgh .led-chart .axis { fill: var(--muted); font-size: 10.5px; }
.mgh .led-chart rect.col { transition: opacity .12s; }
.mgh .led-chart .none {
  display: grid;
  place-items: center;
  height: 100%;
  font-size: 12px;
  color: var(--muted);
}

/* ---- 排行（.led-rank） ---- */
.mgh .led-rank { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.mgh .led-rank .rank-row {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  min-width: 0;
}
.mgh .led-rank .rank-row i {
  width: 7px;
  height: 7px;
  border-radius: 2px;
  flex: none;
}
.mgh .led-rank .rank-row span.nm {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mgh .led-rank .rank-row em {
  margin-left: auto;
  padding-left: 10px;
  font-style: normal;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

/* ---- 额度组头：照抄 .pq-gh（app.css:1958-1965） ---- */
.mgh .pq-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 12px;
  border-radius: 14px;
  /* 顶亮底暗的纵向渐变 + 上沿 1px 高光：卡片像是从页面里"浮起来"的一层。 */
  border: 1px solid color-mix(in srgb, var(--line) 88%, var(--card));
  background: linear-gradient(180deg, color-mix(in srgb, var(--card) 100%, #ffffff 7%), color-mix(in srgb, var(--card) 100%, #ffffff 1%));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #ffffff 30%, transparent),
    0 1px 2px rgba(20, 22, 30, .06),
    0 3px 6px -3px rgba(20, 22, 30, .07),
    0 10px 24px -14px rgba(20, 22, 30, .18);
  transition: box-shadow 260ms ease, border-color 260ms ease, transform 260ms cubic-bezier(.22, 1, .36, 1);
}
/* 悬停时卡片抬 1px、影子加深、描边染主色 —— 给"可操作"的反馈，不抢戏。 */
.mgh .pq-group:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 20%, var(--line));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #ffffff 22%, transparent),
    0 1px 1px rgba(20, 22, 30, .05),
    0 12px 28px -14px rgba(20, 22, 30, .22);
}
/* 分组头下面那条细线：认可版里 CODEARTS 卡有明显分隔，空态卡同样保留。 */
.mgh .pq-group > .pq-gh {
  padding: 0 2px 11px;
  border-bottom: 1px solid var(--line-2);
}
.mgh .pq-gh {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 800;
  letter-spacing: .055em;
  text-transform: uppercase;
  color: var(--fg);
}
/* 供应商名：从 faint 10.5px 提到 fg 13.5px/800 —— 一行里它就是标题。 */
.mgh .pq-gn {
  flex: 0 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 0 color-mix(in srgb, #ffffff 55%, transparent);
}
.mgh .pq-count {
  flex: none;
  min-width: 18px;
  height: 17px;
  padding: 0 6px;
  border-radius: 999px;
  display: inline-grid;
  place-items: center;
  background: color-mix(in srgb, var(--fg) 8%, transparent);
  color: var(--fg-2);
  font-size: 10.5px;
  font-weight: 750;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}
.mgh .pq-gnote {
  flex: none;
  margin-left: auto;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
  font-variant-numeric: tabular-nums;
}
.mgh .pq-gnote.ends { color: var(--amber); }

/* ---- 额度卡：照抄 .pq-card（app.css:1997-2008） ---- */
.mgh .pq-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 12px;
  padding: 10px 12px;
  border-radius: 11px;
  background: var(--card);
  box-shadow: var(--card-edge);
  border: 1px solid var(--line-2);
}
.mgh .pq-card.err { opacity: .85; }
.mgh .pq-who { display: flex; align-items: center; gap: 2px; min-width: 0; }
.mgh .pq-user {
  flex: 0 1 auto;
  min-width: 0;
  font-size: 12.5px;
  color: var(--fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mgh .pq-sub {
  font-size: 11px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.mgh .pq-sub.err { color: var(--red); white-space: normal; }
.mgh .pq-rings { grid-row: 1 / 3; grid-column: 2; display: flex; gap: 12px; }
.mgh .pq-rings.many { gap: 7px; }
.mgh .pq-ring {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  cursor: default;
}
/* 34px 环形：conic-gradient + 28px 内圈（app.css:2008-2013） */
/* 34px 环形：conic-gradient + 28px 内圈（app.css:2008-2013） */
.mgh .pq-dial {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  /* 环带本身有 1px 内圈暗边 + 外投影，28px 内盘再叠一层纵向渐变 —— 
     这样 34px 的小圆才不像"贴纸"，而像一颗嵌进去的仪表。 */
  background: conic-gradient(var(--fg-2) calc(var(--p) * 1%), color-mix(in srgb, var(--fg) 9%, transparent) 0);
  box-shadow:
    inset 0 0 0 1px rgba(20, 22, 30, .10),
    0 1px 3px rgba(20, 22, 30, .14);
}
.mgh .pq-dial b {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: linear-gradient(180deg, color-mix(in srgb, var(--card) 100%, #ffffff 8%), color-mix(in srgb, var(--card) 100%, #ffffff 1%));
  box-shadow: inset 0 1px 2px rgba(20, 22, 30, .08), 0 0 0 .5px rgba(20, 22, 30, .06);
  font-size: 9.5px;
  font-weight: 600;
  color: var(--fg-2);
  font-variant-numeric: tabular-nums;
}
.mgh .pq-ring.full .pq-dial {
  background: conic-gradient(var(--amber) calc(var(--p) * 1%), color-mix(in srgb, var(--amber) 18%, transparent) 0);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--amber) 45%, transparent),
    0 1px 4px color-mix(in srgb, var(--amber) 32%, transparent),
    0 1px 3px rgba(20, 22, 30, .12);
}
.mgh .pq-ring.full b { color: var(--fg); }
.mgh .pq-rn {
  max-width: 44px;
  font-size: 9.5px;
  line-height: 1.2;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mgh .pq-say {
  grid-column: 1;
  font-size: 11px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

/* ---- 表格（路由页） ---- */
.mgh table.rows { width: 100%; border-collapse: collapse; font-size: 12px; }
.mgh table.rows th {
  text-align: left;
  padding: 6px 8px;
  font-weight: 500;
  color: var(--muted);
  border-bottom: 1px solid var(--line);
}
.mgh table.rows td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--line-2);
  font-variant-numeric: tabular-nums;
  color: var(--fg-2);
}
.mgh table.rows td.bad { color: var(--red); }

/* ---- 空状态 ---- */
.mgh .none-box {
  padding: 28px 12px;
  text-align: center;
  font-size: 12.5px;
  color: var(--muted);
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 12px;
}

/* ---- 商店搜索框（照 .field 的克制风） ---- */
.mgh .mgh-search {
  flex: 0 1 240px;
  min-width: 120px;
  border: 1px solid rgba(20, 22, 30, .10);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(20, 22, 30, .042) 0%, rgba(20, 22, 30, .013) 100%);
  color: var(--fg);
  font: inherit;
  font-size: 12px;
  padding: 4px 10px;
  outline: none;
  box-shadow:
    inset 0 1px 2px rgba(20, 22, 30, .085),
    inset 0 -1px 0 rgba(255, 255, 255, .78);
  transition: background 180ms ease, border-color 180ms ease, box-shadow 200ms ease;
}
.mgh .mgh-search:hover { border-color: rgba(20, 22, 30, .165); }
.mgh .mgh-search:focus {
  border-color: rgba(20, 22, 30, .225);
  background: linear-gradient(180deg, rgba(20, 22, 30, .060) 0%, rgba(20, 22, 30, .021) 100%);
  box-shadow:
    inset 0 1.5px 3px rgba(20, 22, 30, .135),
    inset 0 -1px 0 rgba(255, 255, 255, .86),
    0 0 0 3px rgba(20, 22, 30, .055);
}
.mgh .mgh-search::placeholder { color: var(--faint); }

/* ---- 小按钮（与 .text / .icon 同款克制） ---- */
.mgh .mini {
  border: 0;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 11.5px;
  padding: 2px 6px;
  border-radius: 6px;
  cursor: pointer;
}
.mgh .mini:hover { background: var(--pill); color: var(--fg-2); }
.mgh .mini:disabled { opacity: .5; cursor: default; }

/* ---- 折叠（「展开其余 N 个账号」，照抄 usageMore 的语义） ---- */
.mgh .more {
  border: 0;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 11.5px;
  padding: 3px 2px;
  cursor: pointer;
  text-align: start;
}
.mgh .more:hover { color: var(--fg-2); }

/* ═══ 本机补丁 2026-11-16：顶栏 / 账号卡 / 弹窗 / 隐藏区 / 动效 ═══════════════
   原版 UI 只有 .pq-* 那套（pq-group / pq-card / pq-say…），没有顶栏、没有账号
   操作按钮、没有确认弹窗。下面全部是新增，作用域一律挂 .mgh。
   颜色只用 .mgh 上的令牌变量，深色由 data-theme="dark" 覆盖。
   ───────────────────────────────────────────────────────────────────────── */

/* ---- 主题令牌：data-theme 优先于系统深色 ---- */
.mgh[data-theme="light"] {
  --bg: #f4f4f6;
  --card: #ffffff;
  --card-2: #f9f9fb;
  --pill: #f1f1f4;
  --pill-hover: #e9e9ee;
  --line: #e3e3e8;
  --line-2: #ececf0;
  --fg: #1c1c21;
  --fg-2: #3f3f47;
  --muted: #6e6e78;
  --faint: #96969f;
  --accent: #5b4bf5;
  --accent-soft: #efedff;
  --green: #189a58;
  --red: #d64545;
  --amber: #b45309;
}
.mgh[data-theme="dark"] {
  --bg: #1a1a1e;
  --card: #232327;
  --card-2: #2a2a2f;
  --pill: #2f2f35;
  --pill-hover: #38383f;
  --line: #33333a;
  --line-2: #2d2d33;
  --fg: #ececf0;
  --fg-2: #c9c9d1;
  --muted: #a3a3ad;
  --faint: #7b7b86;
  --accent: #818cff;
  --accent-soft: #26264a;
  --green: #3fce86;
  --red: #f0736e;
  --amber: #ffc94f;
}

/* ---- 顶栏 ---- */
.mgh .mg-topbar {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 2px;
}
.mgh .mg-brand {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -.2px;
  color: var(--fg);
}
/* 「模型供应商」：黑白灰液态玻璃。
   靠"多层半透明白 + 顶部折射亮带 + inset 高光"造厚度，不靠颜色抢眼。 */
.mgh .mg-brand-sub {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  padding: 2.5px 10px;
  border-radius: 999px;
  border: 1px solid rgba(20, 22, 30, .105);
  background:
    linear-gradient(135deg,
      rgba(255, 255, 255, .94) 0%,
      rgba(238, 240, 245, .74) 38%,
      rgba(203, 208, 219, .56) 66%,
      rgba(252, 253, 255, .88) 100%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  backdrop-filter: blur(14px) saturate(150%);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: .02em;
  color: #2a2e38;
  white-space: nowrap;
  text-shadow: 0 1px 0 rgba(255, 255, 255, .72);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .96),
    inset 0 -1px 0 rgba(20, 22, 30, .07),
    inset 0 0 12px rgba(255, 255, 255, .34),
    0 1px 2px rgba(20, 22, 30, .07),
    0 4px 12px -7px rgba(20, 22, 30, .26);
  transition: box-shadow 200ms ease, transform 200ms ease;
}
/* 顶部那道折射亮带 —— 玻璃感全靠它 */
.mgh .mg-brand-sub::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 54%;
  border-radius: 999px 999px 46% 46%;
  background: linear-gradient(180deg, rgba(255, 255, 255, .90) 0%, rgba(255, 255, 255, .18) 62%, rgba(255, 255, 255, 0) 100%);
  pointer-events: none;
  z-index: -1;
}
.mgh .mg-brand-sub:hover {
  transform: translateY(-.5px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 1),
    inset 0 -1px 0 rgba(20, 22, 30, .08),
    inset 0 0 14px rgba(255, 255, 255, .42),
    0 2px 4px rgba(20, 22, 30, .09),
    0 8px 18px -8px rgba(20, 22, 30, .30);
}
.mgh .mg-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  margin-left: 0;
  border-radius: 10px;
  border: 1px solid rgba(20, 22, 30, .135);
  background: linear-gradient(180deg, #ffffff 0%, #f8f9fc 54%, #eef0f5 100%);
  color: var(--fg);
  font-size: 15px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 1),
    inset 0 -1px 0 rgba(20, 22, 30, .055),
    0 1px 2px rgba(16, 18, 30, .09),
    0 3px 8px -4px rgba(16, 18, 30, .17);
  transition: transform 140ms cubic-bezier(.22, 1, .36, 1), box-shadow 160ms ease,
    background 160ms ease, border-color 160ms ease, color 160ms ease;
  will-change: transform;
}
.mgh .mg-brand-sub + .mg-icon-btn { margin-left: auto; }
/* 顶栏刷新气泡插在品牌与按钮之间，会把「第一个按钮 margin-left:auto」这条
   右推规则打断 —— 按钮于是挤到中间。让气泡自己顶到右边，按钮跟在它后面。 */
.mgh .mg-brand-sub + .mg-flash { margin-left: auto; max-width: 46vw; overflow: hidden; text-overflow: ellipsis; }
.mgh .mg-flash + .mg-icon-btn { margin-left: 8px; }
.mgh .mg-icon-btn ~ .mg-icon-btn { margin-left: 6px; }
/* 语言按钮：两个字符，比图标宽一点、字号小一号、字重高一点，视觉上不虚 */
.mgh .mg-locale-btn {
  width: auto;
  min-width: 32px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .04em;
  color: #2b3040;
  background: linear-gradient(180deg, #ffffff 0%, #f2f4f9 52%, #e4e8f1 100%);
  border-color: rgba(20, 22, 30, .26);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 1),
    inset 0 -1px 0 rgba(20, 22, 30, .09),
    0 1px 2px rgba(16, 18, 30, .13),
    0 3px 8px -4px rgba(16, 18, 30, .22);
}
.mgh .mg-locale-btn:hover:not(:disabled) { color: #14161e; }
.mgh[data-theme="dark"] .mg-locale-btn {
  color: #f2f4fa;
  border-color: rgba(255, 255, 255, .30);
}
/* 国内 / 国际 分段切换器：两颗一起看才知道"现在是哪个站、点一下会去哪"。
   凹槽底 + 选中块浮起，跟顶栏按钮同一套玻璃质感。 */
.mgh .mg-seg {
  display: inline-flex;
  align-items: stretch;
  padding: 2px;
  border-radius: 10px;
  background: linear-gradient(180deg, #eef1f6 0%, #e4e8f0 100%);
  border: 1px solid rgba(20, 22, 30, .12);
  box-shadow:
    inset 0 1px 2px rgba(16, 20, 32, .08),
    inset 0 -1px 0 rgba(255, 255, 255, .70);
}
.mgh .mg-seg-btn {
  appearance: none;
  border: 0;
  margin: 0;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .02em;
  line-height: 1;
  padding: 5px 9px;
  border-radius: 8px;
  color: #6b7182;
  background: transparent;
  transition: color .16s ease, background .16s ease, box-shadow .16s ease;
}
.mgh .mg-seg-btn:hover:not(:disabled) { color: #14161e; }
.mgh .mg-seg-btn.mg-seg-on {
  color: #14161e;
  background: linear-gradient(180deg, #ffffff 0%, #f5f7fb 100%);
  box-shadow:
    0 1px 2px rgba(16, 20, 32, .12),
    0 0 0 1px rgba(20, 22, 30, .07),
    inset 0 1px 0 rgba(255, 255, 255, 1);
}
.mgh .mg-seg-btn:disabled { opacity: .5; cursor: default; }
.mgh[data-theme="dark"] .mg-seg {
  background: linear-gradient(180deg, #24252c 0%, #1e1f26 100%);
  border-color: rgba(255, 255, 255, .11);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, .34);
}
.mgh[data-theme="dark"] .mg-seg-btn { color: #9aa0b0; }
.mgh[data-theme="dark"] .mg-seg-btn:hover:not(:disabled) { color: #f2f4fa; }
.mgh[data-theme="dark"] .mg-seg-btn.mg-seg-on {
  color: #fdfdff;
  background: linear-gradient(180deg, #43444f 0%, #36373f 100%);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, .42),
    0 0 0 1px rgba(255, 255, 255, .09),
    inset 0 1px 0 rgba(255, 255, 255, .10);
}
.mgh .mg-icon-btn:hover:not(:disabled) {
  transform: translateY(-1.5px);
  color: var(--fg);
  border-color: rgba(20, 22, 30, .245);
  background: linear-gradient(180deg, #ffffff 0%, #ffffff 54%, #f1f3f8 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 1),
    inset 0 -1px 0 rgba(20, 22, 30, .065),
    0 2px 4px rgba(16, 18, 30, .10),
    0 7px 16px -7px rgba(16, 18, 30, .26);
}
.mgh .mg-icon-btn:active:not(:disabled) {
  transform: translateY(0) scale(.915);
  color: var(--fg);
  border-color: rgba(20, 22, 30, .20);
  background: linear-gradient(180deg, #e7e9f0 0%, #f0f2f7 100%);
  box-shadow:
    inset 0 2px 6px rgba(16, 18, 30, .215),
    inset 0 -1px 0 rgba(255, 255, 255, .58),
    0 1px 1px rgba(16, 18, 30, .05);
}
.mgh .mg-icon-btn:focus-visible {
  outline: none;
  border-color: rgba(20, 22, 30, .28);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 1),
    0 0 0 3px rgba(20, 22, 30, .10),
    0 2px 4px rgba(16, 18, 30, .10);
}
.mgh .mg-icon-btn:disabled { opacity: .72; cursor: default; }
.mgh .mg-spin { animation: mg-spin 900ms linear infinite; }
@keyframes mg-spin { to { transform: rotate(360deg); } }

/* ---- 徽章 ---- */
/* 徽章（"8 个模型"、"有效"、"已停用"）：加粗 + 提高对比 + 内沿高光，
   免得跟供应商名一起糊成一片灰字。 */
.mgh .mg-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--fg) 14%, transparent);
  background: color-mix(in srgb, var(--fg) 5%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #ffffff 50%, transparent);
  font-size: 11.5px;
  font-weight: 750;
  letter-spacing: .005em;
  color: var(--fg-2);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  transition: background-color 180ms ease, border-color 180ms ease;
}
.mgh .pq-group:hover .mg-badge { border-color: color-mix(in srgb, var(--fg) 22%, transparent); }
.mgh .mg-badge-ok { background: color-mix(in srgb, var(--green) 12%, transparent); border-color: color-mix(in srgb, var(--green) 32%, transparent); color: color-mix(in srgb, var(--green) 78%, var(--fg)); }
.mgh .mg-badge-bad,
.mgh .mg-badge-off { background: color-mix(in srgb, var(--amber) 12%, transparent); border-color: color-mix(in srgb, var(--amber) 32%, transparent); color: color-mix(in srgb, var(--amber) 78%, var(--fg)); }

/* ---- 按钮族 ---- */
.mgh .mg-acts {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.mgh .mg-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  padding: 0 11px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--card-2);
  color: var(--fg-2);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: transform 140ms cubic-bezier(.22, 1, .36, 1), box-shadow 180ms ease,
    background-color 180ms ease, border-color 180ms ease, color 160ms ease;
  will-change: transform;
}
.mgh .mg-btn:active:not(:disabled) { transform: translateY(1px) scale(.972); transition-duration: 60ms; }
.mgh .mg-btn:disabled { opacity: .55; cursor: default; }
.mgh .mg-btn:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 70%, transparent); outline-offset: 2px; }

.mgh .mg-btn-mini {
  height: 27px;
  padding: 0 9px;
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff 0%, #f8f9fc 55%, #eff1f6 100%);
  font-size: 11.5px;
  font-weight: 620;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 1), inset 0 -1px 0 rgba(20, 22, 30, .045), 0 1px 2px rgba(16, 18, 30, .07);
}
.mgh .mg-btn-mini:hover:not(:disabled) {
  transform: translateY(-1.5px);
  box-shadow: 0 4px 12px -4px rgba(16, 18, 30, .22), 0 1px 2px rgba(16, 18, 30, .1);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--line));
}

/* ── 液态玻璃按钮：登录 / 我已完成 共用一套玻璃，不落任何实色 ── */
.mgh .mg-btn-primary,
.mgh .mg-btn-done {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  border: 1px solid rgba(20, 22, 30, .135);
  background: linear-gradient(135deg,
    rgba(255, 255, 255, .94) 0%,
    rgba(240, 243, 249, .74) 34%,
    rgba(206, 212, 225, .52) 66%,
    rgba(252, 253, 255, .88) 100%);
  -webkit-backdrop-filter: blur(15px) saturate(165%);
  backdrop-filter: blur(15px) saturate(165%);
  color: #23252d;
  font-weight: 760;
  letter-spacing: .012em;
  text-shadow: 0 1px 0 rgba(255, 255, 255, .78);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .98),
    inset 0 -1px 0 rgba(20, 22, 30, .075),
    inset 0 0 14px rgba(255, 255, 255, .32),
    0 1px 2px rgba(20, 22, 30, .075),
    0 5px 14px -8px rgba(20, 22, 30, .34);
  transition: transform 160ms cubic-bezier(.22, 1, .36, 1), box-shadow 180ms ease, background 200ms ease, border-color 180ms ease;
}
/* 顶部折射亮带 */
.mgh .mg-btn-primary::before,
.mgh .mg-btn-done::before {
  content: "";
  position: absolute;
  top: 0;
  left: 1px;
  right: 1px;
  height: 54%;
  border-radius: 999px 999px 46% 46%;
  background: linear-gradient(180deg, rgba(255, 255, 255, .92) 0%, rgba(255, 255, 255, .20) 62%, transparent 100%);
  pointer-events: none;
  z-index: -1;
}
.mgh .mg-btn-primary:hover:not(:disabled),
.mgh .mg-btn-done:hover:not(:disabled) {
  transform: translateY(-1.5px);
  border-color: rgba(20, 22, 30, .20);
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 1) 0%,
    rgba(248, 250, 255, .84) 34%,
    rgba(212, 219, 231, .58) 66%,
    rgba(255, 255, 255, .94) 100%);
  box-shadow:
    inset 0 1px 0 #fff,
    inset 0 -1px 0 rgba(20, 22, 30, .09),
    inset 0 0 18px rgba(255, 255, 255, .44),
    0 2px 4px rgba(20, 22, 30, .09),
    0 10px 22px -10px rgba(20, 22, 30, .40);
}
.mgh .mg-btn-primary:active:not(:disabled),
.mgh .mg-btn-done:active:not(:disabled) {
  transform: translateY(0) scale(.968);
  box-shadow:
    inset 0 2px 7px rgba(20, 22, 30, .20),
    inset 0 -1px 0 rgba(255, 255, 255, .35),
    0 1px 2px rgba(20, 22, 30, .06);
}
/* 「我已完成」只在「等你确认」那一刻出现，玻璃再亮一档，主次自然分开 */
.mgh .mg-btn-done {
  border-color: rgba(20, 22, 30, .17);
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 1) 0%,
    rgba(250, 252, 255, .88) 34%,
    rgba(216, 223, 236, .58) 66%,
    rgba(255, 255, 255, .97) 100%);
  box-shadow:
    inset 0 1px 0 #fff,
    inset 0 -1px 0 rgba(20, 22, 30, .085),
    inset 0 0 16px rgba(255, 255, 255, .48),
    0 1px 2px rgba(20, 22, 30, .08),
    0 6px 18px -8px rgba(20, 22, 30, .42);
}
.mgh .mg-btn-done:hover:not(:disabled) {
  border-color: rgba(20, 22, 30, .235);
}
.mgh .mg-btn-primary::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 30%, rgba(255, 255, 255, .55) 50%, transparent 70%);
  transform: translateX(-120%);
  transition: transform 620ms ease;
  pointer-events: none;
}
.mgh .mg-btn-primary:hover:not(:disabled) { transform: translateY(-1px); }
.mgh .mg-btn-primary:hover:not(:disabled)::after { transform: translateX(120%); }
.mgh .mg-btn-primary:not(:disabled) { animation: mg-breathe 2800ms ease-in-out infinite; }
.mgh .mg-btn-primary:hover:not(:disabled),
.mgh .mg-btn-primary:active:not(:disabled) { animation: none; }
@keyframes mg-breathe {
  0%, 100% {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, .98),
      inset 0 -1px 0 rgba(20, 22, 30, .075),
      0 1px 2px rgba(20, 22, 30, .075),
      0 4px 12px -8px rgba(20, 22, 30, .28);
  }
  50% {
    box-shadow:
      inset 0 1px 0 #fff,
      inset 0 -1px 0 rgba(20, 22, 30, .075),
      0 2px 4px rgba(20, 22, 30, .09),
      0 8px 20px -8px rgba(20, 22, 30, .46);
  }
}
/* ── 液态玻璃的深色那一套：白雾四段 + 顶沿反光，玻璃在深色底下才立得住 ── */
.mgh[data-theme="dark"] .mg-btn-primary,
.mgh[data-theme="dark"] .mg-btn-done {
  border-color: rgba(255, 255, 255, .19);
  background: linear-gradient(135deg,
    rgba(255, 255, 255, .215) 0%,
    rgba(255, 255, 255, .095) 34%,
    rgba(255, 255, 255, .035) 66%,
    rgba(255, 255, 255, .155) 100%);
  color: rgba(255, 255, 255, .95);
  text-shadow: none;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .28),
    inset 0 -1px 0 rgba(0, 0, 0, .28),
    0 1px 3px rgba(0, 0, 0, .36),
    0 7px 20px -10px rgba(0, 0, 0, .72);
}
.mgh[data-theme="dark"] .mg-btn-primary::before,
.mgh[data-theme="dark"] .mg-btn-done::before {
  background: linear-gradient(180deg, rgba(255, 255, 255, .26) 0%, rgba(255, 255, 255, .05) 62%, transparent 100%);
}
.mgh[data-theme="dark"] .mg-btn-primary:hover:not(:disabled),
.mgh[data-theme="dark"] .mg-btn-done:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, .30);
  background: linear-gradient(135deg,
    rgba(255, 255, 255, .28) 0%,
    rgba(255, 255, 255, .13) 34%,
    rgba(255, 255, 255, .055) 66%,
    rgba(255, 255, 255, .20) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .40),
    inset 0 -1px 0 rgba(0, 0, 0, .30),
    0 2px 5px rgba(0, 0, 0, .42),
    0 10px 26px -12px rgba(0, 0, 0, .80);
}
.mgh[data-theme="dark"] .mg-btn-done {
  border-color: rgba(255, 255, 255, .26);
  background: linear-gradient(135deg,
    rgba(255, 255, 255, .30) 0%,
    rgba(255, 255, 255, .135) 34%,
    rgba(255, 255, 255, .06) 66%,
    rgba(255, 255, 255, .22) 100%);
}
@media (prefers-color-scheme: dark) {
  .mgh:not([data-theme="light"]) .mg-btn-primary,
  .mgh:not([data-theme="light"]) .mg-btn-done {
    border-color: rgba(255, 255, 255, .19);
    background: linear-gradient(135deg,
      rgba(255, 255, 255, .215) 0%,
      rgba(255, 255, 255, .095) 34%,
      rgba(255, 255, 255, .035) 66%,
      rgba(255, 255, 255, .155) 100%);
    color: rgba(255, 255, 255, .95);
    text-shadow: none;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, .28),
      inset 0 -1px 0 rgba(0, 0, 0, .28),
      0 1px 3px rgba(0, 0, 0, .36),
      0 7px 20px -10px rgba(0, 0, 0, .72);
  }
  .mgh:not([data-theme="light"]) .mg-btn-primary::before,
  .mgh:not([data-theme="light"]) .mg-btn-done::before {
    background: linear-gradient(180deg, rgba(255, 255, 255, .26) 0%, rgba(255, 255, 255, .05) 62%, transparent 100%);
  }
  .mgh:not([data-theme="light"]) .mg-btn-done {
    border-color: rgba(255, 255, 255, .26);
    background: linear-gradient(135deg,
      rgba(255, 255, 255, .30) 0%,
      rgba(255, 255, 255, .135) 34%,
      rgba(255, 255, 255, .06) 66%,
      rgba(255, 255, 255, .22) 100%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .mgh .mg-btn-primary:hover:not(:disabled),
  .mgh .mg-btn-done:hover:not(:disabled) { transform: none; }
  .mgh .mg-btn-primary:active:not(:disabled),
  .mgh .mg-btn-done:active:not(:disabled) { transform: none; }
}

/* 「全部启用」这类：材质与 ghost 同族，但底色压深一档，看着不是死白 */
.mgh .mg-btn-accent {
  border-color: rgba(20, 22, 30, .155);
  background: linear-gradient(180deg, rgba(255, 255, 255, .84) 0%, rgba(238, 240, 250, .70) 46%, rgba(220, 223, 238, .60) 100%);
  color: var(--fg);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .96),
    inset 0 -1px 0 rgba(20, 22, 30, .052),
    0 1px 2px rgba(16, 18, 30, .07),
    0 3px 9px -5px color-mix(in srgb, var(--accent) 42%, transparent);
  backdrop-filter: blur(10px) saturate(150%);
  -webkit-backdrop-filter: blur(10px) saturate(150%);
}
.mgh .mg-btn-accent:hover:not(:disabled) {
  border-color: rgba(20, 22, 30, .245);
  background: linear-gradient(180deg, rgba(255, 255, 255, .94) 0%, rgba(243, 245, 253, .82) 46%, rgba(226, 229, 244, .72) 100%);
  box-shadow:
    inset 0 1px 0 #ffffff,
    inset 0 -1px 0 rgba(20, 22, 30, .065),
    0 2px 6px -2px rgba(16, 18, 30, .17),
    0 4px 12px -5px color-mix(in srgb, var(--accent) 50%, transparent);
}
.mgh .mg-btn-accent:active:not(:disabled) {
  background: linear-gradient(180deg, rgba(224, 227, 240, .80) 0%, rgba(237, 240, 250, .68) 100%);
  box-shadow: inset 0 2px 6px rgba(20, 22, 30, .19);
}

/* 次按钮也走液态玻璃：与主按钮同一套材质，只是更薄一档，不再是一块透明死区 */
.mgh .mg-btn-ghost {
  border-color: rgba(20, 22, 30, .105);
  background: linear-gradient(180deg, rgba(255, 255, 255, .76) 0%, rgba(247, 248, 252, .50) 52%, rgba(235, 238, 245, .38) 100%);
  color: var(--fg-2);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .90), inset 0 -1px 0 rgba(20, 22, 30, .032), 0 1px 2px rgba(16, 18, 30, .045);
  backdrop-filter: blur(10px) saturate(140%);
  -webkit-backdrop-filter: blur(10px) saturate(140%);
}
.mgh .mg-btn-ghost:hover:not(:disabled) {
  color: var(--fg);
  border-color: rgba(20, 22, 30, .195);
  background: linear-gradient(180deg, rgba(255, 255, 255, .95) 0%, rgba(251, 252, 255, .70) 52%, rgba(239, 242, 249, .56) 100%);
  box-shadow: inset 0 1px 0 #ffffff, inset 0 -1px 0 rgba(20, 22, 30, .045), 0 2px 6px -2px rgba(16, 18, 30, .16);
}
.mgh .mg-btn-ghost:active:not(:disabled) {
  background: linear-gradient(180deg, rgba(231, 234, 242, .76) 0%, rgba(242, 244, 249, .62) 100%);
  box-shadow: inset 0 2px 5px rgba(20, 22, 30, .17);
}

.mgh .mg-btn-danger {
  border-color: color-mix(in srgb, var(--red) 30%, var(--line));
  background: color-mix(in srgb, var(--red) 8%, transparent);
  color: color-mix(in srgb, var(--red) 82%, var(--fg));
}
.mgh .mg-btn-danger:hover:not(:disabled) { background: color-mix(in srgb, var(--red) 15%, transparent); }

.mgh .mg-btn-danger-solid {
  background: var(--red);
  border-color: var(--red);
  color: #fff;
  font-weight: 650;
}

.mgh .mg-btn-checkin {
  border-color: color-mix(in srgb, var(--amber) 34%, var(--line));
  background: color-mix(in srgb, var(--amber) 12%, transparent);
  color: color-mix(in srgb, var(--amber) 84%, var(--fg));
  font-size: 11.5px;
}
.mgh .mg-btn-checkin:hover:not(:disabled) { background: color-mix(in srgb, var(--amber) 20%, transparent); }

/* 刷新额度：天蓝。紫是「登录」、琥珀是「签到」，这里必须第三种色才不打架。 */
.mgh .mg-btn-refresh {
  border-color: color-mix(in srgb, #0284c7 34%, var(--line));
  background: color-mix(in srgb, #0284c7 11%, transparent);
  color: color-mix(in srgb, #0284c7 86%, var(--fg));
  font-size: 11.5px;
}
.mgh .mg-btn-refresh:hover:not(:disabled) {
  background: color-mix(in srgb, #0284c7 19%, transparent);
  border-color: color-mix(in srgb, #0284c7 52%, var(--line));
}
.mgh[data-theme="dark"] .mg-btn-refresh {
  border-color: color-mix(in srgb, #38bdf8 40%, transparent);
  background: color-mix(in srgb, #38bdf8 20%, transparent);
  color: color-mix(in srgb, #38bdf8 72%, #fff);
}

/* ---- 账号卡 ---- */
.mgh .mg-acct {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 0;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--card);
  transition: box-shadow 200ms ease, transform 200ms ease, border-color 200ms ease;
}
.mgh .mg-acct:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 22%, var(--line));
  box-shadow: 0 6px 20px -10px rgba(16, 18, 30, .24);
}
.mgh .mg-acct-bad { border-color: color-mix(in srgb, var(--red) 34%, var(--line)); }

/* 账号级错误条：额度用尽 / key 失效，跟着具体那张卡走 */
.mgh .mg-flash-bad {
  color: #b3261e;
  background: linear-gradient(180deg, rgba(220, 38, 38, .11) 0%, rgba(190, 30, 24, .045) 100%);
  border-color: rgba(200, 40, 32, .30);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .55);
}
.mgh .mg-flash {
  display: inline-flex; align-items: center;
  padding: 3px 10px; border-radius: 999px;
  font-size: 11.5px; font-weight: 600; line-height: 1.5;
  color: var(--fg-2); white-space: nowrap;
  background: linear-gradient(180deg, color-mix(in srgb, var(--fg) 7%, transparent) 0%, color-mix(in srgb, var(--fg) 3%, transparent) 100%);
  border: 1px solid color-mix(in srgb, var(--fg) 13%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .55);
  animation: mg-flash-in .18s cubic-bezier(.22, 1, .36, 1);
}
@keyframes mg-flash-in {
  from { opacity: 0; transform: translateY(-2px); }
  to { opacity: 1; transform: translateY(0); }
}
/* ---- 确认浮层（自绘，凝态玻璃）---- */
/* ---- 商店页（本机补丁 2026-11-19）---- */
.mgh .mg-store { display: flex; flex-direction: column; gap: 10px; }
.mgh .mg-st-head { display: flex; align-items: center; gap: 8px; }
.mgh .mg-st-search {
  flex: 1 1 auto; min-width: 0; height: 34px;
  padding: 0 13px;
  font: inherit; font-size: 12.5px; font-weight: 500;
  color: var(--fg);
  border-radius: 10px;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, color-mix(in srgb, var(--fg) 5.5%, transparent) 0%, color-mix(in srgb, var(--fg) 1.5%, transparent) 100%);
  box-shadow: inset 0 1px 2.5px color-mix(in srgb, var(--fg) 10%, transparent);
  outline: none;
  transition: border-color .14s, box-shadow .14s;
}
.mgh .mg-st-search::placeholder { color: var(--faint); opacity: 1; }
.mgh .mg-st-search:focus {
  border-color: color-mix(in srgb, var(--fg) 26%, var(--line));
  box-shadow: inset 0 1px 2px color-mix(in srgb, var(--fg) 7%, transparent), 0 0 0 3px color-mix(in srgb, var(--fg) 6%, transparent);
}
.mgh .mg-st-refresh {
  flex: none;
  width: 34px; height: 34px;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0; cursor: pointer;
  border-radius: 10px;
  border: 1px solid var(--line);
  color: var(--fg-2);
  background: linear-gradient(180deg, color-mix(in srgb, #ffffff 70%, var(--card)) 0%, var(--card) 100%);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #ffffff 80%, transparent),
    0 1px 2px color-mix(in srgb, #10121e 7%, transparent);
  transition: transform .12s, box-shadow .12s, background .14s;
}
.mgh .mg-st-refresh:hover:not(:disabled) { background: linear-gradient(180deg, var(--card) 0%, var(--card-2) 100%); }
.mgh .mg-st-refresh:active:not(:disabled) {
  transform: scale(.94);
  box-shadow: inset 0 2px 6px color-mix(in srgb, #10121e 18%, transparent);
}
.mgh .mg-st-refresh:disabled { cursor: default; opacity: .62; }
.mgh .mg-st-refresh-ico { font-size: 16px; line-height: 1; display: inline-block; color: var(--fg-2); }
.mgh .mg-st-refresh-on .mg-st-refresh-ico { animation: mg-st-turn .9s linear infinite; }
@keyframes mg-st-turn { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.mgh .mg-st-notice {
  display: flex; align-items: center; gap: 9px;
  padding: 9px 11px 9px 12px;
  border-radius: 11px;
  font-size: 12px; font-weight: 600; line-height: 1.55;
  color: #0f7a4f;
  background: linear-gradient(180deg, rgba(45, 190, 132, .13) 0%, rgba(24, 160, 106, .055) 100%);
  border: 1px solid rgba(20, 150, 98, .26);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .55);
  animation: mg-flash-in .18s ease-out;
}
.mgh .mg-st-notice-bad {
  color: #b3261e;
  background: linear-gradient(180deg, rgba(220, 38, 38, .085) 0%, rgba(190, 30, 24, .035) 100%);
  border-color: rgba(200, 40, 32, .28);
}
.mgh .mg-st-notice-dot {
  flex: none; width: 7px; height: 7px; border-radius: 50%;
  background: #18a06a;
  box-shadow: 0 0 0 3px rgba(24, 160, 106, .16);
}
.mgh .mg-st-notice-bad .mg-st-notice-dot { background: #cf2a20; box-shadow: 0 0 0 3px rgba(207, 42, 32, .16); }
.mgh .mg-st-notice-text { flex: 1 1 auto; min-width: 0; }
.mgh .mg-st-notice-x {
  flex: none; width: 20px; height: 20px;
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0; cursor: pointer; line-height: 1;
  font-size: 14px;
  color: inherit; opacity: .55;
  border: 0; border-radius: 6px; background: transparent;
}
.mgh .mg-st-notice-x:hover { opacity: 1; background: color-mix(in srgb, currentColor 12%, transparent); }

.mgh .mg-st-meta { font-size: 11px; font-weight: 600; color: var(--faint); padding: 0 2px; }
.mgh .mg-st-empty { padding: 22px 4px; text-align: center; font-size: 12.5px; color: var(--faint); }
.mgh .mg-st-list { display: flex; flex-direction: column; gap: 8px; }

.mgh .mg-st-card {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 13px 14px;
  border-radius: 13px;
  border: 1px solid var(--line);
  background: var(--card);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #ffffff 72%, transparent),
    0 1px 2px color-mix(in srgb, #10121e 6%, transparent);
  transition: box-shadow .16s, border-color .16s, transform .16s;
}
.mgh .mg-st-card:hover {
  border-color: var(--line-2);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #ffffff 78%, transparent),
    0 2px 5px color-mix(in srgb, #10121e 9%, transparent),
    0 10px 22px -12px color-mix(in srgb, #10121e 22%, transparent);
}
.mgh .mg-st-card-on { border-color: color-mix(in srgb, var(--green) 26%, var(--line)); }
.mgh .mg-st-ico {
  flex: none;
  width: 38px; height: 38px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 11px;
  font-size: 15px; font-weight: 700; color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, .22);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .38), 0 2px 6px color-mix(in srgb, #10121e 16%, transparent);
}
.mgh .mg-st-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.mgh .mg-st-line { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.mgh .mg-st-name { font-size: 13.5px; font-weight: 700; color: var(--fg); letter-spacing: -.01em; }
.mgh .mg-st-tag {
  font-size: 10px; font-weight: 700; letter-spacing: .02em;
  padding: 1px 7px; border-radius: 999px;
  color: var(--fg-2);
  background: color-mix(in srgb, var(--fg) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--fg) 11%, transparent);
}
.mgh .mg-st-tag-mute { color: var(--faint); background: transparent; }
.mgh .mg-st-tag-on {
  color: #0f7a4f;
  background: rgba(24, 160, 106, .12);
  border-color: rgba(20, 150, 98, .28);
}
.mgh .mg-st-pkg {
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 10.5px; color: var(--faint);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mgh .mg-st-desc { font-size: 12px; font-weight: 500; line-height: 1.6; color: var(--fg-2); }
.mgh .mg-st-act { flex: none; display: flex; align-items: center; padding-top: 2px; }
.mgh .mg-st-busy { display: inline-flex; align-items: center; gap: 7px; font-size: 11.5px; font-weight: 600; color: var(--faint); }
.mgh .mg-st-spin {
  width: 12px; height: 12px; border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--fg) 22%, transparent);
  border-top-color: var(--accent);
  animation: mg-st-turn .7s linear infinite;
}

.mgh[data-theme="dark"] .mg-st-refresh {
  background: linear-gradient(180deg, rgba(255, 255, 255, .09) 0%, rgba(255, 255, 255, .035) 100%);
  border-color: rgba(255, 255, 255, .11);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .10), 0 1px 2px rgba(0, 0, 0, .34);
}
.mgh[data-theme="dark"] .mg-st-refresh:hover:not(:disabled) { background: linear-gradient(180deg, rgba(255, 255, 255, .13) 0%, rgba(255, 255, 255, .05) 100%); }
.mgh[data-theme="dark"] .mg-st-card { box-shadow: inset 0 1px 0 rgba(255, 255, 255, .06), 0 1px 2px rgba(0, 0, 0, .30); }
.mgh[data-theme="dark"] .mg-st-card:hover {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08), 0 2px 6px rgba(0, 0, 0, .34), 0 10px 22px -12px rgba(0, 0, 0, .55);
}
.mgh[data-theme="dark"] .mg-st-notice {
  color: #62dda4;
  background: linear-gradient(180deg, rgba(45, 190, 132, .16) 0%, rgba(24, 160, 106, .07) 100%);
  border-color: rgba(20, 150, 98, .34);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .07);
}
.mgh[data-theme="dark"] .mg-st-notice-bad {
  color: #ff9c96;
  background: linear-gradient(180deg, rgba(220, 38, 38, .16) 0%, rgba(190, 30, 24, .07) 100%);
  border-color: rgba(200, 40, 32, .38);
}
.mgh[data-theme="dark"] .mg-st-tag-on { color: #62dda4; }

.mgh .mg-modal-mask {
  position: fixed; inset: 0; z-index: 60;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  background: radial-gradient(120% 90% at 50% 0%, rgba(28, 30, 44, .19) 0%, rgba(14, 16, 26, .32) 100%);
  backdrop-filter: blur(9px) saturate(125%);
  -webkit-backdrop-filter: blur(9px) saturate(125%);
  animation: mg-modal-fade .16s ease-out;
}
.mgh .mg-modal {
  width: 100%; max-width: 380px;
  display: flex; flex-direction: column; gap: 12px;
  padding: 20px 20px 16px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, .90) 0%, rgba(250, 251, 253, .84) 46%, rgba(240, 243, 249, .79) 100%);
  border: 1px solid rgba(255, 255, 255, .78);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .96),
    inset 0 -1px 0 rgba(20, 22, 34, .05),
    0 1px 2px rgba(18, 20, 30, .10),
    0 12px 32px -8px rgba(18, 20, 30, .28),
    0 32px 64px -24px rgba(18, 20, 30, .34);
  backdrop-filter: blur(28px) saturate(190%);
  -webkit-backdrop-filter: blur(28px) saturate(190%);
  animation: mg-modal-in .2s cubic-bezier(.2, .9, .3, 1.05);
}
.mgh .mg-modal-title {
  font-size: 14.5px; font-weight: 700; line-height: 1.45;
  color: var(--fg); letter-spacing: -.01em;
}
.mgh .mg-modal-body {
  font-size: 12.5px; font-weight: 500; line-height: 1.62;
  color: var(--fg-2); white-space: pre-wrap;
}
.mgh .mg-modal-acts {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  margin-top: 2px;
}
.mgh .mg-modal-acts .mg-btn {
  height: 32px; padding: 0 18px;
  font-size: 12.5px; border-radius: 10px;
}
@keyframes mg-modal-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes mg-modal-in {
  from { opacity: 0; transform: translateY(8px) scale(.975); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.mgh[data-theme="dark"] .mg-modal-mask {
  background: radial-gradient(120% 90% at 50% 0%, rgba(6, 7, 12, .42) 0%, rgba(3, 4, 7, .58) 100%);
}
.mgh[data-theme="dark"] .mg-modal {
  background: linear-gradient(180deg, rgba(50, 51, 60, .86) 0%, rgba(38, 39, 46, .80) 46%, rgba(29, 30, 37, .76) 100%);
  border-color: rgba(255, 255, 255, .10);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .10),
    inset 0 -1px 0 rgba(0, 0, 0, .28),
    0 1px 2px rgba(0, 0, 0, .36),
    0 12px 32px -8px rgba(0, 0, 0, .56),
    0 32px 64px -24px rgba(0, 0, 0, .62);
}

.mgh .mg-acct-err {
  display: block;
  padding: 7px 11px 7px 12px;
  border-radius: 8px;
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.52;
  color: #b3261e;
  background: linear-gradient(180deg, rgba(220, 38, 38, .068) 0%, rgba(190, 30, 24, .026) 100%);
  border: 1px solid rgba(200, 40, 32, .22);
  border-left: 3px solid rgba(206, 42, 32, .72);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .55);
  word-break: break-word;
  overflow-wrap: anywhere;
}
.mgh .mg-acct-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mgh .mg-acct-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  font-weight: 650;
  color: var(--fg);
}
.mgh .mg-rename {
  flex: 1 1 140px;
  min-width: 100px;
  height: 26px;
  padding: 0 8px;
  border-radius: 7px;
  border: 1px solid color-mix(in srgb, var(--accent) 44%, var(--line));
  background: var(--card-2);
  color: var(--fg);
  font: inherit;
  font-size: 12px;
}
.mgh .mg-rename:focus { outline: 2px solid color-mix(in srgb, var(--accent) 50%, transparent); outline-offset: 1px; }

/* ---- 额度行 ---- */
.mgh .mg-quota {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--fg-2);
}
/* 金色标签（体验版 / 总量）：内沿高光 + 双层投影，做出压印质感。 */
.mgh .mg-quota-plan {
  padding: 2.5px 9px;
  border-radius: 7px;
  background: linear-gradient(180deg, rgba(226, 174, 40, .22) 0%, rgba(196, 142, 20, .11) 100%);
  border: 1px solid rgba(178, 126, 8, .42);
  color: #8f6104;
  font-weight: 800;
  font-size: 11.5px;
  letter-spacing: .25px;
  font-variant-numeric: tabular-nums;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .55),
    inset 0 -1px 0 rgba(140, 96, 4, .12),
    0 1px 2px rgba(160, 116, 6, .16);
  white-space: nowrap;
}
/* 额度读数（总积分 4500 / 4600、基础积分包 500 / 500…）：
   等宽数字 + 内凹底 + 内沿高光，读起来像仪表而不是一串灰字。 */
.mgh .mg-qw {
  padding: 2.5px 9px;
  border-radius: 7px;
  border: 1px solid color-mix(in srgb, var(--fg) 9%, transparent);
  background: linear-gradient(180deg, color-mix(in srgb, var(--fg) 4.5%, transparent), color-mix(in srgb, var(--fg) 1.5%, transparent));
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: .012em;
  color: var(--fg-2);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
  box-shadow:
    inset 0 1px 2px color-mix(in srgb, var(--fg) 7%, transparent),
    inset 0 -1px 0 color-mix(in srgb, #ffffff 45%, transparent);
}

/* ---- 提示 / 登录方式选择器 ---- */
/* 提示条 = 琥珀金笺：和紫（登录）/天蓝（刷新额度）/绿（我已完成）都不撞，
   左侧一道竖线当作「待你操作」的视觉锚 */
.mgh .mg-note {
  padding: 7px 11px 7px 13px;
  border-radius: 9px;
  border: 1px solid rgba(184, 128, 14, .30);
  border-left: 3px solid rgba(201, 142, 16, .72);
  background: linear-gradient(180deg, rgba(245, 173, 40, .13) 0%, rgba(217, 140, 18, .055) 100%);
  font-size: 11.5px;
  line-height: 1.55;
  color: #8a5304;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .55),
    0 1px 2px rgba(160, 108, 8, .08);
  animation: mg-fade 200ms ease;
}
.mgh[data-theme="dark"] .mg-note {
  border-color: rgba(251, 191, 36, .26);
  border-left-color: rgba(251, 191, 36, .68);
  background: linear-gradient(180deg, rgba(251, 191, 36, .12) 0%, rgba(217, 155, 20, .04) 100%);
  color: #fbbf24;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
}
@media (prefers-color-scheme: dark) {
  .mgh:not([data-theme="light"]) .mg-note {
    border-color: rgba(251, 191, 36, .26);
    border-left-color: rgba(251, 191, 36, .68);
    background: linear-gradient(180deg, rgba(251, 191, 36, .12) 0%, rgba(217, 155, 20, .04) 100%);
    color: #fbbf24;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
  }
}
@keyframes mg-fade { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }
.mgh .mg-methods {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 2px 0 6px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--card-2);
  border: 1px dashed var(--line);
}
.mgh .mg-methods-label { font-size: 11.5px; font-weight: 650; color: var(--muted); margin-right: 2px; }

/* ---- 已隐藏账号折叠块 ---- */
.mgh .mg-hidden {
  display: flex;
  flex-direction: column;
  margin-top: 10px;
  border-radius: 10px;
  border: 1px dashed var(--line);
  background: var(--card-2);
}
.mgh .mg-hidden-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--muted);
  text-align: left;
  cursor: pointer;
  border-radius: 10px;
}
.mgh .mg-hidden-toggle:hover { color: var(--fg-2); }
.mgh .mg-hidden-caret {
  display: inline-block;
  font-size: 13px;
  line-height: 1;
  transition: transform 220ms cubic-bezier(.22, 1, .36, 1);
}
.mgh .mg-hidden-open { transform: rotate(90deg); }
.mgh .mg-hidden-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 12px 10px;
}
.mgh .mg-hidden-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--card);
  border: 1px solid var(--line-2);
}
.mgh .mg-hidden-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11.5px;
  color: var(--fg-2);
}

/* ---- 删除确认弹窗 ---- */
.mgh .mg-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(11, 11, 16, .52);
  backdrop-filter: blur(3px);
  animation: mg-fade 160ms ease;
}
.mgh .mg-modal {
  width: min(440px, 100%);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 20px 16px;
  border-radius: 16px;
  background: var(--card);
  border: 1px solid var(--line);
  box-shadow: 0 24px 64px -12px rgba(0, 0, 0, .42), 0 0 0 1px rgba(79, 70, 229, .08);
}
.mgh .mg-modal-title { font-size: 15px; font-weight: 700; color: var(--fg); }
.mgh .mg-modal-body { font-size: 13px; line-height: 1.6; color: var(--fg-2); }
.mgh .mg-modal-acct {
  display: block;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--card-2);
  border: 1px solid var(--line-2);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11.5px;
  color: var(--fg-2);
  overflow: hidden;
  text-overflow: ellipsis;
}
.mgh .mg-modal-err {
  padding: 6px 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--red) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--red) 30%, transparent);
  font-size: 11.5px;
  color: color-mix(in srgb, var(--red) 84%, var(--fg));
}
.mgh .mg-modal-acts { display: flex; justify-content: flex-end; gap: 8px; margin-top: 2px; }

/* ── 调整供应商（原版「调整 <名字>」） ─────────────────────────────── */
.mgh .mg-caret {
  display: inline-block;
  margin-left: 4px;
  color: var(--faint);
  transition: transform .18s cubic-bezier(.4, 0, .2, 1);
}
.mgh .mg-caret-open { transform: rotate(90deg); }
.mgh .mg-btn-on {
  color: var(--fg);
  border-color: rgba(20, 22, 30, .19);
  background: linear-gradient(180deg, rgba(255, 255, 255, .92) 0%, rgba(237, 239, 250, .76) 48%, rgba(218, 221, 238, .66) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .98),
    inset 0 -1px 0 rgba(20, 22, 30, .06),
    0 1px 2px rgba(16, 18, 30, .08),
    0 3px 9px -5px color-mix(in srgb, var(--accent) 46%, transparent);
}
.mgh .mg-tuning {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 13px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--card-2);
  animation: mg-fade 180ms ease-out;
}
.mgh .mg-tuning-head { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.mgh .mg-tuning-title { font-size: 12px; font-weight: 700; color: var(--fg-2); letter-spacing: .01em; }
.mgh .mg-tuning-count {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--pill);
  color: var(--muted);
}
.mgh .mg-tuning-empty { font-size: 12px; color: var(--muted); padding: 14px 0; text-align: center; }
.mgh .mg-tuning-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 9px;
  border-top: 1px dashed var(--line);
}
/* 本机补丁 2026-11-18：底部现在有三样东西（说明 + 卸载 + 停用）。
   space-between 会把三个均匀推开，说明文字被挤成一条窄块。
   让说明自己吃掉剩余宽度，两个按钮就自然靠右并排了。 */
.mgh .mg-tuning-foot > .pq-sub { flex: 1 1 auto; min-width: 0; }
.mgh .mg-models {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(196px, 1fr));
  gap: 6px;
}
.mgh .mg-model {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 7px 9px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  color: var(--fg-2);
  background: var(--card);
  border: 1px solid var(--line-2);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color .14s, background .14s, color .14s, transform .14s;
}
.mgh .mg-model:hover:not(:disabled) {
  border-color: rgba(20, 22, 30, .21);
  transform: translateY(-1px);
  box-shadow: 0 3px 8px -4px rgba(16, 18, 30, .17);
}
.mgh .mg-model:disabled { opacity: .55; cursor: default; }
.mgh .mg-model:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 70%, transparent); outline-offset: 1px; }
.mgh .mg-model-on {
  color: var(--fg);
  background: var(--card);
  border-color: color-mix(in srgb, var(--fg) 22%, var(--line-2));
  box-shadow: 0 1px 2px rgba(16, 18, 30, .055);
}
.mgh .mg-model-box {
  flex: 0 0 auto;
  width: 15px;
  height: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  line-height: 1;
  color: #fff;
  background: transparent;
  border: 1.5px solid color-mix(in srgb, var(--fg) 30%, transparent);
  border-radius: 4px;
  transition: background .14s, border-color .14s;
}
.mgh .mg-model-box {
  width: 15px;
  height: 15px;
  border-radius: 4.5px;
  font-size: 10.5px;
  font-weight: 800;
}
.mgh .mg-model-on .mg-model-box {
  background: linear-gradient(180deg, rgba(45, 190, 132, .20) 0%, rgba(24, 160, 106, .13) 100%);
  border-color: rgba(20, 150, 98, .46);
  color: #10855a;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .62);
}
.mgh .mg-model-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 550;
}
.mgh .mg-model-ctx { flex: 0 0 auto; font-size: 10.5px; color: var(--faint); font-variant-numeric: tabular-nums; }

/* ── 设置页 ─────────────────────────────────────────────────────────── */
.mgh .mg-settings { display: flex; flex-direction: column; gap: 14px; max-width: 780px; }
.mgh .mg-set-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: var(--muted);
}
.mgh .mg-set-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 11px 13px;
  margin-top: 1px;
  background: var(--card);
  border: 1px solid var(--line-2);
  border-radius: 10px;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
  transition: border-color .14s, box-shadow .14s;
}
.mgh .mg-set-row:hover {
  border-color: color-mix(in srgb, var(--accent) 24%, var(--line));
  box-shadow: 0 4px 16px -12px rgba(20, 22, 30, .5);
}
.mgh .mg-set-info { min-width: 0; flex: 1 1 260px; }
.mgh .mg-set-title { font-size: 13px; font-weight: 600; color: var(--fg); }
.mgh .mg-set-hint { margin-top: 2px; font-size: 11.5px; line-height: 1.5; color: var(--muted); }
.mgh .mg-set-ctl { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; }
.mgh .mg-set-ro { font-size: 12px; color: var(--faint); }
.mgh .mg-set-seg {
  display: inline-flex;
  padding: 2px;
  gap: 2px;
  background: var(--pill);
  border-radius: 9px;
}
.mgh .mg-set-seg button {
  padding: 4px 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 550;
  color: var(--muted);
  background: transparent;
  border: 0;
  border-radius: 7px;
  cursor: pointer;
  transition: background .14s, color .14s, box-shadow .14s;
}
.mgh .mg-set-seg button:hover:not(.on):not(:disabled) { color: var(--fg-2); }
.mgh .mg-set-seg button.on {
  color: var(--fg);
  background: var(--card);
  box-shadow: 0 1px 3px rgba(20, 22, 30, .12), 0 0 0 .5px rgba(20, 22, 30, .08);
}
.mgh .mg-set-seg button:disabled { opacity: .5; cursor: default; }
.mgh .mg-set-seg button:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 70%, transparent); outline-offset: 1px; }
.mgh .mg-set-msg {
  font-size: 12px;
  color: color-mix(in srgb, var(--green) 82%, var(--fg));
  padding: 7px 11px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--green) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--green) 26%, transparent);
}
.mgh .mg-set-foot {
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--faint);
  padding: 11px 13px;
  border-top: 1px dashed var(--line);
}



/* ---- 面板 iframe ---- */
.mgh .mg-frame { min-height: 520px; display: block; }

/* ---- 深色微调（浅色那套在深色下会糊）---- */
.mgh[data-theme="dark"] .mg-badge {
  background: rgba(255, 255, 255, .085);
  border-color: rgba(255, 255, 255, .16);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .10);
  color: rgba(255, 255, 255, .88);
}
.mgh[data-theme="dark"] .mg-btn-mini {
  background: linear-gradient(180deg, rgba(255, 255, 255, .115) 0%, rgba(255, 255, 255, .062) 55%, rgba(255, 255, 255, .038) 100%);
  border-color: rgba(255, 255, 255, .145);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .16), inset 0 -1px 0 rgba(0, 0, 0, .22), 0 1px 2px rgba(0, 0, 0, .38);
}
.mgh[data-theme="dark"] .mg-btn-mini:hover:not(:disabled) {
  background: rgba(255, 255, 255, .12);
  border-color: rgba(255, 255, 255, .26);
  box-shadow: 0 4px 12px -4px rgba(0, 0, 0, .62), 0 1px 2px rgba(0, 0, 0, .4);
}
.mgh[data-theme="dark"] .mg-btn-ghost {
  border-color: rgba(255, 255, 255, .125);
  background: linear-gradient(180deg, rgba(255, 255, 255, .095) 0%, rgba(255, 255, 255, .048) 52%, rgba(255, 255, 255, .024) 100%);
  color: rgba(255, 255, 255, .72);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .135), inset 0 -1px 0 rgba(0, 0, 0, .24), 0 1px 2px rgba(0, 0, 0, .34);
  backdrop-filter: blur(10px) saturate(140%);
  -webkit-backdrop-filter: blur(10px) saturate(140%);
}
.mgh[data-theme="dark"] .mg-btn-ghost:hover:not(:disabled) {
  color: rgba(255, 255, 255, .95);
  border-color: rgba(255, 255, 255, .24);
  background: linear-gradient(180deg, rgba(255, 255, 255, .175) 0%, rgba(255, 255, 255, .095) 52%, rgba(255, 255, 255, .058) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .22), inset 0 -1px 0 rgba(0, 0, 0, .28), 0 2px 7px -2px rgba(0, 0, 0, .56);
}
.mgh[data-theme="dark"] .mg-btn-ghost:active:not(:disabled) {
  background: linear-gradient(180deg, rgba(0, 0, 0, .30) 0%, rgba(255, 255, 255, .062) 100%);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, .62);
}
.mgh[data-theme="dark"] .mg-btn-accent {
  border-color: rgba(255, 255, 255, .20);
  color: rgba(255, 255, 255, .93);
  background: linear-gradient(180deg, rgba(255, 255, 255, .185) 0%, rgba(178, 184, 255, .105) 46%, rgba(140, 146, 220, .075) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .24),
    inset 0 -1px 0 rgba(0, 0, 0, .30),
    0 1px 2px rgba(0, 0, 0, .40),
    0 3px 10px -5px color-mix(in srgb, var(--accent) 52%, transparent);
  backdrop-filter: blur(10px) saturate(150%);
  -webkit-backdrop-filter: blur(10px) saturate(150%);
}
.mgh[data-theme="dark"] .mg-btn-accent:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, .31);
  background: linear-gradient(180deg, rgba(255, 255, 255, .255) 0%, rgba(184, 190, 255, .155) 46%, rgba(146, 152, 228, .115) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .32),
    inset 0 -1px 0 rgba(0, 0, 0, .34),
    0 2px 8px -2px rgba(0, 0, 0, .60),
    0 4px 13px -5px color-mix(in srgb, var(--accent) 62%, transparent);
}
.mgh[data-theme="dark"] .mg-btn-accent:active:not(:disabled) {
  background: linear-gradient(180deg, rgba(0, 0, 0, .34) 0%, rgba(255, 255, 255, .10) 100%);
  box-shadow: inset 0 2px 7px rgba(0, 0, 0, .66);
}
.mgh[data-theme="dark"] .mg-btn-checkin { background: color-mix(in srgb, var(--amber) 22%, transparent); border-color: color-mix(in srgb, var(--amber) 46%, transparent); color: color-mix(in srgb, var(--amber) 64%, #fff); }

.mgh[data-theme="dark"] .mg-brand-sub {
  border-color: rgba(255, 255, 255, .17);
  background:
    linear-gradient(135deg,
      rgba(255, 255, 255, .22) 0%,
      rgba(255, 255, 255, .085) 38%,
      rgba(255, 255, 255, .028) 66%,
      rgba(255, 255, 255, .17) 100%);
  color: rgba(255, 255, 255, .93);
  text-shadow: none;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .30),
    inset 0 -1px 0 rgba(0, 0, 0, .30),
    inset 0 0 12px rgba(255, 255, 255, .07),
    0 1px 3px rgba(0, 0, 0, .34);
}
.mgh[data-theme="dark"] .mg-brand-sub::before {
  background: linear-gradient(180deg, rgba(255, 255, 255, .26) 0%, rgba(255, 255, 255, .05) 62%, rgba(255, 255, 255, 0) 100%);
}
.mgh[data-theme="dark"] .mg-quota-plan {
  background: linear-gradient(180deg, rgba(255, 199, 82, .23), rgba(255, 199, 82, .075));
  border-color: rgba(255, 199, 82, .44);
  color: #ffc94f;
  text-shadow: 0 0 10px rgba(255, 199, 82, .30);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .16),
    inset 0 -1px 0 rgba(0, 0, 0, .22),
    0 1px 3px rgba(0, 0, 0, .35);
}
/* 深色额度读数：亮膜叠暗底，跟金色标签同一套压印语言。 */
.mgh[data-theme="dark"] .mg-qw {
  border-color: rgba(255, 255, 255, .10);
  background: linear-gradient(180deg, rgba(255, 255, 255, .065), rgba(255, 255, 255, .022));
  color: rgba(255, 255, 255, .82);
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, .38),
    inset 0 -1px 0 rgba(255, 255, 255, .07);
}
/* 浅色那层白色 text-shadow 在深色底上是脏边，去掉。 */
.mgh[data-theme="dark"] .pq-gn { text-shadow: none; }
.mgh[data-theme="dark"] .pq-gh { color: #ffffff; }
.mgh[data-theme="dark"] .mg-methods { background: rgba(255, 255, 255, .035); border-color: rgba(255, 255, 255, .13); }

.mgh[data-theme="dark"] .mg-lock-btn {
  background: rgba(255, 255, 255, .06);
  border-color: rgba(255, 255, 255, .14);
  color: rgba(255, 255, 255, .58);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
}
.mgh[data-theme="dark"] .mg-lock-btn:hover {
  color: #ffffff;
  border-color: rgba(255, 255, 255, .26);
}
.mgh[data-theme="dark"] .mg-lock-btn.mg-lock-on {
  color: #fbbf24;
  background: linear-gradient(180deg, rgba(251, 191, 36, .17), rgba(217, 155, 20, .07));
  border-color: rgba(251, 191, 36, .44);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .12),
    0 0 10px rgba(251, 191, 36, .16);
}
.mgh[data-theme="dark"] .pq-card .pq-user { color: rgba(255, 255, 255, .95); }
.mgh[data-theme="dark"] .pq-card .pq-say { color: rgba(255, 255, 255, .72); }
.mgh[data-theme="dark"] .pq-card .pq-count { color: rgba(255, 255, 255, .52); }
.mgh[data-theme="dark"] .pq-card .mini {
  color: rgba(255, 255, 255, .80);
  border-color: rgba(255, 255, 255, .16) !important;
}
.mgh[data-theme="dark"] .pq-card .mini:hover:not(:disabled) {
  color: #ffffff;
  background: rgba(255, 255, 255, .08);
}
.mgh[data-theme="dark"] .mg-tuning { background: rgba(255, 255, 255, .035); border-color: rgba(255, 255, 255, .12); }
.mgh[data-theme="dark"] .mg-model { background: rgba(255, 255, 255, .045); border-color: rgba(255, 255, 255, .09); }
.mgh[data-theme="dark"] .mg-model:hover:not(:disabled) { border-color: rgba(255, 255, 255, .23); box-shadow: 0 3px 9px -4px rgba(0, 0, 0, .58); }
.mgh[data-theme="dark"] .mg-model-on {
  background: rgba(255, 255, 255, .055);
  border-color: rgba(255, 255, 255, .185);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .075);
}
.mgh[data-theme="dark"] .mg-model-on .mg-model-box {
  background: linear-gradient(180deg, rgba(74, 222, 159, .26) 0%, rgba(23, 168, 111, .17) 100%);
  border-color: rgba(74, 222, 159, .52);
  color: #7ff0bc;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .16);
}
.mgh[data-theme="dark"] .mg-btn-on {
  color: rgba(255, 255, 255, .93);
  border-color: rgba(255, 255, 255, .235);
  background: linear-gradient(180deg, rgba(255, 255, 255, .215) 0%, rgba(178, 184, 255, .125) 48%, rgba(140, 146, 220, .09) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .27),
    inset 0 -1px 0 rgba(0, 0, 0, .32),
    0 3px 10px -5px color-mix(in srgb, var(--accent) 54%, transparent);
}
.mgh[data-theme="dark"] .mg-tuning-count { background: rgba(255, 255, 255, .07); }
.mgh[data-theme="dark"] .mg-tuning-foot { border-top-color: rgba(255, 255, 255, .1); }
.mgh[data-theme="dark"] .mg-set-row { background: rgba(255, 255, 255, .035); border-color: rgba(255, 255, 255, .09); }
.mgh[data-theme="dark"] .mg-set-row:hover { border-color: color-mix(in srgb, var(--accent) 36%, transparent); }
.mgh[data-theme="dark"] .mg-set-seg { background: rgba(255, 255, 255, .06); }
.mgh[data-theme="dark"] .mg-set-seg button.on { background: rgba(255, 255, 255, .13); box-shadow: 0 1px 3px rgba(0, 0, 0, .5); }
.mgh[data-theme="dark"] .mg-set-foot { border-top-color: rgba(255, 255, 255, .1); }
.mgh[data-theme="dark"] .mg-set-msg { color: color-mix(in srgb, var(--green) 70%, #fff); }
.mgh[data-theme="dark"] .mg-hidden { border-color: rgba(255, 255, 255, .14); background: rgba(255, 255, 255, .035); }
.mgh[data-theme="dark"] .mg-acct { border-color: rgba(255, 255, 255, .09); }

.mgh[data-theme="dark"] .mg-flash-bad {
  color: #ff9a90;
  background: linear-gradient(180deg, rgba(255, 82, 74, .17), rgba(205, 48, 42, .065));
  border-color: rgba(255, 110, 100, .30);
}
.mgh[data-theme="dark"] .mg-flash {
  color: rgba(255, 255, 255, .88);
  background: linear-gradient(180deg, rgba(255, 255, 255, .095), rgba(255, 255, 255, .042));
  border-color: rgba(255, 255, 255, .17);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .13);
}
.mgh[data-theme="dark"] .mg-acct-err {
  color: #ff9a90;
  background: linear-gradient(180deg, rgba(255, 82, 74, .15) 0%, rgba(205, 48, 42, .055) 100%);
  border-color: rgba(255, 110, 100, .28);
  border-left-color: rgba(255, 122, 112, .74);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .07);
}
.mgh[data-theme="dark"] .mg-acct:hover { border-color: color-mix(in srgb, var(--accent) 34%, transparent); box-shadow: 0 6px 20px -10px rgba(0, 0, 0, .7); }
.mgh[data-theme="dark"] .mg-icon-btn {
  border-color: rgba(255, 255, 255, .155);
  background: linear-gradient(180deg, rgba(255, 255, 255, .135) 0%, rgba(255, 255, 255, .065) 58%, rgba(255, 255, 255, .038) 100%);
  color: rgba(255, 255, 255, .93);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .17),
    inset 0 -1px 0 rgba(0, 0, 0, .22),
    0 1px 2px rgba(0, 0, 0, .35),
    0 4px 10px -5px rgba(0, 0, 0, .55);
}
.mgh[data-theme="dark"] .mg-icon-btn:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, .27);
  background: linear-gradient(180deg, rgba(255, 255, 255, .19) 0%, rgba(255, 255, 255, .10) 58%, rgba(255, 255, 255, .06) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .24),
    inset 0 -1px 0 rgba(0, 0, 0, .24),
    0 2px 5px rgba(0, 0, 0, .40),
    0 8px 18px -8px rgba(0, 0, 0, .68);
}
.mgh[data-theme="dark"] .mg-icon-btn:active:not(:disabled) {
  background: linear-gradient(180deg, rgba(0, 0, 0, .30) 0%, rgba(255, 255, 255, .07) 100%);
  border-color: rgba(255, 255, 255, .20);
  box-shadow:
    inset 0 2px 6px rgba(0, 0, 0, .60),
    inset 0 -1px 0 rgba(255, 255, 255, .09);
}
.mgh[data-theme="dark"] .mg-badge-ok { background: color-mix(in srgb, var(--green) 20%, transparent); border-color: color-mix(in srgb, var(--green) 38%, transparent); }
.mgh[data-theme="dark"] .mg-badge-bad,
.mgh[data-theme="dark"] .mg-badge-off { background: color-mix(in srgb, var(--amber) 20%, transparent); border-color: color-mix(in srgb, var(--amber) 42%, transparent); color: color-mix(in srgb, var(--amber) 66%, #fff); }

/* ---- 无障碍：关掉动效 ---- */
@media (prefers-reduced-motion: reduce) {
  .mgh .mg-btn,
  .mgh .mg-btn-mini,
  .mgh .mg-icon-btn,
  .mgh .mg-hidden-toggle,
  .mgh .mg-acct,
  .mgh .mg-badge { transition: background-color 120ms ease, border-color 120ms ease !important; }

  .mgh .mg-btn:active:not(:disabled),
  .mgh .mg-btn-mini:hover:not(:disabled),
  .mgh .mg-icon-btn:hover:not(:disabled),
  .mgh .mg-acct:hover { transform: none !important; }
  .mgh .mg-btn-primary:not(:disabled) { animation: none !important; }
  .mgh .mg-btn-primary::after { display: none !important; }
  .mgh .mg-spin { animation: none !important; }
  .mgh .mg-note,
  .mgh .mg-modal-mask { animation: none !important; }
}

/* ---- 账号上锁按钮：卡内一枚，SVG 锁，上锁=主色实心，解锁=白底淡描 ---- */
.mgh .mg-lock-btn {
  width: 26px;
  min-width: 26px;
  height: 26px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--muted);
  background: color-mix(in srgb, var(--card) 92%, transparent);
  border: 1px solid var(--line);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .55), 0 1px 2px rgba(10, 12, 20, .045);
  transition: color 150ms ease, background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 140ms ease;
}
.mgh .mg-lock-btn:hover {
  color: var(--fg);
  border-color: color-mix(in srgb, var(--fg) 22%, var(--line));
  transform: translateY(-1px);
}
.mgh .mg-lock-btn:active { transform: translateY(0) scale(.94); }
/* 上锁：琥珀金描边 + 极浅金底，不做实心填充 —— 一眼看到"锁住了"，又不抢主色按钮 */
.mgh .pq-gh .mg-lock-btn.mg-lock-on,
.mgh .mg-lock-btn.mg-lock-on {
  color: #a9660a;
  background: linear-gradient(180deg, rgba(245, 173, 40, .16), rgba(217, 140, 18, .075));
  border-color: rgba(184, 128, 14, .46);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .62),
    inset 0 -1px 0 rgba(150, 96, 8, .10),
    0 1px 3px rgba(184, 128, 14, .16);
}
.mgh .mg-lock-btn.mg-lock-on:hover {
  color: #8a5304;
  background: linear-gradient(180deg, rgba(245, 173, 40, .24), rgba(217, 140, 18, .12));
  border-color: rgba(160, 108, 8, .56);
}

/* ---- 商店页：把原版偏小偏淡的字提上来 ---- */
.mgh .pq-card {
  padding: 12px 14px;
  gap: 7px;
}
.mgh .pq-card .pq-user {
  font-size: 14px;
  font-weight: 750;
  color: var(--fg);
  letter-spacing: .012em;
}
.mgh .pq-card .pq-say {
  font-size: 12.5px;
  font-weight: 450;
  line-height: 1.68;
  color: var(--fg-2);
  letter-spacing: .006em;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.mgh .pq-card .pq-count {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: .03em;
  color: var(--muted);
}
.mgh .pq-card .mini {
  font-size: 12px;
  font-weight: 650;
  color: var(--fg-2);
  padding: 3px 12px;
  border-radius: 8px;
  transition: color 130ms ease, border-color 130ms ease, background-color 130ms ease;
}
.mgh .pq-card .mini:hover:not(:disabled) {
  color: var(--fg);
  border-color: color-mix(in srgb, var(--fg) 22%, var(--line)) !important;
  background: color-mix(in srgb, var(--fg) 4%, transparent);
}
.mgh .pu-bar .mgh-search {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg);
  padding: 6px 12px;
}
.mgh .pu-bar .mgh-search::placeholder { color: var(--muted); }
.mgh[data-theme="dark"] .mgh-search {
  border-color: rgba(255, 255, 255, .10);
  background: linear-gradient(180deg, rgba(0, 0, 0, .30) 0%, rgba(0, 0, 0, .14) 100%);
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, .45),
    inset 0 -1px 0 rgba(255, 255, 255, .055);
}
.mgh[data-theme="dark"] .mgh-search:hover { border-color: rgba(255, 255, 255, .17); }
.mgh[data-theme="dark"] .mgh-search:focus {
  border-color: rgba(255, 255, 255, .24);
  background: linear-gradient(180deg, rgba(0, 0, 0, .38) 0%, rgba(0, 0, 0, .18) 100%);
  box-shadow:
    inset 0 1.5px 3px rgba(0, 0, 0, .52),
    inset 0 -1px 0 rgba(255, 255, 255, .075),
    0 0 0 3px rgba(255, 255, 255, .06);
}
.mgh .none-box {
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--fg-2);
}

/* ── 登录跳转提示条（本机补丁 2026-11-17）──────────────────────────── */
.mgh .mg-note {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.mgh .mg-note-text {
  flex: 1 1 200px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.mgh .mg-note-link {
  flex: 0 0 auto;
  padding: 3px 9px;
  border-radius: 7px;
  border: 1px solid rgba(178, 126, 8, .46);
  background: linear-gradient(180deg, rgba(255, 255, 255, .72), rgba(255, 245, 225, .48));
  color: #8a5304;
  font: inherit;
  font-size: 11.5px;
  font-weight: 650;
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease, transform 140ms cubic-bezier(.22, 1, .36, 1);
}
.mgh .mg-note-link:hover {
  background: linear-gradient(180deg, #fffdf6, #fdf1d8);
  border-color: rgba(160, 108, 8, .64);
  transform: translateY(-1px);
}
.mgh .mg-note-link:active {
  transform: translateY(0) scale(.97);
}
.mgh[data-theme="dark"] .mg-note-link {
  background: rgba(251, 191, 36, .14);
  border-color: rgba(251, 191, 36, .46);
  color: #fbbf24;
}
.mgh[data-theme="dark"] .mg-note-link:hover {
  background: rgba(251, 191, 36, .24);
  border-color: rgba(251, 191, 36, .62);
}
/* 图标按钮 hover 不做翻转。旧规则是 mg-turn + forwards —— 动画结束后永远
   停在 rotate(180deg)，鼠标划过一次「EN」就变成倒过来的「∩3」，而且再也
   回不来。旋转只留给 .mg-spin（刷新时的转圈），别的按钮保持正向。 */
@media (prefers-reduced-motion: reduce) {
  .mgh .mg-icon-btn:hover:not(:disabled) { transform: none !important; }
}
/* ---- 深色补充：浅色靠"白面 + 上沿高光"做凸起，深色没有白面，
        改成"更亮的底 + 主色描边 + 深投影"来读同一个层次。 ---- */
.mgh[data-theme="dark"] .ptabs {
  background:
    linear-gradient(180deg, rgba(0, 0, 0, .32), rgba(0, 0, 0, .10)),
    var(--pill);
  box-shadow:
    inset 0 1px 3px rgba(0, 0, 0, .55),
    inset 0 -1px 0 rgba(255, 255, 255, .05),
    0 1px 0 rgba(255, 255, 255, .03);
}
.mgh[data-theme="dark"] .ptabs button:hover:not(.on) {
  background: rgba(255, 255, 255, .07);
  box-shadow: none;
}
/* 深色玻璃：白膜叠在深底上，靠更亮的顶边和更深的投影立起来。 */
.mgh[data-theme="dark"] .ptabs button.on {
  color: #ffffff;
  background:
    linear-gradient(180deg,
      rgba(255, 255, 255, .22) 0%,
      rgba(255, 255, 255, .12) 44%,
      rgba(255, 255, 255, .07) 100%);
  -webkit-backdrop-filter: blur(16px) saturate(170%);
  backdrop-filter: blur(16px) saturate(170%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .36),
    inset 0 -1px 0 rgba(0, 0, 0, .32),
    inset 0 0 0 1px rgba(255, 255, 255, .10),
    0 1px 2px rgba(0, 0, 0, .45),
    0 6px 16px -6px rgba(0, 0, 0, .70),
    0 14px 28px -16px rgba(0, 0, 0, .55);
}
.mgh[data-theme="dark"] .ptabs button.on::before {
  background: linear-gradient(180deg, rgba(255, 255, 255, .22), rgba(255, 255, 255, 0) 80%);
}
.mgh[data-theme="dark"] .pq-group {
  background: linear-gradient(180deg, #27272d 0%, #212127 100%);
  border-color: var(--line);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .05),
    0 1px 2px rgba(0, 0, 0, .40),
    0 6px 18px -10px rgba(0, 0, 0, .70);
}
.mgh[data-theme="dark"] .pq-group:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--line));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .07),
    0 1px 2px rgba(0, 0, 0, .45),
    0 14px 32px -16px color-mix(in srgb, var(--accent) 60%, #000000);
}
.mgh[data-theme="dark"] .pq-dial b {
  background: linear-gradient(180deg, #2b2b32, #232329);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, .50), 0 0 0 .5px rgba(255, 255, 255, .06);
}

/* 没手动切主题、系统是深色时走同一套（手动切过浅色则排除）。 */
@media (prefers-color-scheme: dark) {
  .mgh:not([data-theme="light"]) .ptabs {
    background: linear-gradient(180deg, rgba(0, 0, 0, .32), rgba(0, 0, 0, .10)), var(--pill);
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, .55), inset 0 -1px 0 rgba(255, 255, 255, .05);
  }
  .mgh:not([data-theme="light"]) .ptabs button:hover:not(.on) { background: rgba(255, 255, 255, .07); box-shadow: none; }
  .mgh:not([data-theme="light"]) .ptabs button.on {
    color: #ffffff;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, .22) 0%, rgba(255, 255, 255, .12) 44%, rgba(255, 255, 255, .07) 100%);
    -webkit-backdrop-filter: blur(16px) saturate(170%);
    backdrop-filter: blur(16px) saturate(170%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, .36),
      inset 0 -1px 0 rgba(0, 0, 0, .32),
      inset 0 0 0 1px rgba(255, 255, 255, .10),
      0 1px 2px rgba(0, 0, 0, .45),
      0 6px 16px -6px rgba(0, 0, 0, .70),
      0 14px 28px -16px rgba(0, 0, 0, .55);
  }
  .mgh:not([data-theme="light"]) .ptabs button.on::before {
    background: linear-gradient(180deg, rgba(255, 255, 255, .22), rgba(255, 255, 255, 0) 80%);
  }
  .mgh:not([data-theme="light"]) .pq-group {
    background: linear-gradient(180deg, #27272d 0%, #212127 100%);
    border-color: var(--line);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .05), 0 1px 2px rgba(0, 0, 0, .40), 0 6px 18px -10px rgba(0, 0, 0, .70);
  }
  .mgh:not([data-theme="light"]) .pq-dial b {
    background: linear-gradient(180deg, #2b2b32, #232329);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, .50), 0 0 0 .5px rgba(255, 255, 255, .06);
  }
}

/* ---- 窄面板：六个页签要挤得下，别折成两行 ---- */
@container magh (max-width: 560px) {
  .mgh .ptabs { margin: 0 10px 8px; padding: 3px; gap: 2px; }
  .mgh .ptabs button { height: 28px; font-size: 11.5px; gap: 2px; padding: 0 2px; }
}
@container magh (max-width: 420px) {
  .mgh .ptabs button { height: 26px; font-size: 11px; }
}

/* 尊重"减少动态效果"：只保留颜色反馈。 */
@media (prefers-reduced-motion: reduce) {
  .mgh .ptabs button,
  .mgh .ptabs button:hover:not(.on),
  .mgh .ptabs button:active:not(.on),
  .mgh .pq-group,
  .mgh .pq-group:hover {
    transform: none !important;
    animation: none !important;
    transition: color 120ms ease, background-color 120ms ease !important;
  }
}
`;
function installMagpieStyles(doc = globalThis.document) {
  if (typeof doc === "undefined" || doc === null) return;
  if (doc.getElementById(STYLE_ID) !== null) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}

// plugin-src/client/index.js
var ENDPOINT = "magpie-hub";
var name = "magpie-hub-client";
var inject = ["slots", "connection"];
async function callMagpieRpc(connection, method, payload, signal) {
  const result = await connection.rpc.call("/api", ENDPOINT, { method, payload }, signal);
  if (result?.ok === true) return result.value;
  if (result?.ok === false) {
    const error = new Error(result.error?.message || `magpie-hub ${method} 失败`);
    error.code = result.error?.code;
    throw error;
  }
  return result;
}
function apply(ctx) {
  const rpcCall = (endpoint, payload, signal) => callMagpieRpc(ctx.connection, endpoint, payload, signal);
  if (typeof ctx.effect === "function") {
    ctx.effect(() => {
      installMagpieStyles();
      return () => {
        const el = globalThis.document?.getElementById("dsh-magpie-styles");
        el?.remove();
      };
    }, "magpie-hub: install styles");
  } else {
    installMagpieStyles();
  }
  registerMagpiePanelEntries(ctx, {
    rpcCall,
    Page: MagpiePage,
    makeElement: (props) => React3.createElement(MagpiePage, props)
  });
}

    return module.exports;
  }
});
