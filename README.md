# Ledgerly — Accounting Software

A double-entry accounting app for small businesses, built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS** and **SQLite**.

## Features

- **Dashboard**: cash and bank balances, receivables, this month's income, expenses and profit, unpaid invoices and recent transactions.
- **Customers**: contact details, total invoiced and outstanding balance.
- **Invoices**: multi-line invoices, auto-numbered (`INV-0001`), with status (unpaid / partial / overdue / paid). You can record full or partial payments and print or save as PDF.
- **Expenses**: record spending by category, paid from cash, bank or a liability account.
- **Journal entries**: a full prepare → review → post workflow (see below). Invoices, payments and expenses post here automatically.
- **Chart of accounts**: 21 default accounts (assets, liabilities, equity, income, expenses). You can add your own.
- **Account ledger**: every transaction in an account, with a running balance.
- **Reports**: Profit & Loss (date range), Balance Sheet (as of a date) and Trial Balance.

## Journal entries

Each entry has a **type**, an **accounting period**, a **prepared by** name, a **reference** to its supporting documents and **supporting detail** explaining the calculation. Every line can carry a **department** and its own memo.

| Type | Default lines | Calculator | Reverses? |
|------|---------------|------------|-----------|
| AP Accrual | Dr Expense / Cr Accrued Liabilities | Contract value × % delivered − already invoiced | Yes |
| Fixed Assets | Dr Depreciation / Cr Accumulated Depreciation (+ amortization) | Straight-line: (cost − salvage) ÷ life | No |
| Prepaid | Dr Insurance / Software / Cr Prepaid Expenses | Prepaid total ÷ term | No |
| Payroll | Salaries, benefits, employer taxes, bonus → accrued liabilities | Payroll × unpaid days ÷ working days, % for benefits and taxes | Yes |
| Revenue | Dr Deferred Revenue / Cr Service Revenue | Contract ÷ term × months delivered | No |
| General | Anything else | — | Optional |

**Workflow**

1. **Prepare:** choose a type. The standard accounts load, the calculator fills the amounts and the supporting detail, and the period sets the entry date (period end) and the reversal date (first day of the next period).
2. **Save draft:** drafts can be unbalanced and edited freely. They are excluded from every balance and report.
3. **Review:** each entry gets an automatic checklist. It checks that debits equal credits, the date is in the period, the accounts suit the entry type, and that supporting detail, memos, department coding and a documentation reference are present. It also checks the reversal flag, the approval limit (`JE_APPROVAL_LIMIT`), consistency with the prior period, and flags any change of more than 25% from the prior period. There is also a side-by-side comparison with the previous period's entry of the same type.
4. **Post:** an entry can only be posted when debits equal credits. If it has a reversal date, the reversing entry is created automatically. Posted entries can't be edited; reverse them instead.
5. **Export:** each entry downloads as a CSV in a generic journal-import layout, for uploading into another ERP.

> Entries should be reviewed by a qualified accountant before posting.

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
| `JE_APPROVAL_LIMIT`    | `1000000`             | Journal entries above this total are flagged for a second approver |

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
