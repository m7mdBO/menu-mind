const express = require('express');
const { Prisma } = require('@prisma/client');
const prisma = require('../prisma');
const { authRequired } = require('../middleware/auth');
const { scoreMatch, parseDate } = require('../lib/match');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const sales = await prisma.salesLog.findMany({
    where: { userId: req.userId },
    orderBy: { soldAt: 'desc' },
    take: 100,
    include: { menuItem: true },
  });
  res.json(sales);
});

router.post('/', async (req, res) => {
  const { menuItemId, quantitySold, notes, removedIngredientIds, extras } = req.body || {};
  const qty = Number(quantitySold);
  if (!menuItemId || !qty || qty <= 0) {
    return res.status(400).json({ error: 'menuItemId and positive quantitySold required' });
  }

  const menuItem = await prisma.menuItem.findFirst({
    where: { id: Number(menuItemId), userId: req.userId },
    include: { recipes: { include: { ingredient: true } } },
  });
  if (!menuItem) return res.status(404).json({ error: 'Menu item not found' });
  if (menuItem.recipes.length === 0) {
    return res.status(400).json({ error: 'Menu item has no recipe defined' });
  }

  const removedSet = new Set(
    (Array.isArray(removedIngredientIds) ? removedIngredientIds : [])
      .map(Number)
      .filter(Number.isFinite),
  );
  for (const rid of removedSet) {
    if (!menuItem.recipes.some((r) => r.ingredientId === rid)) {
      return res.status(400).json({ error: 'Removed ingredient is not in this recipe' });
    }
  }
  if (removedSet.size === menuItem.recipes.length) {
    return res.status(400).json({ error: 'Cannot remove every ingredient from the recipe' });
  }

  const extrasList = Array.isArray(extras) ? extras : [];
  for (const ex of extrasList) {
    const id = Number(ex?.ingredientId);
    const q = Number(ex?.quantity);
    if (!Number.isFinite(id) || !Number.isFinite(q) || q <= 0) {
      return res.status(400).json({ error: 'Each extra needs an ingredientId and a positive quantity' });
    }
  }
  const extraIds = Array.from(new Set(extrasList.map((e) => Number(e.ingredientId))));
  const extraIngredients = extraIds.length
    ? await prisma.ingredient.findMany({ where: { id: { in: extraIds }, userId: req.userId } })
    : [];
  if (extraIngredients.length !== extraIds.length) {
    return res.status(400).json({ error: 'Invalid extra ingredient' });
  }
  const extraMap = new Map(extraIngredients.map((i) => [i.id, i]));

  const deductions = new Map();
  for (const r of menuItem.recipes) {
    if (removedSet.has(r.ingredientId)) continue;
    const need = new Prisma.Decimal(r.quantityNeeded).mul(qty);
    deductions.set(r.ingredientId, (deductions.get(r.ingredientId) || new Prisma.Decimal(0)).add(need));
  }
  for (const ex of extrasList) {
    const id = Number(ex.ingredientId);
    const need = new Prisma.Decimal(ex.quantity).mul(qty);
    deductions.set(id, (deductions.get(id) || new Prisma.Decimal(0)).add(need));
  }

  const recipeIngredients = new Map(menuItem.recipes.map((r) => [r.ingredientId, r.ingredient]));
  const insufficient = [];
  for (const [id, need] of deductions) {
    const ing = recipeIngredients.get(id) || extraMap.get(id);
    if (!ing) continue;
    if (new Prisma.Decimal(ing.currentStock).lt(need)) {
      insufficient.push({
        name: ing.name,
        needed: need.toString(),
        available: ing.currentStock.toString(),
      });
    }
  }
  if (insufficient.length > 0) {
    return res.status(400).json({ error: 'Insufficient stock', ingredients: insufficient });
  }

  const noteParts = [];
  for (const rid of removedSet) {
    const r = menuItem.recipes.find((x) => x.ingredientId === rid);
    if (r) noteParts.push(`no ${r.ingredient.name.toLowerCase()}`);
  }
  for (const ex of extrasList) {
    const ing = extraMap.get(Number(ex.ingredientId));
    if (ing) noteParts.push(`+${ex.quantity} ${ing.name.toLowerCase()}`);
  }
  const composedNote = noteParts.join(' · ');
  const trimmedFreeText = typeof notes === 'string' ? notes.trim() : '';
  const finalNote = [composedNote, trimmedFreeText].filter(Boolean).join(' — ') || null;

  const sale = await prisma.$transaction(async (tx) => {
    for (const [id, need] of deductions) {
      await tx.ingredient.update({
        where: { id },
        data: { currentStock: { decrement: need } },
      });
    }
    return tx.salesLog.create({
      data: {
        userId: req.userId,
        menuItemId: menuItem.id,
        quantitySold: qty,
        notes: finalNote,
      },
      include: { menuItem: true },
    });
  });

  res.status(201).json(sale);
});

