import { describe, expect, it } from 'vitest';

import { formatMoney } from './money';

describe('formatMoney', () => {
  it('formats rands with a currency symbol and thousands separators', () => {
    expect(formatMoney(18500, 'ZAR')).toBe('R18 500');
  });

  it('omits the decimals when a price is a whole amount', () => {
    expect(formatMoney(12500, 'ZAR')).toBe('R12 500');
  });

  it('keeps the decimals when they carry value', () => {
    expect(formatMoney(1250.5, 'ZAR')).toBe('R1 250.50');
  });

  it('accepts the string form Prisma Decimal serialises to', () => {
    expect(formatMoney('18500', 'ZAR')).toBe('R18 500');
    expect(formatMoney('1250.50', 'ZAR')).toBe('R1 250.50');
  });

  it('handles the other supported currencies', () => {
    expect(formatMoney(1200, 'USD')).toBe('$1,200');
    expect(formatMoney(1200, 'GBP')).toBe('£1,200');
  });

  it('formats zero rather than rendering nothing', () => {
    expect(formatMoney(0, 'ZAR')).toBe('R0');
  });

  it('returns an em dash for a value it cannot read', () => {
    expect(formatMoney('not-a-number', 'ZAR')).toBe('—');
  });
});
