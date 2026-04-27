import { useEffect, useState } from 'react';
import api from '../lib/api';

const CATEGORY_PRESETS = ['Main', 'Side', 'Appetizer', 'Dessert', 'Drink'];

const emptyForm = {
  name: '',
  description: '',
  category: 'Main',
  customCategory: '',
  recipes: [],
};

export default function MenuItems() {
  const [items, setItems] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  async function load() {
    const params = categoryFilter ? { category: categoryFilter } : {};
    const { data } = await api.get('/menu-items', { params });
    setItems(data);
  }

  useEffect(() => {
    load();
    api.get('/ingredients').then((r) => setIngredients(r.data));
  }, [categoryFilter]);

  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));

  function startCreate() {
    setEditing('new');
    setForm(emptyForm);
    setError('');
  }

  function startEdit(item) {
    const isPreset = CATEGORY_PRESETS.includes(item.category || '');
    setEditing(item.id);
    setForm({
      name: item.name,
      description: item.description || '',
      category: isPreset ? item.category : (item.category ? 'Other' : 'Main'),
      customCategory: !isPreset && item.category ? item.category : '',
      recipes: item.recipes.map((r) => ({
        ingredientId: r.ingredientId,
        quantityNeeded: Number(r.quantityNeeded),
      })),
    });
    setError('');
  }

  function addRecipeRow() {
    setForm((f) => ({
      ...f,
      recipes: [...f.recipes, { ingredientId: ingredients[0]?.id || '', quantityNeeded: 0 }],
    }));
  }
  function updateRecipe(idx, patch) {
    setForm((f) => ({
      ...f,
      recipes: f.recipes.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }));
  }
  function removeRecipe(idx) {
    setForm((f) => ({ ...f, recipes: f.recipes.filter((_, i) => i !== idx) }));
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    const finalCategory = form.category === 'Other' ? form.customCategory.trim() : form.category;
    if (form.category === 'Other' && !finalCategory) {
      setError('Please specify the custom category');
      return;
    }
    try {
      const payload = {
        name: form.name,
        description: form.description,
        category: finalCategory,
        recipes: form.recipes.filter((r) => r.ingredientId && r.quantityNeeded > 0),
      };
      if (editing === 'new') await api.post('/menu-items', payload);
      else await api.put(`/menu-items/${editing}`, payload);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    }
  }

  async function remove(id) {
    if (!confirm('Remove this menu item?')) return;
    await api.delete(`/menu-items/${id}`);
    load();
  }

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

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between border-b-2 border-navy pb-4">
        <div>
          <div className="eyebrow">The Menu</div>
          <h1 className="font-display font-black text-5xl text-navy leading-none mt-1">Menu Items</h1>
        </div>
        <button onClick={startCreate} className="btn-primary">+ Add menu item</button>
      </div>

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

      {editing !== null && (
        <form onSubmit={save} className="panel p-6 space-y-5">
          <div>
            <div className="eyebrow">{editing === 'new' ? 'New entry' : 'Editing'}</div>
            <div className="font-display font-black text-2xl text-navy mt-1 leading-none">
              {editing === 'new' ? 'Add a menu item' : 'Edit menu item'}
            </div>
          </div>

          <div>
            <label className="input-label">Item name</label>
            <input required placeholder="e.g. Margherita pizza" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input"
              >
                {CATEGORY_PRESETS.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="Other">Other (custom)</option>
              </select>
            </div>
            {form.category === 'Other' && (
              <div>
                <label className="input-label">Custom category name</label>
                <input
                  placeholder="e.g. Brunch"
                  value={form.customCategory}
                  onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
                  className="input"
                />
              </div>
            )}
          </div>

          <div>
            <label className="input-label">Description (optional)</label>
            <input placeholder="e.g. Classic tomato + mozzarella + basil" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="input-label mb-0">Recipe — what it takes to make one</label>
              <button
                type="button"
                onClick={addRecipeRow}
                disabled={ingredients.length === 0}
                className="btn-ghost px-2 py-1 text-xs disabled:opacity-50"
              >
                + Add ingredient
              </button>
            </div>
            {ingredients.length === 0 ? (
              <p className="text-sm text-ash italic">Add ingredients on the Stock page first.</p>
            ) : form.recipes.length === 0 ? (
              <p className="text-sm text-ash italic">No ingredients added to recipe yet.</p>
            ) : (
              <div className="space-y-2">
                {form.recipes.map((r, idx) => {
                  const ing = ingredients.find((i) => i.id === Number(r.ingredientId));
                  return (
                    <div key={idx} className="flex items-center gap-2 bg-bone p-2 rounded-sm">
                      <select
                        value={r.ingredientId}
                        onChange={(e) => updateRecipe(idx, { ingredientId: Number(e.target.value) })}
                        className="input flex-1"
                      >
                        {ingredients.map((i) => (
                          <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={r.quantityNeeded}
                        onChange={(e) => updateRecipe(idx, { quantityNeeded: Number(e.target.value) })}
                        className="input w-28 font-mono"
                      />
                      <span className="text-sm font-mono text-ash w-12">{ing?.unit || ''}</span>
                      <button type="button" onClick={() => removeRecipe(idx)} className="text-tomato text-xs font-display font-bold uppercase tracking-signage px-2">
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {error && <div className="bg-tomato/10 border-l-4 border-tomato px-3 py-2 text-sm text-tomato font-medium">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button className="btn-primary">Save menu item</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.length === 0 && (
          <div className="panel p-8 text-center text-ash md:col-span-2 lg:col-span-3">
            <div className="font-display text-2xl text-navy mb-1">No menu items yet</div>
            <p className="text-sm">Add a menu item and define its recipe.</p>
          </div>
        )}
        {items.map((item) => (
          <div key={item.id} className="panel p-5 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display font-black text-2xl text-navy leading-tight">{item.name}</div>
                {item.description && <p className="text-sm text-ash mt-1">{item.description}</p>}
              </div>
              {item.category && (
                <span className={`text-[10px] font-bold uppercase tracking-signage px-2 py-1 rounded-sm whitespace-nowrap ${categoryColor(item.category)}`}>
                  {item.category}
                </span>
              )}
            </div>
            <div className="mt-4 flex-1">
              <div className="text-[10px] uppercase tracking-signage text-ash mb-2">Recipe</div>
              {item.recipes.length === 0 ? (
                <p className="text-sm text-ash italic">No recipe yet</p>
              ) : (
                <ul className="space-y-1">
                  {item.recipes.map((r) => (
                    <li key={r.id} className="flex justify-between text-sm">
                      <span className="text-ink">{r.ingredient.name}</span>
                      <span className="font-mono text-ash">{r.quantityNeeded} {r.ingredient.unit}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-line flex gap-2 text-xs">
              <button onClick={() => startEdit(item)} className="btn-ghost px-2 py-1">Edit</button>
              <button onClick={() => remove(item.id)} className="btn-ghost px-2 py-1 hover:text-tomato">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
