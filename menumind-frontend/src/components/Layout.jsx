import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Pass' },
  { to: '/ingredients', label: 'Stock' },
  { to: '/menu-items', label: 'Menu' },
  { to: '/suppliers', label: 'Suppliers' },
  { to: '/sales', label: 'Sales' },
  { to: '/ai-restock', label: 'Restock AI' },
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
        <div className="max-w-7xl mx-auto px-6 pt-5 pb-4 flex items-center justify-between gap-8">
          <div className="flex items-end gap-10">
            <div className="leading-none">
              <div className="font-display font-black text-4xl text-cream tracking-tight">
                MENUMIND
              </div>
              <div className="text-mustard text-[10px] tracking-signage font-semibold uppercase mt-1">
                Kitchen Operations · Station 01
              </div>
            </div>
            <nav className="flex gap-0 pb-1">
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
          <div className="flex items-center gap-4">
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-line py-4 text-center text-[11px] uppercase tracking-signage text-ash/70">
        MenuMind · Cloud Kitchen OS · Built for the line
      </footer>
    </div>
  );
}
