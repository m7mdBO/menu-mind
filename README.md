# MenuMind

Intelligent inventory for kitchens of any size — restaurants, cafés, ghost kitchens, food trucks. Log a sale, watch stock deduct itself through your recipes, and ask Claude what to reorder before you run out.

**Live app:** https://menumindkitchen.netlify.app
**API:** https://menu-mind-production.up.railway.app
**Test account:** `test3@test.com` / `password123`

## What it does

- **The Pass** — at-a-glance dashboard: today's sales, low-stock alerts, top movers
- **Stock** — ingredient inventory with par levels, suppliers, units, low-stock thresholds
- **Menu** — menu items with per-portion recipes (which ingredients, how much)
- **Suppliers** — supplier book with contact info and lead times
- **Sales** — POS-style sale logger; each sale runs a Prisma transaction that subtracts every ingredient in the recipe
- **Forecast** — Claude reads your last 7 days of sales + current stock and recommends what to reorder, in what quantity, by when
- **Bulk import** — CSV/XLSX import for stock and historical sales

## Stack

**Frontend** — React 19, Vite, Tailwind CSS, React Router, Axios, SheetJS (xlsx)
**Backend** — Node, Express 5, Prisma 6, PostgreSQL, JWT auth, bcrypt
**AI** — Anthropic Claude via `@anthropic-ai/sdk`
**Hosting** — Netlify (frontend), Railway (backend + Postgres)

## Local setup

Prereqs: Node 20+, PostgreSQL 16, an Anthropic API key.

```bash
git clone https://github.com/m7mdBO/menu-mind.git
cd menu-mind

# backend
cd menumind-backend
npm install
cp .env.example .env   # then fill in values (see below)
npx prisma migrate dev
npm run seed           # optional: loads demo data into test3@test.com
npm run dev            # :4000

# frontend (new terminal)
cd ../menumind-frontend
npm install
echo "VITE_API_URL=http://localhost:4000" > .env
npm run dev            # :5173
```

Open http://localhost:5173.

## Environment variables

**`menumind-backend/.env`**

| Var              | Example                                                   | Notes                                              |
| ---------------- | --------------------------------------------------------- | -------------------------------------------------- |
| `DATABASE_URL`   | `postgresql://user@localhost:5432/menumind?schema=public` | Postgres connection string                         |
| `JWT_SECRET`     | `<random-string>`                                         | Used to sign auth tokens                           |
| `CLAUDE_API_KEY` | `sk-ant-...`                                              | From console.anthropic.com — required for Forecast |
| `PORT`           | `4000`                                                    | Optional; Railway sets this automatically          |

**`menumind-frontend/.env`**

| Var            | Example                 | Notes            |
| -------------- | ----------------------- | ---------------- |
| `VITE_API_URL` | `http://localhost:4000` | Backend base URL |

## Project layout

```
menumind-backend/      Express API, Prisma schema, seed script
  src/routes/          auth, ingredients, suppliers, menu-items, sales, dashboard, ai
  prisma/              schema.prisma, migrations, seed.js
menumind-frontend/     React app
  src/pages/           Login, Register, Dashboard, Stock, Menu, Suppliers, Sales, Forecast
  src/components/      Layout, shared UI
  src/index.css        Custom Tailwind component classes (.input, .btn-primary, .panel, ...)
sample-bulk-stock.csv  Example file for the bulk-import feature
sample-bulk-sales.csv
```

## API

All routes are under `/api`. Auth routes are public; everything else expects `Authorization: Bearer <jwt>`.

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/health

GET    /api/dashboard
GET    /api/ingredients          POST   /api/ingredients
PATCH  /api/ingredients/:id      DELETE /api/ingredients/:id
GET    /api/suppliers            POST   /api/suppliers
PATCH  /api/suppliers/:id        DELETE /api/suppliers/:id
GET    /api/menu-items           POST   /api/menu-items
PATCH  /api/menu-items/:id       DELETE /api/menu-items/:id
GET    /api/sales                POST   /api/sales
POST   /api/sales/bulk

POST   /api/ai/predict-restock
```

## Design

Industrial kitchen palette: navy, copper, mustard, bone, sage, tomato. Typography is Big Shoulders Display for signage, Manrope for body, JetBrains Mono for stock numbers and timestamps. UI vocabulary borrows from real kitchens — the dashboard is "The Pass," restocking is "Forecast," etc.
