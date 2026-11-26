const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Calendar date (YYYY-MM-DD) in India Standard Time. */
export function toIstDate(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Human-readable IST timestamp, e.g. `26 Nov 2026, 11:14 am IST`. */
export function formatIstTimestamp(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const hours = ist.getUTCHours();
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const mm = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${ist.getUTCDate()} ${months[ist.getUTCMonth()]} ${ist.getUTCFullYear()}, ${h12}:${mm} ${hours < 12 ? 'am' : 'pm'} IST`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(toIso) - parse(fromIso)) / 86_400_000);
}
