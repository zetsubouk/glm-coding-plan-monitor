// 官方监控接口封装：带鉴权、超时、错误分类、数据解析。
// 密钥只用于向 open.bigmodel.cn 官方接口鉴权。

import { ENDPOINTS } from "./constants.js";

const TIMEOUT = 20000;

class ApiError extends Error {
  constructor(message, kind = "unknown") {
    super(message);
    this.kind = kind; // invalid_key | quota_context | network | server | bad_data
  }
}

async function request(url, apiKey, extraQuery = "") {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl
    ? setTimeout(() => ctrl.abort(), TIMEOUT)
    : null;
  try {
    const query = extraQuery ? `${url}?${extraQuery}` : url;
    const resp = await fetch(query, {
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      signal: ctrl ? ctrl.signal : undefined,
    });
    const text = await resp.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!json) {
      // 200 空 body 属正常（如 model-usage 无数据时）
      if (resp.status === 200) return null;
      throw new ApiError(`HTTP ${resp.status}：响应无法解析`, "server");
    }

    // 平台统一错误兜底
    if (json.code && json.code !== 200 && !json.success) {
      const msg = String(json.msg || json.error || `错误码 ${json.code}` || "");
      let kind = "server";
      if (/key|授权|apikey|token|401|鉴权/i.test(msg)) kind = "invalid_key";
      if (/仅限|编码工具|coding|工具|产品环境|编码场景/i.test(msg)) kind = "quota_context";
      throw new ApiError(msg, kind);
    }

    if (json.success === false) {
      throw new ApiError(String(json.msg || "request failed"), "server");
    }

    return json;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e && e.name === "AbortError") throw new ApiError("请求超时", "network");
    throw new ApiError("网络错误：" + (e && e.message ? e.message : e), "network");
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** 配额/额度：返回 {level, limits:[...]}，limits 按 nextResetTime 升序。 */
export async function fetchQuotaLimit(apiKey) {
  const json = await request(ENDPOINTS.quotaLimit, apiKey);
  if (!json || !json.data) throw new ApiError("配额接口无数据", "bad_data");
  const limits = (json.data.limits || []).slice().sort(
    (a, b) => (a.nextResetTime || 0) - (b.nextResetTime || 0)
  );
  return { level: json.data.level || "unknown", limits };
}

function isoRange(hours = 24) {
  const end = new Date();
  const start = new Date(Date.now() - hours * 3600 * 1000);
  const fmt = (d) => {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  return { startTime: fmt(start), endTime: fmt(end) };
}

/** 24h 模型用量：返回解析后的汇总对象（无数据时为 null）。 */
export async function fetchModelUsage(apiKey, hours = 24) {
  const { startTime, endTime } = isoRange(hours);
  const json = await request(
    ENDPOINTS.modelUsage,
    apiKey,
    `startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`
  );
  if (!json || !json.data) return null;
  const d = json.data;
  return {
    xTime: d.x_time || [],
    modelCallCount: d.modelCallCount || [],
    tokensUsage: d.tokensUsage || [],
    granularity: d.granularity || "hourly",
    total: {
      calls: (d.totalUsage && d.totalUsage.totalModelCallCount) ?? 0,
      tokens: (d.totalUsage && d.totalUsage.totalTokensUsage) ?? 0,
    },
    models: (d.totalUsage && d.totalUsage.modelSummaryList) || [],
  };
}

/** 24h 工具用量：联网搜索/网页读取/ZRead 次数。 */
export async function fetchToolUsage(apiKey, hours = 24) {
  const { startTime, endTime } = isoRange(hours);
  const json = await request(
    ENDPOINTS.toolUsage,
    apiKey,
    `startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`
  );
  if (!json || !json.data) return null;
  const d = json.data;
  const t = (d.totalUsage || {});
  return {
    networkSearch: t.totalNetworkSearchCount ?? 0,
    webRead: t.totalWebReadMcpCount ?? 0,
    zread: t.totalZreadMcpCount ?? 0,
    searchMcp: t.totalSearchMcpCount ?? 0,
    toolDetails: d.toolDataList || [],
  };
}

/** 一键拉取全部（配额 + 模型 + 工具）。失败任一不阻断其他。 */
export async function fetchAll(apiKey, hours = 24) {
  const [quota, model, tool] = await Promise.allSettled([
    fetchQuotaLimit(apiKey),
    fetchModelUsage(apiKey, hours),
    fetchToolUsage(apiKey, hours),
  ]);
  return {
    quota: quota.status === "fulfilled" ? quota.value : { error: quota.reason },
    model: model.status === "fulfilled" ? model.value : { error: model.reason },
    tool: tool.status === "fulfilled" ? tool.value : { error: tool.reason },
  };
}

export { ApiError };