const express = require('express');
const { Prisma } = require('@prisma/client');
const prisma = require('../prisma');
const { authRequired } = require('../middleware/auth');
const { scoreMatch } = require('../lib/match');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const { search, status } = req.query;
  const where = { userId: req.userId };
  if (search) where.name = { contains: search, mode: 'insensitive' };

  const items = await prisma.ingredient.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { suppliers: { include: { supplier: true } } },
  });

  let result = items;
  if (status === 'low') {
    result = items.filter((i) => Number(i.currentStock) <= Number(i.lowStockThreshold));
  } else if (status === 'ok') {
    result = items.filter((i) => Number(i.currentStock) > Number(i.lowStockThreshold));
  }
  res.json(result);
});

function validateNumber(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return `${label} must be a number`;
  if (n < 0) return `${label} cannot be negative`;
  if (n > 1_000_000) return `${label} is unreasonably large`;
  return null;
}

router.post('/', async (req, res) => {
  const { name, unit, currentStock, lowStockThreshold, supplierIds } = req.body || {};
  if (!name || !unit) return res.status(400).json({ error: 'name and unit required' });

  const trimmed = String(name).trim();
  if (!trimmed) return res.status(400).json({ error: 'name and unit required' });

  const stockErr = validateNumber(currentStock, 'Current stock')
    || validateNumber(lowStockThreshold, 'Low-stock threshold');
  if (stockErr) return res.status(400).json({ error: stockErr });

  const dup = await prisma.ingredient.findFirst({
    where: {
      userId: req.userId,
      name: { equals: trimmed, mode: 'insensitive' },
    },
  });
  if (dup) {
    return res.status(409).json({ error: `An ingredient named "${dup.name}" already exists` });
  }

  const created = await prisma.ingredient.create({
    data: {
      userId: req.userId,
      name: trimmed,
      unit,
      currentStock: currentStock ?? 0,
      lowStockThreshold: lowStockThreshold ?? 0,
      suppliers: Array.isArray(supplierIds) && supplierIds.length
        ? { create: supplierIds.map((id) => ({ supplierId: Number(id) })) }
        : undefined,
    },
    include: { suppliers: { include: { supplier: true } } },
  });
  res.status(201).json(created);
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.ingredient.findFirst({ where: { id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { name, unit, currentStock, lowStockThreshold, supplierIds } = req.body || {};

  const stockErr = validateNumber(currentStock, 'Current stock')
    || validateNumber(lowStockThreshold, 'Low-stock threshold');
  if (stockErr) return res.status(400).json({ error: stockErr });

  let finalName = existing.name;
  if (name !== undefined && name !== null) {
    const trimmed = String(name).trim();
    if (!trimmed) return res.status(400).json({ error: 'name cannot be empty' });
    if (trimmed.toLowerCase() !== existing.name.toLowerCase()) {
      const dup = await prisma.ingredient.findFirst({
        where: {
          userId: req.userId,
          name: { equals: trimmed, mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (dup) {
        return res.status(409).json({ error: `An ingredient named "${dup.name}" already exists` });
      }
    }
    finalName = trimmed;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.ingredient.update({
      where: { id },
      data: {
        name: finalName,
        unit: unit ?? existing.unit,
        currentStock: currentStock ?? existing.currentStock,
        lowStockThreshold: lowStockThreshold ?? existing.lowStockThreshold,
      },
    });
    if (Array.isArray(supplierIds)) {
      await tx.ingredientSupplier.deleteMany({ where: { ingredientId: id } });
      if (supplierIds.length) {
        await tx.ingredientSupplier.createMany({
          data: supplierIds.map((sid) => ({ ingredientId: id, supplierId: Number(sid) })),
          skipDuplicates: true,
        });
      }
    }
    return tx.ingredient.findUnique({
      where: { id },
      include: { suppliers: { include: { supplier: true } } },
    });
  });
  res.json(updated);
});

router.post('/bulk-preview', async (req, res) => {
  const { rows } = req.body || {};
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows array required' });
  }

  const existing = await prisma.ingredient.findMany({
    where: { userId: req.userId },
    select: { id: true, name: true, unit: true, currentStock: true, lowStockThreshold: true },
  });

  const results = rows.map((row, index) => {
    const originalName = String(row?.name ?? '').trim();
    const qtyRaw = row?.quantity;
    const quantity = qtyRaw === '' || qtyRaw == null ? null : Number(qtyRaw);
    const unitRaw = row?.unit ? String(row.unit).trim() : '';
    const thresholdRaw = row?.threshold;
    const threshold = thresholdRaw === '' || thresholdRaw == null ? null : Number(thresholdRaw);

    const errors = [];
    if (!originalName) errors.push('missing item name');
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push('quantity must be a positive number');
    }
    if (threshold != null && (!Number.isFinite(threshold) || threshold < 0)) {
      errors.push('threshold must be a non-negative number');
    }

    const scored = existing
      .map((ing) => {
        const s = scoreMatch(originalName, ing.name);
        return {
          id: ing.id,
          name: ing.name,
          unit: ing.unit,
          currentStock: Number(ing.currentStock),
          score: s.score,
          level: s.level,
        };
      })
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const match = best && best.level !== 'none'
      ? {
          ingredientId: best.id,
          ingredientName: best.name,
          unit: best.unit,
          currentStock: best.currentStock,
          confidence: best.level,
        }
      : null;

    const alternatives = scored
      .filter((s) => s.score > 0.3 && (!match || s.id !== match.ingredientId))
      .slice(0, 5)
      .map((s) => ({ ingredientId: s.id, ingredientName: s.name, unit: s.unit, confidence: s.level }));

    const action = match ? 'topup' : 'create';
    const defaultThreshold = threshold != null
      ? threshold
      : (Number.isFinite(quantity) && quantity > 0 ? Number((quantity * 0.25).toFixed(3)) : 0);

    return {
      index,
      originalName,
      quantity: Number.isFinite(quantity) ? quantity : null,
      sheetUnit: unitRaw || null,
      sheetThreshold: threshold,
      action,
      match,
      alternatives,
      newDraft: {
        name: originalName,
        unit: unitRaw || null,
        threshold: defaultThreshold,
      },
      errors,
    };
  });

  res.json({ rows: results });
});

router.post('/bulk-commit', async (req, res) => {
  const { rows } = req.body || {};
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows array required' });
  }

  const succeeded = [];
  const failed = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const index = row?.index ?? i;
    const action = row?.action;
    const qty = Number(row?.quantity);
    const label = row?.originalName ? ` (${row.originalName})` : '';
    const rowTag = `row ${index + 1}${label}`;

    if (!Number.isFinite(qty) || qty <= 0) {
      failed.push({ index, reason: `${rowTag}: quantity must be a positive number` });
      continue;
    }

    try {
      if (action === 'topup') {
        const ingredientId = Number(row.ingredientId);
        if (!ingredientId) {
          failed.push({ index, reason: `${rowTag}: no ingredient selected` });
          continue;
        }
        const ing = await prisma.ingredient.findFirst({
          where: { id: ingredientId, userId: req.userId },
        });
        if (!ing) {
          failed.push({ index, reason: `${rowTag}: ingredient not found` });
          continue;
        }
        const updated = await prisma.ingredient.update({
          where: { id: ing.id },
          data: { currentStock: { increment: new Prisma.Decimal(qty) } },
          include: { suppliers: { include: { supplier: true } } },
        });
        succeeded.push({ index, action: 'topup', ingredient: updated, added: qty });
      } else if (action === 'create') {
        const name = String(row.name ?? '').trim();
        const unit = String(row.unit ?? '').trim();
        const threshold = row.threshold != null && row.threshold !== '' ? Number(row.threshold) : 0;

        if (!name) {
          failed.push({ index, reason: `${rowTag}: name required for new ingredient` });
          continue;
        }
        if (!unit) {
          failed.push({ index, reason: `${rowTag}: unit required for new ingredient` });
          continue;
        }
        if (!Number.isFinite(threshold) || threshold < 0) {
          failed.push({ index, reason: `${rowTag}: threshold must be a non-negative number` });
          continue;
        }

        const dup = await prisma.ingredient.findFirst({
          where: {
            userId: req.userId,
            name: { equals: name, mode: 'insensitive' },
          },
        });
        if (dup) {
          failed.push({
            index,
            reason: `${rowTag}: an ingredient named "${dup.name}" already exists — switch this row to "Top up existing"`,
          });
          continue;
        }

        const created = await prisma.ingredient.create({
          data: {
            userId: req.userId,
            name,
            unit,
            currentStock: qty,
            lowStockThreshold: threshold,
          },
          include: { suppliers: { include: { supplier: true } } },
        });
        succeeded.push({ index, action: 'create', ingredient: created });
      } else {
        failed.push({ index, reason: `${rowTag}: unknown action` });
      }
    } catch (err) {
      console.error('ingredient bulk-commit row error', index, err);
      failed.push({ index, reason: `${rowTag}: unexpected error` });
    }
  }

  res.status(succeeded.length > 0 ? 201 : 400).json({ succeeded, failed });
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.ingredient.findFirst({ where: { id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await prisma.ingredient.delete({ where: { id } });
  res.status(204).end();
});

module.exports = router;
