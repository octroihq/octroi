import { Fuel } from "lucide-react";
import { fmtGwei, fmtInt, networks } from "../data";
import { Sparkline } from "./Sparkline";

/** Settlement network matrix: live base fees and tolls settled per chain. */
export function Settlement() {
  return (
    <section className="glass panel" id="networks" aria-label="Settlement networks">
      <div className="panel-head">
        <span className="t">
          <Fuel size={14} strokeWidth={1.7} />
          Settlement networks
        </span>
        <span className="microlabel">live · 12s</span>
      </div>
      {networks.map((n) => (
        <div key={n.id} className="datarow">
          <span className="netdot" style={{ background: n.color }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.8rem" }}>{n.name}</div>
            <div className="microlabel" style={{ letterSpacing: "0.06em" }}>
              {fmtInt(n.settledToday)} settled
            </div>
          </div>
          <Sparkline data={n.feeTrend} width={54} height={18} stroke="var(--indigo-soft)" strokeWidth={1.2} />
          <div className="gas-fee">
            <div className="gwei">{fmtGwei(n.baseFeeGwei)}</div>
            <span className="microlabel">gwei</span>
          </div>
        </div>
      ))}
    </section>
  );
}
