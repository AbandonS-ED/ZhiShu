# 智枢 (SmartHub) 前端 API 集成文档

> ⚠️ **DEPRECATED · 2026-06-09**
>
> 本文档描述的 `ApiClient` 类、Token 刷新、SWR 集成、Auth 模块等**全部未在项目中实现**。
>
> **实际项目**（2026-06-09）只用了一个轻量 `lib/api.ts`：7 个 module（profile/chat/resource/exercise/path/tutor/dashboard/evaluation），用 `fetch` + `ReadableStream` 解析 SSE，无 Token / SWR / Auth。
>
> 真实前端 API 用法见 [`frontend/src/lib/api.ts`](../../frontend/src/lib/api.ts) 和 [`frontend/src/lib/student.ts`](../../frontend/src/lib/student.ts)。**不要按本文档动手开发。**
>
> 保留仅作历史参考 + 答辩材料。

> **版本**: v1.0
> **日期**: 2026-06-06
> **目标**: 详细说明前端与后端 API 的集成方式

---

## 1. API 客户端配置

### 1.1 基础配置

**文件位置**: `src/lib/api.ts`

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

class ApiClient {
  private token: string | null = null;
  private baseUrl: string;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(
        error.detail || `API Error: ${response.status}`,
        response.status,
        error
      );
    }

    return response.json();
  }

  // GET 请求
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = params
      ? `${endpoint}?${new URLSearchParams(params).toString()}`
      : endpoint;
    return this.request<T>(url, { method: "GET" });
  }

  // POST 请求
  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT 请求
  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // DELETE 请求
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

// 自定义错误类
export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// 单例实例
export const api = new ApiClient();
```

### 1.2 环境变量配置

**文件位置**: `.env.local`

```env
# API 地址
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

# 其他配置
NEXT_PUBLIC_APP_NAME=智枢 SmartHub
```

---

## 2. API 接口封装

### 2.1 画像 API

**文件位置**: `src/lib/api/profile.ts`

```typescript
import { api } from "../api";
import type {
  StudentProfile,
  ProfileDimensions,
  ApiResponse,
} from "@/types";

export const profileApi = {
  // 构建画像
  async build(data: {
    student_id: string;
    course_id: string;
    answers: Record<string, any>;
  }): Promise<StudentProfile> {
    return api.post<StudentProfile>("/profile/build", data);
  },

  // 获取画像
  async get(studentId: string, courseId: string): Promise<StudentProfile> {
    return api.get<StudentProfile>(`/profile/${studentId}/${courseId}`);
  },

  // 更新画像
  async update(
    studentId: string,
    courseId: string,
    data: {
      action: string;
      data: Record<string, any>;
    }
  ): Promise<ApiResponse<any>> {
    return api.put<ApiResponse<any>>(
      `/profile/${studentId}/${courseId}`,
      data
    );
  },
};
```

### 2.2 资源 API

**文件位置**: `src/lib/api/resource.ts`

```typescript
import { api } from "../api";
import type { Resource, PaginatedResponse } from "@/types";

export const resourceApi = {
  // 生成资源
  async generate(data: {
    student_id: string;
    course_id: string;
    topic: string;
    type: string;
  }): Promise<Resource> {
    return api.post<Resource>("/resources/generate", data);
  },

  // 获取资源列表
  async list(
    studentId: string,
    courseId: string,
    params?: {
      type?: string;
      page?: number;
      page_size?: number;
    }
  ): Promise<PaginatedResponse<Resource>> {
    const searchParams: Record<string, string> = {
      student_id: studentId,
      course_id: courseId,
    };

    if (params?.type) searchParams.type = params.type;
    if (params?.page) searchParams.page = String(params.page);
    if (params?.page_size) searchParams.page_size = String(params.page_size);

    return api.get<PaginatedResponse<Resource>>("/resources", searchParams);
  },

  // 获取资源详情
  async get(resourceId: string): Promise<Resource> {
    return api.get<Resource>(`/resources/${resourceId}`);
  },

  // 删除资源
  async delete(resourceId: string): Promise<void> {
    return api.delete<void>(`/resources/${resourceId}`);
  },
};
```

### 2.3 路径 API

**文件位置**: `src/lib/api/path.ts`

```typescript
import { api } from "../api";
import type { LearningPath } from "@/types";

