import { describe, expect, it } from 'vitest';
import { todayIso } from './format';

describe('todayIso', () => {
  it('uses the local calendar date with zero padding', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
