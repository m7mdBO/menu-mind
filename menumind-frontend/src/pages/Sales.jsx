import { useEffect, useState } from 'react';
import api from '../lib/api';

function categoryColor(cat) {
  const palette = {
    Main: 'bg-copper text-cream',
    Side: 'bg-mustard text-navy',
    Appetizer: 'bg-sage text-cream',
    Dessert: 'bg-tomato text-cream',
    Drink: 'bg-navy text-cream',
  };
  return palette[cat] || 'bg-ash text-cream';
}

function MenuCard({ item, isActive, onActivate, onLog, onCancel, error }) {
  const [qty, setQty] = useState(1);
  const [logging, setLogging] = useState(false);

  async function fire() {
    setLogging(true);
    try {
      await onLog(item.id, qty);
      setQty(1);
    } finally {
      setLogging(false);
    }
  }

  if (isActive) {
    return (
      <div className="border-2 border-copper bg-cream rounded-sm shadow-pos p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-display font-black text-2xl text-navy leading-tight">{item.name}</div>
            {item.category && (
              <span className={`mt-1 inline-block text-[10px] font-bold uppercase tracking-signage px-2 py-0.5 rounded-sm ${categoryColor(item.category)}`}>
                {item.category}
              </span>
            )}
          </div>
          <button onClick={onCancel} className="text-ash hover:text-tomato text-xs font-display font-bold uppercase tracking-signage">
            ✕ Close
          </button>
        </div>

        <div className="flex items-center justify-between bg-navy text-cream rounded-sm p-3">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="w-12 h-12 rounded-sm bg-navy-light hover:bg-copper text-cream text-2xl font-display font-bold transition-colors"
            aria-label="Decrease"
          >
            −
          </button>
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-signage text-cream/60">Quantity</div>
            <div className="font-mono font-bold text-4xl text-mustard leading-none">
              {String(qty).padStart(2, '0')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setQty((q) => q + 1)}
            className="w-12 h-12 rounded-sm bg-navy-light hover:bg-copper text-cream text-2xl font-display font-bold transition-colors"
            aria-label="Increase"
          >
            +
          </button>
        </div>

        {error && (
          <div className="bg-tomato/10 border-l-4 border-tomato px-3 py-2 text-xs text-tomato font-medium">
            {error}
          </div>
        )}

        <button onClick={fire} disabled={logging} className="btn-primary disabled:opacity-50">
          {logging ? 'Firing…' : `Punch sale × ${qty}`}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onActivate}
      className="text-left panel p-5 hover:border-copper hover:shadow-pos transition-all group flex flex-col cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display font-black text-2xl text-navy leading-tight group-hover:text-copper-dark transition-colors">
            {item.name}
          </div>
          <div className="text-[10px] uppercase tracking-signage text-ash mt-1">
            {item.recipes.length > 0
              ? `${item.recipes.length} ingredient${item.recipes.length > 1 ? 's' : ''}`
              : 'No recipe'}
          </div>
        </div>
        {item.category && (
          <span className={`text-[10px] font-bold uppercase tracking-signage px-2 py-1 rounded-sm whitespace-nowrap ${categoryColor(item.category)}`}>
            {item.category}
          </span>
        )}
      </div>
      <div className="mt-auto pt-4 text-[11px] uppercase tracking-signage text-copper font-bold">
        Tap to log →
      </div>
    </button>
  );
}

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [cardError, setCardError] = useState({ id: null, message: '' });
  const [success, setSuccess] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  async function load() {
    const [salesRes, miRes] = await Promise.all([api.get('/sales'), api.get('/menu-items')]);
    setSales(salesRes.data);
    setMenuItems(miRes.data);
  }

  useEffect(() => { load(); }, []);

  async function logSale(menuItemId, quantity) {
    setCardError({ id: null, message: '' });
    setSuccess('');
    try {
      const { data } = await api.post('/sales', { menuItemId, quantitySold: quantity });
      setSuccess(`✓ Logged ${data.menuItem.name} × ${data.quantitySold}`);
      setActiveId(null);
      setTimeout(() => setSuccess(''), 2500);
      load();
    } catch (err) {
      const data = err.response?.data;
      const message = data?.ingredients
        ? `Insufficient: ${data.ingredients.map((i) => `${i.name} (need ${i.needed}, have ${i.available})`).join(', ')}`
        : (data?.error || 'Failed to log sale');
      setCardError({ id: menuItemId, message });
    }
  }

  const categories = Array.from(new Set(menuItems.map((i) => i.category).filter(Boolean)));
  const visibleItems = categoryFilter ? menuItems.filter((m) => m.category === categoryFilter) : menuItems;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-navy pb-4">
        <div>
          <div className="eyebrow">Point of Sale</div>
          <h1 className="font-display font-black text-4xl md:text-5xl text-navy leading-none mt-1">Sales</h1>
        </div>
        {success && (
          <div className="bg-sage/15 border-l-4 border-sage px-3 py-2 text-sage font-medium text-sm">
            {success}
          </div>
        )}
      </div>

      {/* Category filter chips */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryFilter('')}
            className={`px-3 py-1.5 rounded-sm text-[11px] font-display font-bold uppercase tracking-signage border transition-colors ${
              !categoryFilter ? 'bg-navy text-cream border-navy' : 'bg-cream text-navy border-line hover:border-copper'
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1.5 rounded-sm text-[11px] font-display font-bold uppercase tracking-signage border transition-colors ${
                categoryFilter === c ? 'bg-navy text-cream border-navy' : 'bg-cream text-navy border-line hover:border-copper'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* POS card grid */}
      {menuItems.length === 0 ? (
        <div className="panel p-8 text-center text-ash">
          <div className="font-display text-2xl text-navy mb-1">No menu items yet</div>
          <p className="text-sm">Add menu items to start logging sales.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleItems.map((item) => (
            <MenuCard
              key={item.id}
              item={item}
              isActive={activeId === item.id}
              onActivate={() => { setActiveId(item.id); setCardError({ id: null, message: '' }); }}
              onCancel={() => { setActiveId(null); setCardError({ id: null, message: '' }); }}
              onLog={logSale}
              error={cardError.id === item.id ? cardError.message : ''}
            />
          ))}
        </div>
      )}

      {/* Sales history — kitchen ticket strip */}
      <div className="panel">
        <div className="px-5 pt-5 pb-3 border-b border-line">
          <div className="eyebrow">History</div>
          <div className="font-display font-black text-2xl text-navy mt-1 leading-none">
            Recent tickets
          </div>
        </div>
        {sales.length === 0 ? (
          <div className="px-5 py-6 text-sm text-ash">No sales logged yet.</div>
        ) : (
          <ul className="divide-y divide-line/60">
            {sales.map((s) => (
              <li key={s.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs text-copper">#{String(s.id).padStart(4, '0')}</span>
                  <span className="font-medium text-ink truncate">{s.menuItem.name}</span>
                  <span className="font-mono text-xs bg-navy text-cream px-2 py-0.5 rounded-sm shrink-0">
                    ×{s.quantitySold}
                  </span>
                </div>
                <span className="text-[11px] text-ash uppercase tracking-signage shrink-0">
                  {new Date(s.soldAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
