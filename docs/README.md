# TradingAgents 文档目录

本目录包含 TradingAgents 项目的所有文档。

## 📚 文档分类

### 核心功能文档

- **[COMPANY_NAME_FEATURE.md](COMPANY_NAME_FEATURE.md)** - 公司名称显示功能实现说明
  - 功能概述和实现细节
  - 数据流向和技术细节
  - 显示效果和使用说明

- **[REALTIME_QUOTES_QUICKSTART.md](REALTIME_QUOTES_QUICKSTART.md)** - 实时股票行情快速开始
  - 快速配置和使用指南
  - 支持A股、美股、港股
  - 代码示例和返回格式

- **[REALTIME_QUOTES_IMPLEMENTATION.md](REALTIME_QUOTES_IMPLEMENTATION.md)** - 实时行情功能实现详解
  - 完整的技术实现说明
  - API使用方法和集成指南
  - 故障排除和优化方向

- **[XUEQIU_TOKEN_SETUP.md](XUEQIU_TOKEN_SETUP.md)** - 雪球Token配置指南
  - Token获取详细步骤
  - 多种配置方式说明
  - 安全注意事项

### 交易执行功能

- **[TRADING_EXECUTOR_INDEX.md](TRADING_EXECUTOR_INDEX.md)** - 交易执行节点文档索引 ⭐
  - 所有交易执行相关文档的导航
  - 推荐阅读顺序
  - 快速查找指南

- **[QUICK_START_TRADING_EXECUTOR.md](QUICK_START_TRADING_EXECUTOR.md)** - 交易执行快速开始
  - 快速启动指南
  - 配置步骤说明
  - 使用示例和常见问题

- **[TRADING_EXECUTOR_SUMMARY.md](TRADING_EXECUTOR_SUMMARY.md)** - 交易执行实现总结
  - 功能概述和架构
  - 修改的文件列表
  - 使用流程和关键特性

- **[TRADING_EXECUTOR_IMPLEMENTATION.md](TRADING_EXECUTOR_IMPLEMENTATION.md)** - 交易执行完整实现
  - 详细实现说明
  - 技术细节和代码示例
  - 配置选项和注意事项

- **[TRADING_EXECUTOR_CHECKLIST.md](TRADING_EXECUTOR_CHECKLIST.md)** - 交易执行检查清单
  - 功能实现检查
  - 代码质量验证
  - 测试建议和完成状态

- **[FUTU_INTEGRATION_SUMMARY.md](FUTU_INTEGRATION_SUMMARY.md)** - Futu交易集成总结
  - Futu API集成说明
  - 交易工具和功能

- **[FUTU_TRADING_SETUP.md](FUTU_TRADING_SETUP.md)** - Futu交易设置指南
  - Futu OpenD配置
  - API密钥设置

- **[FUTU_TRADING_TOOLS.md](FUTU_TRADING_TOOLS.md)** - Futu交易工具文档
  - 可用的交易工具
  - 使用方法和示例

- **[AUTO_EXECUTE_TRADING_CONFIG.md](AUTO_EXECUTE_TRADING_CONFIG.md)** - 自动交易配置
  - 自动交易开关配置
  - 配置选项说明

- **[CLI_AUTO_TRADING.md](CLI_AUTO_TRADING.md)** - CLI自动交易
  - CLI中的自动交易功能
  - 使用方法和示例

### 数据库相关

- **[DATABASE_INIT_SUMMARY.md](DATABASE_INIT_SUMMARY.md)** - 数据库初始化方式说明
  - 统一使用应用启动时的异步初始化
  - 实现位置和优势说明
  - 快速开始指南

- **[DATABASE_SETUP.md](DATABASE_SETUP.md)** - 数据库设置完整指南
  - 数据库表结构说明
  - 初始化和迁移方法
  - 常见问题解答

- **[DATABASE_CONFIG.md](DATABASE_CONFIG.md)** - 数据库配置说明
  - 支持的数据库类型
  - 连接配置方法

### 部署相关

- **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - 部署检查清单
  - 部署前准备
  - 部署步骤详解
  - 部署后验证
  - 回滚计划

- **[DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)** - Docker 部署指南
  - Docker 容器化部署
  - docker-compose 配置

- **[DOCKER_BUILD_TROUBLESHOOTING.md](DOCKER_BUILD_TROUBLESHOOTING.md)** - Docker 构建问题排查
  - 常见构建问题
  - 解决方案

