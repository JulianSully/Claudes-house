import { describe, it, expect } from "vitest";
import {
  LOAD_SHAPE,
  WEATHER_MIX,
  solarShape,
  loadProfile,
  overlapForDay,
  allocateAverageDay,
  daylightFor,
} from "./profiles";

describe("the load shape", () => {
  it("covers a full 24 hours", () => {
    expect(LOAD_SHAPE).toHaveLength(24);
    expect(LOAD_SHAPE.every((w) => w > 0)).toBe(true);
  });

  it("peaks in the evening and again in the morning", () => {
    const max = Math.max(...LOAD_SHAPE);
    const peakHour = LOAD_SHAPE.indexOf(max);
    expect(peakHour).toBeGreaterThanOrEqual(17); // evening peak dominates
    expect(peakHour).toBeLessThanOrEqual(20);
    // The morning peak beats the midday trough — that is the whole point.
    expect(LOAD_SHAPE[7]).toBeGreaterThan(LOAD_SHAPE[12]);
  });

  it("is quietest overnight", () => {
    const overnight = Math.max(LOAD_SHAPE[1], LOAD_SHAPE[2], LOAD_SHAPE[3]);
    expect(overnight).toBeLessThan(Math.min(LOAD_SHAPE[7], LOAD_SHAPE[18]));
  });
});

describe("the solar shape", () => {
  for (const season of ["annual", "summer", "winter"]) {
    it(`${season}: sums to exactly one day's production`, () => {
      const total = solarShape(season).reduce((a, v) => a + v, 0);
      expect(total).toBeCloseTo(1, 9);
    });

    it(`${season}: produces nothing before sunrise or after sunset`, () => {
      const shape = solarShape(season);
      const { sunrise, sunset } = daylightFor(season);
      shape.forEach((v, h) => {
        const midHour = h + 0.5;
        if (midHour <= sunrise || midHour >= sunset) expect(v, `hour ${h}`).toBe(0);
      });
      expect(shape[0]).toBe(0);
      expect(shape[23]).toBe(0);
    });
  }

  it("peaks around the middle of the day", () => {
    const shape = solarShape("annual");
    const peak = shape.indexOf(Math.max(...shape));
    expect(peak).toBeGreaterThanOrEqual(11);
    expect(peak).toBeLessThanOrEqual(13);
  });

  it("gives winter a shorter day than summer", () => {
    const daylight = (season) => solarShape(season).filter((v) => v > 0).length;
    expect(daylight("winter")).toBeLessThan(daylight("summer"));
  });
});

describe("the day/night slider still governs the split", () => {
  for (const dayPercent of [0, 25, 60, 80, 100]) {
    it(`${dayPercent}% day puts exactly that share in daylight hours`, () => {
      const { load, isDaylight } = loadProfile({
        dailyUsage: 20,
        dayPercent,
        season: "annual",
      });
      const inDaylight = load.reduce((a, v, h) => a + (isDaylight[h] ? v : 0), 0);
      expect(inDaylight).toBeCloseTo(20 * (dayPercent / 100), 9);
    });
  }

  it("always distributes the whole day's usage, nothing lost", () => {
    const { load } = loadProfile({ dailyUsage: 17.3, dayPercent: 55, season: "winter" });
    expect(load.reduce((a, v) => a + v, 0)).toBeCloseTo(17.3, 9);
  });
});

describe("the weather mix", () => {
  it("preserves the yield the rep entered", () => {
    const mean = WEATHER_MIX.reduce((a, d) => a + d.share * d.factor, 0);
    expect(mean).toBeCloseTo(1, 9);
  });

  it("shares add to one whole set of days", () => {
    expect(WEATHER_MIX.reduce((a, d) => a + d.share, 0)).toBeCloseTo(1, 9);
  });

  it("spans genuinely different days", () => {
    const factors = WEATHER_MIX.map((d) => d.factor);
    expect(Math.max(...factors)).toBeGreaterThan(1.2);
    expect(Math.min(...factors)).toBeLessThan(0.6);
  });
});

