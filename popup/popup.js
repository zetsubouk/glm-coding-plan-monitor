// 弹窗逻辑：渲染仪表 + 用量；每次打开强刷；错误显式暴露。

import { nf, fmtTime, fmtRemain, pctColor, daysLeft } from "../shared/format.js";
import { LEVEL_NAMES } from "../shared/constants.js";

const $ = (id) => document.getElementById(id);

const els = {
  setup: $("setup"), panel: $("panel"),
  fKey: $("f-key"), fRefresh: $("f-refresh"), fExpiry: $("f-expiry"),
  btnSave: $("btn-save"), setupMsg: $("setup-msg"),
  planBadge: $("plan-badge"), planExpiry: $("plan-expiry"), lastUpdated: $("last-updated"),
  statusBar: $("status-bar"), planErr: $("plan-err"),
  limits: $("limits"), mcp: $("mcp-wrap"), usageWrap: $("usage-wrap"),
  btnSettings: $("btn-settings"), btnRefresh: $("btn-refresh"),
};

function shortError(e) { return e && e.message ? e.message : "未知错误"; }

/* ---------- 额度窗口识别 ---------- */
function classify(limit) {
  if (limit.type === "CREDIT_LIMIT" && limit.unit === 3 && limit.number === 5) return "h5";
  if (limit.type === "CREDIT_LIMIT" && (limit.unit === 6) && (limit.number === 1 || limit.number === 7)) return "weekly";
  return "other";
}

/* ---------- 渲染：横向进度条额度项 ---------- */
function limitBar(limit, label) {
  const pct = Math.max(0, Math.min(100, Number(limit.percentage || 0)));
  const used = Number(limit.currentValue || 0);
  const total = Number(limit.usage || 0);
  const remaining = limit.remaining;

  const el = document.createElement("div");
  el.className = "limit";

  const top = document.createElement("div");
  top.className = "limit-top";
  top.innerHTML = `<span class="limit-name">${label}</span>
    <span class="limit-pct">${Math.round(pct)}<small>%</small></span>`;
  el.appendChild(top);

  const track = document.createElement("div");
  track.className = "limit-track";
  const fill = document.createElement("div");
  fill.className = "limit-fill" + (pct >= 80 ? (pct >= 95 ? " bad" : " warn") : "");
  fill.style.width = pct + "%";
  track.appendChild(fill);
  el.appendChild(track);

  const info = document.createElement("div");
  info.className = "limit-info";
  let left = "";
  if (total && used) left = `已用 <b>${nf(used)}</b> / ${nf(total)} 积分`;
  else if (used) left = `已用 <b>${nf(used)}</b>`;
  let right = "";
  const parts = [];
  if (remaining !== undefined && remaining !== null) parts.push(`剩余 <b>${nf(remaining)}</b>`);
  if (limit.nextResetTime) parts.push(`${fmtRemain(limit.nextResetTime - Date.now())}后重置`);
  right = `<span class="rem">${parts.join(" · ")}</span>`;
  info.innerHTML = `<span class="used">${left}</span>${right}`;
  el.appendChild(info);
  return el;
}

/* ---------- 渲染：MCP ---------- */
function renderMcp(limits) {
  const others = limits.filter((l) => classify(l) === "other");
  if (!others.length) return;
  els.mcp.innerHTML = "";
  for (const o of others) {
    const pct = Number(o.percentage || 0);
    const color = pctColor(pct);
    const row = document.createElement("div");
    row.className = "mcp-row";
    const used = o.currentValue, total = o.usage;
    row.innerHTML = `
      <span class="l">${o.name || "MCP"} · ${total ? (Math.round(pct) + "%") : ""}</span>
      <span class="v"><b style="color:${color}">${nf(used)}</b> / ${nf(total || "—")} 次</span>`;
    els.mcp.appendChild(row);
  }
}

