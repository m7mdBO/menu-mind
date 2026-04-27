import { useEffect, useState } from 'react';
import api from '../lib/api';

const UNITS = ['kg', 'g', 'L', 'mL', 'pieces'];
const empty = { name: '', unit: 'kg', currentStock: 0, lowStockThreshold: 0, supplierIds: [] };

export default function Ingredients() {
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  async function load() {
    const params = {};
    if (search) params.search = search;
    if (status) params.status = status;
    const { data } = await api.get('/ingredients', { params });
    setItems(data);
  }

  useEffect(() => {
    load();
    api.get('/suppliers').then((r) => setSuppliers(r.data));
  }, [search, status]);

  function startCreate() {
    setEditing('new');
    setForm(empty);
    setError('');
  }

  function startEdit(item) {
    setEditing(item.id);
    setForm({
      name: item.name,
      unit: item.unit,
      currentStock: Number(item.currentStock),
      lowStockThreshold: Number(item.lowStockThreshold),
      supplierIds: item.suppliers.map((s) => s.supplierId),
    });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      if (editing === 'new') await api.post('/ingredients', form);
      else await api.put(`/ingredients/${editing}`, form);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    }
  }

  async function remove(id) {
    if (!confirm('Remove this ingredient from the line?')) return;
    await api.delete(`/ingredients/${id}`);
    load();
  }

  function toggleSupplier(id) {
    setForm((f) =>
      f.supplierIds.includes(id)
        ? { ...f, supplierIds: f.supplierIds.filter((x) => x !== id) }
        : { ...f, supplierIds: [...f.supplierIds, id] },
    );
  }

  function statusOf(item) {
    const s = Number(item.currentStock);
    const t = Number(item.lowStockThreshold);
    if (s <= t) return { label: 'Low', badge: 'bg-tomato/15 text-tomato', bar: 'bg-tomato' };
    if (s <= t * 1.5) return { label: 'Near low', badge: 'bg-mustard/20 text-copper-dark', bar: 'bg-mustard' };
    return { label: 'OK', badge: 'bg-sage/15 text-sage', bar: 'bg-sage' };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between border-b-2 border-navy pb-4">
        <div>
          <div className="eyebrow">Walk-in & Pantry</div>
          <h1 className="font-display font-black text-5xl text-navy leading-none mt-1">Stock</h1>
        </div>
        <button onClick={startCreate} className="btn-primary">+ Add ingredient</button>
      </div>

      <div className="flex gap-3">
        <input
          placeholder="Search ingredients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input md:w-56">
          <option value="">All statuses</option>
          <option value="low">Low stock only</option>
          <option value="ok">Above threshold</option>
        </select>
      </div>

      {editing !== null && (
        <form onSubmit={save} className="panel p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="eyebrow">{editing === 'new' ? 'New entry' : 'Editing'}</div>
              <div className="font-display font-black text-2xl text-navy mt-1 leading-none">
                {editing === 'new' ? 'Add an ingredient' : 'Edit ingredient'}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {/* Row 1: Name + Unit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="input-label">Ingredient name</label>
                <input
                  required
                  placeholder="e.g. San Marzano tomato"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="input-label">Unit of measure</label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="input"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Stock + Threshold — clearly labeled */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Current stock on hand</label>
                <div className="flex">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={form.currentStock}
                    onChange={(e) => setForm({ ...form, currentStock: Number(e.target.value) })}
                    className="input rounded-r-none"
                  />
                  <span className="bg-navy text-cream px-4 flex items-center font-mono text-sm rounded-r-sm">
                    {form.unit}
                  </span>
                </div>
                <p className="text-[11px] text-ash mt-1">How much you have right now.</p>
              </div>
              <div>
                <label className="input-label">Low-stock threshold</label>
                <div className="flex">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={form.lowStockThreshold}
                    onChange={(e) =>
                      setForm({ ...form, lowStockThreshold: Number(e.target.value) })
                    }
                    className="input rounded-r-none"
                  />
                  <span className="bg-navy text-cream px-4 flex items-center font-mono text-sm rounded-r-sm">
                    {form.unit}
                  </span>
                </div>
                <p className="text-[11px] text-ash mt-1">Alert when stock drops to this level.</p>
              </div>
            </div>

            {/* Suppliers */}
            {suppliers.length > 0 && (
              <div>
                <label className="input-label">Suppliers (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {suppliers.map((s) => {
                    const on = form.supplierIds.includes(s.id);
                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => toggleSupplier(s.id)}
                        className={`px-3 py-1.5 rounded-sm text-xs font-display font-bold uppercase tracking-signage border transition-colors ${
                          on
                            ? 'bg-copper text-cream border-copper'
                            : 'bg-cream text-navy border-line hover:border-copper'
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-tomato/10 border-l-4 border-tomato px-3 py-2 text-sm text-tomato font-medium">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button className="btn-primary">Save ingredient</button>
              <button type="button" onClick={() => setEditing(null)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* List as cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.length === 0 && (
          <div className="panel p-8 text-center text-ash md:col-span-2">
            <div className="font-display text-2xl text-navy mb-1">Nothing on the shelf</div>
            <p className="text-sm">Add your first ingredient to start tracking stock.</p>
          </div>
        )}
        {items.map((item) => {
          const st = statusOf(item);
          const stock = Number(item.currentStock);
          const threshold = Number(item.lowStockThreshold);
          const ratio = threshold > 0 ? Math.min(stock / (threshold * 2), 1) : 1;
          return (
            <div key={item.id} className="panel p-5 relative overflow-hidden">
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${st.bar}`} />
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display font-black text-2xl text-navy leading-tight">
                    {item.name}
                  </div>
                  <div className="text-[11px] uppercase tracking-signage text-ash mt-0.5">
                    {item.suppliers.map((s) => s.supplier.name).join(' · ') || 'No supplier set'}
                  </div>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-signage px-2 py-1 rounded-sm ${st.badge}`}>
                  {st.label}
                </span>
              </div>

              <div className="mt-4 flex items-end gap-1">
                <span className="font-mono font-bold text-4xl text-navy leading-none">
                  {stock}
                </span>
                <span className="font-mono text-sm text-ash mb-1">{item.unit}</span>
                <span className="ml-auto text-[11px] text-ash">
                  Threshold: <span className="font-mono">{threshold} {item.unit}</span>
                </span>
              </div>

              <div className="mt-2 h-1.5 bg-line rounded-sm overflow-hidden">
                <div className={`${st.bar} h-full`} style={{ width: `${ratio * 100}%` }} />
              </div>

              <div className="mt-4 flex gap-2 text-xs">
                <button onClick={() => startEdit(item)} className="btn-ghost px-2 py-1">Edit</button>
                <button onClick={() => remove(item.id)} className="btn-ghost px-2 py-1 hover:text-tomato">Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
