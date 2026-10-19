type DayLite = { date: string; photo_count?: number | null; has_notes?: boolean | null };

const active = (d: DayLite) => (d.photo_count ?? 0) > 0 || !!d.has_notes;

/**
 * Opening day for a live share page. Today wins when it has any update;
 * otherwise the most recent earlier day with photos or notes, so the page
 * never opens empty while crews upload at end of day. Falls back to today
 * when nothing has ever been recorded.
 */
export function pickDefaultDate(days: DayLite[], today: string): { date: string | null; isFallback: boolean } {
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
  const todayRow = sorted.find((d) => d.date === today);
  if (todayRow && active(todayRow)) return { date: today, isFallback: false };
  const past = sorted.filter((d) => d.date < today && active(d));
  if (past.length) return { date: past[past.length - 1].date, isFallback: true };
  if (todayRow || sorted.length === 0) return { date: sorted.length ? today : null, isFallback: false };
  const anyPast = sorted.filter((d) => d.date <= today);
  return { date: (anyPast.length ? anyPast[anyPast.length - 1] : sorted[sorted.length - 1]).date, isFallback: false };
}
