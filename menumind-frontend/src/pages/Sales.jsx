import { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import BulkSalesImport from '../components/BulkSalesImport';

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

function MenuCard({ item, ingredients, isActive, onActivate, onLog, onCancel, error }) {
  const [qty, setQty] = useState(1);
  const [logging, setLogging] = useState(false);
  const [removedIds, setRemovedIds] = useState(() => new Set());
  const [extras, setExtras] = useState([]);
  const [adderOpen, setAdderOpen] = useState(false);
  const [extraIngredientId, setExtraIngredientId] = useState('');
  const [extraQty, setExtraQty] = useState('1');

  function reset() {
    setQty(1);
    setRemovedIds(new Set());
    setExtras([]);
    setAdderOpen(false);
    setExtraIngredientId('');
    setExtraQty('1');
  }

  const recipeIngredientIds = useMemo(
    () => new Set(item.recipes.map((r) => r.ingredient.id)),
    [item.recipes],
  );

  const extraOptions = useMemo(
    () =>
      ingredients
        .filter((ing) => !recipeIngredientIds.has(ing.id) && !extras.some((e) => e.ingredientId === ing.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [ingredients, recipeIngredientIds, extras],
  );

  function toggleRemove(id) {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addExtra() {
    const id = Number(extraIngredientId);
    const q = Number(extraQty);
    if (!Number.isFinite(id) || id <= 0) return;
    if (!Number.isFinite(q) || q <= 0) return;
    const ing = ingredients.find((i) => i.id === id);
    if (!ing) return;
    setExtras((prev) => [...prev, { ingredientId: id, name: ing.name, unit: ing.unit, quantity: q }]);
    setExtraIngredientId('');
    setExtraQty('1');
    setAdderOpen(false);
  }

  function incExtra(id) {
    setExtras((prev) =>
      prev.map((e) => (e.ingredientId === id ? { ...e, quantity: Number((e.quantity + 1).toFixed(3)) } : e)),
    );
  }

  function decExtra(id) {
    setExtras((prev) =>
      prev.flatMap((e) => {
        if (e.ingredientId !== id) return [e];
        const next = Number((e.quantity - 1).toFixed(3));
        return next <= 0 ? [] : [{ ...e, quantity: next }];
      }),
    );
  }

  const allRecipeRemoved = recipeIngredientIds.size > 0 && removedIds.size === recipeIngredientIds.size;

  const noteParts = [];
  for (const r of item.recipes) {
    if (removedIds.has(r.ingredient.id)) noteParts.push(`no ${r.ingredient.name.toLowerCase()}`);
  }
  for (const ex of extras) {
    noteParts.push(`+${ex.quantity} ${ex.name.toLowerCase()}`);
  }
  const notePreview = noteParts.join(' · ');

  async function fire() {
    if (allRecipeRemoved) return;
    setLogging(true);
    try {
      await onLog(item.id, qty, {
        removedIngredientIds: Array.from(removedIds),
        extras: extras.map((e) => ({ ingredientId: e.ingredientId, quantity: e.quantity })),
      });
      reset();
    } finally {
      setLogging(false);
    }
  }

  function cancel() {
    reset();
    onCancel();
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
          <button onClick={cancel} className="text-ash hover:text-tomato text-xs font-display font-bold uppercase tracking-signage">
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

        {item.recipes.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-signage text-ash">
              Tap to skip · use + to add extras
            </div>
            <div className="flex flex-wrap gap-1.5">
              {item.recipes.map((r) => {
                const removed = removedIds.has(r.ingredient.id);
                return (
                  <button
                    type="button"
                    key={r.ingredient.id}
                    onClick={() => toggleRemove(r.ingredient.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-display font-bold uppercase tracking-signage border transition-colors ${
                      removed
                        ? 'bg-bone/60 border-tomato/40 text-tomato line-through'
                        : 'bg-cream border-line text-navy hover:border-copper hover:text-copper-dark'
                    }`}
                  >
                    {r.ingredient.name}
                  </button>
                );
              })}

              {extras.map((ex) => (
                <span
                  key={ex.ingredientId}
                  className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-display font-bold uppercase tracking-signage bg-mustard/30 border border-mustard text-navy"
                >
                  + {ex.name}
                  <span className="font-mono text-[10px] text-navy/70">×{ex.quantity}</span>
                  <button
                    type="button"
                    onClick={() => decExtra(ex.ingredientId)}
                    className="w-5 h-5 rounded-full bg-cream/70 hover:bg-cream text-navy text-sm leading-none flex items-center justify-center"
                    aria-label="Decrease"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => incExtra(ex.ingredientId)}
                    className="w-5 h-5 rounded-full bg-cream/70 hover:bg-cream text-navy text-sm leading-none flex items-center justify-center"
                    aria-label="Increase"
                  >
                    +
                  </button>
                </span>
              ))}

              {extraOptions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAdderOpen((o) => !o)}
                  className={`px-3 py-1.5 rounded-full text-xs font-display font-bold uppercase tracking-signage border transition-colors ${
                    adderOpen
                      ? 'bg-copper border-copper text-cream'
                      : 'bg-cream border-dashed border-copper text-copper hover:bg-copper hover:text-cream'
                  }`}
                >
                  + Add
                </button>
              )}
            </div>

            {adderOpen && extraOptions.length > 0 && (
              <div className="flex gap-2 pt-1">
                <select
                  value={extraIngredientId}
                  onChange={(e) => setExtraIngredientId(e.target.value)}
                  className="input flex-1 text-sm"
                  autoFocus
                >
                  <option value="">Pick an ingredient…</option>
                  {extraOptions.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={extraQty}
                  onChange={(e) => setExtraQty(e.target.value)}
                  className="input w-20 text-sm"
                  aria-label="Quantity"
                />
                <button
                  type="button"
                  onClick={addExtra}
                  disabled={!extraIngredientId}
                  className="btn-secondary px-3 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            )}

            {qty > 1 && (removedIds.size > 0 || extras.length > 0) && (
              <div className="text-[11px] text-ash italic">
                Modifications apply to all {qty} units.
              </div>
            )}
          </div>
        )}

        {notePreview && (
          <div className="text-[11px] text-copper-dark bg-mustard/15 border-l-4 border-mustard px-3 py-2 font-medium italic">
            {notePreview}
          </div>
        )}

        {allRecipeRemoved && (
          <div className="bg-tomato/10 border-l-4 border-tomato px-3 py-2 text-xs text-tomato font-medium">
            You can't remove every ingredient.
          </div>
        )}

        {error && (
          <div className="bg-tomato/10 border-l-4 border-tomato px-3 py-2 text-xs text-tomato font-medium">
            {error}
          </div>
        )}

        <button onClick={fire} disabled={logging || allRecipeRemoved} className="btn-primary disabled:opacity-50">
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
  const [ingredients, setIngredients] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [cardError, setCardError] = useState({ id: null, message: '' });
  const [success, setSuccess] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [mode, setMode] = useState('manual');

  async function load() {
    const [salesRes, miRes, ingRes] = await Promise.all([
      api.get('/sales'),
      api.get('/menu-items'),
      api.get('/ingredients'),
    ]);
    setSales(salesRes.data);
    setMenuItems(miRes.data);
    setIngredients(ingRes.data);
  }

  useEffect(() => { load(); }, []);

  async function logSale(menuItemId, quantity, mods = {}) {
    setCardError({ id: null, message: '' });
    setSuccess('');
    try {
      const { data } = await api.post('/sales', {
        menuItemId,
        quantitySold: quantity,
        removedIngredientIds: mods.removedIngredientIds || [],
        extras: mods.extras || [],
      });
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
  const q = nameSearch.toLowerCase().trim();
  const visibleItems = menuItems
    .filter((m) => !categoryFilter || m.category === categoryFilter)
    .filter((m) => !q || m.name.toLowerCase().includes(q));

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

      <div className="flex gap-1.5 bg-navy/5 p-1.5 rounded-sm w-fit">
        <button
          onClick={() => setMode('manual')}
          className={`px-7 py-3 rounded-sm text-sm font-display font-bold uppercase tracking-signage transition-colors ${
            mode === 'manual' ? 'bg-navy text-cream shadow-pos' : 'text-navy hover:text-copper'
          }`}
        >
          Manual
        </button>
        <button
          onClick={() => setMode('bulk')}
          className={`px-7 py-3 rounded-sm text-sm font-display font-bold uppercase tracking-signage transition-colors ${
            mode === 'bulk' ? 'bg-navy text-cream shadow-pos' : 'text-navy hover:text-copper'
          }`}
        >
          Bulk Import
        </button>
      </div>

      {mode === 'bulk' && (
        <BulkSalesImport menuItems={menuItems} onImported={load} />
      )}

      {mode === 'manual' && (
        <input
          placeholder="Search menu items by name…"
          value={nameSearch}
          onChange={(e) => setNameSearch(e.target.value)}
          className="input"
        />
      )}

      {/* Category filter chips */}
      {mode === 'manual' && categories.length > 0 && (
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
      {mode === 'manual' && (menuItems.length === 0 ? (
        <div className="panel p-8 text-center text-ash">
          <div className="font-display text-2xl text-navy mb-1">No menu items yet</div>
          <p className="text-sm">Add menu items to start logging sales.</p>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="panel p-8 text-center text-ash">
          <div className="font-display text-2xl text-navy mb-1">No matches</div>
          <p className="text-sm">Nothing matches your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleItems.map((item) => (
            <MenuCard
              key={item.id}
              item={item}
              ingredients={ingredients}
              isActive={activeId === item.id}
              onActivate={() => { setActiveId(item.id); setCardError({ id: null, message: '' }); }}
              onCancel={() => { setActiveId(null); setCardError({ id: null, message: '' }); }}
              onLog={logSale}
              error={cardError.id === item.id ? cardError.message : ''}
            />
          ))}
        </div>
      ))}

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
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="font-mono text-xs text-copper">#{String(s.id).padStart(4, '0')}</span>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-ink truncate">{s.menuItem.name}</span>
                      <span className="font-mono text-xs bg-navy text-cream px-2 py-0.5 rounded-sm shrink-0">
                        ×{s.quantitySold}
                      </span>
                    </div>
                    {s.notes && (
                      <span className="text-[11px] text-copper-dark italic truncate">{s.notes}</span>
                    )}
                  </div>
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
