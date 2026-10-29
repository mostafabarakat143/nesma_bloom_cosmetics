import { Link } from "@/i18n/navigation";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "unstyled";

const variantClass: Record<Variant, string> = {
  primary: "bg-rose-deep text-white hover:bg-rose-hover",
  secondary: "border border-rose bg-surface text-ink hover:bg-blush",
  ghost: "text-rose-deep hover:bg-blush",
  unstyled: "",
};

const baseClass =
  "inline-flex h-11 items-center justify-center rounded-2xl px-5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep disabled:pointer-events-none disabled:opacity-60";

type CommonProps = {
  variant?: Variant;
  className?: string;
};

type ButtonAsLink = CommonProps &
  Omit<ComponentProps<typeof Link>, "className"> & { href: string };

type ButtonAsButton = CommonProps &
  ComponentProps<"button"> & { href?: undefined };

function classesFor(variant: Variant = "primary", className = "") {
  if (variant === "unstyled") {
    return className;
  }
  return `${baseClass} ${variantClass[variant]} ${className}`;
}

export function Button(props: ButtonAsLink | ButtonAsButton) {
  if (typeof props.href === "string") {
    return <LinkButton {...props} href={props.href} />;
  }

  return <NativeButton {...props} />;
}

function LinkButton({
  href,
  variant,
  className,
  ...linkProps
}: ButtonAsLink) {
  return (
    <Link
      href={href}
      className={classesFor(variant, className)}
      {...linkProps}
    />
  );
}

function NativeButton({
  variant,
  className,
  type = "button",
  ...buttonProps
}: ButtonAsButton) {
  return (
    <button
      type={type}
      className={classesFor(variant, className)}
      {...buttonProps}
    />
  );
}
