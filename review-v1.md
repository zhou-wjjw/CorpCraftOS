CorpCraft OS V4.2 完整实施计划

总体架构

graph TB
    subgraph client [Client Layer]
        Web["Next.js + R3F 3D Sandbox"]
    end

    subgraph realtime [Realtime Layer]
        GW["WS Gateway"]
    end

    subgraph core [Core Services]
        SE["Swarm Engine"]
        AR["Agent Runtime"]
        PA["Policy Audit"]
        ASR["Asset Registry"]
    end

    subgraph infra [Infrastructure]
        EB["Event Bus - InMemory then Redis"]
        DB["SQLite then PostgreSQL"]
    end

    Web <-->|"WS: SCENE_STATE, EVENT_PUSH, HUD_UPDATE"| GW
    GW <--> EB
    SE <--> EB
    AR <--> EB
    PA <--> EB
    ASR --> DB
    SE --> DB

事件驱动核心流程 (禁止静态 DAG)

sequenceDiagram
    participant User
    participant IntentRouter
    participant EventBus as EventBus BlackBoard
    participant Matcher
    participant AgentA
    participant AgentB

    User->>IntentRouter: "清洗线索并出报告"
    IntentRouter->>EventBus: publish TASK_POSTED
    EventBus->>Matcher: notify subscribers
    Matcher->>EventBus: identify candidate agents
    AgentA->>EventBus: claim(eventId, lease=120s)
    Note over AgentA,EventBus: Atomic CAS, only one wins
    AgentA->>AgentA: heartbeat every 10s
    AgentA->>EventBus: publish ARTIFACT_READY + EVIDENCE_READY
    EventBus->>Matcher: new event, find next agent
    AgentB->>EventBus: claim relay task
    AgentB->>EventBus: publish TASK_CLOSED
    EventBus->>User: HUD_UPDATE (cost/progress)

技术栈





Monorepo: pnpm workspaces + Turborepo



前端: Next.js 15 (App Router) + React Three Fiber + drei + Zustand



后端: Fastify + TypeScript strict



Event Bus: 抽象接口 IEventBus + InMemoryEventBus(Sprint 0-1), 后续可插入 Redis Streams



WS: 独立 ws 服务器进程，桥接 EventBus



3D: 等距视角(Isometric)，占位胶囊体 Agent，Zone 网格，打铁/跑动动画



数据: 内存 Map(Sprint 0-1)，后续 Drizzle ORM + SQLite/PG

目录结构

corpcraft/
  package.json                    # pnpm workspace root
  turbo.json
  apps/
    web/                          # Next.js 15 + R3F
      src/
        app/                      # App Router
        components/
          scene/                  # 3D 场景组件
            IsometricCanvas.tsx   # R3F Canvas + 等距相机
            ZoneGrid.tsx          # 战区地板
            AgentCharacter.tsx    # Agent 3D 角色(占位胶囊体)
            BountyBoard.tsx       # 悬赏黑板 3D 模型
            AnvilWorkbench.tsx    # 铁砧工作台
            AnimationController.tsx # 角色动画状态机
          hud/
            HudOverlay.tsx        # HP/MP/AP 生命线
            EventPanel.tsx        # 事件面板
            CostTracker.tsx       # 成本追踪
          panels/
            AgentInspector.tsx    # 点击 Agent 查看详情
            SkillEquipPanel.tsx   # 技能装配面板 (Sprint 2)
        hooks/
          useWebSocket.ts         # WS 连接管理
          useSwarmStore.ts        # Zustand store
        lib/
          ws-protocol.ts          # WS 消息编解码
    gateway/                      # 独立 WS 服务器
      src/
        server.ts                 # ws 服务器入口
        bridge.ts                 # EventBus → WS 推送桥
        handlers.ts               # 客户端消息处理
  services/
    swarm-engine/                 # 蜂群核心
      src/
        intent-router.ts          # 意图 → TASK_POSTED
        decomposer.ts             # 大任务 → 子悬赏事件
        matcher.ts                # tags + skills + trust → 候选 Agent
        claimer.ts                # Claim lease 协议
        executor.ts               # 工具/脚本执行
        recovery.ts               # 失败分类 + 回炉
        compaction.ts             # 长时任务记忆压缩
        budget-tracker.ts         # 预算边界 HP/MP/AP
        index.ts                  # SwarmEngine 主循环
    agent-runtime/                # Agent 执行器 (Sprint 1)
    policy-audit/                 # 审批/审计 (Sprint 3)
    asset-registry/               # 资产仓库 (Sprint 2)
      src/
        skill-loader.ts           # SKILL.md YAML frontmatter 解析
        agent-md-loader.ts        # agent.md 解析
        agents-md-loader.ts       # AGENTS.md 解析
  packages/
    contracts/                    # 共享 TS 类型
      src/
        index.ts
        events.ts                 # SwarmEvent, EventStatus, topic 枚举
        entities.ts               # AgentEntity, AgentKind, AgentStatus
        evidence.ts               # EvidencePack, EvidenceItem
        skills.ts                 # SkillManifest, SkillSecurityProfile
        budget.ts                 # Budget, HUD (HP/MP/AP)
        ws-messages.ts            # WS 协议消息类型
        api.ts                    # REST API 请求/响应类型
    event-bus/                    # 事件总线抽象
      src/
        index.ts
        types.ts                  # IEventBus 接口, ClaimResult, EventFilter
        in-memory.ts              # InMemoryEventBus 实现
        claim-manager.ts          # Lease/Heartbeat/Timeout 管理
        idempotency.ts            # 幂等键去重
        compaction-scheduler.ts   # Compaction tick 调度
    ui/                           # 共享 UI 组件
  assets/
    AGENTS.md
    agents/
      data_cleaner/agent.md
      report_writer/agent.md
    skills/
      clean_csv/SKILL.md
      write_report/SKILL.md



