# Pydantic v2 配置修复

## 问题描述

在使用 LLM 配置管理功能时，遇到两个 Pydantic v2 相关的问题：

### 1. 命名空间警告

Pydantic v2 会对以 `model_` 开头的字段名发出警告：

```
UserWarning: Field "model_name" in LLMModelBase has conflict with protected namespace "model_".
You may be able to resolve this warning by setting `model_config['protected_namespaces'] = ()`.
```

### 2. Config 冲突错误

在 Pydantic v2 中，不能同时使用 `model_config` 和 `Config` 类：

```
PydanticUserError: "Config" and "model_config" cannot be used together
```

## 原因

1. **命名空间保护**: Pydantic v2 默认保护 `model_` 命名空间，防止用户定义的字段与 Pydantic 的内部属性冲突。
2. **配置方式变更**: Pydantic v2 使用 `model_config` 字典替代了 v1 的 `Config` 嵌套类。

## 解决方案

### 统一使用 `model_config` 字典

将所有 Schema 类从 Pydantic v1 的 `Config` 类迁移到 v2 的 `model_config` 字典：

**修改前 (Pydantic v1 风格):**
```python
class LLMModelResponse(BaseModel):
    model_name: str
    # ... 其他字段
    
    class Config:
        from_attributes = True
```

**修改后 (Pydantic v2 风格):**
```python
class LLMModelResponse(BaseModel):
    model_config = {
        "protected_namespaces": (),  # 禁用 model_ 命名空间保护
        "from_attributes": True
    }
    
    model_name: str
    # ... 其他字段
```

## 修改的文件

**文件**: `web/backend/schemas.py`

修改的 Schema 类：
1. `LLMProviderResponse` - 添加 `model_config`
2. `LLMModelBase` - 添加 `model_config` 并禁用命名空间保护
3. `LLMModelUpdate` - 添加 `model_config` 并禁用命名空间保护
4. `LLMModelResponse` - 合并 `Config` 到 `model_config`
5. `LLMConnectionTest` - 添加 `model_config` 并禁用命名空间保护

## 验证

修复后可以成功导入 schemas：

```bash
python -c "from web.backend.schemas import LLMProviderResponse, LLMModelResponse; print('✅ OK')"
```

## 参考

- [Pydantic v2 Model Config](https://docs.pydantic.dev/latest/api/config/)
- [Pydantic v2 Migration Guide - Config](https://docs.pydantic.dev/latest/migration/#changes-to-config)
- [Protected Namespaces](https://docs.pydantic.dev/latest/api/config/#pydantic.config.ConfigDict.protected_namespaces)
