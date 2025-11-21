'use client';

import React from 'react';

interface PageLoadingProps {
    message?: string;
}

export function PageLoading({ message = '加载中...' }: PageLoadingProps) {
    return (
        <div className="fixed inset-0 bg-dark-primary/90 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center">
                <div className="relative inline-block">
                    {/* Outer ring */}
                    <div className="w-16 h-16 border-4 border-accent-primary/20 border-t-accent-primary rounded-full animate-spin"></div>
                    {/* Inner ring */}
                    <div className="absolute top-2 left-2 w-12 h-12 border-4 border-accent-secondary/20 border-b-accent-secondary rounded-full animate-spin-reverse"></div>
                </div>
                <p className="mt-4 text-text-primary font-medium">{message}</p>
                <p className="mt-2 text-sm text-text-tertiary">请稍候...</p>
            </div>
        </div>
    );
}
