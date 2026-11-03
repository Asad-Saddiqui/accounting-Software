import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_PATH =
  process.env.DATABASE_PATH || path.join(process.cwd(), "data", "accounting.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id          INTEGER PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('asset','liability','equity','income','expense')),
  is_cash     INTEGER NOT NULL DEFAULT 0,
  system_key  TEXT UNIQUE,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id         INTEGER PRIMARY KEY,
  date       TEXT NOT NULL,
  memo       TEXT NOT NULL DEFAULT '',
  source     TEXT NOT NULL DEFAULT 'manual',
  source_id  INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_entries_date ON journal_entries(date);

CREATE TABLE IF NOT EXISTS journal_lines (
  id          INTEGER PRIMARY KEY,
  entry_id    INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id  INTEGER NOT NULL REFERENCES accounts(id),
  debit       INTEGER NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit      INTEGER NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description TEXT
);
CREATE INDEX IF NOT EXISTS idx_lines_entry ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_lines_account ON journal_lines(account_id);

CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  address    TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
  id               INTEGER PRIMARY KEY,
  number           TEXT NOT NULL UNIQUE,
  customer_id      INTEGER NOT NULL REFERENCES customers(id),
  date             TEXT NOT NULL,
  due_date         TEXT NOT NULL,
  notes            TEXT,
  total            INTEGER NOT NULL,
  journal_entry_id INTEGER REFERENCES journal_entries(id),
  created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id          INTEGER PRIMARY KEY,
  invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    REAL NOT NULL,
  unit_price  INTEGER NOT NULL,
  amount      INTEGER NOT NULL,
  account_id  INTEGER NOT NULL REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id               INTEGER PRIMARY KEY,
  invoice_id       INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  date             TEXT NOT NULL,
  amount           INTEGER NOT NULL CHECK (amount > 0),
  account_id       INTEGER NOT NULL REFERENCES accounts(id),
  journal_entry_id INTEGER REFERENCES journal_entries(id),
  created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id                   INTEGER PRIMARY KEY,
  date                 TEXT NOT NULL,
  payee                TEXT NOT NULL,
  description          TEXT,
  amount               INTEGER NOT NULL CHECK (amount > 0),
  expense_account_id   INTEGER NOT NULL REFERENCES accounts(id),
  paid_from_account_id INTEGER NOT NULL REFERENCES accounts(id),
  journal_entry_id     INTEGER REFERENCES journal_entries(id),
  created_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

// [code, name, type, is_cash, system_key]
const DEFAULT_ACCOUNTS: [string, string, string, number, string | null][] = [
  ["1000", "Cash", "asset", 1, null],
  ["1010", "Bank Account", "asset", 1, null],
  ["1200", "Accounts Receivable", "asset", 0, "accounts_receivable"],
  ["1300", "Inventory", "asset", 0, null],
  ["1400", "Prepaid Expenses", "asset", 0, null],
  ["1500", "Equipment", "asset", 0, null],
  ["1510", "Accumulated Depreciation", "asset", 0, null],
  ["1600", "Software & Intangibles", "asset", 0, null],
  ["1610", "Accumulated Amortization", "asset", 0, null],
  ["2000", "Accounts Payable", "liability", 0, null],
  ["2100", "Taxes Payable", "liability", 0, null],
  ["2200", "Accrued Liabilities", "liability", 0, null],
  ["2210", "Accrued Salaries", "liability", 0, null],
  ["2220", "Accrued Benefits", "liability", 0, null],
  ["2230", "Accrued Payroll Taxes", "liability", 0, null],
  ["2240", "Accrued Bonus", "liability", 0, null],
  ["2300", "Deferred Revenue", "liability", 0, null],
  ["2500", "Loans Payable", "liability", 0, null],
  ["3000", "Owner's Capital", "equity", 0, null],
  ["3100", "Owner's Drawings", "equity", 0, null],
  ["4000", "Sales Revenue", "income", 0, null],
  ["4100", "Service Revenue", "income", 0, null],
  ["4900", "Other Income", "income", 0, null],
  ["5000", "Cost of Goods Sold", "expense", 0, null],
  ["6000", "Rent Expense", "expense", 0, null],
  ["6100", "Utilities Expense", "expense", 0, null],
  ["6200", "Salaries & Wages", "expense", 0, null],
  ["6210", "Employee Benefits", "expense", 0, null],
  ["6220", "Payroll Tax Expense", "expense", 0, null],
  ["6230", "Bonus Expense", "expense", 0, null],
  ["6300", "Office Supplies", "expense", 0, null],
  ["6400", "Marketing & Advertising", "expense", 0, null],
  ["6500", "Bank Charges", "expense", 0, null],
  ["6600", "Depreciation Expense", "expense", 0, null],
  ["6610", "Amortization Expense", "expense", 0, null],
  ["6700", "Insurance Expense", "expense", 0, null],
  ["6800", "Software Subscriptions", "expense", 0, null],
  ["6900", "Miscellaneous Expense", "expense", 0, null],
];

/** Adds columns introduced after the first release. Safe to run repeatedly. */
function migrate(db: Database.Database) {
  const has = (table: string, column: string) =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === column);
  const add = (table: string, column: string, ddl: string) => {
    if (!has(table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  };
  add("journal_entries", "entry_type", "TEXT NOT NULL DEFAULT 'general'");
  add("journal_entries", "period", "TEXT");
  add("journal_entries", "reference", "TEXT");
  add("journal_entries", "prepared_by", "TEXT");
  add("journal_entries", "supporting_detail", "TEXT");
  add("journal_entries", "status", "TEXT NOT NULL DEFAULT 'posted'");
  add("journal_entries", "reverse_on", "TEXT");
  add("journal_entries", "reversal_of", "INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE");
  add("journal_entries", "posted_at", "TEXT");
  add("journal_lines", "department", "TEXT");
  db.exec("CREATE INDEX IF NOT EXISTS idx_entries_type_period ON journal_entries(entry_type, period)");
}

function init(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);

  migrate(db);

  // Add any default accounts that are missing (keeps older databases up to date).
  const insert = db.prepare(
    "INSERT OR IGNORE INTO accounts (code, name, type, is_cash, system_key) VALUES (?, ?, ?, ?, ?)",
  );
  db.transaction(() => {
    for (const row of DEFAULT_ACCOUNTS) insert.run(...row);
  })();
  return db;
}

// Reuse one connection across hot reloads in development.
const globalForDb = globalThis as unknown as { __accountingDb?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb.__accountingDb) globalForDb.__accountingDb = init();
  return globalForDb.__accountingDb;
}
