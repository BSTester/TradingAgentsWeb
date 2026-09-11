/**
 * 报告与公开报告治理 API（工作区线）。
 *
 * 背景：上游把前端 HTTP 层重构为 `@/lib/http-client`（HttpClient 类）+
 * `@/lib/apiClient`（axios 实例与域 API）+ `@/lib/api/*` 模块。本模块承接
 * 工作区线页面所需的报告接口（`/public`、`/reports/[id]`）与管理员公开报告
 * 治理接口（`/admin/public-reports`），统一构建在上游 axios 实例之上。
 *
 * 注意：订阅/积分/订单与后台 LLM 配置已随相关功能下线移除；
 * LLM 配置只来自前端本地（keyVault + 自定义 Base URL/模型），随分析请求提交。
 */

import type { AdminPublicReportItem, ReportDetail, ReportPreview } from '@/lib/types';
import { apiClient, publicApiClient } from '@/lib/apiClient';

function errMessage(error: unknown, fallback: string): string {
  const e = error as {
    response?: { data?: { detail?: string; message?: string } };
    message?: string;
  };
  return e?.response?.data?.detail || e?.response?.data?.message || e?.message || fallback;
}

/** 列表端点的分页元信息（后端统一返回 { data, meta }）。 */
export interface ListMeta {
  total: number;
  page?: number;
  limit?: number;
  [key: string]: unknown;
}

// 报告（公开榜单 / 我的分析 / 详情 / 公开状态 / PDF 导出）
export const reportsAPI = {
  // 公开榜单（免登录，走公共客户端）
  publicList: async (params?: { limit?: number; market?: string; page?: number }) => {
    try {
      const q: Record<string, unknown> = {};
      if (params?.limit) q.limit = params.limit;
      if (params?.market) q.market = params.market;
      if (params?.page) q.page = params.page;
      const res = await publicApiClient.get<{ data: ReportPreview[]; meta: ListMeta }>(
        '/api/reports/public',
        { params: q },
      );
      return res.data;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '获取公开报告列表失败'));
    }
  },

  // 我的分析列表（登录后）
  listMine: async (params?: { page?: number; limit?: number; market?: string; status?: string }) => {
    try {
      const q: Record<string, unknown> = {};
      if (params?.page) q.page = params.page;
      if (params?.limit) q.limit = params.limit;
      if (params?.market) q.market = params.market;
      if (params?.status) q.status = params.status;
      const res = await apiClient.get<{ data: ReportPreview[]; meta: ListMeta }>('/api/reports', {
        params: q,
      });
      return res.data;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '获取我的分析列表失败'));
    }
  },

  // 报告详情（含完整角色链）
  get: async (reportId: string) => {
    try {
      const res = await apiClient.get<{ data: ReportDetail }>(`/api/reports/${reportId}`);
      return res.data;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '获取报告详情失败'));
    }
  },

  // 一键切换公开状态
  setPublic: async (reportId: string, isPublic: boolean) => {
    try {
      const res = await apiClient.post<{ data: ReportPreview }>(
        `/api/reports/${reportId}/public`,
        { is_public: isPublic },
      );
      return res.data;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '更新公开状态失败'));
    }
  },

  // 导出 PDF（带封面研报，返回 Blob）
  exportPdf: async (reportId: string): Promise<Blob> => {
    try {
      const res = await apiClient.get(`/api/reports/${reportId}/export?format=pdf`, {
        responseType: 'blob',
      });
      return res.data as Blob;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '导出失败，请稍后重试'));
    }
  },
};

// 管理控制台 —— 仅保留公开报告治理（订阅商品/订单/LLM 配置已下线）
export const adminAPI = {
  publicReports: async (params?: { page?: number; limit?: number; market?: string }) => {
    try {
      const q: Record<string, unknown> = {};
      if (params?.page) q.page = params.page;
      if (params?.limit) q.limit = params.limit;
      if (params?.market) q.market = params.market;
      const res = await apiClient.get<{ data: AdminPublicReportItem[]; meta: ListMeta }>(
        '/api/admin/public-reports',
        { params: q },
      );
      return res.data;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '获取公开报告管理列表失败'));
    }
  },

  setReportPublic: async (reportId: string, isPublic: boolean) => {
    try {
      const res = await apiClient.post<{ data: unknown }>(`/api/admin/reports/${reportId}/public`, {
        is_public: isPublic,
      });
      return res.data;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '更新报告公开状态失败'));
    }
  },
};
