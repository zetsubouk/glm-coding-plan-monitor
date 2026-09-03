// 复现后台 service-worker.refresh() 的真实异常（Node 桩 + 真实双密钥）。
// 用法：GLM=<glmkey> GO=<gokey> node scripts/repro-sw.mjs
const captured = {};
const realStore = {
  providers: { glm: { enabled: true, apiKey: process.env.GLM || "", planExpiry: "" },
               go: { enabled: true, apiKey: process.env.GO || "" } },
  refreshMin: 10,
};

globalThis.chrome = {
  storage: { local: {
    get: async (keys) => { const o = {}; (Array.isArray(keys)?keys:[keys]).forEach(k=>o[k]=realStore[k]); return o; },
    set: async (o) => { Object.assign(realStore, o); },
  }},
  alarms: {
    clear: async () => {}, create: async () => {},
    onAlarm: { addListener: () => {} },
  },
  action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {}, setIcon: async () => {} },
  runtime: {
    onInstalled: { addListener: () => {} },
    onStartup: { addListener: () => {} },
    onMessage: { addListener: (cb) => { captured.handler = cb; } },
  },
};

await import("../background/service-worker.js");

if (!captured.handler) { console.log("NO_LISTENER"); process.exit(2); }

const result = await Promise.race([
  new Promise((res) => captured.handler({ type: "refresh" }, {}, (r) => res({ response: r }))),
  new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT(30s): refresh未返回——监听器内部抛错导致悬挂")), 30000)),
]);
console.log("refresh 返回:", JSON.stringify(result, null, 2));
process.exit(0);