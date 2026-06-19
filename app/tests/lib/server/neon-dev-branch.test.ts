import { describe, expect, it } from "vitest";
import { resolveNeonDevBranchName } from "@lib/server/neon-dev-branch";

describe("resolveNeonDevBranchName", () => {
  it("maps main to dev", () => {
    expect(resolveNeonDevBranchName("main")).toBe("dev");
  });

  it("maps master to dev", () => {
    expect(resolveNeonDevBranchName("master")).toBe("dev");
  });

  it("uses git branch name as-is when valid", () => {
    expect(resolveNeonDevBranchName("performance-optimizations")).toBe(
      "performance-optimizations",
    );
  });

  it("replaces slashes with dashes", () => {
    expect(resolveNeonDevBranchName("feature/foo")).toBe("feature-foo");
  });

  it("lowercases and strips invalid characters", () => {
    expect(resolveNeonDevBranchName("Feature/FOO_bar")).toBe("feature-foo-bar");
  });

  it("returns dev for empty input", () => {
    expect(resolveNeonDevBranchName("")).toBe("dev");
    expect(resolveNeonDevBranchName(null)).toBe("dev");
    expect(resolveNeonDevBranchName(undefined)).toBe("dev");
  });

  it("truncates to 63 characters", () => {
    const long = "a".repeat(80);
    expect(resolveNeonDevBranchName(long)).toHaveLength(63);
  });
});