- **[README.Docker.md](README.Docker.md)** - Docker 使用说明
  - Docker 镜像构建
  - 容器运行配置

- **[NGINX_CONFIG_GUIDE.md](NGINX_CONFIG_GUIDE.md)** - Nginx 配置指南
  - 反向代理配置
  - SSL 证书配置
  - 性能优化

### 开发相关

- **[LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)** - 本地开发指南
  - 开发环境搭建
  - 调试方法
  - 开发工作流

- **[ENV_SETUP.md](ENV_SETUP.md)** - 环境配置说明
  - 环境变量配置
  - API 密钥设置
  - 配置文件说明

- **[QUICK_START_GUIDE.md](QUICK_START_GUIDE.md)** - 快速开始指南
  - 项目快速启动步骤
  - 基本使用说明

### 项目管理

- **[IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md)** - 实现检查清单
  - 功能实现进度跟踪
  - 待办事项列表

- **[INTEGRATION_COMPLETE.md](INTEGRATION_COMPLETE.md)** - 集成完成说明
  - 系统集成状态
  - 完成的功能模块

### 问题修复

- **[TIMEZONE_AND_WEEKLY_UPDATE.md](TIMEZONE_AND_WEEKLY_UPDATE.md)** - 时区和周更新功能
  - 时区处理说明
  - 周更新功能实现

- **[TIMEZONE_BUG_FIX.md](TIMEZONE_BUG_FIX.md)** - 时区Bug修复
  - 时区相关问题修复记录
  - 解决方案说明

### 股票代码相关

- **[股票代码编码规则详解.md](股票代码编码规则详解.md)** - 股票代码编码规则
  - 美股、港股、A股编码规则
  - 验证逻辑说明

- **[股票代码验证升级说明.md](股票代码验证升级说明.md)** - 股票代码验证升级
  - 验证规则升级说明
  - 前后端验证流程

## 🚀 快速导航

### 新用户入门
1. 阅读主 [README.md](../README.md)
2. 查看 [ENV_SETUP.md](ENV_SETUP.md) 配置环境
3. 参考 [DATABASE_INIT_SUMMARY.md](DATABASE_INIT_SUMMARY.md) 了解数据库初始化
4. 查看 [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) 开始开发

### 交易执行功能使用
1. 查看 [TRADING_EXECUTOR_INDEX.md](TRADING_EXECUTOR_INDEX.md) 了解文档结构 ⭐
2. 阅读 [QUICK_START_TRADING_EXECUTOR.md](QUICK_START_TRADING_EXECUTOR.md) 快速开始
3. 参考 [FUTU_TRADING_SETUP.md](FUTU_TRADING_SETUP.md) 配置Futu交易
4. 查看 [TRADING_EXECUTOR_SUMMARY.md](TRADING_EXECUTOR_SUMMARY.md) 了解功能详情

### 部署人员
1. 查看 [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)
2. 参考 [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) 或 [NGINX_CONFIG_GUIDE.md](NGINX_CONFIG_GUIDE.md)
3. 阅读 [DATABASE_SETUP.md](DATABASE_SETUP.md) 了解数据库配置

### 功能开发
1. 查看 [COMPANY_NAME_FEATURE.md](COMPANY_NAME_FEATURE.md) 了解功能实现示例
2. 查看 [TRADING_EXECUTOR_IMPLEMENTATION.md](TRADING_EXECUTOR_IMPLEMENTATION.md) 了解交易执行实现
3. 参考 [DATABASE_SETUP.md](DATABASE_SETUP.md) 了解数据库操作
4. 查看 [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) 了解开发流程

## 📝 文档维护

### 添加新文档
1. 在 `docs/` 目录下创建新的 Markdown 文件
2. 在本 README 中添加文档链接和说明
3. 确保文档格式统一，包含清晰的标题和目录
4. 在 [CHANGELOG.md](CHANGELOG.md) 中记录变更

### 更新现有文档
1. 保持文档与代码同步
2. 更新日期和版本信息
3. 在 [CHANGELOG.md](CHANGELOG.md) 中添加变更说明

### 项目清理记录
- [CLEANUP_SUMMARY.md](CLEANUP_SUMMARY.md) - 项目文档整理和清理记录

## 🔗 相关链接

- [项目主页](../README.md)
- [GitHub 仓库](https://github.com/BSTester/TradingAgentsWeb)
- [问题反馈](https://github.com/BSTester/TradingAgentsWeb/issues)

## 📄 许可证

本项目采用 MIT 许可证，详见 [LICENSE](../LICENSE)
