// Shared by server and client code. All money is stored as integer cents.

export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "PKR";

const moneyFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY,
  // Always show minor units so journal amounts are exact (CLDR shows PKR with none).
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(cents: number): string {
  return moneyFormat.format(cents / 100);
}

/** Parses "1,234.50" into 123450. Returns 0 for blank and NaN for invalid input. */
export function toCents(value: unknown): number {
  const s = String(value ?? "").replace(/,/g, "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/** Today's date in local time, as YYYY-MM-DD. */
export function today(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function monthStart(): string {
  return today().slice(0, 8) + "01";
}

export function yearStart(): string {
  return today().slice(0, 4) + "-01-01";
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}
