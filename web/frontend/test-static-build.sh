#!/bin/bash
# 测试静态构建脚本

set -e

echo "=========================================="
echo "测试 Next.js 静态构建"
echo "=========================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: Node.js 未安装"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"
echo "✅ npm 版本: $(npm --version)"
echo ""

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
    echo "✅ 依赖安装完成"
    echo ""
fi

# 清理旧的构建
if [ -d "out" ]; then
    echo "🧹 清理旧的构建文件..."
    rm -rf out
fi

if [ -d ".next" ]; then
    rm -rf .next
fi

echo "✅ 清理完成"
echo ""

# 构建
echo "🔨 开始构建静态文件..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 构建成功！"
    echo ""
    
    # 检查输出目录
    if [ -d "out" ]; then
        echo "📁 构建输出目录: out/"
        echo ""
        echo "📊 文件统计："
        echo "   HTML 文件: $(find out -name "*.html" | wc -l)"
        echo "   JS 文件: $(find out -name "*.js" | wc -l)"
        echo "   CSS 文件: $(find out -name "*.css" | wc -l)"
        echo ""
        echo "📦 总大小: $(du -sh out | cut -f1)"
        echo ""
        echo "📝 主要文件："
        ls -lh out/*.html 2>/dev/null || echo "   (HTML 文件在子目录中)"
        echo ""
        
        # 列出所有 HTML 页面
        echo "📄 生成的页面："
        find out -name "*.html" -type f | sed 's|out/||' | sort
        echo ""
        
        echo "✅ 静态构建测试通过！"
        echo ""
        echo "💡 提示："
        echo "   可以使用以下命令本地测试："
        echo "   npx serve out -p 3000"
        echo ""
    else
        echo "❌ 错误: out/ 目录未生成"
        exit 1
    fi
else
    echo ""
    echo "❌ 构建失败"
    exit 1
fi
