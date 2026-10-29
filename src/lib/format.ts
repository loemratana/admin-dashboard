// Dates are formatted in UTC from fixed ISO strings so server and client render the same text.
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const number = new Intl.NumberFormat("en-US");
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

// Date-only and zone-less strings are read as UTC; strings with Z or an offset are used as-is.
const toUtc = (iso: string) => {
  if (iso.length === 10) return new Date(`${iso}T00:00:00Z`);
  return new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`);
};

export const formatCurrency = (value: number) => currency.format(value);
export const formatNumber = (value: number) => number.format(value);
export const formatShortDate = (iso: string) => shortDate.format(toUtc(iso));
export const formatLongDate = (iso: string) => longDate.format(toUtc(iso));
export const formatDateTime = (iso: string) => dateTime.format(toUtc(iso));
export const formatDayOfMonth = (iso: string) => String(toUtc(iso).getUTCDate());
