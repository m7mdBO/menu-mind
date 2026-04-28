import { useEffect, useState } from 'react';
import api from '../lib/api';

export default function AIRestock() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedDrafts, setSavedDrafts] = useState([]);
  const [savedMsg, setSavedMsg] = useState('');

  async function loadDrafts() {
    const { data } = await api.get('/ai/restock-drafts');
    setSavedDrafts(data);
  }

  useEffect(() => { loadDrafts(); }, []);

  async function generate() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await api.post('/ai/predict-restock');
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!result?.draft) return;
    await api.post('/ai/restock-drafts', { content: result.draft });
    setSavedMsg('Saved to history');
    setTimeout(() => setSavedMsg(''), 2000);
    loadDrafts();
  }

  function copy() {
    if (!result?.draft) return;
    navigator.clipboard.writeText(result.draft);
    setSavedMsg('Copied to clipboard');
    setTimeout(() => setSavedMsg(''), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-navy pb-4">
        <div>
          <div className="eyebrow">Predictive Restock</div>
          <h1 className="font-display font-black text-4xl md:text-5xl text-navy leading-none mt-1">Restock AI</h1>
        </div>
        <button onClick={generate} disabled={loading} className="btn-primary disabled:opacity-50">
          {loading ? 'Analyzing the line…' : 'Run prediction →'}
        </button>
      </div>

      <div className="panel p-5 bg-navy text-cream relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
             style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 12px)' }} />
        <div className="relative">
          <div className="text-mustard text-[11px] uppercase tracking-signage font-semibold mb-2">How it works</div>
          <p className="text-sm text-cream/80 max-w-2xl">
            Reads your inventory and last 10 sales, calculates daily consumption per ingredient,
            flags anything that will hit zero in 48 hours, then drafts a professional restock email
            grouped by supplier.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-tomato/10 border-l-4 border-tomato px-4 py-3 text-tomato">
          <div className="text-[11px] uppercase tracking-signage font-bold">Error</div>
          <div className="text-sm">{error}</div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="panel p-5">
            <div className="eyebrow">Summary</div>
            <div className="font-display font-bold text-2xl text-navy mt-1">{result.summary}</div>
          </div>

          {result.atRisk && result.atRisk.length > 0 && (
            <div className="panel">
              <div className="px-5 pt-5 pb-3 border-b border-line">
                <div className="eyebrow text-tomato">Flagged</div>
                <div className="font-display font-black text-2xl text-navy mt-1 leading-none">
                  At-risk ingredients
                </div>
              </div>
              <ul className="divide-y divide-line/60">
                {result.atRisk.map((i, idx) => (
                  <li key={idx} className="px-5 py-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="font-display font-bold text-lg text-navy">{i.name}</div>
                      <div className="text-[11px] uppercase tracking-signage text-ash mt-0.5">
                        Supplier · {i.supplier}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-2xl text-tomato leading-none">
                        {i.currentStock} <span className="text-sm text-ash">{i.unit}</span>
                      </div>
                      <div className="text-[11px] text-ash mt-1">
                        ~{i.avgDailyUse}/day · {i.daysRemaining ?? '∞'} days left
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.draft && (
            <div className="panel relative">
              <div className="px-5 pt-5 pb-3 border-b border-line flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="eyebrow">AI Draft</div>
                  <div className="font-display font-black text-2xl text-navy mt-1 leading-none">
                    Restock email
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {savedMsg && <span className="text-sage text-[11px] uppercase tracking-signage font-bold">{savedMsg}</span>}
                  <button onClick={copy} className="btn-secondary text-xs">Copy</button>
                  <button onClick={save} className="btn-primary text-xs">Save draft</button>
                </div>
              </div>
              <pre className="px-5 py-5 bg-bone/40 text-ink text-sm whitespace-pre-wrap font-body leading-relaxed">
                {result.draft}
              </pre>
            </div>
          )}
        </div>
      )}

      {savedDrafts.length > 0 && (
        <div className="panel">
          <div className="px-5 pt-5 pb-3 border-b border-line">
            <div className="eyebrow">Archive</div>
            <div className="font-display font-black text-2xl text-navy mt-1 leading-none">Saved drafts</div>
          </div>
          <ul className="divide-y divide-line/60">
            {savedDrafts.map((d) => (
              <li key={d.id} className="px-5 py-4">
                <div className="text-[11px] uppercase tracking-signage text-ash mb-2">
                  #{String(d.id).padStart(4, '0')} · {new Date(d.createdAt).toLocaleString()}
                </div>
                <pre className="text-sm whitespace-pre-wrap font-body text-ink leading-relaxed">{d.content}</pre>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