export const pathApi = {
  // 生成学习路径
  async generate(studentId: string, courseId: string): Promise<LearningPath> {
    return api.post<LearningPath>("/path/generate", {
      student_id: studentId,
      course_id: courseId,
    });
  },

  // 获取学习路径
  async get(pathId: string): Promise<LearningPath> {
    return api.get<LearningPath>(`/path/${pathId}`);
  },

  // 获取学生的所有路径
  async listByStudent(
    studentId: string,
    courseId: string
  ): Promise<LearningPath[]> {
    return api.get<LearningPath[]>("/path", {
      student_id: studentId,
      course_id: courseId,
    });
  },

  // 更新路径节点状态
  async updateNodeStatus(
    pathId: string,
    nodeId: string,
    status: "pending" | "in_progress" | "completed"
  ): Promise<void> {
    return api.put<void>(`/path/${pathId}/nodes/${nodeId}`, { status });
  },
};
```

### 2.4 辅导 API

**文件位置**: `src/lib/api/tutor.ts`

```typescript
import { api } from "../api";
import type { ChatMessage } from "@/types";

export const tutorApi = {
  // 提问
  async ask(data: {
    student_id: string;
    course_id: string;
    question: string;
    session_id?: string;
  }): Promise<ChatMessage> {
    return api.post<ChatMessage>("/tutor/ask", data);
  },

  // 获取会话历史
  async getHistory(
    studentId: string,
    courseId: string,
    sessionId: string
  ): Promise<ChatMessage[]> {
    return api.get<ChatMessage[]>(`/tutor/history`, {
      student_id: studentId,
      course_id: courseId,
      session_id: sessionId,
    });
  },
};
```

### 2.5 任务 API

**文件位置**: `src/lib/api/task.ts`

```typescript
import { api } from "../api";
import type { TaskProgress } from "@/types";

export const taskApi = {
  // 获取任务进度
  async getProgress(taskId: string): Promise<TaskProgress> {
    return api.get<TaskProgress>(`/tasks/${taskId}`);
  },

  // 取消任务
  async cancel(taskId: string): Promise<void> {
    return api.post<void>(`/tasks/${taskId}/cancel`);
  },
};
```

---

## 3. SSE 流式连接

### 3.1 SSE Hook

**文件位置**: `src/hooks/useSSE.ts`

```typescript
"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { SSEEvent } from "@/types";

interface UseSSEOptions {
  url: string;
  params?: Record<string, string>;
  onEvent?: (event: SSEEvent) => void;
  onStart?: (data: any) => void;
  onProgress?: (data: any) => void;
  onResource?: (data: any) => void;
  onMessage?: (data: any) => void;
  onDone?: () => void;
  onError?: (error: Event) => void;
}

interface UseSSEReturn {
  connect: () => void;
  disconnect: () => void;
  isConnected: boolean;
  error: Event | null;
}

