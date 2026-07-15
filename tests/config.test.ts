import { describe, expect, it } from "vitest";
import { parseCorsAllowedOrigins } from "../src/config.js";

describe("parseCorsAllowedOrigins", () => {
  it("returns undefined when unset, and empty array when empty string", () => {
    expect(parseCorsAllowedOrigins(undefined)).toBeUndefined();
    expect(parseCorsAllowedOrigins("")).toEqual([]);
  });

  it("parses comma-separated origins and trims whitespace", () => {
    expect(
      parseCorsAllowedOrigins("http://localhost:5173, https://fileguard.helixrs.com ,"),
    ).toEqual(["http://localhost:5173", "https://fileguard.helixrs.com"]);
  });
});
