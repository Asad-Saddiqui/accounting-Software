import "server-only";
import { getDb } from "./db";
import { isDate, monthStart, today } from "./format";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "asset", label: "Assets" },
  { value: "liability", label: "Liabilities" },
  { value: "equity", label: "Equity" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expenses" },
];

export interface Account {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  is_cash: number;
  system_key: string | null;
  description: string | null;
}

export interface AccountWithBalance extends Account {
  debit: number;
  credit: number;
  /** Balance on the account's normal side (positive = normal). */
  balance: number;
  line_count: number;
}

export interface JournalLine {
  id: number;
  entry_id: number;
  account_id: number;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  description: string | null;
}

export interface JournalEntry {
  id: number;
  date: string;
  memo: string;
  source: string;
  source_id: number | null;
  lines: JournalLine[];
  total: number;
}

export interface LineInput {
  accountId: number;
  debit: number;
  credit: number;
  description?: string;
}

/** An error whose message is safe to show to the user. */
export class AccountingError extends Error {}

const DEBIT_NORMAL = new Set<AccountType>(["asset", "expense"]);

export function normalBalance(type: AccountType, debit: number, credit: number): number {
  return DEBIT_NORMAL.has(type) ? debit - credit : credit - debit;
}

function requireDate(date: string, label = "Date") {
  if (!isDate(date)) throw new AccountingError(`${label} is not a valid date.`);
}

/* ------------------------------------------------------------------ */
/* Accounts                                                           */
/* ------------------------------------------------------------------ */

/** All accounts with totals for entries dated within [from, to] (inclusive). */
export function accountBalances(from = "0000-01-01", to = "9999-12-31"): AccountWithBalance[] {
  const rows = getDb()
    .prepare(
      `SELECT a.*,
              COALESCE(SUM(l.debit), 0)  AS debit,
              COALESCE(SUM(l.credit), 0) AS credit,
              COUNT(l.id)                AS line_count
         FROM accounts a
         LEFT JOIN (
           SELECT jl.* FROM journal_lines jl
           JOIN journal_entries je ON je.id = jl.entry_id
           WHERE je.date BETWEEN ? AND ?
         ) l ON l.account_id = a.id
        GROUP BY a.id
        ORDER BY a.code`,
    )
    .all(from, to) as Omit<AccountWithBalance, "balance">[];
  return rows.map((r) => ({ ...r, balance: normalBalance(r.type, r.debit, r.credit) }));
}

export function listAccounts(): Account[] {
  return getDb().prepare("SELECT * FROM accounts ORDER BY code").all() as Account[];
}

export function getAccount(id: number): Account | undefined {
  return getDb().prepare("SELECT * FROM accounts WHERE id = ?").get(id) as Account | undefined;
}

function systemAccountId(key: string): number {
  const row = getDb().prepare("SELECT id FROM accounts WHERE system_key = ?").get(key) as
    | { id: number }
    | undefined;
  if (!row) throw new AccountingError(`System account "${key}" is missing.`);
  return row.id;
}

export function createAccount(input: {
  code: string;
  name: string;
  type: string;
  isCash: boolean;
  description?: string;
}): number {
  const code = input.code.trim();
  const name = input.name.trim();
  if (!/^[0-9A-Za-z-]{1,12}$/.test(code))
    throw new AccountingError("Account code must be 1–12 letters, digits or dashes.");
  if (!name) throw new AccountingError("Account name is required.");
  if (!ACCOUNT_TYPES.some((t) => t.value === input.type))
    throw new AccountingError("Choose a valid account type.");
  if (input.isCash && input.type !== "asset")
    throw new AccountingError("Only asset accounts can be cash/bank accounts.");

  const db = getDb();
  if (db.prepare("SELECT 1 FROM accounts WHERE code = ?").get(code))
    throw new AccountingError(`Account code ${code} is already in use.`);

  const info = db
    .prepare("INSERT INTO accounts (code, name, type, is_cash, description) VALUES (?, ?, ?, ?, ?)")
    .run(code, name, input.type, input.isCash ? 1 : 0, input.description?.trim() || null);
  return Number(info.lastInsertRowid);
}

