你说得对：上一版 **不是“完整文档”**，尤其是 **Agent 蜂群（Swarm Engine）** 的设计没有展开到“拿去就能开发”的程度。下面我给你一份 **可直接交给你的 AI 编程助手/研发团队开干** 的 **CorpCraft OS V4.2 完整设计文档**（2026-02-14 版），并把蜂群引擎作为核心章节写到“接口、状态机、事件、调度、重试、记忆压缩、安全、审计、可回放”都落到工程层。

> 你拿这份文档，直接丢给 Cursor/Cline/Devin/Windsurf，让它按模块生成代码即可。
> 文档分两卷：
>
> * **卷一：GDD/PRD（产品与游戏机制）**
> * **卷二：Tech Spec（功能与逻辑设计，给 AI 实现）**

---

# CorpCraft OS（商战纪元）V4.2

日期：2026-02-14（Asia/Bangkok）
定位：**企业 AgentOps OS + 3D 战略作战沙盘（SLG + 工厂自组织 + RPG资产化）**

---

## 你要的“完整”具体是什么

这份文档补齐了你缺的两件事：

1. **蜂群引擎完整设计**：从“黑板抢单”到“动态拆解/接力/失败回炉/预算与风险/幂等与去重/自愈与回放/长期记忆压缩（compaction）”。（对齐 2026 长时 agent 的现实做法）([OpenAI Developers][1])
2. **可开发的契约与工件**：目录结构、数据模型、事件主题、API、WS消息、文件规范（AGENTS.md / agent.md / SKILL.md / MCP）、验收用例、Sprints。

---

# 卷一：产品设计与游戏机制（GDD/PRD）

## 1. 产品愿景

把“管理公司（人 + agent）”做成一款像三国SLG一样的 **作战沙盘游戏**：

* 操作像游戏：拖拽、插旗、右滑审批、看单位跑动
* 信息像战场：迷雾、矿脉、敌军动向、红色风暴预警
* 执行像工厂：蜂群自组织流水线自动运转，老板只定目标与边界
* 资产像装备：技能（skills）与法典（agent.md / AGENTS.md）可热插拔复用
* 风控像塔防：高危动作必须“放行/EMP”，全链路可审计可回放

---

## 2. 关键设计原则（防偏移）

