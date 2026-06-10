import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("numeric typography", () => {
  it("uses clean tabular numerals without the dotted zero font path", () => {
    const css = readFileSync(resolve(root, "src/index.css"), "utf8");
    const tailwindConfig = readFileSync(resolve(root, "tailwind.config.ts"), "utf8");
    const indexHtml = readFileSync(resolve(root, "index.html"), "utf8");

    expect(indexHtml).not.toContain("JetBrains+Mono");
    expect(tailwindConfig).not.toContain("JetBrains Mono");
    expect(css).toContain(".numeric-clean");
    expect(css).toContain("font-family: 'Inter', system-ui, sans-serif !important");
    expect(css).toContain("font-feature-settings: 'tnum' 1, 'zero' 0 !important");
  });
});