export function deleteAccount(id: number) {
  const db = getDb();
  const account = getAccount(id);
  if (!account) throw new AccountingError("Account not found.");
  if (account.system_key) throw new AccountingError("System accounts cannot be deleted.");
  const used =
    db.prepare("SELECT 1 FROM journal_lines WHERE account_id = ? LIMIT 1").get(id) ||
    db.prepare("SELECT 1 FROM invoice_items WHERE account_id = ? LIMIT 1").get(id);
  if (used) throw new AccountingError("This account has transactions and cannot be deleted.");
  db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
}

export interface LedgerRow {
  entry_id: number;
  date: string;
  memo: string;
  source: string;
  source_id: number | null;
  description: string | null;
  debit: number;
  credit: number;
  balance: number;
}

export function accountLedger(id: number): LedgerRow[] {
  const account = getAccount(id);
  if (!account) return [];
  const rows = getDb()
    .prepare(
      `SELECT e.id AS entry_id, e.date, e.memo, e.source, e.source_id, l.description, l.debit, l.credit
         FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
        WHERE l.account_id = ?
        ORDER BY e.date, e.id, l.id`,
    )
    .all(id) as Omit<LedgerRow, "balance">[];
  let running = 0;
  return rows.map((r) => {
    running += normalBalance(account.type, r.debit, r.credit);
    return { ...r, balance: running };
  });
}

/* ------------------------------------------------------------------ */
/* Journal                                                            */
/* ------------------------------------------------------------------ */

export function postEntry(input: {
  date: string;
  memo: string;
  source?: string;
  sourceId?: number | null;
  lines: LineInput[];
}): number {
  requireDate(input.date);
  const lines = input.lines.filter((l) => l.debit || l.credit);
  if (lines.length < 2) throw new AccountingError("A journal entry needs at least two lines.");

  const db = getDb();
  const accountExists = db.prepare("SELECT 1 FROM accounts WHERE id = ?");
  let debits = 0;
  let credits = 0;
  for (const l of lines) {
    if (!Number.isInteger(l.debit) || !Number.isInteger(l.credit) || l.debit < 0 || l.credit < 0)
      throw new AccountingError("Amounts must be positive numbers.");
    if (l.debit > 0 && l.credit > 0)
      throw new AccountingError("A line can have a debit or a credit, not both.");
    if (!accountExists.get(l.accountId)) throw new AccountingError("Every line needs an account.");
    debits += l.debit;
    credits += l.credit;
  }
  if (debits !== credits)
    throw new AccountingError("Entry is not balanced: total debits must equal total credits.");

  return db.transaction(() => {
    const info = db
      .prepare("INSERT INTO journal_entries (date, memo, source, source_id) VALUES (?, ?, ?, ?)")
      .run(input.date, input.memo.trim(), input.source ?? "manual", input.sourceId ?? null);
    const entryId = Number(info.lastInsertRowid);
    const insertLine = db.prepare(
      "INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)",
    );
    for (const l of lines)
      insertLine.run(entryId, l.accountId, l.debit, l.credit, l.description?.trim() || null);
    return entryId;
  })();
}

export function listEntries(limit = 200): JournalEntry[] {
  const db = getDb();
  const entries = db
    .prepare("SELECT * FROM journal_entries ORDER BY date DESC, id DESC LIMIT ?")
    .all(limit) as Omit<JournalEntry, "lines" | "total">[];
  if (entries.length === 0) return [];

  const ids = entries.map((e) => e.id);
  const lines = db
    .prepare(
      `SELECT l.*, a.code AS account_code, a.name AS account_name
         FROM journal_lines l JOIN accounts a ON a.id = l.account_id
        WHERE l.entry_id IN (${ids.map(() => "?").join(",")})
        ORDER BY l.credit > 0, l.id`,
    )
    .all(...ids) as JournalLine[];

  const byEntry = new Map<number, JournalLine[]>();
  for (const l of lines) byEntry.set(l.entry_id, [...(byEntry.get(l.entry_id) ?? []), l]);
  return entries.map((e) => {
    const ls = byEntry.get(e.id) ?? [];
    return { ...e, lines: ls, total: ls.reduce((s, l) => s + l.debit, 0) };
  });
}

