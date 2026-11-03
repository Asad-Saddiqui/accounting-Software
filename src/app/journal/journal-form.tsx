"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { saveJournalAction } from "@/app/actions";
import { money, toCents } from "@/lib/format";
import {
  ENTRY_TYPES,
  entryType,
  formatPeriod,
  nextPeriodStart,
  periodEnd,
  type EntryType,
} from "@/lib/journal-types";

export interface AccountOption {
  id: number;
  code: string;
  name: string;
  type: string;
}

export interface FormLine {
  key?: string;
  side?: "debit" | "credit";
  accountId: string;
  description: string;
  department: string;
  debit: string;
  credit: string;
}

export interface FormValues {
  entryType: EntryType;
  period: string;
  date: string;
  memo: string;
  reference: string;
  preparedBy: string;
  supportingDetail: string;
  reverse: boolean;
  reverseOn: string;
  lines: FormLine[];
}

const DEPARTMENTS = ["Administration", "Sales", "Marketing", "Operations", "Finance", "HR", "IT", "Production"];
const GROUPS = [
  ["asset", "Assets"],
  ["liability", "Liabilities"],
  ["equity", "Equity"],
  ["income", "Income"],
  ["expense", "Expenses"],
] as const;
const PREPARER_KEY = "ledgerly.preparedBy";

const blankLine = (): FormLine => ({ accountId: "", description: "", department: "", debit: "", credit: "" });

