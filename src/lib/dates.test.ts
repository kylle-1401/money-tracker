import { describe, expect, it } from 'vitest';
import { dayLabel, isValidDateString, toLocalDateString } from './dates.ts';

describe('toLocalDateString', () => {
  it('toLocalDateString_UsesLocalCalendarDate_PadsMonthAndDay', () => {
    expect(toLocalDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('toLocalDateString_JustAfterMidnight_StaysOnThatDay', () => {
    expect(toLocalDateString(new Date(2026, 10, 19, 0, 1))).toBe('2026-11-19');
  });
});

describe('isValidDateString', () => {
  it.each(['2026-11-19', '2024-02-29', '2026-12-31'])('isValidDateString_%s_True', (value) => {
    expect(isValidDateString(value)).toBe(true);
  });

  it.each(['', '2026-13-01', '2026-02-30', '2025-02-29', '19/11/2026', '2026-1-5', 'abc'])(
    'isValidDateString_%s_False',
    (value) => {
      expect(isValidDateString(value)).toBe(false);
    },
  );
});

describe('dayLabel', () => {
  const today = new Date(2026, 10, 19, 10, 0); // Thu 19 Nov 2026

  it('dayLabel_Today_ReturnsToday', () => {
    expect(dayLabel('2026-11-19', today)).toBe('Today');
  });

  it('dayLabel_Yesterday_ReturnsYesterday', () => {
    expect(dayLabel('2026-11-18', today)).toBe('Yesterday');
  });

  it('dayLabel_YesterdayAcrossMonth_ReturnsYesterday', () => {
    expect(dayLabel('2026-11-30', new Date(2026, 11, 1))).toBe('Yesterday');
  });

  it('dayLabel_SameYear_ShowsWeekdayAndDateWithoutYear', () => {
    expect(dayLabel('2026-11-03', today)).toBe('Tue, Nov 3');
  });

  it('dayLabel_OtherYear_IncludesYear', () => {
    expect(dayLabel('2025-12-25', today)).toBe('Thu, Dec 25, 2025');
  });
});