export function deleteManualEntry(id: number) {
  const db = getDb();
  const entry = db.prepare("SELECT source FROM journal_entries WHERE id = ?").get(id) as
    | { source: string }
    | undefined;
  if (!entry) throw new AccountingError("Entry not found.");
  if (entry.source !== "manual")
    throw new AccountingError("This entry was created by an invoice, payment or expense. Delete that instead.");
  db.prepare("DELETE FROM journal_entries WHERE id = ?").run(id);
}

/* ------------------------------------------------------------------ */
/* Customers                                                          */
/* ------------------------------------------------------------------ */

export interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface CustomerSummary extends Customer {
  invoice_count: number;
  invoiced: number;
  paid: number;
}

export function listCustomers(): CustomerSummary[] {
  return getDb()
    .prepare(
      `SELECT c.*,
              COUNT(i.id)                 AS invoice_count,
              COALESCE(SUM(i.total), 0)   AS invoiced,
              COALESCE(SUM((SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.invoice_id = i.id)), 0) AS paid
         FROM customers c LEFT JOIN invoices i ON i.customer_id = c.id
        GROUP BY c.id
        ORDER BY c.name COLLATE NOCASE`,
    )
    .all() as CustomerSummary[];
}

export function createCustomer(input: { name: string; email?: string; phone?: string; address?: string }) {
  const name = input.name.trim();
  if (!name) throw new AccountingError("Customer name is required.");
  const email = input.email?.trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AccountingError("Email address looks invalid.");
  getDb()
    .prepare("INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)")
    .run(name, email, input.phone?.trim() || null, input.address?.trim() || null);
}

export function deleteCustomer(id: number) {
  const db = getDb();
  if (db.prepare("SELECT 1 FROM invoices WHERE customer_id = ? LIMIT 1").get(id))
    throw new AccountingError("This customer has invoices and cannot be deleted.");
  db.prepare("DELETE FROM customers WHERE id = ?").run(id);
}

/* ------------------------------------------------------------------ */
/* Invoices & payments                                                */
/* ------------------------------------------------------------------ */

export type InvoiceStatus = "paid" | "partial" | "overdue" | "unpaid";

export interface InvoiceSummary {
  id: number;
  number: string;
  customer_id: number;
  customer_name: string;
  date: string;
  due_date: string;
  notes: string | null;
  total: number;
  paid: number;
  balance: number;
  status: InvoiceStatus;
}

export interface InvoiceItem {
  id: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  account_id: number;
  account_name: string;
}

export interface Payment {
  id: number;
  date: string;
  amount: number;
  account_name: string;
}

export interface InvoiceDetail extends InvoiceSummary {
  customer: Customer;
  items: InvoiceItem[];
  payments: Payment[];
}

function withStatus(row: Omit<InvoiceSummary, "balance" | "status">): InvoiceSummary {
  const balance = row.total - row.paid;
  let status: InvoiceStatus = "unpaid";
  if (balance <= 0) status = "paid";
  else if (row.due_date < today()) status = "overdue";
  else if (row.paid > 0) status = "partial";
  return { ...row, balance, status };
}

const INVOICE_SELECT = `
  SELECT i.id, i.number, i.customer_id, c.name AS customer_name, i.date, i.due_date, i.notes, i.total,
         COALESCE((SELECT SUM(amount) FROM payments p WHERE p.invoice_id = i.id), 0) AS paid
    FROM invoices i JOIN customers c ON c.id = i.customer_id`;

export function listInvoices(): InvoiceSummary[] {
  const rows = getDb()
    .prepare(`${INVOICE_SELECT} ORDER BY i.date DESC, i.id DESC`)
    .all() as Omit<InvoiceSummary, "balance" | "status">[];
  return rows.map(withStatus);
}

