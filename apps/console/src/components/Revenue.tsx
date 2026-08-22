import { Download, SlidersHorizontal, TrendingDown, TrendingUp, Undo2 } from "lucide-react";
import { fmtInt, fmtMicroUsd, fmtPct, fmtUsd, revenueChange24h, revenueToday, routes } from "../data";
import { Sparkline } from "./Sparkline";

const actions = [
  { label: "Reprice", icon: SlidersHorizontal },
  { label: "Refund", icon: Undo2 },
  { label: "Export", icon: Download },
] as const;

/** The action core: live revenue by gated route, with merchant operations. */
export function Revenue() {
  const up = revenueChange24h >= 0;

  return (
    <section className="glass portfolio" id="revenue" aria-label="Revenue by route">
      <div className="pf-top">
        <div className="pf-total">
          <span className="microlabel">Revenue today · all routes</span>
          <div className="bignum v">{fmtUsd(revenueToday)}</div>
          <span className={`pf-delta ${up ? "delta-up" : "delta-down"}`}>
            {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {fmtPct(revenueChange24h)} · vs yesterday
          </span>
        </div>
        <div className="pf-actions">
          {actions.map(({ label, icon: Icon }) => (
            <button key={label} className="actionpill">
              <Icon size={13} strokeWidth={1.8} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="tokens">
        {routes.map((r) => (
          <div key={r.path} className="token-row">
            <span className="route-price mono">{fmtMicroUsd(r.pricePerCall)}</span>
            <div className="token-name">
              <div className="n mono">{r.path}</div>
              <div className="chain">{fmtInt(r.calls)} paid calls · 24h</div>
            </div>
            <Sparkline data={r.spark} />
            <div className="token-bal">
              <div className="fiat">{fmtUsd(r.revenueToday)}</div>
              <div className="qty">
                per call {fmtMicroUsd(r.pricePerCall)}{" "}
                <span className={`pct ${r.change24h >= 0 ? "delta-up" : "delta-down"}`}>
                  {fmtPct(r.change24h)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
