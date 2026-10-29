import { describe, expect, it } from 'vitest';
import { forEachLimit } from '../src/shared/limit';

describe('forEachLimit', () => {
  it('visits every item with bounded concurrency', async () => {
    let active = 0;
    let peak = 0;
    const seen: number[] = [];
    await forEachLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      seen.push(n);
      active--;
    });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(peak).toBe(3);
  });

  it('handles an empty list', async () => {
    await expect(forEachLimit([], 4, async () => {})).resolves.toBeUndefined();
  });
});
