import { fetcher } from "@/lib/fetcher";

// Thin named wrapper around fetcher — the one place a base URL or default
// headers would be added if the API ever moves off same-origin mocks.
export const apiClient = {
  get: <T>(url: string) => fetcher<T>(url, { method: "GET" }),
};
