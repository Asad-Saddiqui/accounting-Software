import "server-only";
import { getDb } from "./db";
import { AccountingError, type AccountType } from "./accounting";
import { isDate, money } from "./format";
import { ENTRY_TYPES, entryType, isPeriod, jeNumber, type EntryType } from "./journal-types";

/** Entries above this total need a second approver (checklist warning only). */
export const APPROVAL_LIMIT = Math.round(Number(process.env.JE_APPROVAL_LIMIT || 1_000_000) * 100);

export type EntryStatus = "draft" | "posted";

export interface JeLine {
  id: number;
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  debit: number;
  credit: number;
  department: string | null;
  description: string | null;
}

export interface JeEntry {
  id: number;
  number: string;
  date: string;
  period: string | null;
  entry_type: EntryType;
  memo: string;
  reference: string | null;
  prepared_by: string | null;
  supporting_detail: string | null;
  status: EntryStatus;
  source: string;
  source_id: number | null;
  reverse_on: string | null;
  reversal_of: number | null;
  posted_at: string | null;
  created_at: string;
  total_debit: number;
  total_credit: number;
}

export interface JeDetail extends JeEntry {
  lines: JeLine[];
  reversal: { id: number; date: string } | null;
}

export interface JeLineInput {
  accountId: number;
  debit: number;
  credit: number;
  department?: string;
  description?: string;
}

export interface JeInput {
  entryType: string;
  period: string;
  date: string;
  memo: string;
  reference?: string;
  preparedBy?: string;
  supportingDetail?: string;
  reverseOn?: string | null;
  lines: JeLineInput[];
}

const ENTRY_SELECT = `
  SELECT e.*,
         COALESCE((SELECT SUM(debit)  FROM journal_lines WHERE entry_id = e.id), 0) AS total_debit,
         COALESCE((SELECT SUM(credit) FROM journal_lines WHERE entry_id = e.id), 0) AS total_credit
    FROM journal_entries e`;

type EntryRow = Omit<JeEntry, "number">;
const withNumber = (r: EntryRow): JeEntry => ({ ...r, number: jeNumber(r.id) });

/* ------------------------------------------------------------------ */
/* Queries                                                            */
/* ------------------------------------------------------------------ */

export interface JournalFilter {
  type?: string;
  status?: string;
  period?: string;
  q?: string;
}

export function listJournal(f: JournalFilter = {}): JeEntry[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (f.type && ENTRY_TYPES.some((t) => t.value === f.type)) {
    where.push("e.entry_type = ?");
    args.push(f.type);
  }
  if (f.status === "draft" || f.status === "posted") {
    where.push("e.status = ?");
    args.push(f.status);
  }
  if (f.period && isPeriod(f.period)) {
    where.push("COALESCE(e.period, substr(e.date, 1, 7)) = ?");
    args.push(f.period);
  }
  if (f.q?.trim()) {
    where.push("(e.memo LIKE ? OR e.reference LIKE ? OR e.prepared_by LIKE ?)");
    const like = `%${f.q.trim()}%`;
    args.push(like, like, like);
  }
  const sql = `${ENTRY_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
               ORDER BY e.status = 'posted', e.date DESC, e.id DESC LIMIT 500`;
  return (getDb().prepare(sql).all(...args) as EntryRow[]).map(withNumber);
}

export function journalStats() {
  const db = getDb();
  const one = (sql: string, ...a: string[]) => (db.prepare(sql).get(...a) as { n: number }).n;
  const today = new Date().toISOString().slice(0, 10);
  return {
    drafts: one("SELECT COUNT(*) AS n FROM journal_entries WHERE status = 'draft'"),
    posted: one("SELECT COUNT(*) AS n FROM journal_entries WHERE status = 'posted'"),
    upcomingReversals: one(
      "SELECT COUNT(*) AS n FROM journal_entries WHERE reversal_of IS NOT NULL AND date > ?",
      today,
    ),
  };
}

export function getEntry(id: number): JeDetail | undefined {
  const db = getDb();
  const row = db.prepare(`${ENTRY_SELECT} WHERE e.id = ?`).get(id) as EntryRow | undefined;
  if (!row) return undefined;
  const lines = db
    .prepare(
      `SELECT l.id, l.account_id, a.code AS account_code, a.name AS account_name, a.type AS account_type,
              l.debit, l.credit, l.department, l.description
         FROM journal_lines l JOIN accounts a ON a.id = l.account_id
        WHERE l.entry_id = ? ORDER BY l.id`,
    )
    .all(id) as JeLine[];
  const reversal = db
    .prepare("SELECT id, date FROM journal_entries WHERE reversal_of = ?")
    .get(id) as { id: number; date: string } | undefined;
  return { ...withNumber(row), lines, reversal: reversal ?? null };
}

