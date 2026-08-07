import { fetcher } from "@/lib/fetcher";
import { getSessionToken } from "@/lib/auth";

function buildHeaders(init?: RequestInit): HeadersInit {
  const headers: Record<string, string> = {};
  if (init?.headers) {
    const incoming = new Headers(init.headers);
    incoming.forEach((value, key) => {
      headers[key] = value;
    });
  }
  if (!headers["Content-Type"] && init?.body && typeof init.body === "string") {
    headers["Content-Type"] = "application/json";
  }
  const token = getSessionToken();
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export const apiClient = {
  get: <T>(url: string) => fetcher<T>(url, { method: "GET", headers: buildHeaders() }),
  post: <T>(url: string, body?: unknown) =>
    fetcher<T>(url, {
      method: "POST",
      headers: buildHeaders({ body: body ? JSON.stringify(body) : undefined }),
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(url: string, body?: unknown) =>
    fetcher<T>(url, {
      method: "PATCH",
      headers: buildHeaders({ body: body ? JSON.stringify(body) : undefined }),
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(url: string) => fetcher<T>(url, { method: "DELETE", headers: buildHeaders() }),
};
