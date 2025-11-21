# 定时报告列表分页优化

## 修改内容

### 1. 每页显示数量调整

**修改前：** 每页显示 20 条记录  
**修改后：** 每页显示 10 条记录

```typescript
// 修改前
const { data, isLoading, error } = useScheduledTasks(page, 20);

// 修改后
const limit = 10; // 每页显示10条
const { data, isLoading, error } = useScheduledTasks(page, limit);
```

### 2. 分页组件优化

参考分析历史列表的分页实现，优化了定时报告的分页显示：

#### 改进点：

1. **更友好的页码显示**
   - 显示当前页附近的页码（前后各2页）
   - 首页和尾页始终可见
   - 使用省略号（...）表示跳过的页码

2. **更清晰的信息展示**
   - 显示当前范围：`显示第 1 - 10 条，共 25 条记录`
   - 当前页高亮显示（蓝色背景）

3. **更好的交互体验**
   - 禁用状态的按钮有明显的视觉反馈
   - 悬停效果更流畅
   - 按钮间距更合理

#### 分页显示逻辑：

```
总共 50 条记录，每页 10 条，共 5 页

当前在第 1 页：[1] 2 3 4 5
当前在第 2 页：1 [2] 3 4 5
当前在第 3 页：1 2 [3] 4 5
当前在第 4 页：1 2 3 [4] 5
当前在第 5 页：1 2 3 4 [5]

总共 100 条记录，每页 10 条，共 10 页

当前在第 1 页：[1] 2 3 ... 10
当前在第 3 页：1 2 [3] 4 5 ... 10
当前在第 5 页：1 ... 3 4 [5] 6 7 ... 10
当前在第 8 页：1 ... 6 7 [8] 9 10
当前在第 10 页：1 ... 8 9 [10]
```

### 3. 删除后自动回退

添加了删除最后一条记录时自动回退到上一页的逻辑：

```typescript
const handleDelete = async (taskId: number) => {
  try {
    const result = await deleteTask.mutateAsync(taskId);
    setShowDeleteDialog(null);
    
    // 如果当前页删除后为空且页码>1，则回退到上一页
    if (data?.items && data.items.length === 1 && page > 1) {
      setPage(p => p - 1);
    }
    
    showToast(result.message || '任务已删除', 'success');
  } catch (error: any) {
    showToast(error.message || '删除失败', 'error');
  }
};
```

**场景示例：**
- 用户在第 3 页，该页只有 1 条记录
- 用户删除这条记录
- 自动跳转到第 2 页，避免显示空页面

## 代码对比

### 修改前的分页组件

```typescript
{/* 简单的上一页/下一页按钮 */}
{data && data.total > 20 && (
  <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
    <div className="flex-1 flex justify-between sm:hidden">
      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={!data.has_prev}>
        上一页
      </button>
      <button onClick={() => setPage(p => p + 1)} disabled={!data.has_next}>
        下一页
      </button>
    </div>
    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
      <div>
        <p className="text-sm text-gray-700">
          显示第 <span className="font-medium">{(page - 1) * 20 + 1}</span> 到{' '}
          <span className="font-medium">{Math.min(page * 20, data.total)}</span> 条，
          共 <span className="font-medium">{data.total}</span> 条
        </p>
      </div>
      <div>
        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={!data.has_prev}>
            <i className="fas fa-chevron-left" />
          </button>
          <span>{page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={!data.has_next}>
            <i className="fas fa-chevron-right" />
          </button>
        </nav>
      </div>
    </div>
  </div>
)}
```

**问题：**
- 只显示当前页码，无法快速跳转
- 不显示总页数
- 移动端和桌面端体验不一致

### 修改后的分页组件

```typescript
{/* 完整的分页组件，支持页码跳转 */}
{data && data.items.length > 0 && data.total > limit && (
  <div className="mt-6 p-4 border-t border-gray-200">
    <div className="flex items-center justify-between">
      {/* 左侧：显示信息 */}
      <div className="text-sm text-gray-600">
        显示第 {(page - 1) * limit + 1} - {Math.min(page * limit, data.total)} 条，共 {data.total} 条记录
      </div>

      {/* 右侧：分页按钮 */}
      <div className="flex items-center space-x-2">
        {/* 上一页 */}
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <i className="fas fa-chevron-left mr-1" />
          上一页
        </button>

        {/* 页码按钮（智能显示） */}
        <div className="flex items-center space-x-1">
          {/* 首页 + 省略号 */}
          {page > 3 && (
            <>
              <button onClick={() => setPage(1)}>1</button>
              {page > 4 && <span>...</span>}
            </>
          )}

          {/* 当前页附近的页码 */}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p >= page - 2 && p <= page + 2)
            .map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={p === page ? 'bg-blue-600 text-white' : 'bg-white'}
              >
                {p}
              </button>
            ))}

          {/* 省略号 + 尾页 */}
          {page < totalPages - 2 && (
            <>
              {page < totalPages - 3 && <span>...</span>}
              <button onClick={() => setPage(totalPages)}>{totalPages}</button>
            </>
          )}
        </div>

        {/* 下一页 */}
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          下一页
          <i className="fas fa-chevron-right ml-1" />
        </button>
      </div>
    </div>
  </div>
)}
```

**优势：**
- ✅ 支持直接点击页码跳转
- ✅ 智能显示页码，避免页码过多
- ✅ 清晰的当前页高亮
- ✅ 统一的桌面端体验
- ✅ 更好的视觉反馈

## 视觉效果

### 分页按钮样式

```
┌─────────────────────────────────────────────────────────────────┐
│ 显示第 1 - 10 条，共 45 条记录                                    │
│                                                                   │
│  ◀ 上一页   [1]  2  3  4  5  下一页 ▶                           │
│             ^^^                                                   │
│          当前页（蓝色背景）                                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 显示第 31 - 40 条，共 100 条记录                                  │
│                                                                   │
│  ◀ 上一页   1 ... 2  3  [4]  5  6 ... 10  下一页 ▶             │
│                        ^^^                                        │
│                     当前页（蓝色背景）                             │
└─────────────────────────────────────────────────────────────────┘
```

## 与分析历史列表的一致性

现在定时报告列表和分析历史列表使用相同的分页组件样式和交互逻辑：

| 特性 | 分析历史列表 | 定时报告列表 |
|------|-------------|-------------|
| 每页显示数量 | 10 条 | 10 条 ✅ |
| 页码显示方式 | 智能显示 | 智能显示 ✅ |
| 删除后回退 | 支持 | 支持 ✅ |
| 当前页高亮 | 蓝色背景 | 蓝色背景 ✅ |
| 省略号显示 | 支持 | 支持 ✅ |

## 测试建议

1. **基本分页**
   - 创建 15 条定时任务（2 页）
   - 验证分页按钮正常工作
   - 验证页码显示正确

2. **删除操作**
   - 在第 2 页删除最后一条记录
   - 验证自动回退到第 1 页

3. **多页场景**
   - 创建 50+ 条定时任务
   - 验证省略号显示正确
   - 验证首页/尾页按钮工作正常

4. **边界情况**
   - 只有 1 条记录（不显示分页）
   - 正好 10 条记录（不显示分页）
   - 11 条记录（显示分页）

## 相关文件

- `web/frontend/src/app/scheduled-tasks/page.tsx` - 定时报告页面
- `web/frontend/src/app/history/page.tsx` - 分析历史页面（参考实现）
- `web/frontend/src/components/analysis/AnalysisHistory.tsx` - 分析历史组件（参考实现）
