// OpenCode Go 用量查询（官方监控端点，已实测：/zen/go/v1/usage + Bearer API Key）

const ENDPOINT = "https://opencode.ai/zen/go/v1/usage";
const TIMEOUT = 20000;

// 各窗口的已知美元限额（Go 订阅档位）
export const GO_WINDOW_LIMITS = {
  rolling: 12,  // $12 / 5 小时
  weekly: 30,
  monthly: 60,
};

export const GO_WINDOWS = [
  { key: "rolling", name: "5 小时", id: "rolling" },
  { key: "weekly", name: "每周", id: "weekly" },
  { key: "monthly", name: "每月", id: "monthly" },
];

class GoError extends Error {
  constructor(message, kind = "unknown") {
    super(message);
    this.kind = kind; // invalid_key | network | server | bad_data
  }
}

/** 拉取 Go 用量。返回 { windows:[{key,name,percent,limit,resetsAt,endTs}] } */
export async function fetchGoUsage(apiKey) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const resp = await fetch(ENDPOINT, {
      headers: { Authorization: "Bearer " + apiKey },
      signal: ctrl.signal,
    });
    let json = null;
    try { json = await resp.json(); } catch { json = null; }

    if (!resp.ok || (json && json.type === "error")) {
      const msg = (json && json.error && json.error.message) || `HTTP ${resp.status}`;
      const kind = /Missing API key|AuthError|Invalid|401|403|token/i.test(msg) ? "invalid_key" : "server";
      throw new GoError(msg, kind);
    }
    if (!json || !json.usage) throw new GoError("Go 接口无数据", "bad_data");

    const u = json.usage;
    const windows = GO_WINDOWS.map((w) => {
      const d = u[w.id] || {};
      const resetsAt = d.resetsAt || null;
      return {
        key: w.key,
        name: w.name,
        percent: Number(d.percent),
        limit: GO_WINDOW_LIMITS[w.key],
        resetsAt,
        endTs: resetsAt ? Date.parse(resetsAt) : null,
      };
    }).filter((w) => !Number.isNaN(w.percent));
    return { windows };
  } catch (e) {
    if (e instanceof GoError) throw e;
    if (e && e.name === "AbortError") throw new GoError("请求超时", "network");
    throw new GoError("网络错误：" + (e && e.message ? e.message : e), "network");
  } finally {
    clearTimeout(timer);
  }
}

export { GoError };