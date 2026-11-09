# 茗脉 · Harness 有效性自检（HARNESS_CHECK）

| 项 | 内容 |
|---|---|
| 文档版本 | V1.0 |
| 编写日期 | 2026-11-07 |
| 适用阶段 | 阶段四 AI 项目规范 · 第 6 轮 |
| 自检对象 | [AGENTS.md](../AGENTS.md)、[DEVELOPMENT_GUIDE](../docs/development/DEVELOPMENT_GUIDE.md)、[AI_DECISION_RULES](AI_DECISION_RULES.md)、[TASK_TEMPLATE](TASK_TEMPLATE.md)、[ADR](../docs/development/ADR.md)、[build-log](../harness/build-log.md) |
| 结论 | Harness 可用，但存在 3 项缺口，已在 §3 给出补强动作 |

---

## 1 Harness 五要素检查

| # | 要素 | 现状 | 判定 |
|---|---|---|---|
| 1 | 规则（Rules） | AGENTS.md 锁定技术栈、分层、命名、安全红线、禁止项；AI_DECISION_RULES 定义三级授权 | 通过 |
| 2 | 上下文（Context） | AGENTS.md §1 给出 10 篇必读顺序与冲突裁决；任务卡强制填"规格来源" | 通过 |
| 3 | 工具（Tools） | 命令基线（Python venv/pytest、npm、compose）；错误码与分页有统一实现要求 | 部分通过：本机 MySQL 5.7 服务需凭据，DDL 未连库执行 |
| 4 | 检查（Checks） | 自检清单 10 项、评审 8 项、任务验收 5 组 | 通过 |
| 5 | 反馈闭环（Feedback） | build-log 记录偏差；ADR 记录决策；"发现但未修"清单 | 通过 |

---

## 2 用历史缺陷反推有效性（回溯验证）

| 历史缺陷 | 来源 | 现行 Harness 能否提前拦截 | 依据 |
|---|---|---|---|
| P09 收藏页首次进入空白（未调 render） | 阶段二 Q11 | 部分 | 任务验收要求"页面可进入 + 关键交互可完成"，但无"进入即渲染"专项；需补前端冒烟项 |
| 后台写操作静默失效 | 阶段二审计 | 能 | 自检清单 §3.2 响应 Envelope + 错误码 |
| 跨端数据不同步（对比篮） | 阶段二审计 | 能 | ADR-10 + 前端规则"对比篮以服务端为准" |
| API_CONTRACT 缺 26 个错误码 | 阶段三 R6 | 能 | AGENTS.md §7 "新增错误码必须先登记" |
| init.sql 外键/唯一数不一致 | 阶段三 R6 | 能 | 任务卡要求列出涉及表 + 验收要求数据落库期望 |
| PAGE_SPECS 与 TECH_STACK 栈冲突 | 阶段三 | 能（已登记） | AGENTS.md §1.1 冲突裁决 |
| 本机 MySQL 5.7 服务需凭据，DDL 未连库执行 | 环境 | 不能（非流程问题） | 已在 build-log 遗留项登记，交付须标注"未验证" |

---

## 3 缺口与补强

| # | 缺口 | 风险 | 补强动作 | 归属 |
|---|---|---|---|---|
| 1 | 前端缺少"进入即渲染/空态"专项检查 | 页面空白类缺陷可能复发 | 在阶段五每轮验收追加"进入页面首屏有内容"检查 | 阶段五 R7 核验 |
| 2 | 后端 DDL 未连库执行，集成测试受限 | 交付时首次连库失败 | 阶段五 R2 结束后列出全部待执行命令；R7 明确标注未验证 | 阶段五 R2/R7 |
| 3 | 无自动化规则校验（如错误码登记、表变更同步） | 依赖人工自检，可能漏项 | 阶段六引入脚本校验（错误码字典 vs 常量、init.sql 表数 vs DATA_MODEL） | 阶段六（本轮不执行） |

---

## 4 阶段四复盘（是否按用户文档阶段生成）

| 文档要求轮次 | 实际产出 | 结论 |
|---|---|---|
| R1 仓库级 AI/开发约束 | `AGENTS.md` | 符合 |
| R2 SDD 十步流程 | `docs/development/DEVELOPMENT_GUIDE.md` | 符合（十步 + 后端/前端/测试细则） |
| R3 AI 何时提问/执行/停止 | `harness/AI_DECISION_RULES.md` | 符合（三级授权 + 提问边界） |
| R4 任务模板 | `harness/TASK_TEMPLATE.md`（含验收清单与交付格式） | 符合 |
| R5 知识沉淀 | `docs/development/ADR.md`（ADR-01～12）、`harness/build-log.md` | 符合 |
| R6 Harness 自检 | 本文件 | 符合 |

**偏差说明**：文档要求"ADR 与 build-log"未指定拆分粒度，本轮采用单文件汇总 ADR（ADR-01～12），理由是避免 12 个碎片文件；如需逐条独立文件，可在阶段五拆分。

**证据**：6 个文件均已落盘；本轮未运行任何构建命令（阶段四为文档轮，无代码可编译）。

**未验证项**：Harness 的"检查"能力尚未在真实编码中检验，需在阶段五 R2 起按任务卡实际执行并回填证据。

**结论**：阶段四按文档 6 轮完成，可进入阶段五。
