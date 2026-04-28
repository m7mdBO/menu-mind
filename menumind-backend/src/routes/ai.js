const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const prisma = require('../prisma');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const MODEL = 'claude-sonnet-4-6';

function buildConsumptionStats(ingredients, sales, windowDays) {
  const consumption = new Map();
  for (const ing of ingredients) consumption.set(ing.id, 0);

  for (const sale of sales) {
    for (const recipe of sale.menuItem.recipes) {
      const used = Number(recipe.quantityNeeded) * sale.quantitySold;
      consumption.set(recipe.ingredientId, (consumption.get(recipe.ingredientId) || 0) + used);
    }
  }

  return { perIngredient: consumption, daysSpan: Math.max(1, windowDays) };
}

router.post('/predict-restock', async (req, res) => {
  if (!process.env.CLAUDE_API_KEY) {
    return res.status(500).json({ error: 'CLAUDE_API_KEY not configured on server' });
  }

  const userId = req.userId;
  const requested = Number(req.body?.windowDays);
  const windowDays = [1, 3, 7].includes(requested) ? requested : 7;
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [ingredients, sales] = await Promise.all([
    prisma.ingredient.findMany({
      where: { userId },
      include: { suppliers: { include: { supplier: true } } },
    }),
    prisma.salesLog.findMany({
      where: { userId, soldAt: { gte: cutoff } },
      orderBy: { soldAt: 'desc' },
      include: { menuItem: { include: { recipes: true } } },
    }),
  ]);

  if (ingredients.length === 0) {
    return res.status(400).json({ error: 'No ingredients in inventory yet' });
  }

  const { perIngredient, daysSpan } = buildConsumptionStats(ingredients, sales, windowDays);

  const inventoryReport = ingredients.map((ing) => {
    const totalUsed = perIngredient.get(ing.id) || 0;
    const dailyRate = daysSpan > 0 ? totalUsed / daysSpan : 0;
    const stock = Number(ing.currentStock);
    const daysRemaining = dailyRate > 0 ? stock / dailyRate : null;
    const supplierNames = ing.suppliers.map((s) => s.supplier.name).join(', ') || 'No supplier set';

    return {
      name: ing.name,
      unit: ing.unit,
      currentStock: stock,
      lowStockThreshold: Number(ing.lowStockThreshold),
      avgDailyUse: Number(dailyRate.toFixed(3)),
      daysRemaining: daysRemaining === null ? null : Number(daysRemaining.toFixed(2)),
      willRunOutWithin48h: daysRemaining !== null && daysRemaining <= 2,
      supplier: supplierNames,
    };
  });

  const atRisk = inventoryReport.filter(
    (i) => i.willRunOutWithin48h || i.currentStock <= i.lowStockThreshold,
  );

  if (atRisk.length === 0) {
    return res.json({
      summary: 'All ingredients are above threshold and projected to last beyond 48 hours.',
      windowDays,
      salesCount: sales.length,
      atRiskCount: 0,
      draft: null,
    });
  }

  const prompt = `You are a kitchen inventory assistant. Based on current stock levels and recent sales, draft a professional restock order email.

Current inventory analysis (last ${windowDays} day${windowDays === 1 ? '' : 's'} of sales, ${sales.length} sale${sales.length === 1 ? '' : 's'}):
${JSON.stringify(inventoryReport, null, 2)}

At-risk ingredients (will run out within 48 hours OR already below threshold):
${JSON.stringify(atRisk, null, 2)}

Write a single restock email that:
- Groups items by supplier (one email body per supplier if there are multiple suppliers)
- Specifies the suggested order quantity for each ingredient (round up to a sensible amount)
- Has a brief professional tone
- Includes a subject line

Output only the email text, no preamble or explanation.`;

  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const draft = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  res.json({
    summary: `${atRisk.length} ingredient(s) need restocking`,
    windowDays,
    salesCount: sales.length,
    atRiskCount: atRisk.length,
    atRisk,
    draft,
  });
});

router.get('/restock-drafts', async (req, res) => {
  const drafts = await prisma.restockDraft.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(drafts);
});

router.post('/restock-drafts', async (req, res) => {
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'content required' });
  const draft = await prisma.restockDraft.create({
    data: { userId: req.userId, content },
  });
  res.status(201).json(draft);
});

module.exports = router;
