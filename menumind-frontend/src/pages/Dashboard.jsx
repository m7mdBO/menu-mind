import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

function StatTile({ label, value, accent = 'navy' }) {
  const accents = {
    navy: 'text-navy',
    copper: 'text-copper',
    mustard: 'text-mustard',
    tomato: 'text-tomato',
    sage: 'text-sage',
  };
  return (
    <div className="panel p-5">
      <div className="text-[10px] font-semibold uppercase tracking-signage text-ash">
        {label}
      </div>
      <div className={`font-mono font-bold text-5xl mt-2 leading-none ${accents[accent]}`}>
        {String(value).padStart(2, '0')}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/dashboard')
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load dashboard'));
  }, []);

  if (error) return <p className="text-tomato">{error}</p>;
  if (!data) return <p className="text-ash">Loading…</p>;

  const total = data.inventoryHealth.healthy + data.inventoryHealth.nearLow + data.inventoryHealth.lowStock || 1;
  const pct = (n) => `${(n / total) * 100}%`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-navy pb-4">
        <div>
          <div className="eyebrow">Station Overview</div>
          <h1 className="font-display font-black text-4xl md:text-5xl text-navy leading-none mt-1">
            The Pass
          </h1>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-signage text-ash">Live snapshot</div>
          <div className="font-mono text-xs md:text-sm text-navy">{new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Stock items" value={data.counts.ingredients} />
        <StatTile label="Menu items" value={data.counts.menuItems} accent="copper" />
        <StatTile label="Suppliers" value={data.counts.suppliers} />
        <StatTile
          label="Low stock"
          value={data.inventoryHealth.lowStock}
          accent={data.inventoryHealth.lowStock > 0 ? 'tomato' : 'sage'}
        />
      </div>

      {/* Inventory health bar */}
      <div className="panel p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="eyebrow">Inventory Health</div>
            <div className="font-display text-2xl text-navy mt-1">Across all stock items</div>
          </div>
          <Link to="/ingredients" className="btn-ghost">Manage stock →</Link>
        </div>
        {total === 1 && data.counts.ingredients === 0 ? (
          <p className="text-sm text-ash">No ingredients yet — add some on the Stock page.</p>
        ) : (
          <>
            <div className="flex h-3 rounded-sm overflow-hidden border border-line">
              <div className="bg-sage" style={{ width: pct(data.inventoryHealth.healthy) }} />
              <div className="bg-mustard" style={{ width: pct(data.inventoryHealth.nearLow) }} />
              <div className="bg-tomato" style={{ width: pct(data.inventoryHealth.lowStock) }} />
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-sage" />
                  <span className="text-[10px] uppercase tracking-signage text-ash">Healthy</span>
                </div>
                <div className="font-mono font-bold text-2xl text-sage mt-1">
                  {data.inventoryHealth.healthy}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-mustard" />
                  <span className="text-[10px] uppercase tracking-signage text-ash">Near low</span>
                </div>
                <div className="font-mono font-bold text-2xl text-mustard mt-1">
                  {data.inventoryHealth.nearLow}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-tomato" />
                  <span className="text-[10px] uppercase tracking-signage text-ash">Low</span>
                </div>
                <div className="font-mono font-bold text-2xl text-tomato mt-1">
                  {data.inventoryHealth.lowStock}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low stock ticket */}
        {data.lowStockIngredients.length > 0 ? (
          <div className="bg-cream border-l-4 border-tomato shadow-ticket">
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-signage text-tomato font-bold">Action Required</div>
                  <div className="font-display font-black text-3xl text-navy mt-1 leading-none">
                    Low Stock
                  </div>
                </div>
                <span className="font-mono font-bold text-3xl text-tomato">
                  {data.lowStockIngredients.length}
                </span>
              </div>
            </div>
            <ul className="divide-y divide-line/60">
              {data.lowStockIngredients.map((i) => (
                <li key={i.id} className="px-5 py-3 flex justify-between items-center">
                  <span className="font-medium text-ink">{i.name}</span>
                  <span className="font-mono text-sm text-ash">
                    <span className="text-tomato font-bold">{i.currentStock}</span>
                    <span className="text-ash/50"> / {i.lowStockThreshold} {i.unit}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="px-5 py-3 border-t border-line">
              <Link to="/forecast" className="btn-primary text-xs w-full">
                Fire restock email →
              </Link>
            </div>
          </div>
        ) : (
          <div className="panel p-5">
            <div className="eyebrow text-sage">All Clear</div>
            <div className="font-display font-black text-3xl text-navy mt-1">No low stock</div>
            <p className="text-ash text-sm mt-2">Every ingredient is above its threshold.</p>
          </div>
        )}

        {/* Recent sales ticker */}
        <div className="panel">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div>
              <div className="eyebrow">Tickets</div>
              <div className="font-display font-black text-3xl text-navy mt-1 leading-none">
                Recent sales
              </div>
            </div>
            <Link to="/sales" className="btn-ghost text-xs">All →</Link>
          </div>
          {data.recentSales.length === 0 ? (
            <div className="px-5 py-6 text-sm text-ash">No sales yet.</div>
          ) : (
            <ul className="divide-y divide-line/60">
              {data.recentSales.map((s) => (
                <li key={s.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-copper">
                      #{String(s.id).padStart(4, '0')}
                    </span>
                    <span className="font-medium text-ink truncate">{s.menuItem.name}</span>
                    <span className="font-mono text-xs bg-navy text-cream px-2 py-0.5 rounded-sm shrink-0">
                      ×{s.quantitySold}
                    </span>
                  </div>
                  <span className="text-[11px] text-ash uppercase tracking-signage shrink-0">
                    {new Date(s.soldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
