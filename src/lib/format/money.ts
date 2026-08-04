import type { Currency } from '@/lib/validation/art';

/**
 * Prisma returns `Decimal` for money, which serialises to a string across the
 * server/client boundary. Accepting both keeps callers from having to convert.
 */
export type MoneyInput = number | string | { toString(): string };

const LOCALES: Record<Currency, string> = {
  ZAR: 'en-ZA',
  USD: 'en-US',
  EUR: 'en-IE',
  GBP: 'en-GB',
};

/** Non-breaking and narrow non-breaking spaces that Intl emits. */
const NBSP = /[  ]/g;

export function formatMoney(value: MoneyInput, currency: Currency = 'ZAR'): string {
  const amount = typeof value === 'number' ? value : Number(value.toString());

  if (!Number.isFinite(amount)) return '—';

  // Art prices are usually round numbers; showing ".00" on all of them is noise.
  const hasCents = !Number.isInteger(amount);

  const formatted = new Intl.NumberFormat(LOCALES[currency] ?? 'en-ZA', {
    style: 'currency',
    currency,
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })
    .format(amount)
    // Normalise the non-breaking spaces Intl uses after the symbol and between
    // thousands, so the output renders and tests predictably.
    .replace(NBSP, ' ')
    .replace(/^R\s/, 'R');

  // en-ZA formally uses a comma for decimals, but South African retail almost
  // always writes prices as R1 250.50. Follow the convention buyers expect.
  return currency === 'ZAR' ? formatted.replace(',', '.') : formatted;
}
