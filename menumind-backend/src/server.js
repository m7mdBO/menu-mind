require('dotenv/config');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const ingredientsRoutes = require('./routes/ingredients');
const suppliersRoutes = require('./routes/suppliers');
const menuItemsRoutes = require('./routes/menuItems');
const salesRoutes = require('./routes/sales');
const dashboardRoutes = require('./routes/dashboard');
const aiRoutes = require('./routes/ai');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/ingredients', ingredientsRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/menu-items', menuItemsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`MenuMind API listening on :${PORT}`));
