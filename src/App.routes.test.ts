import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("App route registration", () => {
  it("registers focused app pages for dashboard, deals, pipeline, alerts, and sources", () => {
    const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");

    expect(appSource).toContain('path="/dashboard"');
    expect(appSource).toContain('path="/deals"');
    expect(appSource).toContain('path="/pipeline"');
    expect(appSource).toContain('path="/alerts"');
    expect(appSource).toContain('path="/sources"');
  });
});
