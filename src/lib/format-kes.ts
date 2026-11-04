// Money display: numeric KES, always two decimal places. Never locale-formatted
// (CLDR renders the Kenyan shilling as "Ksh", which is not the required label).
const kesFormatter = new Intl.NumberFormat('en-KE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatKes(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return `KES ${kesFormatter.format(value)}`;
}
