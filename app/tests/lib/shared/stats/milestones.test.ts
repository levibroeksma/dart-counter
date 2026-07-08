import { describe, expect, it } from 'vitest';
import { countVisitMilestones } from '@lib/shared/stats';

describe('countVisitMilestones', () => {
  it('counts threshold buckets', () => {
    expect(countVisitMilestones([60, 100, 120, 140, 180])).toEqual({
      visits100Plus: 4,
      visits120Plus: 3,
      visits140Plus: 2,
      visits180: 1,
    });
  });

  it('returns zeros for empty input', () => {
    expect(countVisitMilestones([])).toEqual({
      visits100Plus: 0,
      visits120Plus: 0,
      visits140Plus: 0,
      visits180: 0,
    });
  });
});