export function JournalForm({
  accounts,
  initial,
  entryId,
}: {
  accounts: AccountOption[];
  initial: FormValues;
  entryId?: number;
}) {
  const [v, setV] = useState<FormValues>(initial);
  const [calc, setCalc] = useState<Record<string, string>>({});
  const [state, action, pending] = useActionState(saveJournalAction.bind(null, entryId ?? null), undefined);
  const def = entryType(v.entryType);
  const byCode = useMemo(() => new Map(accounts.map((a) => [a.code, a])), [accounts]);
  const byId = useMemo(() => new Map(accounts.map((a) => [String(a.id), a])), [accounts]);

  // Remember who prepares entries on this browser.
  useEffect(() => {
    if (initial.preparedBy) return;
    try {
      const saved = localStorage.getItem(PREPARER_KEY);
      if (saved) setV((x) => ({ ...x, preparedBy: saved }));
    } catch {}
  }, [initial.preparedBy]);

  const set = (patch: Partial<FormValues>) => setV((x) => ({ ...x, ...patch }));
  const setLine = (i: number, patch: Partial<FormLine>) =>
    setV((x) => ({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));

  function chooseType(type: EntryType) {
    const t = entryType(type);
    const hasData = v.lines.some((l) => l.accountId || l.debit || l.credit);
    if (hasData && type !== v.entryType && !window.confirm("Replace the current lines with the template for this entry type?"))
      return set({ entryType: type });
    const lines: FormLine[] = t.template.length
      ? t.template.map((tl) => ({
          key: tl.key,
          side: tl.side,
          accountId: String(byCode.get(tl.accountCode)?.id ?? ""),
          description: tl.description,
          department: "",
          debit: "",
          credit: "",
        }))
      : [blankLine(), blankLine()];
    setCalc(Object.fromEntries((t.calculator?.fields ?? []).map((f) => [f.name, f.defaultValue ?? ""])));
    set({
      entryType: type,
      lines,
      date: type === "general" ? v.date : periodEnd(v.period),
      reverse: t.reverses,
      reverseOn: nextPeriodStart(v.period),
      memo: type === "general" ? v.memo : `${t.label} — ${formatPeriod(v.period)}`,
      supportingDetail: "",
    });
  }

  function changePeriod(period: string) {
    if (!period) return;
    set({
      period,
      date: periodEnd(period),
      reverseOn: nextPeriodStart(period),
      memo: def.value !== "general" && v.memo === `${def.label} — ${formatPeriod(v.period)}` ? `${def.label} — ${formatPeriod(period)}` : v.memo,
    });
  }

  function applyCalculator() {
    if (!def.calculator) return;
    const values = Object.fromEntries(
      def.calculator.fields.map((f) => [f.name, Number(String(calc[f.name] ?? f.defaultValue ?? "").replace(/,/g, "")) || 0]),
    );
    const { amounts, detail } = def.calculator.compute(values, money);
    setV((x) => ({
      ...x,
      supportingDetail: detail,
      lines: x.lines.map((l) => {
        if (!l.key || !(l.key in amounts)) return l;
        const amt = amounts[l.key] ? (amounts[l.key] / 100).toFixed(2) : "";
        return l.side === "debit" ? { ...l, debit: amt, credit: "" } : { ...l, credit: amt, debit: "" };
      }),
    }));
  }

  const debits = v.lines.reduce((s, l) => s + (toCents(l.debit) || 0), 0);
  const credits = v.lines.reduce((s, l) => s + (toCents(l.credit) || 0), 0);
  const diff = debits - credits;
  const balanced = debits > 0 && diff === 0;
  const inPeriod = v.date.startsWith(v.period);

  const payload = JSON.stringify({
    ...v,
    lines: v.lines.filter((l) => l.accountId || l.debit || l.credit),
  });

  return (
    <form
      action={action}
      onSubmit={() => {
        try {
          if (v.preparedBy) localStorage.setItem(PREPARER_KEY, v.preparedBy);
        } catch {}
      }}
      className="space-y-6"
    >
      {/* Entry type */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">1. Entry type</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ENTRY_TYPES.map((t) => (
            <button
              type="button"
              key={t.value}
              onClick={() => chooseType(t.value)}
              aria-pressed={v.entryType === t.value}
              className={`rounded-xl border p-4 text-left transition ${
                v.entryType === t.value
                  ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span className="flex items-center justify-between">
                <span className="font-medium">{t.label}</span>
                {t.reverses && <span className="rounded bg-amber-50 px-1.5 text-[11px] font-medium text-amber-700">auto-reverses</span>}
              </span>
              <span className="mt-1 block text-xs text-slate-500">{t.description}</span>
            </button>
          ))}
        </div>
      </section>

      <div className={`grid items-start gap-6 ${def.calculator ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
          {/* Header */}
          <section className="card">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">2. Entry details</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="period">Period</label>
                <input id="period" type="month" className="input" value={v.period} onChange={(e) => changePeriod(e.target.value)} required />
              </div>
              <div>
                <label className="label" htmlFor="date">Entry date</label>
                <input id="date" type="date" className="input" value={v.date} onChange={(e) => set({ date: e.target.value })} required />
                {!inPeriod && <p className="mt-1 text-xs text-amber-600">Outside {formatPeriod(v.period)}</p>}
              </div>
              <div>
                <label className="label" htmlFor="preparedBy">Prepared by</label>
                <input id="preparedBy" className="input" value={v.preparedBy} onChange={(e) => set({ preparedBy: e.target.value })} placeholder="Your name" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="memo">Memo</label>
                <input id="memo" className="input" value={v.memo} onChange={(e) => set({ memo: e.target.value })} placeholder="What this entry records and why" required />
              </div>
              <div>
                <label className="label" htmlFor="reference">Reference / support</label>
                <input id="reference" className="input" value={v.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="PO-114, payroll register…" />
              </div>
            </div>
          </section>
          {def.calculator && (
            <section className="card">
              <h2 className="text-sm font-semibold text-slate-700">Calculator</h2>
              <p className="mb-3 text-xs text-slate-500">Fill in the schedule values to calculate the line amounts and supporting detail.</p>
              <div className="space-y-3">
                {def.calculator.fields.map((f) => (
                  <div key={f.name}>
                    <label className="label text-xs" htmlFor={`calc-${f.name}`}>{f.label}{f.kind === "percent" ? " (%)" : ""}</label>
                    <input id={`calc-${f.name}`} className="input" inputMode="decimal" value={calc[f.name] ?? f.defaultValue ?? ""}
                      onChange={(e) => setCalc((c) => ({ ...c, [f.name]: e.target.value }))} />
                  </div>
                ))}
                <button type="button" className="btn-secondary w-full" onClick={applyCalculator}>Calculate &amp; fill lines</button>
              </div>
            </section>
          )}
      </div>

          {/* Lines */}
          <section className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">3. Lines</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${balanced ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {balanced ? "Balanced" : debits === 0 && credits === 0 ? "No amounts yet" : `Out by ${money(Math.abs(diff))}`}
              </span>
            </div>
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="table min-w-[860px]">
                <thead>
                  <tr>
                    <th className="w-8">#</th>
                    <th className="w-64">Account</th>
                    <th>Line memo</th>
                    <th className="w-36">Department</th>
                    <th className="num w-32">Debit</th>
                    <th className="num w-32">Credit</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {v.lines.map((l, i) => {
                    const acct = byId.get(l.accountId);
                    const isPL = acct && (acct.type === "income" || acct.type === "expense");
                    return (
                      <tr key={i}>
                        <td className="pt-4 text-slate-400">{i + 1}</td>
                        <td>
                          <select className="input" value={l.accountId} onChange={(e) => setLine(i, { accountId: e.target.value })} aria-label={`Line ${i + 1} account`}>
                            <option value="">Select account…</option>
                            {GROUPS.map(([type, label]) => (
                              <optgroup key={type} label={label}>
                                {accounts.filter((a) => a.type === type).map((a) => (
                                  <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </td>
                        <td><input className="input" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} aria-label={`Line ${i + 1} memo`} /></td>
                        <td>
                          <input className={`input ${isPL && !l.department ? "border-amber-300" : ""}`} list="departments" value={l.department}
                            onChange={(e) => setLine(i, { department: e.target.value })} placeholder={isPL ? "Required" : "—"} aria-label={`Line ${i + 1} department`} />
                        </td>
                        <td>
                          <input className="input text-right tabular-nums" inputMode="decimal" placeholder="0.00" value={l.debit} aria-label={`Line ${i + 1} debit`}
                            onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} />
                        </td>
                        <td>
                          <input className="input text-right tabular-nums" inputMode="decimal" placeholder="0.00" value={l.credit} aria-label={`Line ${i + 1} credit`}
                            onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} />
                        </td>
                        <td>
                          {v.lines.length > 2 && (
                            <button type="button" className="pt-2 text-slate-400 hover:text-red-600" aria-label={`Remove line ${i + 1}`}
                              onClick={() => set({ lines: v.lines.filter((_, j) => j !== i) })}>✕</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>
                      <button type="button" className="btn-secondary" onClick={() => set({ lines: [...v.lines, blankLine()] })}>+ Add line</button>
                    </td>
                    <td className="num font-semibold tabular-nums">{money(debits)}</td>
                    <td className="num font-semibold tabular-nums">{money(credits)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
              <datalist id="departments">{DEPARTMENTS.map((d) => <option key={d} value={d} />)}</datalist>
            </div>
          </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* Support & reversal */}
          <section className="card grid h-fit gap-4 sm:grid-cols-[minmax(0,1fr)_240px]">
            <div>
              <label className="label" htmlFor="support">Supporting detail</label>
              <textarea id="support" rows={4} className="input" value={v.supportingDetail} onChange={(e) => set({ supportingDetail: e.target.value })}
                placeholder="Calculation basis, assumptions and the schedule this ties to." />
            </div>
            <div>
              <span className="label">Reversal</span>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={v.reverse} onChange={(e) => set({ reverse: e.target.checked })} />
                Auto-reverse this entry
              </label>
              {v.reverse && (
                <div className="mt-2">
                  <label className="label" htmlFor="reverseOn">Reverse on</label>
                  <input id="reverseOn" type="date" className="input" value={v.reverseOn} onChange={(e) => set({ reverseOn: e.target.value })} />
                </div>
              )}
              <p className="mt-2 text-xs text-slate-500">
                {def.reverses ? "Accruals normally reverse on the first day of the next period." : "This entry type does not normally reverse."}
              </p>
            </div>
          </section>
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Before you post</h2>
            <ul className="space-y-2 text-sm">
              <Check ok={balanced} label="Debits equal credits" />
              <Check ok={inPeriod} label="Date is inside the period" />
              <Check ok={v.memo.trim().length >= 10} label="Clear memo" />
              <Check ok={!!v.supportingDetail.trim()} label="Supporting detail" />
              <Check ok={!!v.reference.trim()} label="Documentation referenced" />
              <Check ok={def.reverses ? v.reverse : !v.reverse} label={def.reverses ? "Reversal set (accrual)" : "No reversal needed"} />
            </ul>
            <p className="mt-3 text-xs text-slate-400">A full review checklist runs after saving.</p>
          </section>
      </div>

      {state?.error && <p className="alert-error">{state.error}</p>}
      <input type="hidden" name="payload" value={payload} />
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <button className="btn-secondary" name="intent" value="draft" disabled={pending}>Save draft</button>
        <button className="btn" name="intent" value="post" disabled={pending || !balanced}>{pending ? "Saving…" : "Save & post"}</button>
        <Link href={entryId ? `/journal/${entryId}` : "/journal"} className="ml-auto text-sm text-slate-500 hover:underline">Cancel</Link>
      </div>
    </form>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${ok ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
        {ok ? "✓" : "•"}
      </span>
      <span className={ok ? "" : "text-slate-500"}>{label}</span>
    </li>
  );
}
