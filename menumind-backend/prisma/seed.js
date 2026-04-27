const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEMO_EMAIL = 'test3@test.com';

const suppliers = [
  { name: 'Harvest Row Produce', email: 'orders@harvestrow.co', phone: '(415) 555-0182', notes: 'Mon/Wed/Fri delivery before 7am. Same-day cutoff: 4pm prior.' },
  { name: 'Iron Range Meats', email: 'sales@ironrange.co', phone: '(415) 555-0294', notes: 'Smash patties pre-portioned. Min order $250.' },
  { name: 'Old Mill Bakery', email: 'wholesale@oldmill.co', phone: '(510) 555-0117', notes: 'Brioche buns + tortillas. 24h lead time.' },
  { name: 'Coastline Dairy Co', email: 'route7@coastlinedairy.co', phone: '(415) 555-0233', notes: 'Tue + Sat. Backup contact Renee.' },
  { name: 'Pantry Standard', email: 'orders@pantrystandard.co', phone: '(800) 555-0150', notes: 'Dry goods, oils, sauces. 2-day shipping.' },
  { name: 'North Bay Beverage', email: 'team@nbb.co', phone: '(415) 555-0411', notes: 'Sodas, sparkling, juice. Net 15 terms.' },
];

// units: kg, g, l, ml, ea, slice
const ingredients = [
  // produce — Harvest Row
  { name: 'Romaine Lettuce',      unit: 'kg',    currentStock: 4.2,  lowStockThreshold: 2.0,  supplier: 'Harvest Row Produce' },
  { name: 'Roma Tomato',          unit: 'kg',    currentStock: 1.4,  lowStockThreshold: 2.5,  supplier: 'Harvest Row Produce' }, // LOW
  { name: 'Red Onion',            unit: 'kg',    currentStock: 3.8,  lowStockThreshold: 1.5,  supplier: 'Harvest Row Produce' },
  { name: 'Yellow Onion',         unit: 'kg',    currentStock: 5.1,  lowStockThreshold: 2.0,  supplier: 'Harvest Row Produce' },
  { name: 'Avocado',              unit: 'ea',    currentStock: 18,   lowStockThreshold: 24,   supplier: 'Harvest Row Produce' }, // LOW
  { name: 'Baby Spinach',         unit: 'kg',    currentStock: 2.6,  lowStockThreshold: 1.5,  supplier: 'Harvest Row Produce' },
  { name: 'Kale',                 unit: 'kg',    currentStock: 1.9,  lowStockThreshold: 1.0,  supplier: 'Harvest Row Produce' },
  { name: 'Cucumber',             unit: 'kg',    currentStock: 2.2,  lowStockThreshold: 1.2,  supplier: 'Harvest Row Produce' },
  { name: 'Cilantro',             unit: 'kg',    currentStock: 0.4,  lowStockThreshold: 0.6,  supplier: 'Harvest Row Produce' }, // LOW
  { name: 'Lime',                 unit: 'ea',    currentStock: 32,   lowStockThreshold: 20,   supplier: 'Harvest Row Produce' },
  { name: 'Pickle Chips',         unit: 'kg',    currentStock: 1.8,  lowStockThreshold: 1.0,  supplier: 'Harvest Row Produce' },

  // meat — Iron Range
  { name: 'Beef Smash Patty 80g', unit: 'ea',    currentStock: 96,   lowStockThreshold: 80,   supplier: 'Iron Range Meats' },
  { name: 'Grilled Chicken Breast', unit: 'kg', currentStock: 6.4,  lowStockThreshold: 4.0,  supplier: 'Iron Range Meats' },
  { name: 'Bacon Strips',         unit: 'ea',    currentStock: 42,   lowStockThreshold: 60,   supplier: 'Iron Range Meats' }, // LOW

  // bakery — Old Mill
  { name: 'Brioche Bun',          unit: 'ea',    currentStock: 38,   lowStockThreshold: 60,   supplier: 'Old Mill Bakery' }, // LOW
  { name: 'Flour Tortilla 10in',  unit: 'ea',    currentStock: 84,   lowStockThreshold: 50,   supplier: 'Old Mill Bakery' },

  // dairy — Coastline
  { name: 'American Cheese Slice',unit: 'slice', currentStock: 120,  lowStockThreshold: 100,  supplier: 'Coastline Dairy Co' },
  { name: 'Cheddar Slice',        unit: 'slice', currentStock: 64,   lowStockThreshold: 80,   supplier: 'Coastline Dairy Co' }, // LOW
  { name: 'Feta Crumble',         unit: 'kg',    currentStock: 1.2,  lowStockThreshold: 0.8,  supplier: 'Coastline Dairy Co' },
  { name: 'Greek Yogurt',         unit: 'kg',    currentStock: 2.0,  lowStockThreshold: 1.5,  supplier: 'Coastline Dairy Co' },

  // dry goods — Pantry Standard
  { name: 'Brown Rice (cooked)',  unit: 'kg',    currentStock: 5.5,  lowStockThreshold: 3.0,  supplier: 'Pantry Standard' },
  { name: 'Quinoa (cooked)',      unit: 'kg',    currentStock: 2.8,  lowStockThreshold: 2.0,  supplier: 'Pantry Standard' },
  { name: 'Black Beans',          unit: 'kg',    currentStock: 3.4,  lowStockThreshold: 2.0,  supplier: 'Pantry Standard' },
  { name: 'Corn Kernels',         unit: 'kg',    currentStock: 2.1,  lowStockThreshold: 1.5,  supplier: 'Pantry Standard' },
  { name: 'House Sauce',          unit: 'l',     currentStock: 1.6,  lowStockThreshold: 1.0,  supplier: 'Pantry Standard' },
  { name: 'Chipotle Mayo',        unit: 'l',     currentStock: 0.7,  lowStockThreshold: 1.0,  supplier: 'Pantry Standard' }, // LOW
  { name: 'Olive Oil',            unit: 'l',     currentStock: 4.0,  lowStockThreshold: 2.0,  supplier: 'Pantry Standard' },
  { name: 'Sea Salt',             unit: 'kg',    currentStock: 2.0,  lowStockThreshold: 0.5,  supplier: 'Pantry Standard' },

  // beverage — North Bay
  { name: 'Cola Can 330ml',       unit: 'ea',    currentStock: 48,   lowStockThreshold: 36,   supplier: 'North Bay Beverage' },
  { name: 'Sparkling Water 330ml',unit: 'ea',    currentStock: 24,   lowStockThreshold: 36,   supplier: 'North Bay Beverage' }, // LOW
];

