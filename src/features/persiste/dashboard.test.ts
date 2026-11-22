import { describe, expect, it } from "vitest";
import type { AnalyticsReport } from "@/features/instagram-publisher/useInstagramAnalytics";
import { dashboardGreeting, mascotLine, viewsOnReelsPublishedToday } from "./dashboard";

const timezone = "America/Sao_Paulo";

describe("dashboard Persiste", () => {
  it.each([
    ["03:00", "Boa madrugada"],
    ["08:00", "Bom dia"],
    ["15:00", "Boa tarde"],
    ["21:00", "Boa noite"],
  ])("uses the workspace timezone at %s UTC", (time, greeting) => {
    expect(dashboardGreeting(new Date(`2026-11-22T${time}:00Z`), timezone, "Freitas DXVI")).toBe(`${greeting}, Freitas.`);
  });

  it("only counts available views on today's Reels, once per video", () => {
    const time = new Date("2026-11-22T05:30:00Z");
    const reel = { account_id: "a", id: "1", caption: "", timestamp: "2026-11-22T03:20:00Z", permalink: null, thumbnail_url: null, views: 10_001, media_product_type: "REELS" };
    const report: AnalyticsReport = {
      checked_at: time.toISOString(),
      accounts: [{account_id: "a", complete: false, unavailable: false, videos: [
        reel, reel,
        { ...reel, id: "2", timestamp: "2026-11-22T02:50:00Z" },
        { ...reel, id: "3", media_product_type: "STORY" },
        { ...reel, id: "4", views: null },
        { ...reel, id: "5", timestamp: "2026-11-22T05:31:00Z" },
      ]}],
    };
    expect(viewsOnReelsPublishedToday(report, time, timezone)).toBe(10_001);
    expect(viewsOnReelsPublishedToday(undefined, time, timezone)).toBe(0);
  });

  it("celebrates real milestones and gives marketing prompts when there is no data", () => {
    expect(mascotLine(0, null, 0)).toContain("faturamento");
    expect(mascotLine(0, 999_999, 9_999)).not.toMatch(/1M|10k/);
    expect(mascotLine(0, 1_000_000, 10_000)).toContain("1M de vizu");
    expect(mascotLine(1, 1_000_000, 10_000)).toContain("10k");
  });
});
