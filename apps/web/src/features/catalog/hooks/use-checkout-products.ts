"use client";

import type { DraftSnapshot } from "@/features/orders/lib/order-draft";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { catalogKeys, loadProduct } from "../services/catalog.service";
import type { ProductState } from "@/features/catalog/types";
export function useCheckoutProducts(userId: number, snapshot: DraftSnapshot) {
  const queryClient = useQueryClient();
  const [products, setProducts] = useState<Map<number, ProductState>>(new Map());
  const lineKey = snapshot.lines.map((line) => line.productId).join(",");

  useEffect(() => {
    if (!snapshot.ready || snapshot.lines.length === 0) {
      return;
    }
    let cancelled = false;
    const ids = snapshot.lines.map((line) => line.productId);
    void (async () => {
      const entries = await Promise.all(ids.map(async (id) => [id, await queryClient.fetchQuery({
        queryKey: catalogKeys.checkoutProduct(userId, id),
        queryFn: () => loadProduct(id),
        staleTime: 0,
        gcTime: 0,
      })] as const));
      if (cancelled) {
        return;
      }
      setProducts((current) => {
        const next = new Map(current);
        for (const [id, value] of entries) {
          next.set(id, value);
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [snapshot.ready, lineKey, snapshot.lines, userId, queryClient]);

  return products;
}
