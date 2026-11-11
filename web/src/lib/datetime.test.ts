import { describe, expect, it } from "vitest";

import {
  formatDayMonth,
  formatKickoff,
  formatMatchDate,
  isMatchday,
  ticketDate,
} from "@/lib/datetime";

describe("match times", () => {
  it("shows kick-off in the club's timezone, not the server's", () => {
    // 12:00 UTC is 15:00 in Kitengela. A server in UTC formatting without a
    // timezone would tell supporters the wrong kick-off time.
    expect(formatKickoff("2026-10-03T12:00:00+00:00")).toBe("15:00");
  });

  it("keeps a late kick-off on the correct local day", () => {
    // 22:00 UTC on the 3rd is 01:00 on the 4th in Kitengela.
    expect(formatMatchDate("2026-10-03T22:00:00+00:00")).toContain("4");
  });

  it("formats a date with no confirmed kick-off time", () => {
    expect(formatDayMonth("2026-10-03")).toContain("October");
  });

  it("returns null when there is no date, rather than inventing one", () => {
    expect(formatKickoff(null)).toBeNull();
    expect(formatMatchDate(null)).toBeNull();
    expect(formatDayMonth(null)).toBeNull();
  });
});

describe("match day", () => {
  it("knows a kick-off is today in Kitengela even when UTC disagrees", () => {
    // 22:30 UTC on the 3rd is 01:30 on the 4th in Kitengela.
    const now = new Date("2026-10-03T22:30:00Z");
    expect(isMatchday({ kickoff_at: "2026-10-04T12:00:00Z", scheduled_on: null }, now)).toBe(true);
    expect(isMatchday({ kickoff_at: "2026-10-03T12:00:00Z", scheduled_on: null }, now)).toBe(false);
  });

  it("treats a dated fixture without a kick-off time as on that date", () => {
    const now = new Date("2026-10-04T06:00:00Z");
    expect(isMatchday({ kickoff_at: null, scheduled_on: "2026-10-04" }, now)).toBe(true);
    expect(isMatchday({ kickoff_at: null, scheduled_on: "2026-10-05" }, now)).toBe(false);
  });

  it("never calls an undated fixture today", () => {
    expect(isMatchday({ kickoff_at: null, scheduled_on: null }, new Date())).toBe(false);
  });

  it("gives a ticket stub its date parts in local time", () => {
    expect(ticketDate({ kickoff_at: "2026-10-03T22:00:00Z", scheduled_on: null })).toEqual({
      weekday: "Sun",
      day: "4",
      month: "Oct",
    });
    expect(ticketDate({ kickoff_at: null, scheduled_on: null })).toBeNull();
  });
});
