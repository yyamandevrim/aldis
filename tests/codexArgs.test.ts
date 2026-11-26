import { describe, expect, test } from "bun:test";
import { buildCodexArgs, exaMcpUrl } from "../src/brain/codexArgs";

describe("buildCodexArgs", () => {
  test("new session", () => {
    const args = buildCodexArgs({ exaApiKey: "" });
    expect(args.slice(0, 2)).toEqual(["exec", "--json"]);
    expect(args).not.toContain("resume");
    expect(args).toContain("--ignore-user-config");
    expect(args).toContain('sandbox_mode="read-only"');
    expect(args).toContain('web_search="disabled"');
    expect(args).toContain('mcp_servers.exa.url="https://mcp.exa.ai/mcp"');
    for (const feature of ["shell_tool", "unified_exec"]) {
      expect(args[args.indexOf(feature) - 1]).toBe("--disable");
    }
    expect(args.at(-1)).toBe("-");
    expect(args).not.toContain("-m");
  });

  test("resume with model", () => {
    const args = buildCodexArgs({ sessionId: "abc", exaApiKey: "", model: "gpt-5" });
    expect(args.slice(0, 3)).toEqual(["exec", "resume", "abc"]);
    expect(args[args.indexOf("-m") + 1]).toBe("gpt-5");
    expect(args.at(-1)).toBe("-");
  });

  test("exa url encodes key", () => {
    expect(exaMcpUrl("k&y")).toBe("https://mcp.exa.ai/mcp?exaApiKey=k%26y");
  });
});
