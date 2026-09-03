<div align="center">

# GLM Coding Plan 用量监控

**智谱中国大陆版 · GLM Coding Plan 用量监控面板（Chrome 扩展）**

实时查看你的 Coding Plan「5 小时 / 每周 / MCP 额度、24 小时模型与工具用量」，工具栏徽章随时掌握当前 5 小时使用占比。

![Chrome](https://img.shields.io/badge/Chrome%20(Chromium)-96%2B-blue) ![Manifest](https://img.shields.io/badge/Manifest-V3-9cf) ![License](https://img.shields.io/badge/License-MIT-green) ![Version](https://img.shields.io/badge/Version-1.0.4-blue)

</div>

---

## 简介

GLM Coding Plan 是智谱开放平台面向 AI 编程场景的订阅套餐。本扩展让你**无需登录网页后台**，点击浏览器工具栏即可查看套餐额度消耗情况：

- 套餐等级（Lite / Pro / Max）与**到期日期**
- **5 小时额度**与**每周额度**的已用百分比、已用/总额、剩余、重置时间
- **月末 MCP** 调用次数（账号存在该额度时显示）
- **24 小时模型用量**（调用次数、Tokens、分模型占比）
- **24 小时工具用量**（联网搜索 / 网页读取 / ZRead）
- 工具栏**徽章**实时显示当前 5 小时使用占比（绿 <80% / 黄 80–95% / 红 >95%）

数据来自智谱**官方公开监控接口**，密钥仅存本机，仅发送给官方接口，无任何第三方服务或埋点。

> ⚠️ 本工具仅面向**中国大陆版 `open.bigmodel.cn`**。套餐额度仅统计官方支持工具内的编码用量；本扩展只做查询、不发起模型请求，因此**不会消耗你的套餐额度**。

## 功能特性

- [x] 5 小时 / 每周额度横向进度条（已用%、已用/总额、剩余、重置倒计时）
- [x] 套餐等级 + 到期日期显示（到期 ≤7 天变黄、已过期变红）
- [x] 24h 模型用量（次数、Tokens、分模型占比条）
- [x] 24h 工具用量（联网搜索 / 网页读取 / ZRead）
- [x] 工具栏徽章（占比实时显示，阈值变色）
- [x] 自动刷新（1–30 分钟可设）
- [x] 深色扁平 UI、全中文

## 截图

> 截图待补充（发布前建议放入 `docs/screenshots/` 并在下面引用）。

## 安装

### 方式一：本地加载（开发者/自用）

1. 下载或克隆本仓库到本地目录。
2. 打开 `chrome://extensions`（Edge：`edge://extensions`）。
3. 打开右上角「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择项目根目录（含 `manifest.json` 的目录）。
5. 浏览器工具栏出现扩展图标。

### 方式二：Chrome Web Store（正式发布后）

> 上架链接待补充。上架后可在商店一键安装并自动更新。

详细步骤见 [docs/INSTALL.md](docs/INSTALL.md)。

## 配置

点扩展图标 → ⚙ 设置：

1. **API Key**：到 [bigmodel.cn](https://open.bigmodel.cn/) 后台「API Keys」复制（与你在 Claude Code / ZCode 等工具中配置的密钥一致）。
2. **套餐到期日期**（选填）：填写你的订阅到期日，将显示在套餐等级后，临近到期会有颜色提醒。
3. **自动刷新间隔**：1–30 分钟。
4. 保存后面板自动查询并展示。

密钥只存本机 `chrome.storage.local`，仅发送给 `open.bigmodel.cn` 官方监控接口。

## 隐私与安全

- **密钥不离开本机**：仅用于向官方监控接口鉴权，不上传任何第三方。
- **无广告 / 无统计 / 无追踪**。
- 内置 `docs/API.md` 完整记录了所有请求端点与数据结构，供审计。

## 技术栈与结构

- **Manifest V3** + 原生 HTML/CSS/JS，零构建依赖
- 后台 `service-worker`：`chrome.alarms` 定时刷新、徽章更新、数据缓存
- 弹窗 `popup/`：横向进度条仪表 + 用量明细
- 共享模块 `shared/`：接口封装 / 平台常量 / 格式化

```
GLM Coding Plan 用量监控/
├── manifest.json              # MV3 配置
├── background/service-worker.js # 定时刷新、徽章、缓存
├── popup/                     # 弹窗 UI（html/css/js）
├── shared/                    # api.js / constants.js / format.js
├── icons/                     # 扩展图标（16/32/48/128）
├── docs/                      # API.md 接口契约 / INSTALL.md 安装指南
├── scripts/                   # 图标生成 / 打包 / 接口冒烟测试
└── package.json               # 开发脚本
```

## 开发

```bash
npm run test:api   # 接口冒烟测试（需 BIGMODEL_KEY 环境变量）
npm run icons      # 重新生成图标
npm run build      # 打包发布 zip 到 dist/
```

接口契约与实测数据结构见 [docs/API.md](docs/API.md)。

## 版本历史

见 [CHANGELOG.md](CHANGELOG.md)。

## 贡献

欢迎提交 Issue 与 PR，流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)

---

*本项目与智谱官方无任何关联，为社区独立开发，仅作个人用量监控用途。*