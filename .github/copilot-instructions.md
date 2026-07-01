# BobSystem — 整体解决方案设计文档

> 最后更新：2026-05-28
> 核心功能：用户上传体检报告（PDF）→ AI智能解读 → C端展示分析结果与建议

---

## 一、项目背景与目标

### 核心流程
```
B端管理员/用户上传PDF体检报告
        ↓
系统存储PDF + 解析提取结构化指标数据
        ↓
C端用户授权 → 触发AI分析
        ↓
AI逐项解读指标、给出风险评估与健康建议
        ↓
C端展示（参考 screen.png 效果）
```

### 两端定义
- **B端（管理后台）**：供运营人员管理用户、查看报告、配置系统参数
- **C端（用户侧）**：供普通用户授权查看自己的报告、触发AI分析、查看健康建议（微信小程序 / H5）

---

## 二、技术选型方案

### 2.1 前端技术

#### B端管理后台（选一）

| 方案 | 技术栈 | 推荐指数 | 说明 |
|------|--------|----------|------|
| **方案A（推荐）** | Vue 3 + Vite + Element Plus | ⭐⭐⭐⭐⭐ | 生态成熟，前端友好，上手快 |
| 方案B | React + Vite + Ant Design Pro | ⭐⭐⭐⭐ | 生态更大，但学习曲线稍陡 |
| 方案C | Nuxt 3 + Element Plus | ⭐⭐⭐ | SSR支持好，但B端不需要SSR |

**推荐：方案A（Vue 3 + Element Plus）**，因为你是前端开发，Vue 上手更快，Element Plus 有现成的表格、上传组件等。

#### C端用户侧（选一）

| 方案 | 技术栈 | 推荐指数 | 说明 |
|------|--------|----------|------|
| **方案A（推荐）** | uni-app + Vue 3 | ⭐⭐⭐⭐⭐ | 一套代码同时编译为微信小程序+H5，前端友好 |
| 方案B | Taro + React | ⭐⭐⭐⭐ | 同样跨端，但用React语法 |
| 方案C | 原生微信小程序 | ⭐⭐⭐ | 只能在微信内运行，无法同时做H5 |
| 方案D | 纯H5（Vue 3） | ⭐⭐⭐ | 可嵌入微信公众号，但体验不如小程序 |

**推荐：方案A（uni-app + Vue 3）**，最大化复用代码，同时覆盖小程序和H5两个场景。

---

### 2.2 后端技术（选一）

> 你有前端基础，推荐用 TypeScript/Node.js 系的框架，语法最熟悉

| 方案 | 技术栈 | 推荐指数 | 说明 |
|------|--------|----------|------|
| **方案A（推荐）** | NestJS + TypeScript | ⭐⭐⭐⭐⭐ | TypeScript全栈、模块化清晰、有完整的装饰器/依赖注入体系，生产级首选 |
| 方案B | Express + TypeScript | ⭐⭐⭐⭐ | 轻量灵活，但需要自己组织架构 |
| 方案C | FastAPI（Python） | ⭐⭐⭐⭐ | AI集成最方便（Python生态），但你需要学Python |
| 方案D | NestJS + Python AI微服务 | ⭐⭐⭐⭐⭐ | NestJS做业务，Python独立服务做AI解析，最佳实践 |

**推荐：方案A（NestJS）或方案D（NestJS + Python AI微服务）**
- 如果预算和时间有限：选方案A，NestJS内直接调用AI API
- 如果未来AI功能复杂（自定义模型、批量处理）：选方案D，AI单独成服务

---

### 2.3 数据库（选一）

| 方案 | 数据库 | 推荐指数 | 说明 |
|------|--------|----------|------|
| **方案A（推荐）** | PostgreSQL | ⭐⭐⭐⭐⭐ | 功能强大、支持JSON字段、开源免费、医疗数据安全性高 |
| 方案B | MySQL | ⭐⭐⭐⭐ | 国内使用最广、运维经验丰富 |
| 方案C | MongoDB | ⭐⭐⭐ | 灵活存储非结构化数据，但关联查询弱 |
| 方案D | PostgreSQL + Redis | ⭐⭐⭐⭐⭐ | PostgreSQL存业务数据，Redis做缓存/Session/队列 |