const menuItems = [
  {
    name: 'Classic Smash Burger', category: 'Burgers',
    description: 'Double 80g smash patty, American cheese, onion, pickle, house sauce on brioche.',
    recipe: [
      ['Brioche Bun', 1],
      ['Beef Smash Patty 80g', 2],
      ['American Cheese Slice', 2],
      ['Yellow Onion', 0.025],
      ['Pickle Chips', 0.020],
      ['House Sauce', 0.025],
    ],
  },
  {
    name: 'Bacon Cheddar Smash', category: 'Burgers',
    description: 'Double smash, cheddar, bacon, red onion, chipotle mayo.',
    recipe: [
      ['Brioche Bun', 1],
      ['Beef Smash Patty 80g', 2],
      ['Cheddar Slice', 2],
      ['Bacon Strips', 2],
      ['Red Onion', 0.020],
      ['Chipotle Mayo', 0.025],
    ],
  },
  {
    name: 'Garden Smash', category: 'Burgers',
    description: 'Single smash, American, romaine, tomato, red onion, house sauce.',
    recipe: [
      ['Brioche Bun', 1],
      ['Beef Smash Patty 80g', 1],
      ['American Cheese Slice', 1],
      ['Romaine Lettuce', 0.030],
      ['Roma Tomato', 0.040],
      ['Red Onion', 0.020],
      ['House Sauce', 0.020],
    ],
  },
  {
    name: 'Chipotle Chicken Bowl', category: 'Bowls',
    description: 'Brown rice, black beans, corn, chicken, avocado, chipotle mayo.',
    recipe: [
      ['Brown Rice (cooked)', 0.180],
      ['Black Beans', 0.080],
      ['Corn Kernels', 0.060],
      ['Grilled Chicken Breast', 0.150],
      ['Avocado', 0.5],
      ['Chipotle Mayo', 0.030],
      ['Cilantro', 0.005],
      ['Lime', 0.25],
    ],
  },
  {
    name: 'Mediterranean Quinoa Bowl', category: 'Bowls',
    description: 'Quinoa, kale, cucumber, tomato, feta, olive oil, lemon yogurt.',
    recipe: [
      ['Quinoa (cooked)', 0.180],
      ['Kale', 0.060],
      ['Cucumber', 0.060],
      ['Roma Tomato', 0.050],
      ['Feta Crumble', 0.040],
      ['Greek Yogurt', 0.040],
      ['Olive Oil', 0.010],
    ],
  },
  {
    name: 'Power Greens Bowl', category: 'Bowls',
    description: 'Spinach, kale, quinoa, chicken, avocado, cucumber, yogurt dressing.',
    recipe: [
      ['Baby Spinach', 0.080],
      ['Kale', 0.040],
      ['Quinoa (cooked)', 0.120],
      ['Grilled Chicken Breast', 0.140],
      ['Avocado', 0.5],
      ['Cucumber', 0.050],
      ['Greek Yogurt', 0.040],
      ['Olive Oil', 0.008],
    ],
  },
  {
    name: 'Chicken Caesar Wrap', category: 'Wraps',
    description: 'Grilled chicken, romaine, parmesan-style house sauce in a flour tortilla.',
    recipe: [
      ['Flour Tortilla 10in', 1],
      ['Grilled Chicken Breast', 0.140],
      ['Romaine Lettuce', 0.080],
      ['House Sauce', 0.030],
    ],
  },
  {
    name: 'Southwest Chicken Wrap', category: 'Wraps',
    description: 'Chicken, black beans, corn, cheddar, chipotle mayo, cilantro.',
    recipe: [
      ['Flour Tortilla 10in', 1],
      ['Grilled Chicken Breast', 0.130],
      ['Black Beans', 0.060],
      ['Corn Kernels', 0.040],
      ['Cheddar Slice', 1],
      ['Chipotle Mayo', 0.025],
      ['Cilantro', 0.004],
    ],
  },
  {
    name: 'Avocado BLT Wrap', category: 'Wraps',
    description: 'Bacon, romaine, tomato, avocado, house sauce in a flour tortilla.',
    recipe: [
      ['Flour Tortilla 10in', 1],
      ['Bacon Strips', 3],
      ['Romaine Lettuce', 0.060],
      ['Roma Tomato', 0.050],
      ['Avocado', 0.5],
      ['House Sauce', 0.025],
    ],
  },
  {
    name: 'House Side Salad', category: 'Sides',
    description: 'Romaine, spinach, cucumber, tomato, olive oil.',
    recipe: [
      ['Romaine Lettuce', 0.060],
      ['Baby Spinach', 0.040],
      ['Cucumber', 0.040],
      ['Roma Tomato', 0.040],
      ['Olive Oil', 0.008],
    ],
  },
  {
    name: 'Cola', category: 'Drinks',
    description: 'Cold cola, 330ml can.',
    recipe: [['Cola Can 330ml', 1]],
  },
  {
    name: 'Sparkling Water', category: 'Drinks',
    description: 'Lime sparkling water, 330ml can.',
    recipe: [
      ['Sparkling Water 330ml', 1],
      ['Lime', 0.125],
    ],
  },
];

