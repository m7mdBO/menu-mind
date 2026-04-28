import { useEffect, useState } from 'react';
import api from '../lib/api';

const empty = { name: '', email: '', phone: '', notes: '' };

export default function Suppliers() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  async function load() {
    const { data } = await api.get('/suppliers');
    setItems(data);
  }
  useEffect(() => { load(); }, []);

  function startCreate() {
    setEditing('new'); setForm(empty); setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function startEdit(s) {
    setEditing(s.id);
    setForm({ name: s.name, email: s.email || '', phone: s.phone || '', notes: s.notes || '' });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      if (editing === 'new') await api.post('/suppliers', form);
      else await api.put(`/suppliers/${editing}`, form);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    }
  }

  async function remove(id) {
    if (!confirm('Remove this supplier?')) return;
    await api.delete(`/suppliers/${id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-navy pb-4">
        <div>
          <div className="eyebrow">Sourcing</div>
          <h1 className="font-display font-black text-4xl md:text-5xl text-navy leading-none mt-1">Suppliers</h1>
        </div>
        <button onClick={startCreate} className="btn-primary">+ Add supplier</button>
      </div>

      <input
        placeholder="Search suppliers by name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input"
      />

      {editing !== null && (
        <form onSubmit={save} className="panel p-6 space-y-5">
          <div>
            <div className="eyebrow">{editing === 'new' ? 'New entry' : 'Editing'}</div>
            <div className="font-display font-black text-2xl text-navy mt-1 leading-none">
              {editing === 'new' ? 'Add a supplier' : 'Edit supplier'}
            </div>
          </div>

          <div>
            <label className="input-label">Supplier name</label>
            <input required placeholder="e.g. Acme Foods" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Email (for restock orders)</label>
              <input type="email" placeholder="orders@acme.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
            </div>
            <div>
              <label className="input-label">Phone</label>
              <input placeholder="+1 555 123 4567" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" />
            </div>
          </div>
          <div>
            <label className="input-label">Notes</label>
            <textarea rows="2" placeholder="Delivery days, minimum orders, etc." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" />
          </div>

          {error && <div className="bg-tomato/10 border-l-4 border-tomato px-3 py-2 text-sm text-tomato font-medium">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button className="btn-primary">Save supplier</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {(() => {
        const q = search.toLowerCase().trim();
        const visible = q ? items.filter((s) => s.name.toLowerCase().includes(q)) : items;
        return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.length === 0 ? (
          <div className="panel p-8 text-center text-ash md:col-span-2">
            <div className="font-display text-2xl text-navy mb-1">No suppliers yet</div>
            <p className="text-sm">Add suppliers so the AI can group restock emails.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="panel p-8 text-center text-ash md:col-span-2">
            <div className="font-display text-2xl text-navy mb-1">No matches</div>
            <p className="text-sm">No supplier matches "{search}".</p>
          </div>
        ) : null}
        {visible.map((s) => (
          <div key={s.id} className="panel p-5 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-copper" />
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display font-black text-2xl text-navy leading-tight">{s.name}</div>
                <div className="text-[11px] uppercase tracking-signage text-ash mt-0.5">
                  {s.ingredients.length > 0 ? `Supplies ${s.ingredients.length} ingredient${s.ingredients.length > 1 ? 's' : ''}` : 'No ingredients linked yet'}
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-1 text-sm">
              <div className="text-ash"><span className="text-[10px] uppercase tracking-signage">Email </span><span className="font-mono">{s.email || '—'}</span></div>
              <div className="text-ash"><span className="text-[10px] uppercase tracking-signage">Phone </span><span className="font-mono">{s.phone || '—'}</span></div>
              {s.notes && <div className="text-ink mt-2 text-sm border-l-2 border-line pl-3 italic">{s.notes}</div>}
            </div>
            {s.ingredients.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {s.ingredients.map((i) => (
                  <span key={i.id} className="text-[10px] uppercase tracking-signage bg-bone text-navy px-2 py-0.5 rounded-sm border border-line">
                    {i.ingredient.name}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-2 text-xs">
              <button onClick={() => startEdit(s)} className="btn-ghost px-2 py-1">Edit</button>
              <button onClick={() => remove(s.id)} className="btn-ghost px-2 py-1 hover:text-tomato">Delete</button>
            </div>
          </div>
        ))}
      </div>
        );
      })()}
    </div>
  );
}