**推荐：方案D（PostgreSQL + Redis）**，Redis用于缓存AI分析结果（同一份报告不重复分析）和用户Session管理。

ORM推荐：**Prisma**（TypeScript友好，Schema自动生成类型，迁移管理简单）

---

### 2.4 文件存储（选一）

| 方案 | 服务 | 推荐指数 | 说明 |
|------|------|----------|------|
| **方案A（推荐，国内）** | 阿里云OSS / 腾讯云COS | ⭐⭐⭐⭐⭐ | 国内速度快、价格便宜、有SDK |
| 方案B | AWS S3 | ⭐⭐⭐⭐ | 国际标准，但国内访问慢 |
| 方案C | MinIO（自建） | ⭐⭐⭐ | 完全自控，但需要自己运维 |

**推荐：阿里云OSS 或 腾讯云COS**（根据你已有的云服务账号选择），PDF文件上传后存储到OSS，数据库只存文件URL。

---

### 2.5 AI分析服务（选一）

| 方案 | 服务 | 推荐指数 | 说明 |
|------|------|----------|------|
| **方案A（推荐）** | OpenAI GPT-4o | ⭐⭐⭐⭐⭐ | 分析能力最强，支持PDF文件直传（Assistants API） |
| 方案B | Claude 3.5 Sonnet（Anthropic） | ⭐⭐⭐⭐⭐ | 长文本理解极好，适合报告解读 |
| 方案C | 阿里云通义千问 | ⭐⭐⭐⭐ | 国内合规，有医疗垂直模型，无需翻墙 |
| 方案D | 百度文心一言 | ⭐⭐⭐ | 国内合规，但效果稍弱 |
| 方案E | DeepSeek API | ⭐⭐⭐⭐ | 价格极低，中文理解好，国内可用 |

**推荐：**
- 国内合规优先 → **通义千问 或 DeepSeek**
- 效果优先 → **GPT-4o 或 Claude 3.5**
- 可以先用DeepSeek快速验证，后期切换GPT-4o

**PDF解析方案（必须）：**
- `pdf-parse`（Node.js）：提取纯文本，简单但对复杂布局支持差
- `pdfplumber`（Python）：提取表格和文本，效果最好
- **OpenAI Assistants API / Claude**：直接上传PDF，让AI自己解析，最省事

---

### 2.6 部署方案（选一）

| 方案 | 技术 | 推荐指数 | 说明 |
|------|------|----------|------|
| **方案A（推荐，初期）** | 单台云服务器 + Docker Compose | ⭐⭐⭐⭐⭐ | 简单、便宜、够用 |
| 方案B | 容器化 + K8s | ⭐⭐⭐ | 过度设计，初期不需要 |
| 方案C | Serverless（云函数） | ⭐⭐⭐ | 冷启动问题，AI分析场景不适合 |

**推荐：Docker Compose 单机部署**，一个 docker-compose.yml 管理所有服务（后端+数据库+Redis），方便后期迁移。

---

## 三、系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        客户端层                              │
│  ┌─────────────────┐          ┌─────────────────────────┐   │
│  │   B端管理后台    │          │      C端（uni-app）      │   │
│  │ Vue3 + Element  │          │  微信小程序 / H5         │   │
│  └────────┬────────┘          └───────────┬─────────────┘   │
└───────────┼───────────────────────────────┼─────────────────┘
            │  HTTPS/REST API               │  HTTPS/REST API
            ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                     API网关 / Nginx反向代理                   │
