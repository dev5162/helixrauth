import { describe, expect, it } from "vitest";
import { parseCorsAllowedOrigins } from "../src/config.js";

describe("parseCorsAllowedOrigins", () => {
  it("returns an empty list when unset", () => {
    expect(parseCorsAllowedOrigins(undefined)).toEqual([]);
    expect(parseCorsAllowedOrigins("")).toEqual([]);
  });

  it("parses comma-separated origins and trims whitespace", () => {
    expect(
      parseCorsAllowedOrigins("http://localhost:5173, https://fileguard.helixrs.com ,"),
    ).toEqual(["http://localhost:5173", "https://fileguard.helixrs.com"]);
  });
});