router.post('/bulk-preview', async (req, res) => {
  const { rows } = req.body || {};
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows array required' });
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { userId: req.userId },
    select: { id: true, name: true },
  });

  const results = rows.map((row, index) => {
    const originalName = String(row?.name ?? '').trim();
    const quantityRaw = row?.quantity;
    const quantity = Number(quantityRaw);
    const dateRaw = row?.date;
    const parsedDate = dateRaw ? parseDate(dateRaw) : new Date();

    const errors = [];
    if (!originalName) errors.push('missing item name');
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      errors.push('quantity must be a positive integer');
    }
    if (dateRaw && !parsedDate) errors.push('invalid date');

    const scored = menuItems
      .map((mi) => {
        const s = scoreMatch(originalName, mi.name);
        return { id: mi.id, name: mi.name, score: s.score, level: s.level };
      })
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const match = best && best.level !== 'none'
      ? { menuItemId: best.id, menuItemName: best.name, confidence: best.level }
      : null;

    const alternatives = scored
      .filter((s) => s.score > 0.3 && (!match || s.id !== match.menuItemId))
      .slice(0, 5)
      .map((s) => ({ menuItemId: s.id, menuItemName: s.name, confidence: s.level }));

    return {
      index,
      originalName,
      quantity: Number.isFinite(quantity) ? quantity : null,
      date: parsedDate ? parsedDate.toISOString() : null,
      match,
      alternatives,
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
    const menuItemId = Number(row?.menuItemId);
    const qty = Number(row?.quantity);
    const soldAt = row?.date ? parseDate(row.date) : new Date();
    const label = row?.originalName ? ` (${row.originalName})` : '';

    if (!menuItemId) {
      failed.push({ index, reason: `row ${index + 1}${label}: menu item not selected` });
      continue;
    }
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
      failed.push({ index, reason: `row ${index + 1}${label}: quantity must be a positive integer` });
      continue;
    }
    if (row?.date && !soldAt) {
      failed.push({ index, reason: `row ${index + 1}${label}: invalid date` });
      continue;
    }

    try {
      const menuItem = await prisma.menuItem.findFirst({
        where: { id: menuItemId, userId: req.userId },
        include: { recipes: { include: { ingredient: true } } },
      });
      if (!menuItem) {
        failed.push({ index, reason: `row ${index + 1}${label}: menu item not found` });
        continue;
      }
      if (menuItem.recipes.length === 0) {
        failed.push({ index, reason: `${menuItem.name}: no recipe defined` });
        continue;
      }

      const insufficient = menuItem.recipes.filter((r) => {
        const need = new Prisma.Decimal(r.quantityNeeded).mul(qty);
        return new Prisma.Decimal(r.ingredient.currentStock).lt(need);
      });
      if (insufficient.length > 0) {
        failed.push({
          index,
          reason: `${menuItem.name} ×${qty}: insufficient stock (${insufficient.map((r) => r.ingredient.name).join(', ')})`,
        });
        continue;
      }

      const sale = await prisma.$transaction(async (tx) => {
        for (const r of menuItem.recipes) {
          const deduction = new Prisma.Decimal(r.quantityNeeded).mul(qty);
          await tx.ingredient.update({
            where: { id: r.ingredientId },
            data: { currentStock: { decrement: deduction } },
          });
        }
        return tx.salesLog.create({
          data: {
            userId: req.userId,
            menuItemId: menuItem.id,
            quantitySold: qty,
            soldAt,
          },
          include: { menuItem: true },
        });
      });
      succeeded.push({ index, sale });
    } catch (err) {
      console.error('bulk-commit row error', index, err);
      failed.push({ index, reason: `row ${index + 1}${label}: unexpected error` });
    }
  }

  res.status(succeeded.length > 0 ? 201 : 400).json({ succeeded, failed });
});

module.exports = router;