export function useSSE({
  url,
  params,
  onEvent,
  onStart,
  onProgress,
  onResource,
  onMessage,
  onDone,
  onError,
}: UseSSEOptions): UseSSEReturn {
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Event | null>(null);

  const buildUrl = useCallback(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const fullUrl = `${baseUrl}${url}`;
    
    if (params) {
      const searchParams = new URLSearchParams(params);
      return `${fullUrl}?${searchParams.toString()}`;
    }
    
    return fullUrl;
  }, [url, params]);

  const connect = useCallback(() => {
    // 断开之前的连接
    disconnect();

    const fullUrl = buildUrl();
    const eventSource = new EventSource(fullUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    // 通用事件处理
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onEvent?.({ event: "message", data: event.data });
      } catch (e) {
        console.error("SSE parse error:", e);
      }
    };

    // 特定事件处理
    eventSource.addEventListener("start", (event) => {
      try {
        const data = JSON.parse(event.data);
        onStart?.(data);
        onEvent?.({ event: "start", data: event.data });
      } catch (e) {
        console.error("SSE start event parse error:", e);
      }
    });

    eventSource.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse(event.data);
        onProgress?.(data);
        onEvent?.({ event: "progress", data: event.data });
      } catch (e) {
        console.error("SSE progress event parse error:", e);
      }
    });

    eventSource.addEventListener("resource", (event) => {
      try {
        const data = JSON.parse(event.data);
        onResource?.(data);
        onEvent?.({ event: "resource", data: event.data });
      } catch (e) {
        console.error("SSE resource event parse error:", e);
      }
    });

    eventSource.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage?.(data);
        onEvent?.({ event: "message", data: event.data });
      } catch (e) {
        console.error("SSE message event parse error:", e);
      }
    });

    eventSource.addEventListener("done", () => {
      onDone?.();
      onEvent?.({ event: "done", data: "" });
      disconnect();
    });

    eventSource.addEventListener("error", (event) => {
      console.error("SSE error:", event);
      setError(event);
      onError?.(event);
      onEvent?.({ event: "error", data: "" });
      disconnect();
    });

    eventSource.onerror = (event) => {
      console.error("SSE connection error:", event);
      setError(event);
      onError?.(event);
      setIsConnected(false);
    };
  }, [buildUrl, onEvent, onStart, onProgress, onResource, onMessage, onDone, onError]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // 组件卸载时断开连接
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    isConnected,
    error,
  };
}
```

### 3.2 SSE 使用示例

```tsx
"use client";

import React, { useState } from "react";
import { useSSE } from "@/hooks/useSSE";
import { useChatStore } from "@/stores/useChatStore";

interface ChatWindowProps {
  studentId: string;
  courseId: string;
}

export function ChatWindow({ studentId, courseId }: ChatWindowProps) {
  const [input, setInput] = useState("");
  const { addMessage, updateLastMessage, addResource } = useChatStore();

  const { connect, disconnect, isConnected } = useSSE({
    url: "/api/v1/stream/chat",
    params: {
      message: input,
      course_id: courseId,
      student_id: studentId,
    },
    onStart: (data) => {
      console.log("Task started:", data.task_id);
    },
    onProgress: (data) => {
      console.log("Progress:", data.progress);
    },
    onResource: (resource) => {
      addResource(resource);
    },
    onMessage: (data) => {
      updateLastMessage({
        content: data.content,
        citations: data.citations || [],
      });
    },
    onDone: () => {
      console.log("Task completed");
    },
    onError: (error) => {
      console.error("SSE error:", error);
    },
  });

  const handleSend = () => {
    if (!input.trim()) return;

    // 添加用户消息
    addMessage({
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    });

    // 添加助手消息占位
    addMessage({
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    });

    // 连接 SSE
    connect();
  };

  return (
    <div>
      {/* 消息列表 */}
      {/* ... */}

      {/* 输入框 */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入你的问题..."
          disabled={isConnected}
        />
        <button onClick={handleSend} disabled={isConnected || !input.trim()}>
          {isConnected ? "处理中..." : "发送"}
        </button>
      </div>
    </div>
  );
}
```

---

## 4. WebSocket 连接

### 4.1 WebSocket Hook

**文件位置**: `src/hooks/useWebSocket.ts`

```typescript
"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface UseWebSocketOptions {
  url: string;
  onMessage?: (data: any) => void;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
  send: (data: any) => void;
  disconnect: () => void;
  isConnected: boolean;
  reconnectCount: number;
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
}: UseWebSocketOptions): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);

  const connect = useCallback(() => {
    // 断开之前的连接
    disconnect();

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
    const fullUrl = `${wsUrl}${url}`;

    const ws = new WebSocket(fullUrl);
    wsRef.current = ws;

    ws.onopen = (event) => {
      setIsConnected(true);
      reconnectCountRef.current = 0;
      setReconnectCount(0);
      onOpen?.(event);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage?.(data);
      } catch (e) {
        console.error("WebSocket message parse error:", e);
      }
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      onClose?.(event);

      // 尝试重连
      if (
        !event.wasClean &&
        reconnectCountRef.current < maxReconnectAttempts
      ) {
        reconnectTimerRef.current = setTimeout(() => {
          reconnectCountRef.current += 1;
          setReconnectCount(reconnectCountRef.current);
          connect();
        }, reconnectInterval);
      }
    };

    ws.onerror = (event) => {
      console.error("WebSocket error:", event);
      onError?.(event);
    };
  }, [url, onMessage, onOpen, onClose, onError, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const send = useCallback(
    (data: any) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(data));
      } else {
        console.warn("WebSocket is not connected");
      }
    },
    []
  );

  // 组件卸载时断开连接
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    send,
    disconnect,
    isConnected,
    reconnectCount,
  };
}
```

### 4.2 WebSocket 使用示例

```tsx
"use client";

