import { getTranslations } from "next-intl/server";

function Line({ messages, decorative = false }: { messages: string[]; decorative?: boolean }) {
  return (
    <p className="flex shrink-0 items-center" aria-hidden={decorative || undefined}>
      {messages.map((message) => (
        <span key={message} className="px-8 text-sm whitespace-nowrap">
          <span aria-hidden="true" className="me-8 text-rose">
            ·
          </span>
          {message}
        </span>
      ))}
    </p>
  );
}

export async function AnnouncementBar() {
  const t = await getTranslations("home");
  const brand = await getTranslations("common");
  const messages = [1, 2, 3, 4, 5, 6, 7].map((index) => t(`announce${index}` as "announce1"));

  return (
    <div className="overflow-hidden bg-ink py-2 text-surface" role="region" aria-label={brand("brand")} dir="ltr">
      <style>{`
        @keyframes lamsa-ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .lamsa-ticker:hover { animation-play-state: paused; }
      `}</style>
      <div className="lamsa-ticker flex w-max" style={{ animation: "lamsa-ticker 46s linear infinite" }}>
        <Line messages={messages} />
        <Line messages={messages} decorative />
      </div>
    </div>
  );
}
