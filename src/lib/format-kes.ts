const kes = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 2,
});

export function formatKes(amount: number): string {
  return kes.format(Number.isFinite(amount) ? amount : 0);
}
