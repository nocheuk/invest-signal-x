import { describe, expect, it } from "vitest";
import { hasRawFlag, parseArgs, readBooleanFlag, readStringArg } from "../../../scripts/lib/env.mjs";

describe("script argument parsing", () => {
  it("parses named Rightmove import flags", () => {
    const args = parseArgs([
      "--url",
      "https://www.rightmove.co.uk/commercial-property-for-sale/Bournemouth.html",
      "--source-name",
      "Rightmove Commercial Bournemouth",
      "--dry-run",
    ]);

    expect(args.url).toBe("https://www.rightmove.co.uk/commercial-property-for-sale/Bournemouth.html");
    expect(args["source-name"]).toBe("Rightmove Commercial Bournemouth");
    expect(readStringArg(args, "url")).toBe("https://www.rightmove.co.uk/commercial-property-for-sale/Bournemouth.html");
    expect(readStringArg(args, "source-name")).toBe("Rightmove Commercial Bournemouth");
    expect(readBooleanFlag(args, "dry-run", [])).toBe(true);
  });

  it("supports inline values and camel-case boolean flag aliases", () => {
    const args = parseArgs([
      "--url=https://example.com/search",
      "--source-name=Rightmove Commercial",
      "--dryRun=true",
    ]);

    expect(args.url).toBe("https://example.com/search");
    expect(args["source-name"]).toBe("Rightmove Commercial");
    expect(readBooleanFlag(args, "dry-run", [])).toBe(true);
  });

  it("keeps positional url support", () => {
    const args = parseArgs([
      "https://example.com/search",
      "--source-name",
      "Rightmove Commercial",
      "--dry-run",
    ]);

    expect(args._[0]).toBe("https://example.com/search");
    expect(args["source-name"]).toBe("Rightmove Commercial");
    expect(readBooleanFlag(args, "dry-run", [])).toBe(true);
  });

  it("detects dry-run in raw npm-style argv as a hard safety check", () => {
    const argv = [
      "C:\\Program Files\\nodejs\\node.exe",
      "C:\\repo\\node_modules\\.bin\\tsx",
      "C:\\repo\\scripts\\import-rightmove.mjs",
      "--url",
      "https://www.rightmove.co.uk/commercial-property-for-sale/Bournemouth.html",
      "--source-name",
      "Rightmove Commercial Bournemouth",
      "--dry-run",
    ];

    expect(hasRawFlag(argv, "dry-run")).toBe(true);
    expect(readBooleanFlag(parseArgs(argv.slice(3)), "dry-run", argv)).toBe(true);
  });

  it("does not infer dry-run from npm-style argv when the flag is absent", () => {
    const argv = [
      "C:\\Program Files\\nodejs\\node.exe",
      "C:\\repo\\node_modules\\.bin\\tsx",
      "C:\\repo\\scripts\\import-rightmove.mjs",
      "--url",
      "https://www.rightmove.co.uk/commercial-property-for-sale/Bournemouth.html",
      "--source-name",
      "Rightmove Commercial Bournemouth",
    ];

    expect(hasRawFlag(argv, "dry-run")).toBe(false);
  });

  it("reads npm config env fallbacks when npm consumes named flags", () => {
    const args = parseArgs([]);
    const env = {
      npm_config_url: "https://www.rightmove.co.uk/commercial-property-for-sale/Bournemouth.html",
      npm_config_source_name: "Rightmove Commercial Bournemouth",
      npm_config_dry_run: "true",
    };

    expect(readStringArg(args, "url", env)).toBe("https://www.rightmove.co.uk/commercial-property-for-sale/Bournemouth.html");
    expect(readStringArg(args, "source-name", env)).toBe("Rightmove Commercial Bournemouth");
    expect(readBooleanFlag(args, "dry-run", [], env)).toBe(true);
  });

  it("falls back to positional source name when npm marks source-name as true", () => {
    const args = parseArgs([
      "https://www.rightmove.co.uk/commercial-property-for-sale/Bournemouth.html",
      "Rightmove Commercial Bournemouth",
    ]);
    const env = { npm_config_source_name: "true" };

    const sourceName = readStringArg(args, "source-name", env) || args._[1] || "Rightmove Commercial";

    expect(sourceName).toBe("Rightmove Commercial Bournemouth");
  });
});
