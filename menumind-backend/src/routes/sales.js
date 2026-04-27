const express = require('express');
const { Prisma } = require('@prisma/client');
const prisma = require('../prisma');
const { authRequired } = require('../middleware/auth');

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

module.exports = router;
