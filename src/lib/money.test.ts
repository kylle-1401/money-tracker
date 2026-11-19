import { describe, expect, it } from 'vitest';
import { formatMinor, MAX_AMOUNT_MINOR, minorToInput, parseAmountToMinor } from './money.ts';

describe('parseAmountToMinor', () => {
  it.each([
    ['1', 100],
    ['12.5', 1250],
    ['12.50', 1250],
    ['0.01', 1],
    ['.5', 50],
    ['1,234.56', 123456],
    ['  250  ', 25000],
    ['₱1,000', 100000],
    ['1000000', 100000000],
  ])('parseAmountToMinor_ValidInput_%s_Returns_%i', (input, expected) => {
    expect(parseAmountToMinor(input)).toBe(expected);
  });

  it.each([
    ['', 'empty'],
    ['   ', 'blank'],
    ['0', 'zero'],
    ['0.00', 'zero with decimals'],
    ['-5', 'negative'],
    ['1.234', 'three decimals'],
    ['abc', 'letters'],
    ['1.2.3', 'two dots'],
    ['12a', 'trailing junk'],
    ['1e5', 'exponent'],
    ['.', 'lone dot'],
  ])('parseAmountToMinor_Invalid_%s_(%s)_ReturnsNull', (input) => {
    expect(parseAmountToMinor(input)).toBeNull();
  });

  it('parseAmountToMinor_AvoidsFloatError_0.29Is29Centavos', () => {
    // 0.29 * 100 === 28.999999999999996 in floating point
    expect(parseAmountToMinor('0.29')).toBe(29);
    expect(parseAmountToMinor('1.15')).toBe(115);
  });

  it('parseAmountToMinor_AboveMax_ReturnsNull', () => {
    expect(parseAmountToMinor('1000000000')).toBeNull();
    expect(parseAmountToMinor('999999999.99')).toBe(MAX_AMOUNT_MINOR);
  });
});

describe('formatMinor', () => {
  it('formatMinor_Peso_FormatsWithSymbolAndSeparators', () => {
    expect(formatMinor(123456)).toBe('₱1,234.56');
  });

  it('formatMinor_WholeAmount_KeepsTwoDecimals', () => {
    expect(formatMinor(100)).toBe('₱1.00');
  });

  it('formatMinor_OtherCurrency_UsesThatCurrency', () => {
    expect(formatMinor(500, 'USD')).toContain('5.00');
    expect(formatMinor(500, 'USD')).toContain('$');
  });
});

describe('minorToInput', () => {
  it.each([
    [1250, '12.50'],
    [100, '1.00'],
    [1, '0.01'],
    [123456, '1234.56'],
  ])('minorToInput_%i_Returns_%s', (minor, expected) => {
    expect(minorToInput(minor)).toBe(expected);
  });

  it('minorToInput_RoundTripsThroughParse', () => {
    expect(parseAmountToMinor(minorToInput(98765))).toBe(98765);
  });
});
