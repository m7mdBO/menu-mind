const express = require('express');
const prisma = require('../prisma');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const { category } = req.query;
  const where = { userId: req.userId };
  if (category) where.category = category;

  const items = await prisma.menuItem.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { recipes: { include: { ingredient: true } } },
  });
  res.json(items);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.menuItem.findFirst({
    where: { id, userId: req.userId },
    include: { recipes: { include: { ingredient: true } } },
  });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.post('/', async (req, res) => {
  const { name, description, category, recipes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });

  const created = await prisma.menuItem.create({
    data: {
      userId: req.userId,
      name,
      description,
      category,
      recipes: Array.isArray(recipes) && recipes.length
        ? {
            create: recipes.map((r) => ({
              ingredientId: Number(r.ingredientId),
              quantityNeeded: r.quantityNeeded,
            })),
          }
        : undefined,
    },
    include: { recipes: { include: { ingredient: true } } },
  });
  res.status(201).json(created);
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.menuItem.findFirst({ where: { id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { name, description, category, recipes } = req.body || {};

  const updated = await prisma.$transaction(async (tx) => {
    await tx.menuItem.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        description: description ?? existing.description,
        category: category ?? existing.category,
      },
    });
    if (Array.isArray(recipes)) {
      await tx.recipe.deleteMany({ where: { menuItemId: id } });
      if (recipes.length) {
        await tx.recipe.createMany({
          data: recipes.map((r) => ({
            menuItemId: id,
            ingredientId: Number(r.ingredientId),
            quantityNeeded: r.quantityNeeded,
          })),
        });
      }
    }
    return tx.menuItem.findUnique({
      where: { id },
      include: { recipes: { include: { ingredient: true } } },
    });
  });
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.menuItem.findFirst({ where: { id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: 'Not found' });
  await prisma.menuItem.delete({ where: { id } });
  res.status(204).end();
});

module.exports = router;
