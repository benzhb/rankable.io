import { useEffect, useState } from "react";

export function useServerTimer(deadline: string | null): number | null {
  const calculate = () =>
    deadline ? Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1_000)) : null;
  const [remaining, setRemaining] = useState<number | null>(calculate);

  useEffect(() => {
    setRemaining(calculate());
    if (!deadline) return;
    const timer = window.setInterval(() => setRemaining(calculate()), 200);
    return () => window.clearInterval(timer);
  }, [deadline]);

  return remaining;
}
