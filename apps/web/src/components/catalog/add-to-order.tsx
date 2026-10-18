"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { addProduct } from "@/lib/order-draft";
import { maxPurchasableQuantity } from "@/lib/orders/payload";

export function AddToOrder({
  productId,
  inStock,
  stockQty,
  ownerId,
  accountUnavailable,
}: {
  productId: number;
  inStock: boolean;
  stockQty: number | null;
  ownerId: number | null;
  accountUnavailable: boolean;
}) {
  const maxQty = maxPurchasableQuantity({ inStock, stockQty });
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (accountUnavailable) {
    return (
      <p role="status" className="mt-6 text-sm text-muted">
        Account status is temporarily unavailable. You can still browse.
      </p>
    );
  }

  function changeQuantity(next: number) {
    if (!Number.isInteger(next)) {
      return;
    }
    setQuantity(Math.min(Math.max(next, 1), Math.max(maxQty, 1)));
  }

  function add() {
    setError(null);
    setMessage(null);
    const result = addProduct(ownerId ?? "guest", productId, quantity, maxQty);
    if (result === "added") {
      setMessage("Added to your order.");
      return;
    }
    if (result === "clamped") {
      setMessage("Added up to the available quantity.");
      return;
    }
    if (result === "full") {
      setError("An order can include at most 50 products.");
      return;
    }
    if (result === "pending") {
      setError("Finish or retry the order already in progress before changing it.");
      return;
    }
    if (result === "unavailable") {
      setError("This product is out of stock.");
      return;
    }
    setError("Enter a whole quantity between 1 and 100.");
  }

  return (
    <div className="mt-6">
      {maxQty === 0 ? (
        <p className="text-sm text-rose-deep">This product is out of stock.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Quantity" className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity <= 1}
              onClick={() => changeQuantity(quantity - 1)}
              className="inline-flex size-11 items-center justify-center rounded-2xl border border-line bg-surface text-ink hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep disabled:opacity-60"
            >
              −
            </button>
            <input
              id={`quantity-${productId}`}
              aria-label="Quantity"
              inputMode="numeric"
              value={String(quantity)}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (event.target.value.trim() === "") {
                  setQuantity(1);
                  return;
                }
                if (Number.isInteger(next)) {
                  changeQuantity(next);
                }
              }}
              className="h-11 w-16 rounded-2xl border border-line bg-bg text-center text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
            />
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={quantity >= maxQty}
              onClick={() => changeQuantity(quantity + 1)}
              className="inline-flex size-11 items-center justify-center rounded-2xl border border-line bg-surface text-ink hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep disabled:opacity-60"
            >
              +
            </button>
          </div>
          <p className="text-sm text-muted">
            {stockQty !== null ? `${stockQty} available` : "Available to order"}
          </p>
        </div>
      )}
      {message ? (
        <p role="status" className="mt-4 text-sm text-ink">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-rose-deep">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" disabled={maxQty === 0} onClick={add}>
          Add to order
        </Button>
        <Button href="/checkout" variant="secondary">
          Review order
        </Button>
      </div>
    </div>
  );
}