/* ---------- 渲染：24h 模型用量 ---------- */
function renderModel(model) {
  if (!model) return "";
  const box = document.createElement("div");
  const h = document.createElement("div");
  h.className = "usage-h"; h.textContent = "24 小时用量";
  box.appendChild(h);

  const k = document.createElement("div");
  k.className = "kpis";
  const mk = (n, l, c) => `<div class="kpi"><div class="n" style="color:${c || ""}">${n}</div><div class="l">${l}</div></div>`;
  k.innerHTML = mk(nf(model.total.calls), "调用次数")
    + mk(nf(model.total.tokens), "Tokens", "var(--accent)");
  box.appendChild(k);

  if (model.models && model.models.length) {
    const top = Math.max(...model.models.map((m) => m.totalTokens), 1);
    const mb = document.createElement("div");
    mb.className = "model-box";
    for (const m of model.models) {
      const w = Math.round((m.totalTokens / top) * 100);
      const row = document.createElement("div");
      row.className = "model-row";
      row.innerHTML = `
        <div class="top"><span>${m.modelName || "模型"}</span><span class="tokens">${nf(m.totalTokens)} · ${nf(m.totalTokens && model.total.tokens ? ((m.totalTokens / model.total.tokens) * 100) : 0)}%</span></div>
        <div class="model-bar"><i style="width:${w}%"></i></div>`;
      mb.appendChild(row);
    }
    box.appendChild(mb);
  }
  return box;
}

/* ---------- 渲染：工具用量 ---------- */
function renderTool(tool) {
  if (!tool) return "";
  const box = document.createElement("div");
  const mk = (n, l) => `<div class="tool"><div class="n">${nf(n)}</div><div class="l">${l}</div></div>`;
  box.innerHTML = `
    <div class="tools">
      ${mk(tool.networkSearch, "联网搜索")}${mk(tool.webRead, "网页读取")}${mk(tool.zread, "ZRead")}
    </div>`;
  return box;
}

/* ---------- 顶层渲染 ---------- */
function render(payload) {
  if (!payload) {
    els.gauges.innerHTML = `<div class="empty">暂无数据，正在刷新…</div>`;
    els.mcp.innerHTML = ""; els.usageWrap.innerHTML = "";
    return;
  }

  // 计划徽章 / 到期日 / 更新时间
  const levelName = payload.levelName || LEVEL_NAMES[payload.level] || payload.level;
  els.planBadge.textContent = levelName && levelName !== "unknown" ? levelName : "";
  els.planExpiry.textContent = "";
  els.planExpiry.className = "plan-expiry";
  if (payload.planExpiry) {
    els.planExpiry.textContent = `到期 ${payload.planExpiry}`;
    const dl = daysLeft(payload.planExpiry);
    if (dl !== null && dl < 0) {
      els.planExpiry.classList.add("bad");
      els.planExpiry.textContent += "（已到期）";
    } else if (dl !== null && dl <= 7) {
      els.planExpiry.classList.add("warn");
      els.planExpiry.textContent += `（剩 ${dl} 天）`;
    }
  }
  els.lastUpdated.textContent = payload.fetchedAt ? fmtTime(payload.fetchedAt) + " 更新" : "";

  // 错误暴露
  const quotaErr = (payload.errors || []).find((e) => e.section === "quota");
  els.planErr.hidden = !quotaErr;
  if (quotaErr) {
    els.planErr.textContent = "套餐额度查询失败：" + shortError(quotaErr);
  }
  const others = (payload.errors || []).filter((e) => e.section !== "quota");
  els.statusBar.hidden = others.length === 0;
  if (others.length) {
    els.statusBar.className = "status" + (others.some((e) => e.kind === "invalid_key") ? " bad" : "");
    els.statusBar.textContent = others.map(shortError).join("；");
  }

  // 额度列表（横向进度条）
  const limits = payload.limits || [];
  els.limits.innerHTML = "";
  els.mcp.innerHTML = "";
  if (!limits.length) {
    els.limits.innerHTML = `<div class="empty">未查询到额度，请检查密钥或刷新。</div>`;
  } else {
    const h5 = limits.find((l) => classify(l) === "h5");
    const weekly = limits.find((l) => classify(l) === "weekly");
    if (h5) els.limits.appendChild(limitBar(h5, "5 小时额度"));
    if (weekly) els.limits.appendChild(limitBar(weekly, "本周额度"));
    const leftover = limits.filter((l) => classify(l) === "other");
    if (leftover.length && !h5 && !weekly) els.limits.appendChild(limitBar(leftover[0], leftover[0].name || "额度"));
    renderMcp(leftover || []);
  }

  // 用量
  els.usageWrap.innerHTML = "";
  const hasModel = payload.model && !payload.model.error;
  const hasTool = payload.tool && !payload.tool.error;
  if (hasModel) els.usageWrap.appendChild(renderModel(payload.model));
  if (hasTool) els.usageWrap.appendChild(renderTool(payload.tool));
  if (!hasModel && !hasTool) els.usageWrap.innerHTML = `<div class="empty">24h 用量暂不可用。</div>`;
}

