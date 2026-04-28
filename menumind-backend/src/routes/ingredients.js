const express = require('express');
const prisma = require('../prisma');
const { authRequired } = require('../middleware/auth');

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

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.ingredient.findFirst({ where: { id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await prisma.ingredient.delete({ where: { id } });
  res.status(204).end();
});

module.exports = router;