describe("the overlap", () => {
  const base = { dailyUsage: 20, dayPercent: 60, season: "annual" };

  it("conserves energy: what's made is used or spare", () => {
    for (const dailyProduction of [0, 5, 12, 27, 60]) {
      const o = overlapForDay({ ...base, dailyProduction });
      expect(o.selfConsumed + o.excess).toBeCloseTo(dailyProduction, 6);
    }
  });

  it("conserves demand: what's used is met by sun, missed, or after dark", () => {
    for (const dailyProduction of [0, 5, 12, 27, 60]) {
      const o = overlapForDay({ ...base, dailyProduction });
      expect(o.selfConsumed + o.daytimeShortfall + o.darkLoad).toBeCloseTo(20, 6);
    }
  });

  it("leaves a daylight shortfall even when production dwarfs demand", () => {
    // The 7am and 4pm peaks land when the sun is barely up. This is the
    // "From grid 0.0" bug — a huge system must not cover literally everything.
    const o = overlapForDay({ ...base, dailyProduction: 40 });
    expect(o.daytimeShortfall).toBeGreaterThan(0);
  });

  it("covers nothing with no sun", () => {
    const o = overlapForDay({ ...base, dailyProduction: 0 });
    expect(o.selfConsumed).toBe(0);
    expect(o.daytimeShortfall).toBeCloseTo(20 * 0.6, 9);
  });

  it("misses more of the day in winter than in summer", () => {
    // Compared the way the app does it: the same 6.6 kW system, but at each
    // season's own yield (Sydney 3.0 in winter, 5.1 in summer). The shorter
    // winter window alone is not what drives this — at equal production the
    // two seasons land within a few percent of each other. It is the drop in
    // output that leaves the morning and evening peaks uncovered.
    const winter = overlapForDay({ ...base, season: "winter", dailyProduction: 6.6 * 3.0 });
    const summer = overlapForDay({ ...base, season: "summer", dailyProduction: 6.6 * 5.1 });
    expect(winter.daytimeShortfall).toBeGreaterThan(summer.daytimeShortfall);
    expect(winter.selfConsumed).toBeLessThan(summer.selfConsumed);
  });
});

describe("the weighted day", () => {
  const base = {
    dailyUsage: 20,
    dailyProduction: 27,
    dayPercent: 60,
    season: "annual",
    efficiency: 0.9,
  };

  it("conserves production across the whole weather mix", () => {
    for (const batteryKwh of [0, 5, 16, 40]) {
      const d = allocateAverageDay({ ...base, batteryKwh });
      expect(d.selfConsumed + d.batteryCharge + d.exported).toBeCloseTo(27, 6);
    }
  });

  it("conserves demand across the whole weather mix", () => {
    for (const batteryKwh of [0, 5, 16, 40]) {
      const d = allocateAverageDay({ ...base, batteryKwh });
      const met = d.selfConsumed + d.nightCovered + d.dayCoveredByBattery;
      const unmet = d.remainingNight + d.remainingDay;
      expect(met + unmet).toBeCloseTo(20, 6);
    }
  });

  it("leaves the customer buying power even with a large battery", () => {
    // Overcast days cannot refill it, so self-sufficiency never reaches 100%
    // on a system that isn't heavily oversized.
    const d = allocateAverageDay({ ...base, batteryKwh: 40 });
    expect(d.remainingNight + d.remainingDay).toBeGreaterThan(0);
  });

  it("never charges past capacity on any day in the mix", () => {
    for (const batteryKwh of [1, 4, 16]) {
      const d = allocateAverageDay({ ...base, batteryKwh });
      expect(d.batteryCharge).toBeLessThanOrEqual(batteryKwh + 1e-9);
    }
  });

  it("delivers exactly what efficiency allows", () => {
    for (const efficiency of [0.5, 0.9, 1]) {
      const d = allocateAverageDay({ ...base, batteryKwh: 16, efficiency });
      expect(d.batteryDelivered).toBeCloseTo(d.batteryCharge * efficiency, 9);
    }
  });
});