/* ---------- 动作 ---------- */
function setRefreshBusy(b) {
  els.btnRefresh.disabled = b;
  if (b) els.btnRefresh.classList.add("spin");
  else { els.btnRefresh.classList.remove("spin"); els.btnRefresh.textContent = "⟳"; }
}

async function doRefresh() {
  setRefreshBusy(true);
  try {
    const resp = await chrome.runtime.sendMessage({ type: "refresh" });
    if (resp && resp.data) render(resp.data);
    else if (resp && resp.reason === "no_key") showSetup();
  } catch (e) {
    render({ fetchedAt: Date.now(), errors: [{ message: "刷新失败：" + shortError(e), section: "quota" }], limits: [], model: null, tool: null });
  } finally {
    setRefreshBusy(false);
  }
}

function showSetup() { els.panel.hidden = true; els.setup.hidden = false; }
function showPanel() { els.setup.hidden = true; els.panel.hidden = false; }

async function init() {
  const got = await chrome.storage.local.get(["lastData", "lastFetchAt", "apiKey", "refreshMin", "planExpiry"]);
  if (!got.apiKey) { showSetup(); return; }
  showPanel();
  els.fRefresh.value = String(got.refreshMin || 10);
  els.fExpiry.value = got.planExpiry || "";
  if (got.lastData) render(got.lastData);
  // 每次都强刷，规避缓存/瞬时错误导致计划不可见
  doRefresh();
}

/* ---------- 事件 ---------- */
els.btnRefresh.addEventListener("click", doRefresh);
els.btnSettings.addEventListener("click", showSetup);

els.btnSave.addEventListener("click", async () => {
  const key = els.fKey.value.trim();
  if (!key) { show("请填写 API Key。", false); return; }
  const refreshMin = Number(els.fRefresh.value) || 10;
  const planExpiry = els.fExpiry.value || "";
  // 校验到期日格式；若填了非法日期则用月-日解析兜底失败时清空
  if (planExpiry && !/^\d{4}-\d{2}-\d{2}$/.test(planExpiry)) {
    show("到期日期格式应为 YYYY-MM-DD。", false);
    return;
  }
  await chrome.storage.local.set({ apiKey: key, refreshMin, planExpiry });
  show("已保存，正在查询…", true);
  try {
    const resp = await chrome.runtime.sendMessage({ type: "settingsChanged" });
    if (!resp) throw new Error("后台无响应");
    const quotaErr = resp.data && (resp.data.errors || []).find((e) => e.section === "quota");
    if (quotaErr && quotaErr.kind === "invalid_key") {
      show("保存成功，但 API Key 校验失败：" + shortError(quotaErr), false);
      return;
    }
    if (resp.data) render(resp.data);
    showPanel();
  } catch (e) {
    show("保存成功，查询未完成（" + shortError(e) + "）", false);
    showPanel();
  }
});

function show(msg, ok) {
  els.setupMsg.hidden = false;
  els.setupMsg.className = "msg " + (ok ? "ok" : "bad");
  els.setupMsg.textContent = msg;
}

init();