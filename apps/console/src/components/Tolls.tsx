import { CircleDollarSign, History } from "lucide-react";
import { fmtMicroUsd, tolls, type TollStatus } from "../data";

const statusMeta: Record<TollStatus, { cls: string; label: string }> = {
  settled: { cls: "ok", label: "settled" },
  pending: { cls: "pend", label: "pending" },
  "402": { cls: "fail", label: "402" },
  "429": { cls: "pend", label: "429" },
};

/** Live toll stream: every challenge, payment, and reject as it happens. */
export function Tolls() {
  return (
    <section className="glass panel" id="tolls" aria-label="Recent tolls">
      <div className="panel-head">
        <span className="t">
          <History size={14} strokeWidth={1.7} />
          Toll stream
        </span>
        <span className="microlabel">live</span>
      </div>
      {tolls.map((t) => {
        const s = statusMeta[t.status];
        return (
          <div key={t.id} className="datarow">
            <span className="tx-ico">
              <CircleDollarSign size={13} strokeWidth={1.7} />
            </span>
            <div className="tx-main">
              <div className="l1">
                <span className="kind mono">{t.route}</span>
                <span className={`status ${s.cls}`}>
                  <span className="sdot" />
                  {s.label}
                </span>
              </div>
              <div className="l2">
                agent {t.agent} · {t.network}
              </div>
            </div>
            <div className="tx-amt">
              <div className="a">{t.amount === null ? "—" : fmtMicroUsd(t.amount)}</div>
              <div className="age">{t.age}</div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
