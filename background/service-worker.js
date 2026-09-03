// 背景 service worker：定时拉取官方接口、更新徽章、缓存数据供弹窗读取。
// 密钥只存本机 chrome.storage.local，仅用于向 open.bigmodel.cn 官方接口鉴权。

import { fetchAll } from "../shared/api.js";
import { LEVEL_NAMES, describeLimit } from "../shared/constants.js";
import { pctColor, badgeText } from "../shared/format.js";

const DEFAULTS = {
  apiKey: "",
  refreshMin: 10,      // 1–30
  planExpiry: "",      // 用户手动填写的套餐到期日 YYYY-MM-DD
  lastData: null,
  lastFetchAt: 0,
};

const STORE_KEYS = ["apiKey", "refreshMin", "planExpiry"];

async function getSettings() {
  const got = await chrome.storage.local.get(STORE_KEYS);
  return {
    apiKey: got.apiKey || "",
    refreshMin: got.refreshMin || DEFAULTS.refreshMin,
    planExpiry: got.planExpiry || "",
  };
}

function buildSnapshot(quota, model, tool, errors, planExpiry) {
  const limits = (quota.limits || []).map((l) => ({ ...l, name: describeLimit(l) }));
  return {
    fetchedAt: Date.now(),
    level: quota.level || "unknown",
    levelName: LEVEL_NAMES[quota.level] || quota.level,
    planExpiry: planExpiry || "",
    limits,
    model: model && !model.error ? model : null,
    tool: tool && !tool.error ? tool : null,
    errors: errors || [],
  };
}

function persistSnapshot(snap) {
  return chrome.storage.local.set({ lastData: snap, lastFetchAt: Date.now() });
}

/** 五小时占比：取 nextResetTime 最小（窗口最短）的 CREDIT_LIMIT 条目。 */
function badgePct(limits) {
  const credit = limits.find((l) => l.type === "CREDIT_LIMIT");
  if (!credit) return null;
  const p = Number(credit.percentage);
  if (Number.isNaN(p)) return null;
  return p;
}

async function refresh() {
  const { apiKey, planExpiry } = await getSettings();
  if (!apiKey) {
    await chrome.action.setBadgeText({ text: "" });
    await chrome.storage.local.set({ lastData: null, lastFetchAt: 0 });
    return { ok: false, reason: "no_key", data: null };
  }

  const res = await fetchAll(apiKey);
  const errors = [];
  let quota = res.quota;
  if (quota.error) {
    errors.push({ section: "quota", message: quota.error.message, kind: quota.error.kind });
    quota = { limits: [], level: "unknown" };
  }

  const pct = badgePct(quota.limits || []);
  if (pct !== null && pct !== undefined) {
    await chrome.action.setBadgeBackgroundColor({ color: pctColor(pct) });
    await chrome.action.setBadgeText({ text: badgeText(pct) });
  } else {
    await chrome.action.setBadgeText({ text: "" });
  }

  const snap = buildSnapshot(quota, res.model, res.tool, errors, planExpiry);
  await persistSnapshot(snap);
  return { ok: errors.length === 0, reason: errors.length ? "partial" : "ok", data: snap };
}

async function ensureAlarm() {
  const { refreshMin } = await getSettings();
  const period = Math.min(30, Math.max(1, Number(refreshMin) || 10));
  await chrome.alarms.clear("glm-refresh");
  await chrome.alarms.create("glm-refresh", { periodInMinutes: period });
  return period;
}

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm().then(() => refresh());
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm().then(() => refresh());
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "glm-refresh") refresh();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      case "refresh":
        sendResponse(await refresh());
        break;
      case "getData": {
        const got = await chrome.storage.local.get(["lastData", "lastFetchAt", "apiKey"]);
        sendResponse({
          data: got.lastData || null,
          fetchedAt: got.lastFetchAt || 0,
          hasKey: Boolean(got.apiKey),
        });
        break;
      }
      case "settingsChanged":
        await ensureAlarm();
        sendResponse(await refresh());
        break;
      default:
        sendResponse({ ok: false, reason: "unknown" });
    }
  })();
  return true; // 异步响应
});