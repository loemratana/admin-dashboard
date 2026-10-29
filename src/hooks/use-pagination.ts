"use client";

import { useState } from "react";

type UsePaginationOptions = {
  pageSize?: number;
  // Changing this value (e.g. a serialized filter state) sends you back to page 1.
  resetKey?: string;
};

export function usePagination<T>(items: T[], { pageSize = 10, resetKey = "" }: UsePaginationOptions = {}) {
  const [requestedPage, setPage] = useState(1);
  const [lastResetKey, setLastResetKey] = useState(resetKey);

  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  // Clamp so deleting the last row on a page never leaves you on an empty page.
  const page = Math.min(requestedPage, pageCount);
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);

  return { page, pageCount, pageSize, pageItems, totalItems: items.length, setPage };
}
