import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

const items = [
  { href: "/account", id: "profile", label: "profileTitle" },
  { href: "/account/orders", id: "orders", label: "ordersTitle" },
  { href: "/account/change-password", id: "password", label: "changeTitle" },
] as const;

export async function AccountLinks({
  current,
}: {
  current: (typeof items)[number]["id"];
}) {
  const t = await getTranslations("account");

  return (
    <nav aria-label={t("nav")}>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = item.id === current;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "inline-flex h-11 items-center rounded-2xl bg-rose-deep px-4 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
                    : "inline-flex h-11 items-center rounded-2xl border border-line bg-surface px-4 text-sm text-ink hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
                }
              >
                {t(item.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
