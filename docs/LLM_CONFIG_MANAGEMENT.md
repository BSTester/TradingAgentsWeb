# LLM 供应商和模型配置管理

## 功能概述

LLM 配置管理系统为管理员提供了一个完整的界面，用于管理 LLM 服务供应商和模型配置。这个功能允许管理员：

- 添加、编辑、删除 LLM 供应商信息
- 管理供应商的 API 密钥和基础 URL
- 配置和管理不同类型的 LLM 模型
- 测试 LLM 供应商连接的可用性
- 控制供应商和模型的启用/禁用状态

## 架构设计

### 数据库表结构

#### 1. `llm_providers` 表 - LLM 供应商

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| provider_name | String(100) | 供应商唯一标识（如 openai, anthropic） |
| display_name | String(200) | 显示名称 |
| api_key | String(500) | API 密钥（建议加密存储） |
| base_url | String(500) | API 基础 URL |
| description | Text | 供应商描述 |
| is_active | Boolean | 是否启用 |
| config_json | JSON | 额外配置参数 |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |

#### 2. `llm_models` 表 - LLM 模型

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| provider_id | Integer | 关联的供应商 ID（外键） |
| model_name | String(200) | 模型名称（如 gpt-4o） |
| model_type | String(50) | 模型类型（shallow_thinker/deep_thinker） |
| display_name | String(200) | 显示名称 |
| description | Text | 模型描述 |
| is_active | Boolean | 是否启用 |
| config_json | JSON | 模型配置参数 |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |

**关系**：
- 一个供应商可以有多个模型（一对多关系）
- 删除供应商时会级联删除其下的所有模型

### API 接口

#### 供应商管理接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/llm/providers` | 获取所有供应商列表 |
| GET | `/api/admin/llm/providers/{id}` | 获取供应商详情（含完整 API Key） |
| POST | `/api/admin/llm/providers` | 创建新供应商 |
| PATCH | `/api/admin/llm/providers/{id}` | 更新供应商信息 |
| DELETE | `/api/admin/llm/providers/{id}` | 删除供应商 |

#### 模型管理接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/llm/models` | 获取所有模型列表 |
| GET | `/api/admin/llm/models/{id}` | 获取模型详情 |
| POST | `/api/admin/llm/models` | 创建新模型 |
| PATCH | `/api/admin/llm/models/{id}` | 更新模型信息 |
| DELETE | `/api/admin/llm/models/{id}` | 删除模型 |

#### 连接测试接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/llm/test-connection` | 测试 LLM 供应商连接 |

### 前端页面

**路径**：`/admin/llm-config`

**权限**：仅管理员可访问

**功能模块**：

1. **供应商管理标签页**
   - 供应商列表卡片展示
   - 添加/编辑/删除供应商
   - 显示每个供应商下的模型数量
   - 供应商启用/禁用状态切换

2. **模型管理标签页**
   - 模型列表表格展示
   - 按供应商和模型类型筛选
   - 添加/编辑/删除模型
   - 模型类型标识（深度思考/快速响应）

## 使用指南

### 1. 添加 LLM 供应商

1. 以管理员身份登录系统
2. 访问 `导航栏 → LLM配置`
3. 在"供应商管理"标签页，点击"添加供应商"
4. 填写供应商信息：
   - **供应商标识**：唯一标识符，只能包含字母、数字、下划线和连字符（创建后不可修改）
   - **显示名称**：用户友好的名称
   - **Base URL**：API 基础地址（如 `https://api.openai.com/v1`）
   - **API Key**：API 密钥
   - **描述**：供应商简介
   - **启用状态**：是否启用此供应商
5. 点击"测试连接"验证配置（可选）
6. 点击"创建"保存

### 2. 添加 LLM 模型

1. 在"模型管理"标签页，点击"添加模型"
2. 填写模型信息：
   - **供应商**：选择所属供应商
   - **模型类型**：
     - 快速响应（shallow_thinker）：用于快速分析任务
     - 深度思考（deep_thinker）：用于复杂分析任务
   - **模型名称**：实际 API 调用时使用的模型 ID（如 `gpt-4o`）
   - **显示名称**：用户友好的名称（如 `GPT-4o`）
   - **描述**：模型简介
   - **启用状态**：是否启用此模型
3. 点击"创建"保存

### 3. 编辑供应商或模型

- 点击列表中的"编辑"图标
- 修改相应字段
- 点击"更新"保存更改

### 4. 删除供应商或模型

- 点击列表中的"删除"图标
- 确认删除操作
- **注意**：删除供应商会同时删除其下的所有模型

### 5. 测试连接

