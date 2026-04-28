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
  const { menuItemId, quantitySold, notes } = req.body || {};
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

  const insufficient = menuItem.recipes.filter((r) => {
    const need = new Prisma.Decimal(r.quantityNeeded).mul(qty);
    return new Prisma.Decimal(r.ingredient.currentStock).lt(need);
  });
  if (insufficient.length > 0) {
    return res.status(400).json({
      error: 'Insufficient stock',
      ingredients: insufficient.map((r) => ({
        name: r.ingredient.name,
        needed: new Prisma.Decimal(r.quantityNeeded).mul(qty).toString(),
        available: r.ingredient.currentStock.toString(),
      })),
    });
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
        notes,
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