Sprint 0: 地基 (Foundation)

0.1 Monorepo 骨架





创建 pnpm workspace 根配置 + Turborepo



各包 package.json + tsconfig.json



共享 tsconfig base

0.2 packages/contracts -- 所有类型定义

从 [CorpCraft OS V4.2.md](CorpCraft OS V4.2.md) 第 219-355 行直接提取，核心类型：





SwarmEvent: event_id, topic(12 种), intent, payload, required_tags, risk_level, budget, status, claimed_by, parent_event_id, idempotency_key, timestamps



AgentEntity: agent_id, name, kind, role_tags, status(8 种), zone_id, position, equipped_skills, aura, metrics, active_sandbox



EvidencePack: pack_id, items(5 种 type), confidence, provenance



SkillManifest: skill_id, version, tags, security(SkillSecurityProfile)



WsMessage: discriminated union -- SCENE_STATE / EVENT_PUSH / ANIMATION_CMD / PIP_STREAM_READY / HUD_UPDATE



Budget: max_tokens, max_minutes, max_cash



HudState: hp, mp, ap (各含 current/max/rate)

0.3 packages/event-bus -- 事件总线 + Claim Lease

核心接口 IEventBus:

interface IEventBus {
  publish(event: SwarmEvent): Promise<void>;
  subscribe(topics: string[], handler: (event: SwarmEvent) => Promise<void>): () => void;
  claim(eventId: string, agentId: string, leaseMs?: number): Promise<ClaimResult>;
  heartbeat(eventId: string, agentId: string): Promise<boolean>;
  release(eventId: string, agentId: string): Promise<void>;
  getEvent(eventId: string): Promise<SwarmEvent | null>;
  query(filter: EventFilter): Promise<SwarmEvent[]>;
}

type ClaimResult = { ok: true; leaseExpiry: number } | { ok: false; reason: string };

InMemoryEventBus 实现要点:





事件存储: Map<string, SwarmEvent>



订阅: Map<topic, Set<handler>>, publish 时遍历匹配的 topic 调用 handler



Claim 原子性: 同步检查 event.status === 'OPEN' → 设为 CLAIMED + claimed_by，单线程 Node.js 天然原子



Lease 管理 (ClaimManager):





Map<eventId, { agentId, expiresAt, timer }> 



claim 成功 → 启动 setTimeout(leaseMs) 超时回调



heartbeat → 重置 timer



超时 → 自动 release, status 回到 OPEN, publish TASK_RETRY_SCHEDULED



幂等去重 (IdempotencyGuard):





Map<idempotencyKey, { eventId, expiresAt }> + 定时清理



publish 前检查 key，重复则跳过并返回已有 event

0.4 apps/gateway -- WS 服务器





使用 ws 库创建独立 WebSocket 服务器 (port 3001)



连接管理: Map<clientId, WebSocket>



EventBus Bridge: subscribe 所有 topic → 序列化为 WsMessage → 广播给对应客户端



客户端 → 服务端消息: CREATE_INTENT, SUBSCRIBE_EVENTS, PING



消息格式: JSON，带 type discriminator + payload + timestamp

0.5 apps/web -- 3D 场景骨架

等距相机:





