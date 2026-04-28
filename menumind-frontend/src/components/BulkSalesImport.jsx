import { useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../lib/api';
import SearchableSelect from './SearchableSelect';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dateOnlyToISO(yyyymmdd) {
  if (!yyyymmdd) return null;
  const m = String(yyyymmdd).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return yyyymmdd;
  const [, y, mo, d] = m;
  if (yyyymmdd.slice(0, 10) === todayLocal()) {
    return new Date().toISOString();
  }
  return new Date(Number(y), Number(mo) - 1, Number(d), 12, 0, 0).toISOString();
}

function isoToLocalDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parsePasteText(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((line) => {
    if (line.includes(',')) {
      const parts = line.split(',').map((p) => p.trim());
      return {
        name: parts[0] || '',
        quantity: parts[1] ? Number(parts[1]) : null,
        date: parts[2] || null,
      };
    }
    const qtyFirst = line.match(/^(\d+)\s*x?\s+(.+)$/i);
    if (qtyFirst) return { name: qtyFirst[2].trim(), quantity: Number(qtyFirst[1]), date: null };
    const qtyLast = line.match(/^(.+?)\s+x?(\d+)$/i);
    if (qtyLast) return { name: qtyLast[1].trim(), quantity: Number(qtyLast[2]), date: null };
    return { name: line, quantity: null, date: null };
  });
}

async function parseFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
  if (matrix.length === 0) return [];

  const cellToDate = (v) => {
    if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
    if (v === '' || v == null) return null;
    return String(v).trim();
  };

  const header = matrix[0].map((h) => String(h).toLowerCase().trim());
  const looksLikeHeader = header.some((h) => /name|item|qty|quantity|sold|date/.test(h));

  if (looksLikeHeader) {
    const nameIdx = header.findIndex((h) => /name|item/.test(h));
    const qtyIdx = header.findIndex((h) => /qty|quantity|count|sold/.test(h));
    const dateIdx = header.findIndex((h) => /date/.test(h));
    return matrix.slice(1)
      .map((r) => ({
        name: String(r[nameIdx] ?? '').trim(),
        quantity: r[qtyIdx] === '' || r[qtyIdx] == null ? null : Number(r[qtyIdx]),
        date: dateIdx >= 0 ? cellToDate(r[dateIdx]) : null,
      }))
      .filter((r) => r.name);
  }

  return matrix.map((r) => ({
    name: String(r[0] ?? '').trim(),
    quantity: r[1] === '' || r[1] == null ? null : Number(r[1]),
    date: cellToDate(r[2]),
  })).filter((r) => r.name);
}

function ConfidenceBadge({ level }) {
  const styles = {
    high: 'bg-sage/15 text-sage border-sage/40',
    medium: 'bg-mustard/20 text-navy border-mustard',
    low: 'bg-tomato/15 text-tomato border-tomato/40',
    none: 'bg-tomato text-cream border-tomato',
  };
  const labels = { high: 'Match', medium: 'Check', low: 'Low', none: 'No match' };
  return (
    <span className={`text-[9px] font-display font-bold uppercase tracking-signage px-1.5 py-0.5 rounded-sm border ${styles[level] || styles.none}`}>
      {labels[level] || labels.none}
    </span>
  );
}

