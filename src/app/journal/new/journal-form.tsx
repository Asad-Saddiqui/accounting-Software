"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createEntryAction } from "@/app/actions";
import { money, toCents } from "@/lib/format";

type Line = { accountId: string; debit: string; credit: string; description: string };
const blank = (): Line => ({ accountId: "", debit: "", credit: "", description: "" });

export function JournalForm({
  accounts,
  defaultDate,
}: {
  accounts: { id: number; label: string }[];
  defaultDate: string;
}) {
  const [lines, setLines] = useState<Line[]>([blank(), blank()]);
  const [state, action, pending] = useActionState(createEntryAction, undefined);

  const update = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const debits = lines.reduce((s, l) => s + (toCents(l.debit) || 0), 0);
  const credits = lines.reduce((s, l) => s + (toCents(l.credit) || 0), 0);
  const balanced = debits > 0 && debits === credits;

  return (
    <form action={action} className="card space-y-5">
      {state?.error && <p className="alert-error">{state.error}</p>}
      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <div>
          <label className="label" htmlFor="date">Date</label>
          <input id="date" type="date" name="date" defaultValue={defaultDate} className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="memo">Memo</label>
          <input id="memo" name="memo" className="input" placeholder="e.g. Owner invested capital" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table min-w-[640px]">
          <thead>
            <tr><th>Account</th><th>Description</th><th className="num w-36">Debit</th><th className="num w-36">Credit</th><th className="w-10" /></tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td>
                  <select className="input" value={l.accountId} onChange={(e) => update(i, { accountId: e.target.value })} required>
                    <option value="">Select account…</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                </td>
                <td><input className="input" value={l.description} onChange={(e) => update(i, { description: e.target.value })} /></td>
                <td>
                  <input className="input text-right" inputMode="decimal" value={l.debit} placeholder="0.00"
                    onChange={(e) => update(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} />
                </td>
                <td>
                  <input className="input text-right" inputMode="decimal" value={l.credit} placeholder="0.00"
                    onChange={(e) => update(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} />
                </td>
                <td>
                  {lines.length > 2 && (
                    <button type="button" className="text-slate-400 hover:text-red-600" aria-label="Remove line"
                      onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>✕</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>
                <button type="button" className="btn-secondary" onClick={() => setLines((ls) => [...ls, blank()])}>Add line</button>
              </td>
              <td className="num font-semibold">{money(debits)}</td>
              <td className="num font-semibold">{money(credits)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className={`text-sm ${balanced ? "text-emerald-600" : "text-amber-600"}`}>
        {balanced ? "Entry is balanced." : `Difference: ${money(Math.abs(debits - credits))}`}
      </p>

      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <div className="flex gap-2">
        <button className="btn" disabled={pending || !balanced}>{pending ? "Saving…" : "Save entry"}</button>
        <Link href="/journal" className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
