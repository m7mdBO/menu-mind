import { useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../lib/api';
import SearchableSelect from './SearchableSelect';

const UNITS = ['kg', 'g', 'L', 'mL', 'pieces'];

function parsePasteText(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((line) => {
    if (line.includes(',')) {
      const parts = line.split(',').map((p) => p.trim());
      return {
        name: parts[0] || '',
        quantity: parts[1] ? Number(parts[1]) : null,
        unit: parts[2] || null,
        threshold: parts[3] !== undefined && parts[3] !== '' ? Number(parts[3]) : null,
      };
    }
    const qtyFirst = line.match(/^(\d+(?:\.\d+)?)\s*(?:x\s*)?(.+)$/i);
    if (qtyFirst) return { name: qtyFirst[2].trim(), quantity: Number(qtyFirst[1]), unit: null, threshold: null };
    const qtyLast = line.match(/^(.+?)\s+x?(\d+(?:\.\d+)?)$/i);
    if (qtyLast) return { name: qtyLast[1].trim(), quantity: Number(qtyLast[2]), unit: null, threshold: null };
    return { name: line, quantity: null, unit: null, threshold: null };
  });
}

async function parseFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
  if (matrix.length === 0) return [];

  const header = matrix[0].map((h) => String(h).toLowerCase().trim());
  const looksLikeHeader = header.some((h) => /name|item|ingredient|qty|quantity|unit|threshold/.test(h));

  const num = (v) => (v === '' || v == null ? null : Number(v));
  const str = (v) => (v === '' || v == null ? null : String(v).trim());

  if (looksLikeHeader) {
    const nameIdx = header.findIndex((h) => /name|item|ingredient/.test(h));
    const qtyIdx = header.findIndex((h) => /qty|quantity|amount/.test(h));
    const unitIdx = header.findIndex((h) => /unit|measure/.test(h));
    const threshIdx = header.findIndex((h) => /threshold|low|min/.test(h));
    return matrix.slice(1)
      .map((r) => ({
        name: String(r[nameIdx] ?? '').trim(),
        quantity: num(r[qtyIdx]),
        unit: unitIdx >= 0 ? str(r[unitIdx]) : null,
        threshold: threshIdx >= 0 ? num(r[threshIdx]) : null,
      }))
      .filter((r) => r.name);
  }

  return matrix.map((r) => ({
    name: String(r[0] ?? '').trim(),
    quantity: num(r[1]),
    unit: str(r[2]),
    threshold: num(r[3]),
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

function ActionToggle({ value, onChange, hasMatch }) {
  return (
    <div className="inline-flex bg-navy/5 p-0.5 rounded-sm">
      <button
        type="button"
        disabled={!hasMatch}
        onClick={() => onChange('topup')}
        className={`px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-signage rounded-sm transition-colors ${
          value === 'topup' ? 'bg-navy text-cream' : 'text-navy hover:text-copper disabled:text-ash/40 disabled:cursor-not-allowed'
        }`}
      >
        Top up
      </button>
      <button
        type="button"
        onClick={() => onChange('create')}
        className={`px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-signage rounded-sm transition-colors ${
          value === 'create' ? 'bg-navy text-cream' : 'text-navy hover:text-copper'
        }`}
      >
        Create new
      </button>
    </div>
  );
}

export default function BulkStockImport({ ingredients, onImported }) {
  const [stage, setStage] = useState('input');
  const [pasteText, setPasteText] = useState('');
  const [previewRows, setPreviewRows] = useState([]);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function buildRowState(r) {
    const action = r.action;
    return {
      ...r,
      selectedIngredientId: r.match?.ingredientId ?? 0,
      newName: r.newDraft?.name || r.originalName || '',
      newUnit: r.newDraft?.unit || '',
      newThreshold: r.newDraft?.threshold ?? 0,
      action,
    };
  }

  async function runPreview(rawRows) {
    setError('');
    if (rawRows.length === 0) {
      setError('Nothing to import — sheet or paste box was empty.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post('/ingredients/bulk-preview', { rows: rawRows });
      setPreviewRows(data.rows.map(buildRowState));
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

  function rowReady(r) {
    if (!Number.isFinite(r.quantity) || r.quantity <= 0) return false;
    if (r.action === 'topup') return r.selectedIngredientId > 0;
    if (r.action === 'create') {
      return Boolean(r.newName?.trim()) && Boolean(r.newUnit) && Number.isFinite(r.newThreshold) && r.newThreshold >= 0;
    }
    return false;
  }

  async function commit() {
    setError('');
    const valid = previewRows.filter(rowReady);
    if (valid.length === 0) {
      setError('No row is ready. Each row needs a quantity plus either a matched ingredient (top up) or a name + unit (create new).');
      return;
    }
    setBusy(true);
    try {
      const payload = valid.map((r) => r.action === 'topup'
        ? {
            index: r.index,
            originalName: r.originalName,
            action: 'topup',
            ingredientId: r.selectedIngredientId,
            quantity: r.quantity,
          }
        : {
            index: r.index,
            originalName: r.originalName,
            action: 'create',
            name: r.newName.trim(),
            unit: r.newUnit,
            threshold: r.newThreshold,
            quantity: r.quantity,
          });
      const { data } = await api.post('/ingredients/bulk-commit', { rows: payload });
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="panel p-5 flex flex-col gap-3">
            <div>
              <div className="eyebrow">Option A</div>
              <div className="font-display font-black text-2xl text-navy mt-1 leading-none">
                Upload a delivery sheet
              </div>
              <p className="text-xs text-ash mt-2">
                CSV or Excel. Columns: <span className="font-mono">item, quantity, unit, threshold</span>.
                Only <span className="font-mono">item</span> + <span className="font-mono">quantity</span> are required.
                <span className="font-mono"> unit</span> and <span className="font-mono">threshold</span> are
                only used for brand-new ingredients (existing ones keep their own).
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
                One ingredient per line. <span className="font-mono">5 Roma Tomato</span> or{' '}
                <span className="font-mono">Roma Tomato, 5, kg, 2</span>.
              </p>
            </div>
            <textarea
              className="input min-h-[140px] font-mono text-sm"
              placeholder={'5 Roma Tomato\n3 Brioche Bun\n12 Avocado'}
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
    const validCount = previewRows.filter(rowReady).length;
    const flaggedCount = previewRows.length - validCount;
    const topupCount = previewRows.filter((r) => r.action === 'topup' && rowReady(r)).length;
    const createCount = previewRows.filter((r) => r.action === 'create' && rowReady(r)).length;

    return (
      <div className="space-y-4">
        <div className="panel px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="font-display font-bold text-navy">
              {previewRows.length} row{previewRows.length === 1 ? '' : 's'}
            </span>
            <span className="text-sage font-display font-bold">
              {topupCount} top up · {createCount} new
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
              {busy ? 'Importing…' : `Import ${validCount} row${validCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-tomato/10 border-l-4 border-tomato px-3 py-2 text-sm text-tomato font-medium">
            {error}
          </div>
        )}

        <ul className="space-y-3">
          {previewRows.map((row, i) => {
            const ok = rowReady(row);
            const level = row.match?.confidence || 'none';
            const matchedIng = ingredients.find((ing) => ing.id === row.selectedIngredientId);
            const incomingUnit = row.action === 'topup'
              ? (matchedIng?.unit || row.match?.unit || '')
              : row.newUnit;
            return (
              <li
                key={`${row.index}-${i}`}
                className={`panel p-4 space-y-3 ${ok ? '' : 'border-tomato/40 bg-tomato/5'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-signage text-ash">From sheet:</span>
                    <span className="font-medium text-ink truncate">
                      {row.originalName || <em className="text-ash">(blank)</em>}
                    </span>
                    <ConfidenceBadge level={level} />
                  </div>
                  <div className="flex items-center gap-3">
                    <ActionToggle
                      value={row.action}
                      onChange={(v) => patchRow(i, { action: v })}
                      hasMatch={Boolean(row.match)}
                    />
                    <button
                      onClick={() => dropRow(i)}
                      className="text-ash hover:text-tomato text-xs font-display font-bold uppercase tracking-signage"
                      aria-label="Remove row"
                    >
                      ✕ Remove
                    </button>
                  </div>
                </div>

                {row.errors && row.errors.length > 0 && (
                  <div className="text-[11px] text-tomato">{row.errors.join(' · ')}</div>
                )}

                {row.action === 'topup' ? (
                  <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-3">
                    <div>
                      <div className="input-label">Top up which ingredient</div>
                      <SearchableSelect
                        value={row.selectedIngredientId || 0}
                        onChange={(id) => patchRow(i, { selectedIngredientId: id })}
                        options={ingredients.map((ing) => ({ id: ing.id, name: `${ing.name} (${Number(ing.currentStock)} ${ing.unit})` }))}
                        placeholder="Search ingredient…"
                      />
                    </div>
                    <div>
                      <div className="input-label">Quantity to add</div>
                      <div className="flex">
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          className="input rounded-r-none font-mono"
                          value={row.quantity ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            patchRow(i, { quantity: v === '' ? null : Number(v) });
                          }}
                        />
                        <span className="bg-navy text-cream px-3 flex items-center font-mono text-xs rounded-r-sm">
                          {incomingUnit || '?'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-3">
                    <div>
                      <div className="input-label">New ingredient name</div>
                      <input
                        type="text"
                        className="input"
                        value={row.newName}
                        onChange={(e) => patchRow(i, { newName: e.target.value })}
                      />
                    </div>
                    <div>
                      <div className="input-label">Unit</div>
                      <select
                        className="input"
                        value={row.newUnit || ''}
                        onChange={(e) => patchRow(i, { newUnit: e.target.value })}
                      >
                        <option value="">— pick —</option>
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="input-label">Quantity</div>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        className="input font-mono"
                        value={row.quantity ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          patchRow(i, { quantity: v === '' ? null : Number(v) });
                        }}
                      />
                    </div>
                    <div>
                      <div className="input-label">Low threshold</div>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        className="input font-mono"
                        value={row.newThreshold ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          patchRow(i, { newThreshold: v === '' ? 0 : Number(v) });
                        }}
                      />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // results
  const succ = results?.succeeded || [];
  const fail = results?.failed || [];
  const toppedUp = succ.filter((s) => s.action === 'topup');
  const created = succ.filter((s) => s.action === 'create');

  return (
    <div className="space-y-4">
      <div className="panel p-6">
        <div className="eyebrow">Done</div>
        <div className="font-display font-black text-3xl text-navy mt-1 leading-none">
          {toppedUp.length} topped up · {created.length} new ·{' '}
          <span className={fail.length > 0 ? 'text-tomato' : 'text-sage'}>{fail.length} failed</span>
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
              <li key={i} className="px-5 py-3 text-sm text-tomato">{f.reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={reset} className="btn-primary">Import another sheet</button>
      </div>
    </div>
  );
}