export default function BulkSalesImport({ menuItems, onImported }) {
  const [stage, setStage] = useState('input');
  const [pasteText, setPasteText] = useState('');
  const [defaultDate, setDefaultDate] = useState(todayLocal());
  const [previewRows, setPreviewRows] = useState([]);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function runPreview(rawRows) {
    setError('');
    if (rawRows.length === 0) {
      setError('Nothing to import — sheet or paste box was empty.');
      return;
    }
    setBusy(true);
    try {
      const rows = rawRows.map((r) => ({
        ...r,
        date: dateOnlyToISO(r.date || defaultDate),
      }));
      const { data } = await api.post('/sales/bulk-preview', { rows });
      setPreviewRows(data.rows.map((r) => ({
        ...r,
        date: isoToLocalDate(r.date),
        selectedMenuItemId: r.match?.menuItemId ?? 0,
      })));
      setStage('preview');
    } catch (err) {
      setError(err.response?.data?.error || 'Preview failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const rawRows = await parseFile(file);
      await runPreview(rawRows);
    } catch (err) {
      setError('Could not read file: ' + (err.message || 'unknown error'));
      setBusy(false);
    }
  }

  function onPasteParse() {
    runPreview(parsePasteText(pasteText));
  }

  function patchRow(index, patch) {
    setPreviewRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function dropRow(index) {
    setPreviewRows((rows) => rows.filter((_, i) => i !== index));
  }

  async function commit() {
    setError('');
    const valid = previewRows.filter(
      (r) => r.selectedMenuItemId && Number.isInteger(r.quantity) && r.quantity > 0 && r.date,
    );
    if (valid.length === 0) {
      setError('No row is ready to import. Each row needs a matched item, a positive quantity, and a date.');
      return;
    }
    setBusy(true);
    try {
      const payload = valid.map((r) => ({
        index: r.index,
        originalName: r.originalName,
        menuItemId: r.selectedMenuItemId,
        quantity: r.quantity,
        date: dateOnlyToISO(r.date),
      }));
      const { data } = await api.post('/sales/bulk-commit', { rows: payload });
      setResults(data);
      setStage('results');
      onImported?.();
    } catch (err) {
      const data = err.response?.data;
      if (data && (data.succeeded || data.failed)) {
        setResults(data);
        setStage('results');
        onImported?.();
      } else {
        setError(data?.error || 'Import failed.');
      }
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStage('input');
    setPasteText('');
    setPreviewRows([]);
    setResults(null);
    setError('');
  }

  if (stage === 'input') {
    return (
      <div className="space-y-5">
        {error && (
          <div className="bg-tomato/10 border-l-4 border-tomato px-3 py-2 text-sm text-tomato font-medium">
            {error}
          </div>
        )}

        <div className="panel p-5">
          <div className="eyebrow">Default date</div>
          <div className="font-display font-black text-xl text-navy mt-1 mb-3 leading-none">
            Used when a row has no date of its own
          </div>
          <input
            type="date"
            className="input max-w-xs"
            value={defaultDate}
            onChange={(e) => setDefaultDate(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="panel p-5 flex flex-col gap-3">
            <div>
              <div className="eyebrow">Option A</div>
              <div className="font-display font-black text-2xl text-navy mt-1 leading-none">
                Upload a sheet
              </div>
              <p className="text-xs text-ash mt-2">
                CSV or Excel (.xlsx). Columns: <span className="font-mono">item, quantity, date</span>.
                Date column optional.
              </p>
            </div>
            <label className="btn-primary cursor-pointer mt-auto">
              {busy ? 'Reading…' : 'Choose file'}
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={onFileChosen}
                disabled={busy}
                className="hidden"
              />
            </label>
          </div>

          <div className="panel p-5 flex flex-col gap-3">
            <div>
              <div className="eyebrow">Option B</div>
              <div className="font-display font-black text-2xl text-navy mt-1 leading-none">
                Paste a list
              </div>
              <p className="text-xs text-ash mt-2">
                One sale per line. <span className="font-mono">4 Classic Burger</span> or{' '}
                <span className="font-mono">Classic Burger, 4</span>. Uses the default date above.
              </p>
            </div>
            <textarea
              className="input min-h-[140px] font-mono text-sm"
              placeholder={'4 Classic Burger\n3 Loaded Fries\n2 Iced Latte'}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <button
              onClick={onPasteParse}
              disabled={busy || !pasteText.trim()}
              className="btn-primary disabled:opacity-50"
            >
              {busy ? 'Parsing…' : 'Parse paste'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'preview') {
    const validCount = previewRows.filter(
      (r) => r.selectedMenuItemId && Number.isInteger(r.quantity) && r.quantity > 0 && r.date,
    ).length;
    const flaggedCount = previewRows.length - validCount;

    return (
      <div className="space-y-4">
        <div className="panel px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="font-display font-bold text-navy">
              {previewRows.length} row{previewRows.length === 1 ? '' : 's'}
            </span>
            <span className="text-sage font-display font-bold">
              {validCount} ready
            </span>
            {flaggedCount > 0 && (
              <span className="text-tomato font-display font-bold">
                {flaggedCount} need attention
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={reset} className="btn-secondary" disabled={busy}>
              Start over
            </button>
            <button onClick={commit} className="btn-primary disabled:opacity-50" disabled={busy || validCount === 0}>
              {busy ? 'Importing…' : `Import ${validCount} sale${validCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-tomato/10 border-l-4 border-tomato px-3 py-2 text-sm text-tomato font-medium">
            {error}
          </div>
        )}

        <div className="panel">
          <div className="hidden md:grid grid-cols-[1.4fr_2fr_0.8fr_1fr_auto] gap-3 px-4 py-2 bg-navy text-cream text-[10px] font-display font-bold uppercase tracking-signage">
            <div>From sheet</div>
            <div>Match to menu item</div>
            <div>Qty</div>
            <div>Date</div>
            <div className="w-8" />
          </div>
          <ul className="divide-y divide-line/60">
            {previewRows.map((row, i) => {
              const ok = row.selectedMenuItemId && Number.isInteger(row.quantity) && row.quantity > 0 && row.date;
              const level = row.match?.confidence || 'none';
              return (
                <li
                  key={`${row.index}-${i}`}
                  className={`px-4 py-3 grid grid-cols-1 md:grid-cols-[1.4fr_2fr_0.8fr_1fr_auto] gap-3 items-center ${
                    ok ? '' : 'bg-tomato/5'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-signage text-ash md:hidden">From sheet</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-ink truncate">{row.originalName || <em className="text-ash">(blank)</em>}</span>
                      <ConfidenceBadge level={level} />
                    </div>
                    {row.errors && row.errors.length > 0 && (
                      <div className="text-[11px] text-tomato mt-0.5">{row.errors.join(' · ')}</div>
                    )}
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-signage text-ash md:hidden">Match</div>
                    <SearchableSelect
                      value={row.selectedMenuItemId || 0}
                      onChange={(id) => patchRow(i, { selectedMenuItemId: id })}
                      options={menuItems.map((mi) => ({ id: mi.id, name: mi.name }))}
                      placeholder="Search menu item…"
                    />
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-signage text-ash md:hidden">Qty</div>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="input font-mono"
                      value={row.quantity ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        patchRow(i, { quantity: v === '' ? null : Math.floor(Number(v)) });
                      }}
                    />
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-signage text-ash md:hidden">Date</div>
                    <input
                      type="date"
                      className="input"
                      value={row.date || ''}
                      onChange={(e) => patchRow(i, { date: e.target.value || null })}
                    />
                  </div>

                  <button
                    onClick={() => dropRow(i)}
                    className="text-ash hover:text-tomato text-xs font-display font-bold uppercase tracking-signage justify-self-end"
                    aria-label="Remove row"
                  >
                    ✕ Remove
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  // results
  const succ = results?.succeeded || [];
  const fail = results?.failed || [];
  return (
    <div className="space-y-4">
      <div className="panel p-6">
        <div className="eyebrow">Done</div>
        <div className="font-display font-black text-3xl text-navy mt-1 leading-none">
          {succ.length} imported · <span className={fail.length > 0 ? 'text-tomato' : 'text-sage'}>{fail.length} failed</span>
        </div>
      </div>

      {fail.length > 0 && (
        <div className="panel">
          <div className="px-5 pt-4 pb-2 border-b border-line">
            <div className="eyebrow text-tomato">Failures</div>
            <div className="font-display font-black text-lg text-navy mt-1 leading-none">
              These rows did not import
            </div>
          </div>
          <ul className="divide-y divide-line/60">
            {fail.map((f, i) => (
              <li key={i} className="px-5 py-3 text-sm text-tomato">
                {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={reset} className="btn-primary">
          Import another sheet
        </button>
      </div>
    </div>
  );
}
