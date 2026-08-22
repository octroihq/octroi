import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Moon, Sun, Wallet } from "lucide-react";
import { fmtGwei, networks } from "../data";

interface NavProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export function Nav({ theme, onToggleTheme }: NavProps) {
  const [netOpen, setNetOpen] = useState(false);
  const [activeNet, setActiveNet] = useState(networks[0]); // Base by default
  const [connected, setConnected] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!netOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setNetOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [netOpen]);

  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <a className="brand" href="#">
          <img
            className="mark"
            src={theme === "dark" ? "/mark-white.svg" : "/mark-ink.svg"}
            alt=""
            width={22}
            height={22}
          />
          tollway <span className="brand-scope">console</span>
        </a>

        <nav className="nav-links">
          <a href="#revenue">Revenue</a>
          <a href="#tolls">Tolls</a>
          <a href="#networks">Settlement</a>
          <a href="#agents">Agents</a>
        </nav>

        <div className="nav-right">
          <div className="netsel" ref={menuRef}>
            <button
              className="netsel-btn"
              onClick={() => setNetOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={netOpen}
            >
              <span className="netdot" style={{ background: activeNet.color }} />
              {activeNet.name}
              <ChevronDown size={13} className={`chev${netOpen ? " open" : ""}`} />
            </button>
            <div className={`netmenu${netOpen ? " open" : ""}`} role="listbox">
              {networks.map((n) => (
                <button
                  key={n.id}
                  className="netmenu-row"
                  role="option"
                  aria-selected={n.id === activeNet.id}
                  onClick={() => {
                    setActiveNet(n);
                    setNetOpen(false);
                  }}
                >
                  <span className="netdot" style={{ background: n.color }} />
                  {n.name}
                  <span className="gas">{fmtGwei(n.baseFeeGwei)} gwei</span>
                  {n.id === activeNet.id && <Check size={13} className="check" />}
                </button>
              ))}
            </div>
          </div>

          <button className="iconbtn" onClick={onToggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? <Sun size={15} strokeWidth={1.7} /> : <Moon size={15} strokeWidth={1.7} />}
          </button>

          <button className="connect" onClick={() => setConnected((c) => !c)}>
            {connected ? (
              <>
                <span className="live" />
                <span className="mono">pay-to 0x7A3f…9E2c</span>
              </>
            ) : (
              <>
                <Wallet size={14} strokeWidth={1.7} />
                Connect payout wallet
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
