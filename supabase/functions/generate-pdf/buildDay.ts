/** Date-only arithmetic avoids viewer timezone and daylight-saving drift. */
export function buildDayNumber(reportDate: string, buildStart: string | null | undefined): number | null {
  if (!buildStart) return null;
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : NaN;
  };
  const start = parse(buildStart);
  const date = parse(reportDate);
  if (!Number.isFinite(start) || !Number.isFinite(date) || date < start) return null;
  return Math.floor((date - start) / 86400000) + 1;
}