// rough daily volume per item — used to fabricate 7 days of sales
const dailyVolume = {
  'Classic Smash Burger': 14,
  'Bacon Cheddar Smash': 9,
  'Garden Smash': 6,
  'Chipotle Chicken Bowl': 11,
  'Mediterranean Quinoa Bowl': 7,
  'Power Greens Bowl': 6,
  'Chicken Caesar Wrap': 8,
  'Southwest Chicken Wrap': 7,
  'Avocado BLT Wrap': 5,
  'House Side Salad': 9,
  'Cola': 18,
  'Sparkling Water': 10,
};

async function main() {
  const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    throw new Error(`Demo user ${DEMO_EMAIL} not found. Register it first via the app.`);
  }
  const userId = user.id;

  console.log(`Wiping existing demo data for user ${userId}…`);
  await prisma.salesLog.deleteMany({ where: { userId } });
  await prisma.menuItem.deleteMany({ where: { userId } }); // cascades recipes
  await prisma.ingredient.deleteMany({ where: { userId } }); // cascades ingredient_suppliers
  await prisma.supplier.deleteMany({ where: { userId } });
  await prisma.restockDraft.deleteMany({ where: { userId } });

  console.log('Creating suppliers…');
  const supplierMap = {};
  for (const s of suppliers) {
    const created = await prisma.supplier.create({ data: { ...s, userId } });
    supplierMap[s.name] = created.id;
  }

  console.log('Creating ingredients…');
  const ingredientMap = {};
  for (const i of ingredients) {
    const { supplier, ...data } = i;
    const created = await prisma.ingredient.create({ data: { ...data, userId } });
    ingredientMap[i.name] = created.id;
    await prisma.ingredientSupplier.create({
      data: { ingredientId: created.id, supplierId: supplierMap[supplier] },
    });
  }

  console.log('Creating menu items + recipes…');
  const menuMap = {};
  for (const m of menuItems) {
    const created = await prisma.menuItem.create({
      data: {
        userId,
        name: m.name,
        description: m.description,
        category: m.category,
      },
    });
    menuMap[m.name] = created.id;
    for (const [ingName, qty] of m.recipe) {
      const ingId = ingredientMap[ingName];
      if (!ingId) throw new Error(`Recipe references missing ingredient: ${ingName}`);
      await prisma.recipe.create({
        data: { menuItemId: created.id, ingredientId: ingId, quantityNeeded: qty },
      });
    }
  }

  console.log('Generating 7 days of sales history…');
  const now = new Date();
  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    for (const [itemName, baseQty] of Object.entries(dailyVolume)) {
      // ±25% jitter, weekend bump
      const day = new Date(now);
      day.setDate(now.getDate() - dayOffset);
      const dow = day.getDay(); // 0 sun, 6 sat
      const weekendMul = dow === 0 || dow === 6 ? 1.25 : 1.0;
      const jitter = 0.75 + Math.random() * 0.5;
      const qty = Math.max(1, Math.round(baseQty * jitter * weekendMul));
      // pick a lunchtime hour
      const hour = 11 + Math.floor(Math.random() * 8);
      const minute = Math.floor(Math.random() * 60);
      day.setHours(hour, minute, 0, 0);
      await prisma.salesLog.create({
        data: {
          userId,
          menuItemId: menuMap[itemName],
          quantitySold: qty,
          soldAt: day,
        },
      });
    }
  }

  console.log('Done.');
  console.log(`  Suppliers:   ${suppliers.length}`);
  console.log(`  Ingredients: ${ingredients.length}`);
  console.log(`  Menu items:  ${menuItems.length}`);
  console.log(`  Sales logs:  ${Object.keys(dailyVolume).length * 7}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
