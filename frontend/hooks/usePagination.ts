"use client";
import { useCallback, useState } from "react";

export function usePagination(pageSize = 20) {
  const [page, setPage] = useState(0);
  const next = useCallback(() => setPage((p) => p + 1), []);
  const prev = useCallback(() => setPage((p) => Math.max(0, p - 1)), []);
  const reset = useCallback(() => setPage(0), []);
  return { page, pageSize, next, prev, reset, setPage };
}
