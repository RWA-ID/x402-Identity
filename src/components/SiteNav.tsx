import type { ReactNode } from "react";

type NavLink = { href: string; label: string };

/** Header used by the inner pages (the home page has its own, with wallet connect). */
export function SiteNav({ links, cta }: { links: NavLink[]; cta?: ReactNode }) {
  return (
    <header className="nav">
      <div className="wrap nav-inner">
        <a className="brand" href="/" aria-label="x402 Identity Hub">
          <img className="brand-mark" src="/favicon.svg" width={22} height={22} alt="" />
          <span>x402</span>
          <span className="brand-sub">/ identity hub</span>
        </a>
        <nav className="links">
          {links.map((l) => (
            <a key={l.href} href={l.href}>{l.label}</a>
          ))}
        </nav>
        {cta && <div className="nav-cta">{cta}</div>}
      </div>
    </header>
  );
}
