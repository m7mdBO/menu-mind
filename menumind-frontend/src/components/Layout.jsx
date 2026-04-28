import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Pass' },
  { to: '/ingredients', label: 'Stock' },
  { to: '/menu-items', label: 'Menu' },
  { to: '/suppliers', label: 'Suppliers' },
  { to: '/sales', label: 'Sales' },
  { to: '/forecast', label: 'Forecast' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-navy text-cream sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 md:px-6 pt-4 md:pt-5 pb-3 md:pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-8">
          <div className="flex items-center md:items-end justify-between md:justify-start gap-4 md:gap-10">
            <div className="leading-none">
              <div className="font-display font-black text-3xl md:text-4xl text-cream tracking-tight">
                MENUMIND
              </div>
              <div className="text-mustard text-[10px] tracking-signage font-semibold uppercase mt-1">
                Kitchen Operations · Station 01
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="md:hidden px-3 py-1.5 rounded-sm text-[11px] font-display font-bold uppercase tracking-signage bg-navy-light hover:bg-copper text-cream transition-colors"
            >
              Clock out
            </button>
            <nav className="hidden md:flex gap-0 pb-1">
              {navItems.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    `relative px-4 py-2 font-display font-bold uppercase tracking-signage text-sm transition-colors ${
                      isActive
                        ? 'text-mustard'
                        : 'text-cream/60 hover:text-cream'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {n.label}
                      {isActive && (
                        <span className="absolute -bottom-[5px] left-3 right-3 h-[3px] bg-mustard" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
          <nav className="md:hidden flex gap-0 -mx-4 px-4 overflow-x-auto pb-1">
            {navItems.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `relative px-3 py-2 font-display font-bold uppercase tracking-signage text-xs whitespace-nowrap transition-colors ${
                    isActive ? 'text-mustard' : 'text-cream/60 hover:text-cream'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {n.label}
                    {isActive && (
                      <span className="absolute -bottom-[3px] left-3 right-3 h-[3px] bg-mustard" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-4">
            <div className="text-right leading-tight">
              <div className="text-[10px] uppercase tracking-signage text-cream/50">On shift</div>
              <div className="text-sm font-semibold text-cream">{user?.name}</div>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-sm text-[11px] font-display font-bold uppercase tracking-signage bg-navy-light hover:bg-copper text-cream transition-colors"
            >
              Clock out
            </button>
          </div>
        </div>
        <div className="h-[3px] bg-gradient-to-r from-copper via-mustard to-copper" />
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-6 md:py-8">
        <Outlet />
      </main>
      <footer className="border-t border-line py-4 text-center text-[11px] uppercase tracking-signage text-ash/70">
        MenuMind · Kitchen OS · Built for the line
      </footer>
    </div>
  );
}
