import { useEffect, useState } from "react";

const NOTICE_DURATION_MS = 4_000;

export function SkipNotice({ skippedCard }: {
  skippedCard: { title: string; skippedAt: string } | null;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!skippedCard) {
      setVisible(false);
      return;
    }
    const remaining = NOTICE_DURATION_MS - (Date.now() - Date.parse(skippedCard.skippedAt));
    if (remaining <= 0) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), remaining);
    return () => window.clearTimeout(timeout);
  }, [skippedCard?.skippedAt, skippedCard?.title]);

  if (!visible || !skippedCard) return null;
  return <div className="skip-notice" role="status"><strong>{skippedCard.title}</strong> was skipped</div>;
}
