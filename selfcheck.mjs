// 逐供应商自检：每个 provider 的每个 method 能不能真的初始化。
//
// 只调 authorize() / prompt() 这类「拿地址」的入口，不点「我已完成」
// （那一步才会真的走网络登录、写凭证）。所以这个脚本不会改任何状态。
//
// 用法：node selfcheck.mjs
// 依赖：本机已经装过 magpie 插件（~/.dsh/magpie/plugins/node_modules）。

import { readdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ROOT = join(homedir(), ".dsh", "magpie", "plugins", "node_modules", "@magpie-community");
if (!existsSync(ROOT)) {
  console.error("找不到插件目录：" + ROOT);
  console.error("先装一个插件（商店里点安装，或 npm i），再跑这个脚本。");
  process.exit(1);
}

const PKGS = readdirSync(ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith("opencode-"))
  .map((d) => d.name)
  .sort();

const fakeClient = { provider: {}, auth: {}, config: {}, log: () => {}, fetcher: globalThis.fetch };
const withTimeout = (p, ms, label) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error(label + " 超时 " + ms + "ms")), ms)),
]);

const rows = [];
for (const pkg of PKGS) {
  let m;
  try { m = await import("file:///" + join(ROOT, pkg, "index.mjs").replace(/\\/g, "/")); }
  catch (e) { rows.push({ pkg, provider: "?", ok: false, why: "导入失败: " + (e?.message ?? e).split("\n")[0] }); continue; }

  const factories = Object.keys(m).filter((k) => typeof m[k] === "function" && !k.startsWith("_"));
  if (factories.length === 0) { rows.push({ pkg, provider: "?", ok: false, why: "没有导出工厂函数" }); continue; }

  for (const fn of factories) {
    let hooks;
    try { hooks = await withTimeout(m[fn]({ client: fakeClient }), 8000, pkg); }
    catch (e) { rows.push({ pkg, provider: fn, ok: false, why: "工厂抛错: " + (e?.message ?? e).split("\n")[0] }); continue; }

    const auth = hooks?.auth;
    const prov = auth?.provider ?? hooks?.provider?.id ?? "?";
    const methods = Array.isArray(auth?.methods) ? auth.methods : [];
    const detail = [];
    for (const meth of methods) {
      const label = meth.label ?? meth.type ?? "?";
      if (typeof meth.authorize !== "function") { detail.push({ label, type: meth.type, state: "input" }); continue; }
      try {
        const flow = await withTimeout(Promise.resolve(meth.authorize({})), 10000, String(label));
        const url = typeof flow?.url === "string" ? flow.url : "";
        let cb = "—";
        if (url) {
          try {
            const u = new URL(url);
            const svc = u.searchParams.get("service");
            const inner = svc ? new URL(svc) : u;
            const ru = inner.searchParams.get("redirect_uri");
            const port = inner.searchParams.get("port");
            const scheme = inner.searchParams.get("uri_scheme");
            cb = ru ? "redirect_uri=" + ru : (port ? "port=" + port + (scheme ? " scheme=" + scheme : "") : "无回调参数");
          } catch { cb = "url 解析失败"; }
        }
        detail.push({ label, type: meth.type, state: "ok", hasUrl: url !== "", cb });
      } catch (e) {
        detail.push({ label, type: meth.type, state: "fail", why: (e?.message ?? String(e)).split("\n")[0].slice(0, 140) });
      }
    }
    rows.push({ pkg, provider: prov, fn, ok: true, methods: detail });
  }
}

console.log("=".repeat(96));
for (const r of rows) {
  if (r.ok === false) { console.log("\u2717 " + String(r.provider).padEnd(22) + " [" + r.pkg + "]  " + r.why); continue; }
  console.log("\u25cf " + String(r.provider).padEnd(22) + " [" + r.pkg + "]");
  for (const d of (r.methods ?? [])) {
    if (d.state === "ok") console.log("    \u2713 " + String(d.label).padEnd(44) + (d.hasUrl ? "[" + d.cb + "]" : "（本机应用 / 无跳转）"));
    else if (d.state === "input") console.log("    \u00b7 " + String(d.label).padEnd(44) + "（需要用户输入）");
    else console.log("    \u2717 " + String(d.label).padEnd(44) + d.why);
  }
}
console.log("=".repeat(96));
const bad = rows.filter((r) => r.ok === false || (r.methods ?? []).some((d) => d.state === "fail"));
console.log("总计 " + rows.length + " 个 provider，异常 " + bad.length + " 个");
console.log("注意：\u2717 里有一部分是「设计如此」（需要输入 token / 需要企业域名 / 需要本机 CLI），");
console.log("      具体哪些是真问题，见 PROVIDERS.md。");
