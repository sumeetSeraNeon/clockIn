/** Shared money display helpers (FIX 3). */

const SYMBOLS: Record<string, string> = {
  GBP: '£',
  EUR: '€',
  USD: '$',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'CHF',
  INR: '₹',
  JPY: '¥',
  NZD: 'NZ$',
  SGD: 'S$',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  ZAR: 'R',
  AED: 'د.إ',
};

export function resolveCurrency(
  clientCurrency?: string | null,
  orgCurrency?: string | null,
): string {
  const code = (clientCurrency || orgCurrency || 'GBP').toUpperCase();
  return code;
}

export function currencySymbol(code: string | null | undefined): string {
  const normalised = (code || 'GBP').toUpperCase();
  return SYMBOLS[normalised] ?? normalised;
}

/**
 * Format an amount with the resolved currency, e.g. "£ 125.00" or "125.00 INR".
 */
export function formatMoney(
  amount: string | number | null | undefined,
  currency?: string | null,
): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  const code = (currency || 'GBP').toUpperCase();
  const formatted = n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const symbol = SYMBOLS[code];
  if (symbol) return `${symbol} ${formatted}`;
  return `${formatted} ${code}`;
}
