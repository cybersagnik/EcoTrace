"use client";
import { useState } from "react";

export function usePagination(pageSize = 20) {
  const [page, setPage] = useState(0);
  return { page, pageSize, next: () => setPage((p) => p + 1), prev: () => setPage((p) => Math.max(0, p - 1)) };
}
