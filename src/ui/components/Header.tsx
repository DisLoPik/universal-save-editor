import { NavLink } from 'react-router-dom';

const NAV_LINKS = [
  { to: '/', label: 'Editor', end: true },
  { to: '/supported-games', label: 'Supported Games' },
  { to: '/community-editors', label: 'Community Editors' },
  { to: '/docs', label: 'Docs' },
  { to: '/about', label: 'About' },
];

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <NavLink to="/" className="flex items-center gap-2.5 shrink-0">
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#161c29" />
            <path d="M8 8h13l3 3v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" stroke="#5b8cff" strokeWidth="1.6" strokeLinejoin="round" />
            <rect x="11" y="8" width="7" height="5" fill="#5b8cff" />
            <rect x="10" y="18" width="12" height="6" rx="1" stroke="#5b8cff" strokeWidth="1.6" />
          </svg>
          <span className="font-semibold tracking-tight text-text">
            Universal Save Editor
          </span>
        </NavLink>
        <nav className="flex items-center gap-1 overflow-x-auto text-sm">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors ${
                  isActive ? 'bg-bg-raised text-text' : 'text-text-muted hover:text-text hover:bg-bg-raised/60'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
