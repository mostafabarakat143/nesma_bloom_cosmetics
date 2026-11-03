import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

export const mainNav = [
  { href: "/", key: "home" },
  { href: "/shop", key: "shop" },
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
] as const;
