import { describe, expect, it } from "vitest";

import { formatDayMonth, formatKickoff, formatMatchDate } from "@/lib/datetime";

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