export function getInvoice(id: number): InvoiceDetail | undefined {
  const db = getDb();
  const row = db.prepare(`${INVOICE_SELECT} WHERE i.id = ?`).get(id) as
    | Omit<InvoiceSummary, "balance" | "status">
    | undefined;
  if (!row) return undefined;
  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(row.customer_id) as Customer;
  const items = db
    .prepare(
      `SELECT it.*, a.name AS account_name FROM invoice_items it
         JOIN accounts a ON a.id = it.account_id WHERE it.invoice_id = ? ORDER BY it.id`,
    )
    .all(id) as InvoiceItem[];
  const payments = db
    .prepare(
      `SELECT p.id, p.date, p.amount, a.name AS account_name FROM payments p
         JOIN accounts a ON a.id = p.account_id WHERE p.invoice_id = ? ORDER BY p.date, p.id`,
    )
    .all(id) as Payment[];
  return { ...withStatus(row), customer, items, payments };
}

export function nextInvoiceNumber(): string {
  const { n } = getDb().prepare("SELECT COALESCE(MAX(id), 0) + 1 AS n FROM invoices").get() as { n: number };
  return `INV-${String(n).padStart(4, "0")}`;
}

export interface InvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  accountId: number;
}

export function createInvoice(input: {
  customerId: number;
  date: string;
  dueDate: string;
  notes?: string;
  items: InvoiceItemInput[];
}): number {
  const db = getDb();
  requireDate(input.date, "Invoice date");
  requireDate(input.dueDate, "Due date");
  if (input.dueDate < input.date) throw new AccountingError("Due date cannot be before the invoice date.");
  if (!db.prepare("SELECT 1 FROM customers WHERE id = ?").get(input.customerId))
    throw new AccountingError("Choose a customer.");

  const items = input.items.filter((i) => i.description.trim() || i.unitPrice);
  if (items.length === 0) throw new AccountingError("Add at least one line item.");

  const incomeAccount = db.prepare("SELECT type FROM accounts WHERE id = ?");
  const priced = items.map((i) => {
    if (!i.description.trim()) throw new AccountingError("Every line item needs a description.");
    if (!(i.quantity > 0)) throw new AccountingError("Quantity must be greater than zero.");
    if (!Number.isInteger(i.unitPrice) || i.unitPrice <= 0)
      throw new AccountingError("Price must be greater than zero.");
    const acc = incomeAccount.get(i.accountId) as { type: string } | undefined;
    if (acc?.type !== "income") throw new AccountingError("Each line item needs an income account.");
    return { ...i, amount: Math.round(i.quantity * i.unitPrice) };
  });
  const total = priced.reduce((s, i) => s + i.amount, 0);

  return db.transaction(() => {
    const number = nextInvoiceNumber();
    const info = db
      .prepare("INSERT INTO invoices (number, customer_id, date, due_date, notes, total) VALUES (?, ?, ?, ?, ?, ?)")
      .run(number, input.customerId, input.date, input.dueDate, input.notes?.trim() || null, total);
    const invoiceId = Number(info.lastInsertRowid);

    const insertItem = db.prepare(
      "INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount, account_id) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const revenueByAccount = new Map<number, number>();
    for (const i of priced) {
      insertItem.run(invoiceId, i.description.trim(), i.quantity, i.unitPrice, i.amount, i.accountId);
      revenueByAccount.set(i.accountId, (revenueByAccount.get(i.accountId) ?? 0) + i.amount);
    }

    // Dr Accounts Receivable, Cr Revenue
    const entryId = postEntry({
      date: input.date,
      memo: `Invoice ${number}`,
      source: "invoice",
      sourceId: invoiceId,
      lines: [
        { accountId: systemAccountId("accounts_receivable"), debit: total, credit: 0 },
        ...[...revenueByAccount].map(([accountId, amount]) => ({ accountId, debit: 0, credit: amount })),
      ],
    });
    db.prepare("UPDATE invoices SET journal_entry_id = ? WHERE id = ?").run(entryId, invoiceId);
    return invoiceId;
  })();
}

export function recordPayment(invoiceId: number, input: { date: string; amount: number; accountId: number }) {
  const db = getDb();
  const invoice = getInvoice(invoiceId);
  if (!invoice) throw new AccountingError("Invoice not found.");
  requireDate(input.date, "Payment date");
  if (!Number.isInteger(input.amount) || input.amount <= 0)
    throw new AccountingError("Payment amount must be greater than zero.");
  if (input.amount > invoice.balance)
    throw new AccountingError("Payment is more than the balance due.");
  const acc = getAccount(input.accountId);
  if (!acc?.is_cash) throw new AccountingError("Choose a cash or bank account to deposit into.");

  db.transaction(() => {
    const info = db
      .prepare("INSERT INTO payments (invoice_id, date, amount, account_id) VALUES (?, ?, ?, ?)")
      .run(invoiceId, input.date, input.amount, input.accountId);
    const paymentId = Number(info.lastInsertRowid);
    // Dr Cash/Bank, Cr Accounts Receivable
    const entryId = postEntry({
      date: input.date,
      memo: `Payment for ${invoice.number} — ${invoice.customer_name}`,
      source: "payment",
      sourceId: invoiceId,
      lines: [
        { accountId: input.accountId, debit: input.amount, credit: 0 },
        { accountId: systemAccountId("accounts_receivable"), debit: 0, credit: input.amount },
      ],
    });
    db.prepare("UPDATE payments SET journal_entry_id = ? WHERE id = ?").run(entryId, paymentId);
  })();
}

export function deleteInvoice(id: number) {
  const db = getDb();
  db.transaction(() => {
    const entryIds = [
      ...(db.prepare("SELECT journal_entry_id AS id FROM invoices WHERE id = ?").all(id) as { id: number | null }[]),
      ...(db.prepare("SELECT journal_entry_id AS id FROM payments WHERE invoice_id = ?").all(id) as { id: number | null }[]),
    ];
    db.prepare("DELETE FROM invoices WHERE id = ?").run(id); // items & payments cascade
    const del = db.prepare("DELETE FROM journal_entries WHERE id = ?");
    for (const e of entryIds) if (e.id) del.run(e.id);
  })();
}

/* ------------------------------------------------------------------ */
/* Expenses                                                           */
/* ------------------------------------------------------------------ */

export interface Expense {
  id: number;
  date: string;
  payee: string;
  description: string | null;
  amount: number;
  expense_account_name: string;
  paid_from_account_name: string;
}

export function listExpenses(): Expense[] {
  return getDb()
    .prepare(
      `SELECT x.id, x.date, x.payee, x.description, x.amount,
              ea.name AS expense_account_name, pa.name AS paid_from_account_name
         FROM expenses x
         JOIN accounts ea ON ea.id = x.expense_account_id
         JOIN accounts pa ON pa.id = x.paid_from_account_id
        ORDER BY x.date DESC, x.id DESC`,
    )
    .all() as Expense[];
}

export function createExpense(input: {
  date: string;
  payee: string;
  description?: string;
  amount: number;
  expenseAccountId: number;
  paidFromAccountId: number;
}) {
  const db = getDb();
  requireDate(input.date);
  const payee = input.payee.trim();
  if (!payee) throw new AccountingError("Payee is required.");
  if (!Number.isInteger(input.amount) || input.amount <= 0)
    throw new AccountingError("Amount must be greater than zero.");
  if (getAccount(input.expenseAccountId)?.type !== "expense")
    throw new AccountingError("Choose an expense category.");
  const from = getAccount(input.paidFromAccountId);
  if (!from || !(from.is_cash || from.type === "liability"))
    throw new AccountingError("Choose a cash, bank or liability account to pay from.");

  db.transaction(() => {
    const info = db
      .prepare(
        "INSERT INTO expenses (date, payee, description, amount, expense_account_id, paid_from_account_id) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(input.date, payee, input.description?.trim() || null, input.amount, input.expenseAccountId, input.paidFromAccountId);
    const expenseId = Number(info.lastInsertRowid);
    // Dr Expense, Cr Cash/Bank (or liability)
    const entryId = postEntry({
      date: input.date,
      memo: `Expense — ${payee}${input.description?.trim() ? `: ${input.description.trim()}` : ""}`,
      source: "expense",
      sourceId: expenseId,
      lines: [
        { accountId: input.expenseAccountId, debit: input.amount, credit: 0 },
        { accountId: input.paidFromAccountId, debit: 0, credit: input.amount },
      ],
    });
    db.prepare("UPDATE expenses SET journal_entry_id = ? WHERE id = ?").run(entryId, expenseId);
  })();
}

export function deleteExpense(id: number) {
  const db = getDb();
  db.transaction(() => {
    const row = db.prepare("SELECT journal_entry_id FROM expenses WHERE id = ?").get(id) as
      | { journal_entry_id: number | null }
      | undefined;
    db.prepare("DELETE FROM expenses WHERE id = ?").run(id);
    if (row?.journal_entry_id) db.prepare("DELETE FROM journal_entries WHERE id = ?").run(row.journal_entry_id);
  })();
}

/* ------------------------------------------------------------------ */
/* Reports                                                            */
/* ------------------------------------------------------------------ */

export function trialBalance(asOf: string) {
  const rows = accountBalances(undefined, asOf)
    .filter((a) => a.debit !== a.credit)
    .map((a) => {
      const net = a.debit - a.credit;
      return { ...a, debitBalance: net > 0 ? net : 0, creditBalance: net < 0 ? -net : 0 };
    });
  return {
    rows,
    totalDebit: rows.reduce((s, r) => s + r.debitBalance, 0),
    totalCredit: rows.reduce((s, r) => s + r.creditBalance, 0),
  };
}

export function profitAndLoss(from: string, to: string) {
  const accounts = accountBalances(from, to);
  const income = accounts.filter((a) => a.type === "income" && a.balance !== 0);
  const expenses = accounts.filter((a) => a.type === "expense" && a.balance !== 0);
  const totalIncome = income.reduce((s, a) => s + a.balance, 0);
  const totalExpenses = expenses.reduce((s, a) => s + a.balance, 0);
  return { income, expenses, totalIncome, totalExpenses, netIncome: totalIncome - totalExpenses };
}

export function balanceSheet(asOf: string) {
  const accounts = accountBalances(undefined, asOf);
  const pick = (t: AccountType) => accounts.filter((a) => a.type === t && a.balance !== 0);
  const sum = (list: AccountWithBalance[]) => list.reduce((s, a) => s + a.balance, 0);

  const assets = pick("asset");
  const liabilities = pick("liability");
  const equity = pick("equity");
  // Books are never formally closed, so all net income to date sits in equity.
  const retainedEarnings = sum(accounts.filter((a) => a.type === "income")) - sum(accounts.filter((a) => a.type === "expense"));

  const totalAssets = sum(assets);
  const totalLiabilities = sum(liabilities);
  const totalEquity = sum(equity) + retainedEarnings;
  return { assets, liabilities, equity, retainedEarnings, totalAssets, totalLiabilities, totalEquity };
}

export function dashboard() {
  const all = accountBalances();
  const cash = all.filter((a) => a.is_cash);
  const receivable = all.find((a) => a.system_key === "accounts_receivable")?.balance ?? 0;
  const month = profitAndLoss(monthStart(), today());
  const openInvoices = listInvoices().filter((i) => i.status !== "paid");
  return {
    cashAccounts: cash,
    cashTotal: cash.reduce((s, a) => s + a.balance, 0),
    receivable,
    month,
    openInvoices: openInvoices.slice(0, 6),
    overdueCount: openInvoices.filter((i) => i.status === "overdue").length,
    recentEntries: listEntries(8),
  };
}
