const express = require('express');
const prisma = require('../prisma');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const suppliers = await prisma.supplier.findMany({
    where: { userId: req.userId },
    orderBy: { name: 'asc' },
    include: { ingredients: { include: { ingredient: true } } },
  });
  res.json(suppliers);
});

router.post('/', async (req, res) => {
  const { name, email, phone, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });

  const trimmed = String(name).trim();
  if (!trimmed) return res.status(400).json({ error: 'name required' });

  const dup = await prisma.supplier.findFirst({
    where: {
      userId: req.userId,
      name: { equals: trimmed, mode: 'insensitive' },
    },
  });
  if (dup) {
    return res.status(409).json({ error: `A supplier named "${dup.name}" already exists` });
  }

  const created = await prisma.supplier.create({
    data: { userId: req.userId, name: trimmed, email, phone, notes },
  });
  res.status(201).json(created);
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.supplier.findFirst({ where: { id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { name, email, phone, notes } = req.body || {};

  let finalName = existing.name;
  if (name !== undefined && name !== null) {
    const trimmed = String(name).trim();
    if (!trimmed) return res.status(400).json({ error: 'name cannot be empty' });
    if (trimmed.toLowerCase() !== existing.name.toLowerCase()) {
      const dup = await prisma.supplier.findFirst({
        where: {
          userId: req.userId,
          name: { equals: trimmed, mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (dup) {
        return res.status(409).json({ error: `A supplier named "${dup.name}" already exists` });
      }
    }
    finalName = trimmed;
  }

  const updated = await prisma.supplier.update({
    where: { id },
    data: {
      name: finalName,
      email: email ?? existing.email,
      phone: phone ?? existing.phone,
      notes: notes ?? existing.notes,
    },
  });
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.supplier.findFirst({ where: { id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await prisma.supplier.delete({ where: { id } });
  res.status(204).end();
});

module.exports = router;
