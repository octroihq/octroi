import { fmtInt, rejectRate, spamFiltered, tollsToday } from "../data";
import { Revenue } from "./Revenue";

const stats = [
  { value: fmtInt(tollsToday), label: "tolls collected · 24h" },
  { value: `${rejectRate.toFixed(1)}%`, label: `reject rate · ${fmtInt(spamFiltered)} spam filtered` },
  { value: "60s", label: "reprice, live everywhere" },
] as const;

export function Hero() {
  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <div>
          <span className="eyebrow">
            <span className="pulse" />
            merchant rails for x402
          </span>
          <h1>
            Machine revenue. <span className="dim">Legible.</span>
          </h1>
          <p className="sub">
            Agents pay your API per request over x402. Tollway turns that stream into a business:
            revenue by route, receipts that hold up, prices you change without redeploying, and
            spam blocked before it costs compute.
          </p>
          <div className="hero-stats">
            {stats.map((s) => (
              <div className="stat" key={s.label}>
                <div className="bignum v">{s.value}</div>
                <span className="microlabel">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        <Revenue />
      </div>
    </section>
  );
}