│              /api/admin/*          /api/client/*             │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                   NestJS 主后端服务                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │用户模块   │ │报告模块   │ │授权模块   │ │  AI分析模块   │   │
│  │(Auth)    │ │(Report)  │ │(Consent) │ │  (Analysis)  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────┬───────┘   │
└──────────────────────────────────────────────────┼──────────┘
                                                   │
            ┌──────────────────────────────────────┤
            ▼                  ▼                   ▼
┌───────────────────┐ ┌──────────────┐ ┌──────────────────┐
│   PostgreSQL      │ │    Redis      │ │   云存储 OSS/COS  │
│  (业务数据)        │ │ (缓存/队列)   │ │  (PDF文件存储)    │
└───────────────────┘ └──────────────┘ └──────────────────┘
                                                   │ 文件URL
                                         ┌─────────▼────────┐
                                         │   AI 分析服务     │
                                         │  (OpenAI/DeepSeek │
                                         │   /通义千问)       │
                                         └──────────────────┘
```

---

## 四、数据库表设计

### 4.1 核心数据表

```sql
-- 用户表
users
  id, phone, name, avatar, openid(微信), created_at, updated_at

-- 体检报告表
health_reports
  id, user_id, title, report_date, pdf_url, pdf_size,
  status(pending/parsed/analyzed), created_at

-- 报告解析数据表（结构化指标）
report_metrics
  id, report_id, category(血脂/血压/血糖...), metric_name,
  value, unit, reference_range, status(normal/high/low), raw_text

-- AI分析结果表
analysis_results
  id, report_id, user_id, overall_summary, risk_level(1-5),
  analysis_detail(JSON: 逐项分析), suggestions(JSON: 建议列表),
  ai_model, tokens_used, created_at

-- 授权记录表
consent_records
  id, user_id, report_id, consent_type, consent_at, expire_at, ip_address

-- 管理员表
admins
  id, username, password_hash, role, created_at
```

---

## 五、核心API接口设计

### 5.1 B端接口（/api/admin）

```
POST   /api/admin/auth/login              # 管理员登录
GET    /api/admin/users                   # 用户列表
GET    /api/admin/users/:id/reports       # 指定用户的报告列表
POST   /api/admin/reports/upload          # 上传PDF体检报告
GET    /api/admin/reports/:id             # 报告详情
DELETE /api/admin/reports/:id             # 删除报告
GET    /api/admin/analysis/:reportId      # 查看AI分析结果
```

### 5.2 C端接口（/api/client）

```
POST   /api/client/auth/login             # C端用户登录（微信授权 or 手机号）
GET    /api/client/reports                # 我的报告列表
GET    /api/client/reports/:id            # 报告详情
POST   /api/client/reports/:id/consent    # 同意授权分析（记录授权）
POST   /api/client/reports/:id/analyze    # 触发AI分析
GET    /api/client/analysis/:reportId     # 获取AI分析结果（轮询/SSE）
```

---

## 六、关键功能实现思路

### 6.1 PDF解析流程

```
上传PDF到OSS（存储）
       ↓
调用PDF解析（pdf-parse 或 直接传给AI）
       ↓
提取体检指标（如：总胆固醇、血压、血糖等）
       ↓
结构化存入 report_metrics 表
       ↓
标记 report.status = 'parsed'
```

**两种解析策略：**
- **策略A（简单）**：将PDF文本直接传给AI，让AI自己识别指标，无需自己解析
- **策略B（精确）**：先用规则/NLP提取指标到数据库，再将结构化数据传给AI分析

初期建议策略A，快速验证后再优化。

### 6.2 AI分析流程

```
用户点击「同意授权并分析」
       ↓
记录 consent_records（法律合规，记录用户授权时间/IP）
       ↓
从OSS获取PDF（或使用已解析的report_metrics）
       ↓
构建Prompt → 调用AI API
       ↓
解析AI返回结果，存入 analysis_results 表
       ↓
通过SSE或轮询推送给C端
```

**Prompt 设计模板：**
```
你是一位专业的健康顾问，请根据以下体检报告数据，进行逐项分析：
1. 对每个异常指标给出通俗易懂的解释
2. 标注风险等级（正常/轻度异常/需要关注/建议就诊）
3. 给出具体的生活方式改善建议
4. 最后给出整体健康评估

体检数据：{report_data}

请以JSON格式返回，包含 metrics_analysis 数组和 overall_summary 字段。
```

### 6.3 授权合规设计

用户每次分析前需明确点击「同意」，系统记录：
- 授权时间戳
- 用户IP地址
- 授权有效期（如：本次分析有效 or 30天内有效）
- 授权内容描述（展示给用户看的文字）

这在医疗健康数据处理中是必要的合规要求。

### 6.4 长时任务处理

AI分析可能耗时10-30秒，需要异步处理：
- **方案A（简单）**：前端轮询（每2秒请求一次分析状态）
- **方案B（推荐）**：Server-Sent Events (SSE)，后端实时推送进度
- **方案C（复杂）**：消息队列（Bull + Redis），适合高并发场景

初期用方案A或B即可。

---

## 七、项目目录结构建议

```
BobSystem/
├── apps/
│   ├── admin/              # B端管理后台（Vue 3）
│   │   ├── src/
│   │   │   ├── views/
│   │   │   ├── components/
│   │   │   ├── api/
│   │   │   └── stores/
│   │   └── package.json
│   │
│   ├── client/             # C端用户侧（uni-app）
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   └── api/
│   │   └── package.json
│   │
│   └── server/             # 后端服务（NestJS）
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── reports/
│       │   │   ├── analysis/
│       │   │   └── consent/
│       │   ├── prisma/
│       │   │   └── schema.prisma
│       │   └── main.ts
│       └── package.json
│
├── docker-compose.yml      # 一键启动所有服务
├── .env.example            # 环境变量模板
└── package.json            # monorepo根配置（pnpm workspace）
```

**monorepo 管理工具：pnpm workspace**（你已经安装了pnpm）

---

## 八、技术栈汇总（最终推荐方案）

| 层级 | 技术 |
|------|------|
| B端前端 | Vue 3 + Vite + TypeScript + Element Plus + Pinia |
| C端前端 | uni-app + Vue 3 + TypeScript + uview-plus |
| 后端框架 | NestJS + TypeScript |
| 数据库 | PostgreSQL 16 |
| 缓存 | Redis 7 |
| ORM | Prisma |
| 文件存储 | 阿里云OSS / 腾讯云COS |
| AI服务 | DeepSeek API（开发期）/ GPT-4o（生产期） |
| PDF解析 | 直接传给AI（初期）/ pdfplumber Python服务（后期） |
| 容器化 | Docker + Docker Compose |
| 反向代理 | Nginx |
| 包管理 | pnpm workspace（monorepo） |

---

## 九、开发优先级与里程碑

### Phase 1：MVP（最小可行产品）
- [ ] 项目初始化（monorepo 结构搭建）
- [ ] 后端：NestJS 基础框架 + Prisma + PostgreSQL
- [ ] 后端：文件上传接口 + OSS集成
- [ ] 后端：AI分析接口（接入DeepSeek/GPT-4o）
- [ ] B端：报告上传页面
- [ ] C端：报告列表 + 授权同意 + 分析结果展示页

### Phase 2：完善功能
- [ ] 用户认证（微信小程序登录 + 手机号登录）
- [ ] B端：用户管理、报告管理完整CRUD
- [ ] C端：历史报告对比
- [ ] PDF结构化解析优化
- [ ] 分析结果缓存（相同报告不重复分析）

### Phase 3：生产优化
- [ ] 日志系统（Winston + 阿里云日志服务）
- [ ] 监控报警
- [ ] 安全加固（数据加密、接口限流）
- [ ] CI/CD流水线

---

## 十、需要提前准备的账号/资源

- [ ] 云服务器（阿里云/腾讯云 2核4G起步）
- [ ] 对象存储账号（OSS 或 COS）
- [ ] AI API Key（DeepSeek：https://platform.deepseek.com）
- [ ] 微信小程序 AppID（若做小程序）
- [ ] 域名 + SSL证书（小程序必须HTTPS）

---

## 十一、关键风险点与注意事项

1. **数据安全**：体检报告属于个人敏感健康数据，PDF存储需加密，数据库敏感字段加密存储，接口需要严格鉴权
2. **合规性**：需要明确的用户授权流程，保留授权记录，隐私政策需提及健康数据处理
3. **AI幻觉**：AI分析结果必须标注「仅供参考，不作为医疗诊断依据」的免责声明
4. **PDF多样性**：不同医院的体检报告格式差异很大，AI直接解析比规则解析更健壮
5. **费用控制**：AI API按Token计费，同一报告的分析结果要缓存，避免重复调用
6. **并发处理**：AI分析是耗时操作，要做好异步队列，避免请求超时