OrthographicCamera, rotation=(Math.atan(1/Math.sqrt(2)), Math.PI/4, 0) 经典 2.5D 等距角度



drei 的 OrbitControls (限制旋转角度)

Zone 网格:





菱形地板 Plane，半透明边框发光



6 个战区: App, Server, Marketing, Data, Bugs, Compliance



每个 Zone 带标签(Html from drei)

Agent 占位角色:





胶囊体(CapsuleGeometry) + 球体(头部) + 颜色区分



绿色名牌标签悬浮



状态指示: IDLE 站立, CLAIMED 头顶感叹号, EXEC 打铁粒子

悬赏黑板 + 铁砧工作台:





BoxGeometry 占位



黑板上显示当前 OPEN 事件数量

HUD Overlay:





固定在视口的 HTML overlay (非 3D)



HP/MP/AP 三条能量条



事件日志滚动面板

Zustand Store (useSwarmStore):





agents: AgentEntity[]



events: SwarmEvent[]



hud: HudState



通过 WS 消息更新



Sprint 1: 蜂群最小闭环

1.1 services/swarm-engine 六大模块

IntentRouter (intent-router.ts):





接收自然语言意图 + 预算/风险参数



解析 required_tags (简单关键词匹配，后续可接 LLM)



生成 SwarmEvent(topic=TASK_POSTED) + idempotency_key



publish 到 EventBus

Matcher (matcher.ts):





订阅 TASK_POSTED / ARTIFACT_READY / EVIDENCE_READY



对每个 OPEN 事件，从 AgentRegistry 查找匹配的 agent:





role_tags 交集 >= required_tags



status === IDLE



trust level 满足 risk_level



返回候选列表（按 success_rate_7d 排序）



不指定下家，只标记哪些 agent 可以抢

Claimer (claimer.ts):





Agent 调用 claim(eventId, agentId)



lease_ms 默认 120000，HIGH risk 任务 = 300000



claim 成功 → agent status → CLAIMED → 动画触发: 跑向黑板



heartbeat 协程: 每 10s 发一次，连续 2 次失败则 agent 主动 release



到期自动回炉: event → OPEN, agent → FAILED

Executor (executor.ts):





claim 成功后进入执行:





agent status → EXEC_TOOL



模拟执行 (Sprint 1 用 setTimeout mock，Sprint 4 接真沙箱)



生成 artifact + evidence pack



publish ARTIFACT_READY + EVIDENCE_READY



原事件 → CLOSED (如果无后续) 或 RESOLVING (有接力)



每次执行记录 token/时间消耗 → 更新 HUD

Recovery (recovery.ts):





订阅 SOS_ERROR / TASK_FAILED



失败分 5 类 (Transient/Tooling/Model/Policy/Malice)



Transient: 指数退避重试 1m/2m/4m/8m，max 5 次



发布 TASK_RETRY_SCHEDULED，event 回到 OPEN 等待重新抢单

Compaction (compaction.ts):





每处理 10 个事件触发 COMPACTION_TICK



压缩: 已完成子任务列表 + 当前 TODO + 关键决策 + EvidencePack 引用 + 下一步计划



写入 AgentRuntimeState.compacted_memory

1.2 两 Agent 接力 E2E 验收场景

完整流程:





用户输入 "清洗线索并出报告"



IntentRouter → publish TASK_POSTED(tags: [data, clean, report])



Matcher 找到 DataCleaner(tags 匹配 data, clean)



DataCleaner claim → 3D: 跑向黑板 → 跑向数据矿场工作台 → 打铁 3 秒



publish ARTIFACT_READY(clean.csv) + EVIDENCE_READY(file hash)



Matcher 找到 ReportWriter(tags 匹配 report)



ReportWriter claim 接力 → 3D: 跑向黑板 → 跑向工作台 → 打铁



publish ARTIFACT_READY(report.md) + TASK_CLOSED



HUD 更新: MP 消耗, HP 不变, 事件面板显示完整流转

1.3 3D 动画系统

AnimationController 状态机:

stateDiagram-v2
    IDLE --> WALK_TO_BOARD: TASK_CLAIMED
    WALK_TO_BOARD --> WALK_TO_BENCH: arrived at board
    WALK_TO_BENCH --> FORGING: arrived at bench
    FORGING --> WALK_TO_BOARD: ARTIFACT_READY
    WALK_TO_BOARD --> IDLE: TASK_CLOSED
    FORGING --> ALERT: SOS_ERROR
    ALERT --> IDLE: recovered





