// Formatting helpers matching the Flutter screens' intl usage.

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `NumberFormat.currency(symbol: 'R')` equivalent. */
export const formatCurrency = (amount: number | null | undefined): string =>
  `R${currencyFormatter.format(Number.isFinite(Number(amount)) ? Number(amount) : 0)}`;

/** `'R${value.toStringAsFixed(2)}'` equivalent (no thousands separators). */
export const formatMoney = (amount: number | null | undefined): string => {
  const value = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return `R${value.toFixed(2)}`;
};

export const formatTime = (date: Date): string =>
  `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

export const formatDate = (date: Date): string =>
  date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });

export const formatDateTime = (date: Date): string =>
  `${formatDate(date)}, ${formatTime(date)}`;

/** Compact relative time used by the notification inbox. */
export const timeAgo = (date: Date, now: Date = new Date()): string => {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
};

export const initialsOf = (name: string | null | undefined): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};