import React, { useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";

interface TaskProgressProps {
  taskId: string;
}

export function TaskProgress({ taskId }: TaskProgressProps) {
  const { send, isConnected, reconnectCount } = useWebSocket({
    url: `/ws/tasks/${taskId}`,
    onMessage: (data) => {
      console.log("Task progress:", data);
      // 更新任务进度
    },
    onOpen: () => {
      console.log("WebSocket connected");
    },
    onClose: () => {
      console.log("WebSocket disconnected");
    },
    onError: (error) => {
      console.error("WebSocket error:", error);
    },
  });

  return (
    <div>
      <p>连接状态: {isConnected ? "已连接" : "未连接"}</p>
      <p>重连次数: {reconnectCount}</p>
    </div>
  );
}
```

---

## 5. 数据获取 (SWR)

### 5.1 SWR 配置

**文件位置**: `src/lib/swr-config.tsx`

```typescript
"use client";

import { SWRConfig } from "swr";
import { api, ApiError } from "./api";

async function fetcher(url: string) {
  return api.get(url);
}

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        shouldRetryOnError: false,
        onError: (error) => {
          if (error instanceof ApiError) {
            if (error.status === 401) {
              // 处理未授权
              console.error("Unauthorized");
            } else if (error.status === 403) {
              // 处理禁止访问
              console.error("Forbidden");
            }
          }
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
```

### 5.2 SWR 使用示例

```tsx
"use client";

import React from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

interface ProfileProps {
  studentId: string;
  courseId: string;
}

export function Profile({ studentId, courseId }: ProfileProps) {
  const { data: profile, error, isLoading } = useSWR(
    `/profile/${studentId}/${courseId}`,
    () => api.get(`/profile/${studentId}/${courseId}`)
  );

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <div className="text-red-500">加载失败: {error.message}</div>;
  }

  if (!profile) {
    return <div>暂无画像数据</div>;
  }

  return (
    <div>
      <h2>学习画像</h2>
      {/* 渲染画像数据 */}
    </div>
  );
}
```

---

## 6. 错误处理

### 6.1 全局错误处理

**文件位置**: `src/lib/error-handler.ts`

```typescript
import { ApiError } from "./api";

export function handleApiError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return "请求参数错误";
      case 401:
        return "请先登录";
      case 403:
        return "没有权限";
      case 404:
        return "资源不存在";
      case 409:
        return "资源已存在";
      case 422:
        return "数据验证失败";
      case 429:
        return "请求过于频繁，请稍后再试";
      case 500:
        return "服务器内部错误";
      default:
        return error.message || "请求失败";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "未知错误";
}

