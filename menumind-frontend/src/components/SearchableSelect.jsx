import { useEffect, useRef, useState } from 'react';

export default function SearchableSelect({ value, onChange, options, placeholder = 'Search…' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const q = query.toLowerCase().trim();
  const filtered = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;

  function pick(id) {
    onChange(id);
    setOpen(false);
    setQuery('');
  }

  const displayValue = open ? query : (selected?.name || '');

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        className="input pr-7"
        value={displayValue}
        placeholder={selected ? selected.name : placeholder}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={(e) => { setOpen(true); setQuery(e.target.value); }}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ash text-xs">
        {open ? '▴' : '▾'}
      </span>
      {open && (
        <div className="absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-auto bg-cream border border-line rounded-sm shadow-pos">
          {selected && (
            <button
              type="button"
              onClick={() => pick(0)}
              className="w-full text-left px-3 py-2 text-[10px] uppercase tracking-signage font-display font-bold text-tomato hover:bg-tomato/10 border-b border-line"
            >
              ✕ Clear selection
            </button>
          )}
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-ash">No matches</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => pick(o.id)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  o.id === value
                    ? 'bg-navy text-cream font-semibold'
                    : 'text-ink hover:bg-navy/5'
                }`}
              >
                {o.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
