/** Common ISO 4217 currencies for rate / money entry. */
export const CURRENCY_OPTIONS = [
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'CHF', label: 'CHF — Swiss Franc' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
  { code: 'NZD', label: 'NZD — New Zealand Dollar' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'SEK', label: 'SEK — Swedish Krona' },
  { code: 'NOK', label: 'NOK — Norwegian Krone' },
  { code: 'DKK', label: 'DKK — Danish Krone' },
  { code: 'ZAR', label: 'ZAR — South African Rand' },
  { code: 'AED', label: 'AED — UAE Dirham' },
] as const;

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]['code'];

export function ensureCurrencyOption(
  code: string | null | undefined,
): string {
  const normalised = (code || 'GBP').toUpperCase();
  if (CURRENCY_OPTIONS.some((c) => c.code === normalised)) {
    return normalised;
  }
  return normalised;
}