export function showErrorToast(error: unknown) {
  const message = handleApiError(error);
  // 显示错误提示
  console.error(message);
  // 可以集成 toast 库
}
```

### 6.2 API 错误边界

```tsx
"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { ApiError } from "@/lib/api";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ApiErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("API Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isApiError = this.state.error instanceof ApiError;

      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-red-800 font-medium">请求出错</h3>
          <p className="text-red-600 text-sm mt-1">
            {isApiError
              ? (this.state.error as ApiError).message
              : "网络请求失败，请检查网络连接"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## 7. 认证管理

### 7.1 Token 管理

**文件位置**: `src/lib/auth.ts`

```typescript
import { api } from "./api";

const TOKEN_KEY = "zhishu_token";
const REFRESH_TOKEN_KEY = "zhishu_refresh_token";

export const auth = {
  // 获取 Token
  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  // 设置 Token
  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
    api.setToken(token);
  },

  // 清除 Token
  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    api.clearToken();
  },

  // 获取 Refresh Token
  getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  // 设置 Refresh Token
  setRefreshToken(token: string) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  },

  // 检查是否已登录
  isAuthenticated(): boolean {
    return !!this.getToken();
  },

  // 初始化 (页面加载时调用)
  init() {
    const token = this.getToken();
    if (token) {
      api.setToken(token);
    }
  },
};
```

### 7.2 登录/登出

```typescript
import { api } from "./api";
import { auth } from "./auth";

export async function login(studentNo: string, password: string) {
  const response = await api.post<{ token: string; refresh_token: string }>(
    "/auth/login",
    { student_no: studentNo, password }
  );

  auth.setToken(response.token);
  auth.setRefreshToken(response.refresh_token);

  return response;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } finally {
    auth.clearToken();
  }
}

export async function refreshToken() {
  const refreshToken = auth.getRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token");
  }

  const response = await api.post<{ token: string }>(
    "/auth/refresh",
    { refresh_token: refreshToken }
  );

  auth.setToken(response.token);
  return response;
}
```

---

## 8. 请求拦截器

### 8.1 自动刷新 Token

```typescript
import { api, ApiError } from "./api";
import { auth } from "./auth";
import { refreshToken } from "./auth";

// 原始请求方法
const originalRequest = api["request"].bind(api);

// 重写请求方法，添加自动刷新 Token 逻辑
api["request"] = async function <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    return await originalRequest<T>(endpoint, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // 尝试刷新 Token
      try {
        await refreshToken();
        // 重试原始请求
        return await originalRequest<T>(endpoint, options);
      } catch (refreshError) {
        // 刷新 Token 失败，跳转登录页
        auth.clearToken();
        window.location.href = "/login";
        throw refreshError;
      }
    }
    throw error;
  }
};
```

---

## 9. 类型定义

### 9.1 API 响应类型

```typescript
// 通用响应
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// 错误响应
export interface ErrorResponse {
  detail: string;
  status_code: number;
}
```

### 9.2 请求类型

```typescript
// 画像构建请求
export interface ProfileBuildRequest {
  student_id: string;
  course_id: string;
  answers: Record<string, any>;
}

// 资源生成请求
export interface ResourceGenerateRequest {
  student_id: string;
  course_id: string;
  topic: string;
  type: string;
}

// 路径生成请求
export interface PathGenerateRequest {
  student_id: string;
  course_id: string;
}

// 辅导提问请求
export interface TutorAskRequest {
  student_id: string;
  course_id: string;
  question: string;
  session_id?: string;
}
```

---

## 10. 测试

### 10.1 API 单元测试

```typescript
// __tests__/api/profile.test.ts
import { profileApi } from "@/lib/api/profile";
import { api } from "@/lib/api";

jest.mock("@/lib/api");

describe("profileApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should build profile", async () => {
    const mockResponse = {
      id: "1",
      student_id: "student1",
      course_id: "course1",
      dimensions: {},
      confidence: 0.5,
      version: 1,
    };

    (api.post as jest.Mock).mockResolvedValue(mockResponse);

    const result = await profileApi.build({
      student_id: "student1",
      course_id: "course1",
      answers: {},
    });

    expect(result).toEqual(mockResponse);
    expect(api.post).toHaveBeenCalledWith("/profile/build", {
      student_id: "student1",
      course_id: "course1",
      answers: {},
    });
  });

  it("should get profile", async () => {
    const mockResponse = {
      id: "1",
      student_id: "student1",
      course_id: "course1",
      dimensions: {},
      confidence: 0.5,
      version: 1,
    };

    (api.get as jest.Mock).mockResolvedValue(mockResponse);

    const result = await profileApi.get("student1", "course1");

    expect(result).toEqual(mockResponse);
    expect(api.get).toHaveBeenCalledWith("/profile/student1/course1");
  });
});
```

---

**文档版本**: v1.0  
**最后更新**: 2026-06-06  
**维护者**: SmartHub 开发团队
