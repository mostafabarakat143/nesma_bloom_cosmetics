const messages = [
  "Everyday care, thoughtfully made.",
  "Your beauty blooms with Lamsa.",
  "Seasonal offers on skincare and fragrance.",
  "A little offer for the ritual you repeat.",
  "Natural beauty and fragrance, for a quiet routine.",
  "Shop the offers. Keep the routine simple.",
  "A gentle touch, from cleanser to cream.",
];

function Line({ decorative = false }: { decorative?: boolean }) {
  return (
    <p className="flex shrink-0 items-center" aria-hidden={decorative || undefined}>
      {messages.map((message) => (
        <span key={message} className="px-8 text-sm whitespace-nowrap">
          <span aria-hidden="true" className="mr-8 text-rose">
            ·
          </span>
          {message}
        </span>
      ))}
    </p>
  );
}

export function AnnouncementBar() {
  return (
    <div className="overflow-hidden bg-ink py-2 text-surface" role="region" aria-label="Lamsa">
      <style>{`
        @keyframes lamsa-ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .lamsa-ticker:hover { animation-play-state: paused; }
      `}</style>
      <div className="lamsa-ticker flex w-max" style={{ animation: "lamsa-ticker 46s linear infinite" }}>
        <Line />
        <Line decorative />
      </div>
    </div>
  );
}
