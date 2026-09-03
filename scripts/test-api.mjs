// 用真实密钥跑通 shared/api.js 的完整解析链路（Node 18+），验证契约与解析逻辑。
// 用法：BIGMODEL_KEY=<key> node scripts/test-api.mjs
import { fetchAll } from "../shared/api.js";
import { LEVEL_NAMES, describeLimit } from "../shared/constants.js";
import { nf, fmtTime, pctColor } from "../shared/format.js";

const key = process.env.BIGMODEL_KEY;
if (!key) {
  console.error("缺少 BIGMODEL_KEY 环境变量");
  process.exit(2);
}

console.log("=== fetchAll ===");
const res = await fetchAll(key);

if (res.quota.error) {
  console.log("quota ERROR:", res.quota.error.kind, res.quota.error.message);
} else {
  console.log("level:", res.quota.level, "->", LEVEL_NAMES[res.quota.level]);
  for (const l of res.quota.limits) {
    console.log(
      `  - ${describeLimit(l)} | used=${l.currentValue}/${l.usage} (${l.percentage}%)`,
      `rem=${l.remaining} | nextReset=${fmtTime(l.nextResetTime)} | type=${l.type} unit=${l.unit} num=${l.number}`
    );
  }
  // 徽章验证
  const credit = res.quota.limits.find((x) => x.type === "CREDIT_LIMIT");
  if (credit) {
    const pct = Number(credit.percentage);
    console.log(`  徽章: ${Math.round(pct)}% 颜色 ${pctColor(pct)}`);
  }
}

if (res.model.error) {
  console.log("model ERROR:", res.model.error.kind, res.model.error.message);
} else if (res.model) {
  console.log("model: calls=", res.model.total.calls, "tokens=", res.model.total.tokens);
  for (const m of res.model.models) console.log("   ", m.modelName, m.totalTokens);
}

if (res.tool.error) {
  console.log("tool ERROR:", res.tool.error.kind, res.tool.error.message);
} else if (res.tool) {
  console.log("tool: search=", res.tool.networkSearch, "webRead=", res.tool.webRead, "zread=", res.tool.zread);
}

console.log("=== done ===");