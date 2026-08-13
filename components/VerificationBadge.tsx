const LABELS: Record<string, string> = {
  A: 'A Verified Checkout',
  B: 'B Official Website',
  C: 'C Discovery Only'
};

const COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-orange-100 text-orange-800',
  C: 'bg-zinc-100 text-zinc-600'
};

export function VerificationBadge({
  level
}: {
  level: string;
}) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
        COLORS[level] ?? COLORS.C
      }`}
      title={
        level === 'C'
          ? 'Unverified lead'
          : undefined
      }
    >
      {LABELS[level] ??
        `${level} Unknown`}
    </span>
  );
}