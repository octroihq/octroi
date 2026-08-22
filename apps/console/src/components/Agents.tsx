import { Bot } from "lucide-react";
import { useState } from "react";
import { agents, fmtInt, fmtUsd } from "../data";

/** Paying agents: who spends, who gets rate limited, who gets blocked. */
export function Agents() {
  const [blocked, setBlocked] = useState<ReadonlySet<string>>(new Set());

  const toggleBlock = (address: string) =>
    setBlocked((prev) => {
      const next = new Set(prev);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      return next;
    });

  return (
    <section className="glass panel" id="agents" aria-label="Paying agents">
      <div className="panel-head">
        <span className="t">
          <Bot size={14} strokeWidth={1.7} />
          Paying agents
        </span>
        <span className="microlabel">{fmtInt(agents.length)} active · 24h</span>
      </div>
      {agents.map((a) => {
        const isBlocked = blocked.has(a.address);
        return (
          <div key={a.address} className="datarow" style={{ alignItems: "flex-start", opacity: isBlocked ? 0.45 : 1 }}>
            <div>
              <div className="perm-name mono">{a.address}</div>
              <div className="perm-origin">
                {a.label} · {fmtInt(a.tolls)} tolls · last {a.lastToll}
              </div>
              <div className="scopes">
                {a.traits.map((t) => (
                  <span key={t} className="scope">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="agent-side">
              <div className="fiat mono">{fmtUsd(a.spendToday)}</div>
              <button className="revoke" onClick={() => toggleBlock(a.address)}>
                {isBlocked ? "Unblock" : "Block"}
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
