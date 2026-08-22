/** Domain types + simulated live data for the Tollway merchant console. */

export interface SettlementNetwork {
  id: string;
  name: string;
  color: string;
  baseFeeGwei: number;
  settledToday: number;
  blockNumber: number;
  feeTrend: number[];
}

export interface Route {
  path: string;
  pricePerCall: number;
  revenueToday: number;
  calls: number;
  change24h: number;
  spark: number[];
}

export type TollStatus = "settled" | "pending" | "402" | "429";

export interface Toll {
  id: string;
  route: string;
  agent: string;
  network: string;
  amount: number | null;
  age: string;
  status: TollStatus;
}

export interface AgentAccount {
  address: string;
  label: string;
  spendToday: number;
  tolls: number;
  traits: string[];
  lastToll: string;
}

export const networks: SettlementNetwork[] = [
  { id: "base", name: "Base", color: "#0052ff", baseFeeGwei: 0.08, settledToday: 21_408, blockNumber: 33_901_244, feeTrend: [0.05, 0.07, 0.06, 0.09, 0.08, 0.1, 0.07, 0.08, 0.06, 0.09, 0.08, 0.08] },
  { id: "arbitrum", name: "Arbitrum One", color: "#28a0f0", baseFeeGwei: 0.11, settledToday: 6_112, blockNumber: 372_115_009, feeTrend: [0.1, 0.12, 0.11, 0.14, 0.1, 0.09, 0.12, 0.11, 0.13, 0.1, 0.11, 0.11] },
  { id: "optimism", name: "OP Mainnet", color: "#ff0420", baseFeeGwei: 0.06, settledToday: 2_931, blockNumber: 141_226_530, feeTrend: [0.08, 0.06, 0.07, 0.05, 0.06, 0.08, 0.06, 0.05, 0.07, 0.06, 0.06, 0.06] },
  { id: "polygon", name: "Polygon PoS", color: "#8247e5", baseFeeGwei: 31.4, settledToday: 1_204, blockNumber: 78_003_411, feeTrend: [42, 36, 33, 39, 30, 28, 34, 31, 29, 33, 30, 31] },
  { id: "ethereum", name: "Ethereum", color: "#627eea", baseFeeGwei: 14.2, settledToday: 449, blockNumber: 23_412_887, feeTrend: [18, 16, 21, 19, 15, 14, 13, 16, 14, 12, 15, 14] },
];

export const routes: Route[] = [
  { path: "/v1/report", pricePerCall: 0.004, revenueToday: 61.29, calls: 15_322, change24h: 22.4, spark: [2.9, 3.4, 3.1, 3.8, 4.2, 4.0, 4.6, 4.4, 5.1, 4.9, 5.6, 6.1] },
  { path: "/v1/search", pricePerCall: 0.012, revenueToday: 38.51, calls: 3_209, change24h: 11.8, spark: [2.1, 2.4, 2.2, 2.6, 2.5, 2.9, 2.7, 3.1, 3.0, 3.3, 3.6, 3.8] },
  { path: "/v1/embed", pricePerCall: 0.002, revenueToday: 17.42, calls: 8_710, change24h: -4.2, spark: [2.0, 1.9, 2.1, 1.8, 1.7, 1.9, 1.6, 1.8, 1.7, 1.6, 1.8, 1.7] },
  { path: "/v1/quote", pricePerCall: 0.008, revenueToday: 11.18, calls: 1_398, change24h: 48.9, spark: [0.4, 0.5, 0.6, 0.5, 0.7, 0.8, 0.7, 0.9, 1.0, 0.9, 1.1, 1.2] },
];

export const revenueToday = routes.reduce((sum, r) => sum + r.revenueToday, 0);
export const revenueChange24h = 18.2;
export const tollsToday = routes.reduce((sum, r) => sum + r.calls, 0);
export const rejectRate = 2.1;
export const spamFiltered = 1_904;

export const tolls: Toll[] = [
  { id: "t1", route: "/v1/report", agent: "0x93af…4e2c", network: "base", amount: 0.004, age: "6s", status: "settled" },
  { id: "t2", route: "/v1/search", agent: "0x71bc…09d1", network: "base", amount: 0.012, age: "19s", status: "settled" },
  { id: "t3", route: "/v1/quote", agent: "0xf30a…8871", network: "arbitrum", amount: 0.008, age: "41s", status: "pending" },
  { id: "t4", route: "/v1/report", agent: "0x2f01…d7aa", network: "base", amount: null, age: "1m", status: "402" },
  { id: "t5", route: "/v1/embed", agent: "0xc4e8…22b0", network: "optimism", amount: 0.002, age: "2m", status: "settled" },
  { id: "t6", route: "/v1/search", agent: "0x8809…13fe", network: "base", amount: null, age: "2m", status: "429" },
  { id: "t7", route: "/v1/report", agent: "0x93af…4e2c", network: "base", amount: 0.004, age: "3m", status: "settled" },
];

export const agents: AgentAccount[] = [
  { address: "0x93af…4e2c", label: "research-swarm", spendToday: 41.2, tolls: 10_301, traits: ["auto-pay", "top spender"], lastToll: "6s ago" },
  { address: "0x71bc…09d1", label: "quote-bot", spendToday: 22.9, tolls: 1_905, traits: ["auto-pay"], lastToll: "19s ago" },
  { address: "0xc4e8…22b0", label: "indexer", spendToday: 9.1, tolls: 4_550, traits: ["bursty"], lastToll: "2m ago" },
  { address: "0x8809…13fe", label: "unlabeled", spendToday: 0.4, tolls: 3_119, traits: ["rate-limited", "high 402"], lastToll: "2m ago" },
];

export const fmtUsd = (v: number): string =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export const fmtMicroUsd = (v: number): string => `$${v.toFixed(3).replace(/0$/, "")}`;

export const fmtInt = (v: number): string => v.toLocaleString("en-US");

export const fmtPct = (v: number): string => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

export const fmtGwei = (v: number): string => (v >= 1 ? v.toFixed(1) : v.toString());
