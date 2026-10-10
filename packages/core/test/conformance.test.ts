import { describe, expect, it } from "vitest";
import { formatConformance, runFacilitatorConformance } from "../src/index.js";
import { createMockFacilitator } from "../src/testing.js";

describe("runFacilitatorConformance", () => {
  it("passes the reference mock, probing with an EVM payTo and USDC by default", async () => {
    const mock = createMockFacilitator({ networks: ["base-sepolia"] });
    const checks = await runFacilitatorConformance(mock);
    expect(checks.filter((check) => !check.ok), `\n${formatConformance(checks)}`).toEqual([]);
    expect(mock.challenges[0]).toMatchObject({ payTo: `0x${"1".repeat(40)}`, asset: "usdc" });
  });

  it("probes with the payTo and asset the adapter's network actually uses, when given", async () => {
    const mock = createMockFacilitator({ networks: ["nano:mainnet"] });
    const payTo = "nano_3t6k35gi95xu6tergt6p69ck76ogmitsa8mnijtpxm9fkcm736xtoncuohr3";
    const checks = await runFacilitatorConformance(mock, { payTo, asset: "xno" });
    expect(checks.filter((check) => !check.ok), `\n${formatConformance(checks)}`).toEqual([]);
    expect(mock.challenges.length).toBeGreaterThan(0);
    for (const challenge of mock.challenges) {
      expect(challenge).toMatchObject({ payTo, asset: "xno", network: "nano:mainnet" });
    }
  });
});
