import { describe, expect, it } from "vitest";
import {
  buildSourceScheduleState,
  isBlockedScanRun,
} from "../../../scripts/lib/sourceSchedule.mjs";

describe("source-aware scan scheduling", () => {
  const now = new Date("2026-06-10T12:00:00Z");

  it("always marks Rightmove as due", () => {
    expect(buildSourceScheduleState({
      sourceName: "Rightmove Commercial",
      now,
      scanRuns: [
        run({ sourceName: "Rightmove Commercial", status: "completed", finishedAt: "2026-06-10T11:55:00Z" }),
      ],
    })).toMatchObject({
      sourceName: "Rightmove Commercial",
      group: "rightmove",
      due: true,
      reason: "Runs every scan",
    });
  });

  it("limits Acuitus to once per day", () => {
    expect(buildSourceScheduleState({
      sourceName: "Acuitus",
      now,
      scanRuns: [
        run({ sourceName: "Acuitus", status: "completed", finishedAt: "2026-06-10T06:00:00Z" }),
      ],
    })).toMatchObject({
      group: "static",
      due: false,
      reason: expect.stringContaining("Cooldown"),
    });

    expect(buildSourceScheduleState({
      sourceName: "Acuitus",
      now,
      scanRuns: [
        run({ sourceName: "Acuitus", status: "completed", finishedAt: "2026-06-09T06:00:00Z" }),
      ],
    })).toMatchObject({
      due: true,
      reason: "Eligible now",
    });
  });

  it("runs dynamic sources based on cooldown", () => {
    expect(buildSourceScheduleState({
      sourceName: "Eddisons",
      now,
      scanRuns: [
        run({ sourceName: "Eddisons", status: "completed", finishedAt: "2026-06-10T04:30:00Z" }),
      ],
    })).toMatchObject({
      group: "dynamic",
      due: false,
    });

    expect(buildSourceScheduleState({
      sourceName: "Allsop",
      now,
      scanRuns: [
        run({ sourceName: "Allsop", status: "completed", finishedAt: "2026-06-09T23:00:00Z" }),
      ],
    })).toMatchObject({
      group: "dynamic",
      due: true,
    });
  });

  it("backs off blocked problematic sources", () => {
    const state = buildSourceScheduleState({
      sourceName: "Zoopla Commercial",
      now,
      scanRuns: [
        run({
          sourceName: "Zoopla Commercial",
          status: "failed",
          finishedAt: "2026-06-09T12:00:00Z",
          errorMessage: "Fetch failed: 403 Forbidden",
        }),
      ],
    });

    expect(isBlockedScanRun({ errorMessage: "403 Forbidden" })).toBe(true);
    expect(state).toMatchObject({
      group: "problematic",
      due: false,
      blocked: true,
      consecutiveFailures: 1,
      reason: expect.stringContaining("Blocked/backoff"),
    });
  });
});

function run(overrides: Record<string, unknown>) {
  return {
    sourceName: "Rightmove Commercial",
    status: "completed",
    startedAt: "2026-06-10T05:00:00Z",
    finishedAt: "2026-06-10T05:05:00Z",
    errorMessage: null,
    ...overrides,
  };
}
