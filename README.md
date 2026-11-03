# Ledgerly — Accounting Software

A double-entry accounting app for small businesses, built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS** and **SQLite**.

## Features

- **Dashboard**: cash and bank balances, receivables, this month's income, expenses and profit, unpaid invoices and recent transactions.
- **Customers**: contact details, total invoiced and outstanding balance.
- **Invoices**: multi-line invoices, auto-numbered (`INV-0001`), with status (unpaid / partial / overdue / paid). You can record full or partial payments and print or save as PDF.
- **Expenses**: record spending by category, paid from cash, bank or a liability account.
- **Journal entries**: manual double-entry transactions with a live balance check. Invoices, payments and expenses post here automatically.
- **Chart of accounts**: 21 default accounts (assets, liabilities, equity, income, expenses). You can add your own.
- **Account ledger**: every transaction in an account, with a running balance.
- **Reports**: Profit & Loss (date range), Balance Sheet (as of a date) and Trial Balance.

## How the accounting works

Every transaction is a journal entry whose debits equal its credits:

| Action           | Debit                | Credit               |
|------------------|----------------------|----------------------|
| Create invoice   | Accounts Receivable  | Income account(s)    |
| Receive payment  | Cash / Bank          | Accounts Receivable  |
| Record expense   | Expense category     | Cash / Bank / Liability |

Amounts are stored as integer cents, so there are no rounding errors. Deleting an invoice or expense also removes its journal entries.

## Getting started

Requires Node.js 18.18 or later.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The database is created automatically at `data/accounting.db`.

### Configuration

| Variable               | Default               | Purpose                          |
|------------------------|-----------------------|----------------------------------|
| `NEXT_PUBLIC_CURRENCY` | `PKR`                 | ISO currency code for display (set before `npm run build`) |
| `DATABASE_PATH`        | `data/accounting.db`  | Location of the SQLite file      |

### Production

```bash
npm run build
npm start
```

SQLite needs a persistent disk, so deploy to a long-running Node host such as a VPS, Railway or Render. Serverless platforms like Vercel won't work with it. To host on Vercel, switch `src/lib/db.ts` to a hosted database such as Postgres or Turso.

## Project structure

```
src/
  app/            pages (dashboard, invoices, customers, expenses, journal, accounts, reports)
  app/actions.ts  server actions (all writes)
  lib/db.ts       SQLite connection, schema and default chart of accounts
  lib/accounting.ts  double-entry posting, queries and reports
  lib/format.ts   money and date helpers
  components/     shared UI
```