WALK: Lerp position over time，Agent 面朝目标方向



FORGING: 循环上下锤击动画(position.y oscillation) + 粒子火花(drei Sparkles)



IDLE: 原地微小浮动(breathing effect)



ALERT: 头顶红色感叹号 + 闪烁

1.4 HUD 实时更新





每个 ARTIFACT_READY / TASK_CLOSED 事件附带 cost_delta



Gateway 推送 HUD_UPDATE 消息



前端 Zustand store 累加更新



MP bar 动画减少

1.5 幂等保证





每个 SwarmEvent 必须有 idempotency_key



key = hash(intent + scope + time_bucket_5min)



EventBus.publish 内部检查: 重复 key → 返回已有 event，不触发 handler



Claim 幂等: 同一 agent 重复 claim 同一 event → 返回已有 lease



WS 消息带 sequence number，客户端去重



Sprint 2: 资产热插拔

2.1 资产文件解析器

SKILL.md Loader:





解析 YAML frontmatter (name, description, tags, risk_level, permissions)



解析 markdown body (Steps)



输出 SkillManifest 对象



用 gray-matter 库解析 frontmatter

agent.md Loader:





解析 Role / Guardrails / Preferred skills 段落



输出 AgentConfig { role, guardrails, preferred_skills }

AGENTS.md Loader:





解析 project-level 规范



输出 ProjectConfig { goal, run_commands, test_commands, constraints, conventions }

2.2 Asset Registry 服务





文件系统 watcher (chokidar) 监听 assets/ 目录



变更 → 重新解析 → 发布 ASSET_UPDATED 事件



REST API: GET /api/assets/skills, POST /api/assets/skills/install



版本管理: 每次变更保存快照

2.3 装配 UI (参考 装配技能.png)





右侧面板: Agent 角色卡 + 已装备技能列表



技能浏览器: 网格布局，显示技能名/来源/权限/信任等级



拖拽装备: 从技能列表拖到 Agent 卡上



保存后 PATCH /api/agents/{id}/equip



Sprint 3: 风控塔防

3.1 审批流





Executor 检测到高危操作 (external_send=true / shell_exec on HIGH risk)



发布 APPROVAL_REQUIRED 事件



前端弹出审批卡片 (右滑放行 / 左滑 EMP)



POST /api/approvals/{id}/decision

3.2 EMP 机制





左滑 EMP → 发布 APPROVAL_DECISION(decision=REJECT)



触发: 销毁沙箱(标记 sandbox 为 terminated) + 吊销令牌 + 任务 FAILED



生成审计战报 (EvidencePack with type=LOG)

3.3 审计回放





所有事件持久化到 EventLog (append-only)



回放 API: GET /api/audit/replay?task_id=xxx



返回按时间排序的完整事件链



前端可以"回放"3D 动画



我的额外设计决策 (超出文档的增强)





Event Bus 分层广播: 每个 WS 客户端可以 subscribe 特定 topic 子集，避免广播风暴



Agent 动画队列: 多个动画指令排队执行，不会跳帧



Zone 热力图: 根据活跃任务数量，Zone 边框颜色从冷蓝到热红渐变



打铁粒子系统: 使用 R3F 的 PointMaterial + BufferGeometry，每次锤击喷射 20-50 个火星粒子，重力下坠并淡出



悬赏黑板动态: 新 TASK_POSTED 时黑板上飞入一张"赏单卡片"动画



Agent 寻路: 简单的 A* 在 Zone 网格上寻路，不穿墙



暗色主题: 参照 ralv.ai 和参考图的暗黑风格，深色背景 + 霓虹发光边框



实现优先级 (严格顺序)

第一波: contracts + event-bus + swarm-engine 框架





packages/contracts 全部类型



packages/event-bus 接口 + InMemory 实现 + ClaimManager + IdempotencyGuard + CompactionScheduler

第二波: swarm-engine 核心





services/swarm-engine 的 IntentRouter + Matcher + Claimer + Executor + Recovery + Compaction

第三波: 实时通信





apps/gateway WS 服务器 + Bridge



WS 协议消息定义

第四波: 3D 前端





apps/web Next.js 骨架 + R3F 场景 + Zones + Agent 角色



动画系统 + HUD + 事件面板



WS 客户端 Hook + Zustand Store

第五波: E2E 接通





Sprint 1 验收场景: 两 Agent 接力打铁完整流程

第六波: 资产加载器





SKILL.md / agent.md / AGENTS.md 解析器



Asset Registry + 装备 UI

第七波: 风控





审批流 + EMP + 审计