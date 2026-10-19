import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  message,
  href,
  action,
}: {
  title: string;
  message: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-6 py-10">
      <h2 className="font-display text-3xl text-ink">{title}</h2>
      <p className="mt-3 text-muted">{message}</p>
      {href && action ? (
        <div className="mt-6">
          <Button href={href} variant="secondary">
            {action}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
