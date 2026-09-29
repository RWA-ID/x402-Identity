type NavLink = { href: string; label: string };

/** Header used by the inner pages (the home page has its own, with wallet connect). */
export function SiteNav({ links }: { links: NavLink[] }) {
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
      </div>
    </header>
  );
}
