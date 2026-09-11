/**
 * 订阅 / 后台管理 / 报告 API（工作区线，合并上游主干后保留）。
 *
 * 背景：上游把前端 HTTP 层重构为 `@/lib/http-client`（HttpClient 类）+
 * `@/lib/apiClient`（axios 实例与域 API）+ `@/lib/api/*` 模块。本模块承接
 * 工作区线页面（`/subscribe`、`/me/subscription`、`/admin/orders`、
 * `/admin/subscription-products`、`/admin/public-reports`、`/public`、
 * `/reports/[id]`）所依赖的四个 API 对象，统一构建在上游的 axios 实例之上，
 * 以保证两条线的页面都能工作、HTTP 层只有一份实现。
 *
 * 端点与返回结构沿用工作区线实现（后端路由已合并保留），逐字未改。
 */

import type {
  AdminOrder,
  AdminPublicReportItem,
  AdminSubscriptionPlan,
  AdminUser,
  ReportDetail,
  ReportPreview,
  SubscriptionInfo,
  SubscriptionPlan,
} from '@/lib/types';
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

// 用临时 API Key 获取某提供商的可用模型列表（自定义模型设置页用，Key 不持久化）
export const llmAPI = {
  fetchModelsTransient: async (data: {
    base_url: string;
    api_key: string;
    provider_type?: string;
  }) => {
    try {
      const res = await apiClient.post<{ models: string[]; count: number }>(
        '/api/llm/fetch-models',
        data,
      );
      return res.data;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '获取模型列表失败'));
    }
  },
};

// 订阅 / 按次
export const subscriptionAPI = {
  plans: async () => {
    try {
      const res = await apiClient.get<{ data: SubscriptionPlan[] }>('/api/subscription/plans');
      return res.data;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '获取订阅套餐失败'));
    }
  },

  me: async () => {
    try {
      const res = await apiClient.get<{ data: SubscriptionInfo }>('/api/subscription/me');
      return res.data;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '获取订阅信息失败'));
    }
  },

  purchase: async (planId: number) => {
    try {
      const res = await apiClient.post<{ data: SubscriptionInfo }>(
        '/api/subscription/purchase',
        { plan_id: planId },
      );
      return res.data;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '购买失败'));
    }
  },
};

// 管理控制台（用户 / 订阅商品 / 公开报告 / 供应商模型 / 订单）
export const adminAPI = {
  users: async (params?: { page?: number; limit?: number; search?: string }) => {
    try {
      const q: Record<string, unknown> = {};
      if (params?.page) q.page = params.page;
      if (params?.limit) q.limit = params.limit;
      if (params?.search) q.search = params.search;
      const res = await apiClient.get<{ data: AdminUser[]; meta: ListMeta }>('/api/admin/users', {
        params: q,
      });
      return res.data;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '获取用户列表失败'));
    }
  },

  setUserActive: async (userId: number, isActive: boolean) => {
    try {
      const res = await apiClient.post<{ data: AdminUser }>(`/api/admin/users/${userId}/active`, {
        is_active: isActive,
      });
      return res.data;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '更新用户状态失败'));
    }
  },

  setUserRole: async (userId: number, role: 'user' | 'admin') => {
    try {
      const res = await apiClient.post<{ data: AdminUser }>(`/api/admin/users/${userId}/role`, {
        role,
      });
      return res.data;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '更新用户角色失败'));
    }
  },

  subscriptionProducts: async () => {
    try {
      const res = await apiClient.get<{ data: AdminSubscriptionPlan[] }>(
        '/api/admin/subscription-products',
      );
      return res.data;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '获取订阅商品失败'));
    }
  },

  createSubscriptionProduct: async (data: {
    name: string;
    credits: number;
    price: number;
    description?: string;
    is_active?: boolean;
  }) => {
    try {
      const res = await apiClient.post<{ data: AdminSubscriptionPlan }>(
        '/api/admin/subscription-products',
        data,
      );
      return res.data;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '创建订阅商品失败'));
    }
  },

  updateSubscriptionProduct: async (
    planId: number,
    data: {
      name?: string;
      credits?: number;
      price?: number;
      description?: string;
      is_active?: boolean;
    },
  ) => {
    try {
      const res = await apiClient.patch<{ data: AdminSubscriptionPlan }>(
        `/api/admin/subscription-products/${planId}`,
        data,
      );
      return res.data;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '更新订阅商品失败'));
    }
  },

  deleteSubscriptionProduct: async (planId: number) => {
    try {
      const res = await apiClient.delete<{ data: { id: number; deleted: boolean } }>(
        `/api/admin/subscription-products/${planId}`,
      );
      return res.data;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '删除订阅商品失败'));
    }
  },

  // 公开报告管理（治理 / 可见性）
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

  // 获取某个供应商的可用模型列表（调用其 /v1/models）
  fetchProviderModels: async (providerId: number) => {
    try {
      const res = await apiClient.post<{
        provider_id: number;
        provider_name: string;
        base_url: string;
        count: number;
        models: string[];
      }>(`/api/admin/llm/providers/${providerId}/fetch-models`);
      return res.data;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '获取供应商模型失败'));
    }
  },

  // 订单列表（所有用户的次数流水）
  orders: async (params?: { page?: number; limit?: number; type?: string }) => {
    try {
      const q: Record<string, unknown> = {};
      if (params?.page) q.page = params.page;
      if (params?.limit) q.limit = params.limit;
      if (params?.type) q.type = params.type;
      const res = await apiClient.get<{ data: AdminOrder[]; meta: ListMeta }>('/api/admin/orders', {
        params: q,
      });
      return res.data;
    } catch (error: unknown) {
      throw new Error(errMessage(error, '获取订单列表失败'));
    }
  },
};