/** Most recent posted entry of the same type from an earlier period. */
export function priorPeriodEntry(entry: JeEntry): JeDetail | undefined {
  if (entry.entry_type === "general" || !entry.period) return undefined;
  const row = getDb()
    .prepare(
      `SELECT id FROM journal_entries
        WHERE entry_type = ? AND status = 'posted' AND reversal_of IS NULL AND period < ? AND id != ?
        ORDER BY period DESC, id DESC LIMIT 1`,
    )
    .get(entry.entry_type, entry.period, entry.id) as { id: number } | undefined;
  return row ? getEntry(row.id) : undefined;
}

/* ------------------------------------------------------------------ */
/* Mutations                                                          */
/* ------------------------------------------------------------------ */

function validate(input: JeInput, forPosting: boolean) {
  const db = getDb();
  if (!ENTRY_TYPES.some((t) => t.value === input.entryType)) throw new AccountingError("Choose an entry type.");
  if (!isPeriod(input.period)) throw new AccountingError("Choose an accounting period.");
  if (!isDate(input.date)) throw new AccountingError("Entry date is not valid.");
  if (!input.memo.trim()) throw new AccountingError("A memo is required so the entry is clear for audit.");
  if (input.reverseOn) {
    if (!isDate(input.reverseOn)) throw new AccountingError("Reversal date is not valid.");
    if (input.reverseOn <= input.date) throw new AccountingError("Reversal date must be after the entry date.");
  }

  // Lines without an amount (e.g. unused template rows) are dropped.
  const lines = input.lines.filter((l) => l.debit || l.credit);
  if (lines.length < 2) throw new AccountingError("A journal entry needs at least two lines.");
  const exists = db.prepare("SELECT 1 FROM accounts WHERE id = ?");
  let debits = 0;
  let credits = 0;
  lines.forEach((l, i) => {
    const n = i + 1;
    if (!l.accountId || !exists.get(l.accountId)) throw new AccountingError(`Line ${n}: choose an account.`);
    for (const v of [l.debit, l.credit])
      if (!Number.isInteger(v) || v < 0) throw new AccountingError(`Line ${n}: amounts must be positive numbers.`);
    if (l.debit > 0 && l.credit > 0) throw new AccountingError(`Line ${n}: enter a debit or a credit, not both.`);
    debits += l.debit;
    credits += l.credit;
  });
  if (forPosting && debits !== credits)
    throw new AccountingError(
      `Entry is out of balance by ${money(Math.abs(debits - credits))}. Debits must equal credits before posting.`,
    );
  return lines;
}

