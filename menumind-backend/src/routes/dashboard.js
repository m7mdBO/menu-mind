const express = require('express');
const prisma = require('../prisma');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const userId = req.userId;

  const [ingredients, totalMenuItems, totalSuppliers, recentSales] = await Promise.all([
    prisma.ingredient.findMany({ where: { userId } }),
    prisma.menuItem.count({ where: { userId } }),
    prisma.supplier.count({ where: { userId } }),
    prisma.salesLog.findMany({
      where: { userId },
      orderBy: { soldAt: 'desc' },
      take: 5,
      include: { menuItem: true },
    }),
  ]);

  let lowStock = 0;
  let nearLow = 0;
  let healthy = 0;
  for (const i of ingredients) {
    const stock = Number(i.currentStock);
    const threshold = Number(i.lowStockThreshold);
    if (stock <= threshold) lowStock++;
    else if (stock <= threshold * 1.5) nearLow++;
    else healthy++;
  }

  res.json({
    counts: {
      ingredients: ingredients.length,
      menuItems: totalMenuItems,
      suppliers: totalSuppliers,
    },
    inventoryHealth: { lowStock, nearLow, healthy },
    lowStockIngredients: ingredients
      .filter((i) => Number(i.currentStock) <= Number(i.lowStockThreshold))
      .map((i) => ({
        id: i.id,
        name: i.name,
        currentStock: i.currentStock,
        lowStockThreshold: i.lowStockThreshold,
        unit: i.unit,
      })),
    recentSales,
  });
});

module.exports = router;