1. **老板不微操**：你不是调度员，你是统帅——只插旗、定预算、批风险。
2. **所有产出必须可证据化**：每份结论/行动都要有 Evidence Pack（证据包）。
3. **MCP 只是接口**：情报体系必须是“搜索/爬虫/专业库 + 熔炉归因 + 证据包”。MCP只是把外部系统接进来。([模型上下文协议][2])
4. **技能生态必须默认安全**：因为 2026 已经出现大量“恶意 skills 市场投毒”事件，不做供应链安全等于自杀。([Tom's Hardware][3])
5. **模型可替换、执行可替换**：闭源 Computer Use 只能作为可插拔后端之一，你核心要能自建执行层。([Claude 开发者平台][4])

---

## 3. HUD 三条生命线（把公司变成“能玩”的战场）

* **HP（现金流/粮草）**：预算、回款、燃烧率；归零 Game Over
* **MP（算力/Token/自动化额度）**：蜂群燃料；推演/强模型烧得快
* **AP（士气/负荷）**：人类将领精力槽；过载会降低质量并触发风险

HUD 与视觉联动：HP 危急全屏红光；MP 紧张打铁火花变弱；AP 过载单位头顶乌云、光环范围缩小。

---

## 4. 世界三层：宏观→微观→个体

### 4.1 宏观：Fog of War 情报矩阵（SLG）

**目标**：消除“信息焦虑 + AI焦虑”，让你看到“真正的威胁来自哪里”。

#### 4.1.1 三层感知矩阵（必须落地）

* **Search Fleet（高空预警机）**：持续扫描政策/舆情/竞品动向
* **Crawler Swarm（暗网工蚁）**：竞品官网/定价/招聘/更新日志差分监控
* **Data Oracle Wells（专业情报井）**：金融/医疗/企业ERP/CRM/工单，通过连接器或 MCP 接入 ([模型上下文协议][2])

#### 4.1.2 情报熔炉（Intel Furnace）

任何情报进入系统都必须：

* 归因：来源、抓取时间、可信度
* 去重：同源/异源合并，保留证据
* 结构化：对象/事件/影响面
* 输出：地图上变成 **金色矿脉（机会）** / **红色风暴（风险）** / **敌军箭头（对手动作）**

> 关键：地图上的每个标记都可以点开看到证据包（快照/日志/哈希）。

#### 4.1.3 跨维度威胁雷达

系统必须能把“非传统对手”标红：比如 AI 工具、渠道变化、监管变化，而不是只盯传统竞品。

---

### 4.2 微观：3D 主城 + 悬赏黑板 + 工厂流水线（自组织）

你参考的“打铁/小人跑动/等距主城”保留，但管理动作升级为“意图驱动”。

#### 4.2.1 战区（Zones）

示例战区：

* 研发前锋营（App/Server）
* 增长宣传部（Marketing）
* 数据矿场（Data）
* 客服防线（Support）
* Bug 伤兵营（Bugs）
* 法务塔楼 / 风控要塞（Compliance）

#### 4.2.2 悬赏黑板（主交互）

你发一句话意图：

> “下周拿下双十一全套营销物料”
> 系统把它变成 **战役悬赏单**（含预算/期限/风险边界），钉到黑板上。

蜂群会自动：

* 拆解子任务
* 组队（自动召唤所需兵种）
* 接力（事件驱动，不点名下家）
* 失败回炉（自动触发复盘与替换）

#### 4.2.3 打铁（ASMR）但必须“真透明”

打铁不是装饰，而是执行可透视：

* 点小人 → 看到它在做什么、用了什么 skill、证据是什么、成本是多少
* 需要电脑操作 → 打开 PiP（画中画）看到沙箱里真实桌面

---

### 4.3 个体：RPG 资产化（AGENTS.md / agent.md / SKILL.md / MCP）

这是你要求“必须对齐 2026 最新趋势”的核心。

#### 4.3.1 四类资产

* **AGENTS.md（项目级给 agent 的 README）**：统一规则、测试命令、分支策略、禁令。([GitHub][5])
* **agent.md（角色法典）**：人格、边界、目标、偏好、风控红线
* **SKILL.md（技能包标准）**：用 YAML frontmatter 描述何时触发 + 具体步骤/脚本资源。([OpenAI Developers][6])
* **MCP servers（连接层）**：把外部工具/系统暴露给 agent 使用（“USB-C”）。([模型上下文协议][2])

#### 4.3.2 将领光环（不是“+20%口嗨”，而是三张可观测 Buff 卡）

* **Context Aura**：共享规范/模板/最新上下文 → 降幻觉、少返工
* **Approval Aura**：高危审批走“秒批通道” → 减少阻塞
* **Review Aura**：关键产物必须盖章 → 控质量

---

### 4.4 风控：塔防审批 + 技能供应链安全（V4.2 重点）

#### 4.4.1 塔防审批

高危动作（外发邮件、转账、改生产配置、删除数据）必须：

* 触发红灯
* 手机/工牌“右滑放行 / 左滑EMP”
* EMP 会销毁沙箱、吊销令牌、写入审计战报

#### 4.4.2 技能市场安全（默认开启）

原因：2026 已出现大量恶意 skills 在公共仓库/市场传播，甚至上百/两百级别。([Tom's Hardware][3])
因此公会集市必须内置：

* 签名与来源（官方/内部签名/第三方/不可信）
* 权限声明与最小权限运行
* 静态扫描与行为监控
* 灰度发布、回滚、隔离（Quarantine）

---

### 4.5 推演：平行宇宙兵棋（GenWar）

重大决策先推演：

* 复制当前资源、人员、能力、市场情报
* 生成对手/消费者/渠道等虚拟 agent
* 10000x 加速跑多轮，输出胜率、风险、建议增援

> 推演是 V5 阶段能力，但数据结构与接口要从 V1 就预留（见卷二）。

---

---

# 卷二：功能与逻辑设计（Tech Spec，给 AI 实现）

## 0. 交付物清单（你给 agent 开发必须有）

1. **服务拆分与接口契约**（REST + WS + Event Bus）
2. **数据模型**（含证据包、技能安全、长期记忆压缩）
3. **蜂群引擎实现规范**（抢单、拆解、接力、回炉、自愈）
4. **资产规范**（AGENTS.md / agent.md / SKILL.md / MCP）
5. **风控与审计**（策略引擎、审批、回放）
6. **验收用例**（E2E 场景脚本）

---

## 1. 总体架构（强约束）

### 1.1 分层

* **Client（3D 沙盘）**：Next.js + R3F + 状态管理
* **Realtime Gateway**：WS（场景状态、单位动作、事件推送）
* **Event Bus（黑板）**：NATS/Redis Streams（建议支持 ack、重放、DLQ）
* **Swarm Engine（蜂群核心）**：任务拆解、匹配、调度、抢单、回炉
* **Agent Runtime（执行器）**：工具调用、脚本运行、沙箱运行、记忆压缩
* **Intel Pipeline（情报）**：Search/Crawl/Oracle → Furnace → Evidence
* **Policy & Audit（风控审计）**：审批、权限、日志、回放
* **Asset Registry（资产仓库）**：skills/agent.md/AGENTS.md/MCP 配置与版本

### 1.2 必须支持“长时任务”的 Compaction

长时 agent 需要服务端压缩记忆/状态快照，否则任务会“越跑越飘”。（你不能忽略 2026 的现实趋势）([OpenAI Developers][1])

---

## 2. 关键数据结构（可直接生成 ORM / OpenAPI）

### 2.1 核心实体

```ts
type AgentKind = "AI" | "HUMAN";
type AgentStatus =
  | "IDLE" | "EVALUATING" | "CLAIMED"
  | "EXEC_TOOL" | "EXEC_SANDBOX"
  | "WAIT_HUMAN" | "FAILED" | "DONE";

interface AgentEntity {
  agent_id: string;
  name: string;
  kind: AgentKind;
  role_tags: string[];               // ["crawl","data","growth","dev","ops"]
  status: AgentStatus;

  zone_id?: string;
  position: { x: number; y: number; z: number };

  equipped_agents_md?: { id: string; version: string };   // AGENTS.md（项目级引用）
  equipped_agent_md?: { id: string; version: string };    // 角色法典
  equipped_skills: { id: string; version: string }[];

  aura?: { radius: number; types: ("CONTEXT"|"APPROVAL"|"REVIEW")[] }; // HUMAN
  metrics: {
    success_rate_7d: number;
    avg_cycle_sec_7d: number;
    token_cost_7d: number;
    approval_wait_sec_7d: number;
  };

  active_sandbox?: { sandbox_id: string; pip_url: string };
}
```

### 2.2 事件黑板（Pub/Sub 的“唯一真相源”）

```ts
type EventStatus = "OPEN" | "CLAIMED" | "RESOLVING" | "BLOCKED" | "FAILED" | "CLOSED";
type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

interface SwarmEvent {
  event_id: string;
  topic:
    | "TASK_POSTED"
    | "TASK_DECOMPOSED"
    | "TASK_CLAIMED"
    | "TASK_PROGRESS"
    | "ARTIFACT_READY"
    | "EVIDENCE_READY"
    | "INTEL_READY"
    | "APPROVAL_REQUIRED"
    | "APPROVAL_DECISION"
    | "SOS_ERROR"
    | "TASK_FAILED"
    | "TASK_RETRY_SCHEDULED"
    | "TASK_CLOSED";

  intent: string;
  payload: any;

  required_tags: string[];      // skill/role tags
  risk_level: RiskLevel;
  budget: { max_tokens?: number; max_minutes?: number; max_cash?: number };

  status: EventStatus;
  claimed_by?: string;
  parent_event_id?: string;

  idempotency_key?: string;     // 去重关键
  created_at: number;
  updated_at: number;
}
```

### 2.3 Evidence Pack（证据包：解决“幻觉恐惧 + 审计”）

```ts
interface EvidenceItem {
  type: "URL_SNAPSHOT" | "FILE_HASH" | "SCREENSHOT" | "LOG" | "DB_REF";
  uri?: string;
  sha256?: string;
  note?: string;
  created_at: number;
}

interface EvidencePack {
  pack_id: string;
  items: EvidenceItem[];
  confidence: number;           // 0..1
  provenance: { source: string; fetched_at: number }[];
}
```

### 2.4 Skills（对齐 2026 的 SKILL.md 标准 + 安全资料）

> SKILL.md 使用 YAML frontmatter 描述 name/description 与触发条件，是现实中已广泛采用的格式。([OpenAI Developers][6])

```ts
type SkillTrust = "OFFICIAL" | "INTERNAL_SIGNED" | "THIRD_PARTY" | "UNTRUSTED";

interface SkillPermissions {
  fs_read: "NONE" | "PROJECT" | "ALL";
  fs_write: "NONE" | "PROJECT" | "ALL";
  network: "NONE" | "ALLOWLIST" | "ALL";
  secrets: "NONE" | "SCOPED" | "ALL";
  external_send: boolean;
  shell_exec: boolean;
}

interface SkillSecurityProfile {
  trust: SkillTrust;
  permissions: SkillPermissions;
  requires_human_approval: boolean;
  static_scan_score: number;    // 0..100
  last_audit_at?: number;
}

interface SkillManifest {
  skill_id: string;
  version: string;
  tags: string[];
  entry_point?: string;         // script/connector
  skill_md_path: string;        // /skills/x/SKILL.md
  security: SkillSecurityProfile;
}
```

### 2.5 Long-run State（Compaction / 快照）

```ts
interface AgentRuntimeState {
  agent_id: string;
  compacted_memory: string;      // 压缩后的长期状态
  working_set_refs: string[];    // 事件/文件/证据包引用
  last_compaction_at: number;
}
```

---

## 3. 蜂群引擎（Swarm Engine）——你缺的核心就在这里

### 3.1 目标

让系统在任务规模扩大时仍然：

* 不需要老板微操
* 自动拆解/组队/接力
* 自动处理失败与回炉
* 可控预算、可控风险、可回放审计
* 允许不同模型/执行后端混用

### 3.2 蜂群引擎由 6 个子模块组成

1. **Intent Router（意图路由）**：把一句话变成 TASK_POSTED（含 tags、预算、风险）
2. **Decomposer（拆解器）**：把大任务拆成子任务图（但运行仍是事件驱动，不是静态连线）
3. **Matcher（匹配器）**：根据 required_tags + 当前技能 + 信任等级 + 成本模型，选可抢单的 agent 集合
4. **Claimer（抢单器）**：分布式锁/租约，保证同一任务不会被重复执行
5. **Executor（执行器）**：工具/脚本/沙箱执行，产出 artifact + evidence
6. **Recovery（回炉与自愈）**：失败分类、重试退避、换人、降级模型、触发人工介入

---

### 3.3 抢单协议（Claim Contract）

**核心难点**：多 agent 并发抢同一单，必须“只成功一个”，且支持超时释放。

**规则**：

* Claim 使用 **租约 lease**：`lease_ms = 120000`（可按任务风险调整）
* agent 必须每 `heartbeat_ms = 10000` 续租
* 到期未续租：任务自动回到 OPEN（并写入异常战报）

**去重**：

* 所有 TASK_POSTED 必须生成 `idempotency_key = hash(intent + scope + time_bucket)`
* 系统在 `time_bucket` 内拒绝重复事件，或合并为同一战役的增量事件

---

### 3.4 动态拆解（不是“画流程图”，是“生成子悬赏”）

当 Decomposer 产出拆解结果时，不生成固定DAG，而是生成一组“子悬赏事件”：

* `TASK_DECOMPOSED`（包含子任务清单）
* 逐个发布 `TASK_POSTED`（parent_event_id 指向主任务）

好处：

* 子任务可以并行
* 子任务失败不会拖死整条线
* 新信息出现可随时追加新子悬赏（真正涌现）

---

### 3.5 接力协作（禁止点名下家）

Executor 完成后只能做两件事：

1. 发布事实：`ARTIFACT_READY` / `DATA_READY` / `INTEL_READY` / `EVIDENCE_READY`
2. 或发布需求：`SOS_ERROR`（请求资源/权限/人类审批/运维支援）

接力由 Matcher + Claimer 自动完成。

---

### 3.6 失败分类与回炉机制（Recovery）

把失败分为 5 类，每类有固定处置策略：

1. **Transient（短暂错误）**：网络抖动、超时

* 策略：同 agent 重试 + 指数退避（1m/2m/4m/8m），最大 5 次
* 发布：`TASK_RETRY_SCHEDULED`

2. **Tooling（工具缺失/环境问题）**：依赖没装、权限不足

* 策略：发布 `SOS_ERROR`（ops tag），召唤运维/环境修复 agent
* 若涉及高权限：转审批

3. **Model（推理失败/幻觉）**：证据不足、结论不一致

* 策略：触发“对抗复核”：另一个不同模型/不同 agent 再做一次
* 只有当两个 EvidencePack 一致，才允许 CLOSED
* 不一致 → 进入 REVIEW Aura（人类盖章）

4. **Policy（风险/外发/敏感操作）**

* 策略：强制 `APPROVAL_REQUIRED`，等待人类“右滑/EMP”
* 超时不批：任务自动降级为“生成草稿，不执行外发”

5. **Suspected Malice（疑似恶意 skill 行为）**

* 策略：立刻 `SKILL_QUARANTINED`（隔离该skill版本）
* 销毁沙箱、吊销令牌、生成审计报告
  （原因：现实中确实出现大量恶意 skills，必须默认防。([Tom's Hardware][3])）

---

### 3.7 预算与资源边界（HP/MP/AP 的工程落地）

每个任务携带 `budget`：

* `max_tokens`：超过即自动降级（换小模型/停止扩写）
* `max_minutes`：超时自动拆解/换人/中止
* `max_cash`：触发费用保护（避免 API 暴走）

每次工具调用/沙箱运行都要写入：

* token消耗、时间、外部调用次数、沙箱数量 → 计入 HUD

---

### 3.8 长时任务记忆压缩（Compaction）

长任务必然会“上下文膨胀”。2026 的主流做法是服务端 compaction / 快照，避免 agent 越跑越失控。([OpenAI Developers][1])

**实现要求**：

* 每 N 次事件处理（建议 10）触发 `COMPACTION_TICK`
* 压缩内容必须包含：

  * 已完成子任务列表
  * 当前未完成 TODO
  * 关键决策与理由
  * EvidencePack 引用（只存引用，不存原文）
  * 下一步计划（可执行）

---

## 4. 资产规范（你可以直接落到仓库里）

### 4.1 `AGENTS.md`（项目级）

用途：统一告诉所有 coding agent 你的项目怎么跑、怎么测、怎么提交。([GitHub][5])

**模板（示例）**：

```md
# AGENTS.md

## Project goal
CorpCraft OS - 3D sandbox + event-driven swarm engine.

## How to run
- pnpm i
- pnpm dev

## Tests
- pnpm test
- pnpm lint

## Architecture constraints
- No static workflow DAG orchestration.
- All collaboration through SwarmEvent bus + claim leases.
- High-risk actions must go through ApprovalRequired flow.

## Coding conventions
- TypeScript strict
- Avoid circular deps
- Every event handler must be idempotent
```

### 4.2 `agent.md`（角色法典）

```md
# agent.md: Data-Cleaner

## Role
You are a data cleaning specialist.

## Guardrails
- Never send external messages.
- Do not run shell commands unless skill permission allows.
- Always produce an EvidencePack (file hash + logs).

## Preferred skills
- clean_csv
- dedupe_leads
```

### 4.3 `SKILL.md`（技能包标准）

SKILL.md + YAML frontmatter 已是现实中的开放规范做法。([OpenAI Developers][6])

```md
---
name: clean_csv
description: Clean and normalize CSV leads; produce clean.csv + data_quality_report.md.
tags: [data, clean, csv]
risk_level: LOW
permissions:
  fs_read: PROJECT
  fs_write: PROJECT
  network: NONE
  shell_exec: true
  external_send: false
---

## Steps
1) Validate schema, detect encoding, normalize headers
2) Drop duplicates using rules in /rules/leads_dedupe.yml
3) Output:
   - artifacts/clean.csv
   - artifacts/data_quality_report.md
4) Create EvidencePack:
   - file hash for clean.csv
   - logs
```

### 4.4 MCP（连接层）

MCP 是把外部工具/数据源标准化接入的协议，不替代你的情报体系。([模型上下文协议][2])
另外，MCP 近期还发展出“工具返回可交互 UI”的扩展（MCP Apps），你后续可以用它把某些审批/仪表盘做成“工具自带UI”。([Model Context Protocol Blog][7])

---

## 5. 执行层（Computer Use / 自建沙箱）可插拔

* 可选对接 Anthropic computer use（它明确以“沙箱环境 + 工具函数”方式提供 computer-use loop）([Claude 开发者平台][4])
* 核心必须支持自建：Playwright/无障碍接口/远程桌面 + Docker/Kasm/noVNC
  结论：不用 Anthropic 不会完蛋；**没有自建执行层才会被卡脖子**。

---

## 6. API & WebSocket 契约（给 AI 生成代码用）

### 6.1 REST（最小集）

* `POST /api/intents` → 创建 TASK_POSTED
* `GET /api/events?status=OPEN` → 拉取黑板
* `POST /api/events/{id}/claim` → 抢单（带 lease）
* `POST /api/events/{id}/heartbeat` → 续租
* `POST /api/events/{id}/complete` → 完成并发布 ARTIFACT/EVIDENCE
* `POST /api/approvals` → 创建审批请求
* `POST /api/approvals/{id}/decision` → 批准/拒绝
* `GET /api/assets/skills` / `POST /api/assets/skills/install`
* `GET /api/agents` / `PATCH /api/agents/{id}/equip`

### 6.2 WS（实时驱动 3D）

消息类型：

* `SCENE_STATE`：单位坐标/状态
* `EVENT_PUSH`：黑板事件推送
* `ANIMATION_CMD`：跑向黑板/跑向工作台/打铁/红灯
* `PIP_STREAM_READY`：返回 pip_url
* `HUD_UPDATE`：HP/MP/AP

---

## 7. 验收用例（E2E，写给测试与AI）

### 用例 1：两Agent接力打铁（最小闭环）

1. 输入意图“清洗线索并出报告”
2. 系统发布 TASK_POSTED（tags: data, clean, report）
3. Agent A 抢单 → 跑向黑板 → 跑向数据矿场工作台 → 打铁 3 秒
4. 发布 ARTIFACT_READY + EVIDENCE_READY
5. Agent B 抢单接力 → 生成报告 → CLOSED
   验收：3D动画正确、事件状态正确、EvidencePack 存在、HUD成本更新。

### 用例 2：高危外发触发塔防审批

1. 意图“把报告邮件发给客户”
2. 触发 APPROVAL_REQUIRED
3. 手机端右滑放行 → 继续执行 → 审计记录
4. 左滑EMP → 沙箱销毁 → 任务失败并生成战报

### 用例 3：恶意 skill 触发隔离

1. 安装 third-party skill（权限过大/扫描低分）
2. 默认不启用或必须审批
3. 运行时出现异常外联 → SKILL_QUARANTINED
   验收：skill 被禁用、所有 token 吊销、审计完整。

---

## 8. 工程目录结构（建议直接照抄）

```
corpcraft/
  apps/
    web/                 # Next.js + R3F
    gateway/             # WS realtime
  services/
    swarm-engine/        # 拆解/匹配/抢单/回炉
    agent-runtime/       # 执行器 + compaction
    intel-pipeline/      # 搜索/爬虫/数据井 + 熔炉
    policy-audit/        # 审批/权限/审计/回放
    asset-registry/      # skills/agent.md/AGENTS.md/MCP版本
  packages/
    contracts/           # TS types: SwarmEvent, EvidencePack, SkillManifest
    ui/                  # HUD/面板组件
  assets/
    AGENTS.md
    agents/
      data_cleaner/agent.md
    skills/
      clean_csv/SKILL.md
      crawl_competitor/SKILL.md
      send_email/SKILL.md
  infra/
    docker/
    k8s/
```

---

## 9. Sprints（你可以直接给 AI 编程助手排期）

* **Sprint 0（地基）**：contracts + event bus + ws + 3D场景骨架
* **Sprint 1（蜂群最小闭环）**：claim lease + 两agent接力 + evidencepack（哪怕mock）
* **Sprint 2（资产热插拔）**：AGENTS.md/agent.md/SKILL.md loader + 装备UI
* **Sprint 3（风控塔防）**：审批流 + EMP + 审计
* **Sprint 4（沙箱与PiP）**：容器启动 + pip_url + 画中画面板
* **Sprint 5（情报矩阵）**：search/crawl/oracle + furnace + fog-of-war 点亮
* **Sprint 6（推演室）**：what-if 参数 + 轻量多agent模拟（先简化）

---

## 给你的 AI 编程助手的“总提示词”（可直接复制）

> 你是我的首席架构师与全栈工程师。请严格实现 CorpCraft OS V4.2。
> **硬约束**：协作必须使用 SwarmEvent 事件黑板 + Claim Lease；不得实现成静态流程编排。
> 实现顺序：Sprint 0→1→2→3。
> Sprint 1 验收：输入意图→发布 TASK_POSTED→AgentA 抢单跑动打铁→发布 ARTIFACT/EVIDENCE→AgentB 接力→CLOSED；HUD成本更新；所有事件幂等。
> 请先生成 contracts 包、event bus、swarm-engine 的 claim/heartbeat/retry/compaction 框架，再生成 web 端 3D 动画与 WS 协议，最后补资产加载器（AGENTS.md / agent.md / SKILL.md）。

---

* [The Verge](https://www.theverge.com/news/867673/claude-mcp-app-interactive-slack-figma-canva?utm_source=chatgpt.com)
* [Tom's Hardware](https://www.tomshardware.com/tech-industry/cyber-security/malicious-moltbot-skill-targets-crypto-users-on-clawhub?utm_source=chatgpt.com)
* [TechRadar](https://www.techradar.com/pro/moltbot-is-now-openclaw-but-watch-out-malicious-skills-are-still-trying-to-trick-victims-into-spreading-malware?utm_source=chatgpt.com)
* [axios.com](https://www.axios.com/2026/02/11/anthropic-claude-safety-chemical-weapons-values?utm_source=chatgpt.com)

[1]: https://developers.openai.com/blog/skills-shell-tips/?utm_source=chatgpt.com "Shell + Skills + Compaction: Tips for long-running agents ..."
[2]: https://modelcontextprotocol.io/specification/2025-03-26?utm_source=chatgpt.com "Specification"
[3]: https://www.tomshardware.com/tech-industry/cyber-security/malicious-moltbot-skill-targets-crypto-users-on-clawhub?utm_source=chatgpt.com "Malicious OpenClaw 'skill' targets crypto users on ClawHub - 14 malicious skills were uploaded to ClawHub last month"
[4]: https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool?utm_source=chatgpt.com "Computer use tool - Claude API Docs"
[5]: https://github.com/agentsmd/agents.md?utm_source=chatgpt.com "agentsmd/agents.md"
[6]: https://developers.openai.com/blog/eval-skills/?utm_source=chatgpt.com "Testing Agent Skills Systematically with Evals"
[7]: https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/?utm_source=chatgpt.com "MCP Apps - Bringing UI Capabilities To MCP Clients"