function writeLines(entryId: number, lines: JeLineInput[]) {
  const ins = getDb().prepare(
    "INSERT INTO journal_lines (entry_id, account_id, debit, credit, department, description) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const l of lines)
    ins.run(entryId, l.accountId, l.debit, l.credit, l.department?.trim() || null, l.description?.trim() || null);
}

function createReversal(id: number) {
  const db = getDb();
  const e = getEntry(id);
  if (!e?.reverse_on || e.reversal) return;
  const info = db
    .prepare(
      `INSERT INTO journal_entries
         (date, period, entry_type, memo, reference, prepared_by, supporting_detail, status, source, reversal_of, posted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'posted', 'reversal', ?, CURRENT_TIMESTAMP)`,
    )
    .run(
      e.reverse_on,
      e.reverse_on.slice(0, 7),
      e.entry_type,
      `Reversal of ${e.number}: ${e.memo}`,
      e.reference,
      e.prepared_by,
      `Automatic reversal of ${e.number} dated ${e.date}.`,
      id,
    );
  writeLines(
    Number(info.lastInsertRowid),
    e.lines.map((l) => ({
      accountId: l.account_id,
      debit: l.credit,
      credit: l.debit,
      department: l.department ?? undefined,
      description: l.description ?? undefined,
    })),
  );
}

/** Creates or updates a manual entry. `post` validates balance and posts it to the ledger. */
export function saveEntry(input: JeInput, opts: { post: boolean; id?: number }): number {
  const db = getDb();
  const lines = validate(input, opts.post);

  return db.transaction(() => {
    const fields = [
      input.date,
      input.period,
      input.entryType,
      input.memo.trim(),
      input.reference?.trim() || null,
      input.preparedBy?.trim() || null,
      input.supportingDetail?.trim() || null,
      input.reverseOn || null,
    ];
    let id = opts.id;
    if (id) {
      const current = db.prepare("SELECT status, source FROM journal_entries WHERE id = ?").get(id) as
        | { status: string; source: string }
        | undefined;
      if (!current) throw new AccountingError("Entry not found.");
      if (current.status !== "draft") throw new AccountingError("Posted entries cannot be edited. Reverse them instead.");
      db.prepare(
        `UPDATE journal_entries SET date = ?, period = ?, entry_type = ?, memo = ?, reference = ?, prepared_by = ?,
                supporting_detail = ?, reverse_on = ? WHERE id = ?`,
      ).run(...fields, id);
      db.prepare("DELETE FROM journal_lines WHERE entry_id = ?").run(id);
    } else {
      const info = db
        .prepare(
          `INSERT INTO journal_entries
             (date, period, entry_type, memo, reference, prepared_by, supporting_detail, reverse_on, status, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'manual')`,
        )
        .run(...fields);
      id = Number(info.lastInsertRowid);
    }
    writeLines(id, lines);
    if (opts.post) postDraft(id);
    return id;
  })();
}

export function postDraft(id: number) {
  const db = getDb();
  const e = getEntry(id);
  if (!e) throw new AccountingError("Entry not found.");
  if (e.status === "posted") return;
  if (e.lines.length < 2) throw new AccountingError("A journal entry needs at least two lines.");
  if (e.total_debit !== e.total_credit)
    throw new AccountingError(`Entry is out of balance by ${money(Math.abs(e.total_debit - e.total_credit))}.`);
  db.transaction(() => {
    db.prepare("UPDATE journal_entries SET status = 'posted', posted_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    createReversal(id);
  })();
}

/** Manually reverse a posted entry on a given date. */
export function reverseEntry(id: number, date: string) {
  const db = getDb();
  const e = getEntry(id);
  if (!e || e.status !== "posted") throw new AccountingError("Only posted entries can be reversed.");
  if (e.reversal) throw new AccountingError("This entry has already been reversed.");
  if (e.reversal_of) throw new AccountingError("A reversal cannot itself be reversed.");
  if (!isDate(date) || date < e.date) throw new AccountingError("Reversal date must be on or after the entry date.");
  db.transaction(() => {
    db.prepare("UPDATE journal_entries SET reverse_on = ? WHERE id = ?").run(date, id);
    createReversal(id);
  })();
}

export function deleteEntry(id: number) {
  const db = getDb();
  const e = db.prepare("SELECT source FROM journal_entries WHERE id = ?").get(id) as { source: string } | undefined;
  if (!e) throw new AccountingError("Entry not found.");
  if (e.source !== "manual" && e.source !== "reversal")
    throw new AccountingError("This entry was created by an invoice, payment or expense. Delete that instead.");
  db.transaction(() => {
    db.prepare("DELETE FROM journal_entries WHERE reversal_of = ?").run(id);
    db.prepare("DELETE FROM journal_entries WHERE id = ?").run(id);
  })();
}

/* ------------------------------------------------------------------ */
/* Review checklist                                                   */
/* ------------------------------------------------------------------ */

export type CheckStatus = "pass" | "warn" | "fail" | "info";
export interface CheckItem {
  label: string;
  status: CheckStatus;
  detail: string;
}

export function reviewChecklist(e: JeDetail, prior?: JeDetail): CheckItem[] {
  const def = entryType(e.entry_type);
  const items: CheckItem[] = [];
  const add = (label: string, status: CheckStatus, detail: string) => items.push({ label, status, detail });
  const total = e.total_debit;

  add(
    "Debits equal credits",
    e.total_debit === e.total_credit && total > 0 ? "pass" : "fail",
    e.total_debit === e.total_credit
      ? `${money(e.total_debit)} on both sides.`
      : `Out of balance by ${money(Math.abs(e.total_debit - e.total_credit))}.`,
  );

  const inPeriod = !!e.period && e.date.startsWith(e.period);
  add(
    "Correct accounting period",
    inPeriod ? "pass" : "warn",
    inPeriod ? `Dated ${e.date}, inside period ${e.period}.` : `Entry date ${e.date} falls outside period ${e.period ?? "—"}.`,
  );

  const wrongSide = def.expect
    ? e.lines.filter((l) =>
        l.debit ? !def.expect!.debit.includes(l.account_type) : !def.expect!.credit.includes(l.account_type),
      )
    : [];
  add(
    "Account codes map to the right GL accounts",
    wrongSide.length ? "warn" : "pass",
    wrongSide.length
      ? `Unusual for a ${def.short} entry: ${wrongSide.map((l) => `${l.account_code} ${l.account_name}`).join(", ")}.`
      : "All accounts exist and suit this entry type.",
  );

  add(
    "Calculation and supporting detail",
    e.supporting_detail?.trim() ? "pass" : "warn",
    e.supporting_detail?.trim() ? "Calculation basis is documented." : "Add how the amounts were calculated.",
  );

  const missingDesc = e.lines.filter((l) => !l.description?.trim()).length;
  add(
    "Memo is clear and specific for audit",
    e.memo.trim().length >= 10 && missingDesc === 0 ? "pass" : "warn",
    missingDesc ? `${missingDesc} line(s) have no line memo.` : e.memo.trim().length < 10 ? "Header memo is very short." : "Header and line memos are filled in.",
  );

  const plLines = e.lines.filter((l) => l.account_type === "income" || l.account_type === "expense");
  const noDept = plLines.filter((l) => !l.department?.trim()).length;
  add(
    "Department / cost center coding",
    noDept ? "warn" : "pass",
    noDept ? `${noDept} income/expense line(s) have no department.` : plLines.length ? "All P&L lines are coded." : "No P&L lines to code.",
  );

  if (prior) {
    const accts = (x: JeDetail) => new Set(x.lines.map((l) => l.account_code));
    const now = accts(e);
    const before = accts(prior);
    const added = [...now].filter((a) => !before.has(a));
    const removed = [...before].filter((a) => !now.has(a));
    add(
      "Consistent with prior period treatment",
      added.length || removed.length ? "warn" : "pass",
      added.length || removed.length
        ? `Account mix changed vs ${prior.number}${added.length ? ` (new: ${added.join(", ")})` : ""}${removed.length ? ` (dropped: ${removed.join(", ")})` : ""}.`
        : `Same accounts as ${prior.number} (${prior.period}).`,
    );
  } else {
    add("Consistent with prior period treatment", "info", "No prior-period entry of this type to compare.");
  }

  if (e.reversal_of) {
    add("Reversal flag set appropriately", "pass", "This is an automatic reversal entry.");
  } else if (def.reverses) {
    add(
      "Reversal flag set appropriately",
      e.reverse_on ? "pass" : "warn",
      e.reverse_on ? `Auto-reverses on ${e.reverse_on}.` : "Accruals should auto-reverse at the start of the next period.",
    );
  } else {
    add(
      "Reversal flag set appropriately",
      e.reverse_on ? "warn" : "pass",
      e.reverse_on ? `Set to reverse on ${e.reverse_on}; ${def.short} entries normally do not reverse.` : "No reversal needed for this entry type.",
    );
  }

  add(
    "Supporting documentation referenced",
    e.reference?.trim() ? "pass" : "warn",
    e.reference?.trim() ? `Reference: ${e.reference}.` : "Add a schedule, PO, contract or file reference.",
  );

  add(
    "Within approval authority",
    total <= APPROVAL_LIMIT ? "pass" : "warn",
    total <= APPROVAL_LIMIT
      ? `Below the ${money(APPROVAL_LIMIT)} approval limit.`
      : `Above the ${money(APPROVAL_LIMIT)} limit — needs a second approver.`,
  );

  if (prior && prior.total_debit > 0) {
    const change = (total - prior.total_debit) / prior.total_debit;
    const pct = Math.round(change * 100);
    add(
      "No unusual or out-of-pattern amounts",
      Math.abs(change) > 0.25 ? "warn" : "pass",
      `${pct >= 0 ? "+" : ""}${pct}% vs prior period (${money(prior.total_debit)}).${Math.abs(change) > 0.25 ? " Investigate the variance." : ""}`,
    );
  } else {
    add("No unusual or out-of-pattern amounts", "info", "No prior period to compare against.");
  }

  return items;
}

/* ------------------------------------------------------------------ */
/* Export                                                             */
/* ------------------------------------------------------------------ */

/** CSV in a generic ERP journal-import layout. */
export function entryCsv(e: JeDetail): string {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["JournalNumber", "Date", "Period", "Type", "Line", "AccountCode", "AccountName", "Debit", "Credit", "Department", "LineMemo", "HeaderMemo", "Reference", "ReverseOn"];
  const rows = e.lines.map((l, i) => [
    e.number,
    e.date,
    e.period,
    e.entry_type,
    i + 1,
    l.account_code,
    l.account_name,
    l.debit ? (l.debit / 100).toFixed(2) : "",
    l.credit ? (l.credit / 100).toFixed(2) : "",
    l.department,
    l.description,
    e.memo,
    e.reference,
    e.reverse_on,
  ]);
  return [header, ...rows].map((r) => r.map(esc).join(",")).join("\n") + "\n";
}
