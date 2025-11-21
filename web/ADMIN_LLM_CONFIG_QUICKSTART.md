# LLM 配置管理快速入门指南

## 🚀 功能简介

管理员后台 LLM 配置管理功能允许您：
- ✅ 管理多个 LLM 服务供应商（OpenAI、Anthropic、DeepSeek 等）
- ✅ 配置供应商的 API 密钥和基础 URL
- ✅ 添加和管理各种 LLM 模型
- ✅ 测试 API 连接的可用性
- ✅ 启用/禁用供应商和模型

## 📦 安装步骤

### 1. 运行数据库迁移

```bash
cd h:/AGIProjects/TradingAgentsWeb
python web/backend/migrations/add_llm_providers_models.py
```

预期输出：
```
✅ Created llm_providers table
✅ Created llm_models table
✅ Default data inserted successfully
```

### 2. 验证安装

```bash
python test_llm_config.py
```

应该看到：
- 4 个预置供应商（OpenAI, Anthropic, DeepSeek, 自定义）
- 9 个预置模型
- 统计信息正常

### 3. 启动服务

后端已自动集成，无需额外配置。启动服务即可使用：

```bash
# 启动后端服务（如果尚未运行）
cd web/backend
python app.py

# 或使用 start.bat (Windows)
cd h:/AGIProjects/TradingAgentsWeb
start.bat
```

## 🎯 使用指南

### 访问管理页面

1. 以管理员身份登录系统
2. 点击顶部导航栏的 **"LLM配置"** 按钮
3. 或直接访问：`http://localhost:8000/admin/llm-config`

### 添加新的 LLM 供应商

**示例：添加 OpenRouter**

1. 点击"供应商管理"标签
2. 点击"添加供应商"按钮
3. 填写信息：
   - **供应商标识**: `openrouter`
   - **显示名称**: `OpenRouter`
   - **Base URL**: `https://openrouter.ai/api/v1`
   - **API Key**: 你的 OpenRouter API 密钥
   - **描述**: `OpenRouter 聚合多个 LLM 供应商`
   - **启用状态**: ✅ 选中
4. 点击"测试连接"验证配置
5. 点击"创建"保存

### 添加新的模型

**示例：添加 GPT-4 Turbo Preview**

1. 点击"模型管理"标签
2. 点击"添加模型"按钮
3. 填写信息：
   - **供应商**: 选择 `OpenAI`
   - **模型类型**: 选择 `深度思考` (deep_thinker)
   - **模型名称**: `gpt-4-turbo-preview`
   - **显示名称**: `GPT-4 Turbo Preview`
   - **描述**: `OpenAI 最新的 GPT-4 Turbo 预览版`
   - **启用状态**: ✅ 选中
4. 点击"创建"保存

### 编辑现有配置

1. 在列表中找到要编辑的项目
2. 点击"编辑"图标（铅笔图标）
3. 修改信息
4. 点击"更新"保存

### 删除配置

⚠️ **警告**：删除供应商会同时删除其下的所有模型！

1. 点击"删除"图标（垃圾桶图标）
2. 确认删除操作

### 测试连接

在供应商表单中：
1. 填写完 API Key 和 Base URL
2. 点击"测试连接"按钮
3. 查看测试结果：
   - ✅ **成功**：显示绿色提示
   - ❌ **失败**：显示红色错误信息

## 📊 预置数据说明

### 预置供应商

| 供应商 | provider_name | Base URL |
|--------|---------------|----------|
| OpenAI | `openai` | https://api.openai.com/v1 |
| Anthropic | `anthropic` | https://api.anthropic.com/v1 |
| DeepSeek | `deepseek` | https://api.deepseek.com/v1 |
| 自定义 | `custom` | (空) |

### 预置模型

**OpenAI 模型：**
- GPT-4o (deep_thinker) - 最新多模态模型
- GPT-4o Mini (shallow_thinker) - 轻量级快速模型
- GPT-4 Turbo (deep_thinker) - GPT-4 Turbo
- GPT-3.5 Turbo (shallow_thinker) - 经典模型

**Anthropic 模型：**
- Claude 3.5 Sonnet (deep_thinker) - 最强推理模型
- Claude 3.5 Haiku (shallow_thinker) - 快速响应模型
- Claude 3 Opus (deep_thinker) - 顶级性能模型

