import { useCallback, useEffect, useState } from "react";
import { Agents } from "./components/Agents";
import { Ambient } from "./components/Ambient";
import { Hero } from "./components/Hero";
import { Nav } from "./components/Nav";
import { Settlement } from "./components/Settlement";
import { Tolls } from "./components/Tolls";

type Theme = "dark" | "light";

const THEME_KEY = "tollway-console-theme";

function initialTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" ? stored : "light";
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return (
    <>
      <Ambient />
      <Nav theme={theme} onToggleTheme={toggleTheme} />
      <main>
        <Hero />
        <section className="density">
          <div className="wrap density-grid">
            <Settlement />
            <Tolls />
            <Agents />
          </div>
        </section>
      </main>
      <footer className="wrap footer">
        <span className="mono">tollway console · every request pays its way</span>
        <div className="links">
          <a href="#revenue">Revenue</a>
          <a href="#tolls">Tolls</a>
          <a href="#networks">Settlement</a>
          <a href="#agents">Agents</a>
        </div>
        <span>non-custodial · settlement addresses stay yours</span>
      </footer>
    </>
  );
}
