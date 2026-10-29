"use client";
import { ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { readDraftSnapshot, subscribeDraft } from "@/lib/order-draft";
function productCount(userId: number): number {
  const products = new Set(readDraftSnapshot(userId).lines.map((line) => line.productId));
  return products.size;
}
export function CartLink({ userId }: { userId: number | null }) {
  const t = useTranslations("common");
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (userId === null) {
      return;
    }
    const read = () => setCount(productCount(userId));
    read();
    return subscribeDraft(read);
  }, [userId]);
  return (
    <Link
      href="/checkout"
      aria-label={t("cartCount", { count })}
      className="relative inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
    >
      <ShoppingCart aria-hidden="true" className="size-5" />
      {count > 0 ? (
        <span className="absolute top-1 inset-e-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-deep px-1 text-[11px] leading-none font-medium text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