在供应商表单中：
1. 填写 API Key 和 Base URL
2. 点击"测试连接"按钮
3. 系统会尝试调用 `/models` 端点验证连接
4. 查看测试结果反馈

## 预置数据

系统初始化时会自动创建以下供应商和模型：

### 供应商

1. **OpenAI**
   - provider_name: `openai`
   - base_url: `https://api.openai.com/v1`

2. **Anthropic**
   - provider_name: `anthropic`
   - base_url: `https://api.anthropic.com/v1`

3. **DeepSeek**
   - provider_name: `deepseek`
   - base_url: `https://api.deepseek.com/v1`

4. **自定义供应商**
   - provider_name: `custom`
   - 用于自定义 LLM 服务

### 预置模型

**OpenAI 模型：**
- GPT-4o (deep_thinker)
- GPT-4o Mini (shallow_thinker)
- GPT-4 Turbo (deep_thinker)
- GPT-3.5 Turbo (shallow_thinker)

**Anthropic 模型：**
- Claude 3.5 Sonnet (deep_thinker)
- Claude 3.5 Haiku (shallow_thinker)
- Claude 3 Opus (deep_thinker)

**DeepSeek 模型：**
- DeepSeek Chat (deep_thinker)
- DeepSeek Reasoner (deep_thinker)

## 权限控制

所有 LLM 配置管理接口都需要管理员权限：

```python
def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限"
        )
    return current_user
```

前端路由也会检查用户角色：
- 非管理员访问 `/admin/llm-config` 会被重定向到首页

## 安全建议

1. **API 密钥存储**
   - 当前 API 密钥以明文存储在数据库中
   - 生产环境建议使用加密存储（如 AES-256）
   - 可以集成密钥管理服务（如 AWS KMS、Azure Key Vault）

2. **传输安全**
   - 所有 API 请求都通过 HTTPS 传输
   - Bearer Token 认证保护接口

3. **访问控制**
   - 严格限制管理员权限
   - 记录所有配置变更的审计日志（可扩展）

## 后续扩展

1. **审计日志**
   - 记录所有供应商和模型的创建、修改、删除操作
   - 记录连接测试结果

2. **配置版本控制**
   - 保存配置变更历史
   - 支持配置回滚

3. **批量操作**
   - 批量导入/导出供应商和模型配置
   - 批量启用/禁用

4. **使用统计**
   - 统计各供应商和模型的使用频率
   - 成本分析和优化建议

5. **高级测试**
   - 实际 LLM 调用测试（生成简单响应）
   - 性能测试（响应时间、吞吐量）
   - 成本估算

## 文件清单

### 后端文件

```
web/backend/
├── models.py                                  # 添加 LLMProvider 和 LLMModel 模型
├── schemas.py                                 # 添加相关 Pydantic schemas
├── migrations/
│   └── add_llm_providers_models.py           # 数据库迁移脚本
└── routes/
    └── llm_config_routes.py                  # LLM 配置 API 路由
```

### 前端文件

```
web/frontend/src/
├── app/
│   └── admin/
│       └── llm-config/
│           └── page.tsx                       # LLM 配置管理页面
└── components/
    └── admin/
        └── llm-config/
            ├── ProviderList.tsx              # 供应商列表组件
            ├── ModelList.tsx                 # 模型列表组件
            ├── ProviderForm.tsx              # 供应商表单组件
            └── ModelForm.tsx                 # 模型表单组件
```

## 技术栈

- **后端**: FastAPI, SQLAlchemy, Pydantic
- **前端**: Next.js 15, React 19, TypeScript, TanStack Query
- **数据库**: SQLite / MySQL（支持异步）
- **UI**: Tailwind CSS, Font Awesome

## 故障排查

### 问题：无法访问 LLM 配置页面

**解决方案**：
1. 确认当前用户是管理员角色
2. 检查浏览器控制台是否有错误
3. 验证后端路由是否正确注册

### 问题：测试连接失败

**可能原因**：
1. API Key 无效或已过期
2. Base URL 不正确
3. 网络连接问题
4. 供应商 API 限流

**解决方案**：
1. 验证 API Key 的有效性
2. 确认 Base URL 格式正确（包含协议和版本）
3. 检查防火墙和代理设置
4. 查看供应商 API 文档了解限制

### 问题：模型列表为空

**解决方案**：
1. 运行数据库迁移脚本初始化默认数据
2. 手动添加供应商和模型
3. 检查数据库连接和表结构

## 总结

LLM 配置管理系统提供了一个完整的解决方案，用于管理多个 LLM 服务供应商和模型。通过直观的界面和完善的 API，管理员可以轻松配置和维护系统中的 LLM 资源，确保分析任务能够使用正确的模型和配置。