**DeepSeek 模型：**
- DeepSeek Chat (deep_thinker) - 对话模型
- DeepSeek Reasoner (deep_thinker) - 推理模型

## 🔧 模型类型说明

### shallow_thinker（快速响应）⚡
- **用途**：快速分析任务
- **特点**：响应速度快，成本较低
- **适用场景**：
  - 简单的市场数据查询
  - 快速的情感分析
  - 初步筛选和分类

### deep_thinker（深度思考）🧠
- **用途**：复杂分析任务
- **特点**：推理能力强，准确度高
- **适用场景**：
  - 深度市场分析
  - 综合决策制定
  - 风险评估
  - 策略优化

## 🔐 安全建议

### 生产环境注意事项

1. **API 密钥加密**
   ```python
   # TODO: 在生产环境中实现 API 密钥加密
   # 建议使用 cryptography 库或 AWS KMS
   from cryptography.fernet import Fernet
   ```

2. **HTTPS 强制**
   - 确保所有请求通过 HTTPS 传输
   - 配置 SSL 证书

3. **审计日志**
   - 记录所有配置变更
   - 追踪 API 密钥的使用情况

4. **访问控制**
   - 严格限制管理员权限
   - 定期审查管理员账户

## 🐛 故障排查

### 问题 1：无法访问 LLM 配置页面

**症状**：访问 `/admin/llm-config` 被重定向到首页

**解决方案**：
1. 检查当前用户是否是管理员
   ```bash
   # 在数据库中查询
   SELECT username, role FROM users WHERE id = YOUR_USER_ID;
   ```
2. 如果不是管理员，联系系统管理员升级权限

### 问题 2：测试连接失败

**症状**：点击"测试连接"显示错误

**可能原因及解决方案**：

| 错误信息 | 原因 | 解决方案 |
|---------|------|----------|
| "连接超时" | 网络问题或 URL 错误 | 检查网络连接和 Base URL |
| "认证失败" | API Key 无效 | 验证 API Key 是否正确 |
| "HTTP 404" | 端点不存在 | 某些供应商可能不支持 `/models` 端点 |

### 问题 3：数据库表不存在

**症状**：访问页面时出现数据库错误

**解决方案**：
```bash
# 重新运行迁移
python web/backend/migrations/add_llm_providers_models.py
```

## 📚 API 文档

### 获取所有供应商
```http
GET /api/admin/llm/providers?include_inactive=true
Authorization: Bearer YOUR_TOKEN
```

### 创建供应商
```http
POST /api/admin/llm/providers
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "provider_name": "openai",
  "display_name": "OpenAI",
  "api_key": "sk-...",
  "base_url": "https://api.openai.com/v1",
  "description": "OpenAI GPT系列模型",
  "is_active": true
}
```

### 测试连接
```http
POST /api/admin/llm/test-connection
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "api_key": "sk-...",
  "base_url": "https://api.openai.com/v1"
}
```

## 🎓 最佳实践

1. **分阶段部署**
   - 先在测试环境验证配置
   - 使用测试 API Key 进行连接测试
   - 确认无误后再部署到生产环境

2. **定期检查**
   - 定期测试 API 连接
   - 检查 API Key 是否过期
   - 更新模型列表（供应商可能发布新模型）

3. **文档记录**
   - 记录每个供应商的用途
   - 说明模型选择的原因
   - 记录配置变更历史

4. **成本控制**
   - 监控各供应商的使用量
   - 根据成本调整模型选择
   - 禁用不常用的供应商

## 📞 获取帮助

- **文档**：查看 `docs/LLM_CONFIG_MANAGEMENT.md`
- **测试**：运行 `python test_llm_config.py`
- **日志**：检查后端日志输出

## ✅ 完成清单

安装和配置完成后，请确认：

- [ ] 数据库迁移成功执行
- [ ] 测试脚本运行通过
- [ ] 可以访问 `/admin/llm-config` 页面
- [ ] 可以查看预置的供应商和模型
- [ ] 可以添加新的供应商
- [ ] 可以添加新的模型
- [ ] 测试连接功能正常工作
- [ ] 可以编辑和删除配置

---

🎉 **恭喜！** 您已成功配置 LLM 管理功能。现在可以开始管理您的 LLM 供应商和模型了！
