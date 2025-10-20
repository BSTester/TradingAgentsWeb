'use client';

import React from 'react';

interface PageLoadingProps {
    message?: string;
}

export function PageLoading({ message = '加载中...' }: PageLoadingProps) {
    return (
        <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
            <div className="text-center">
                <div className="relative inline-block">
                    {/* 外圈旋转动画 */}
                    <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    {/* 内圈反向旋转 */}
                    <div className="absolute top-2 left-2 w-12 h-12 border-4 border-purple-200 border-b-purple-600 rounded-full animate-spin-reverse"></div>
                </div>
                <p className="mt-4 text-gray-700 font-medium">{message}</p>
                <p className="mt-2 text-sm text-gray-500">请稍候...</p>
            </div>
        </div>
    );
}
