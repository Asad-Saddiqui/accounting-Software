import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteJournalAction, postJournalAction, reverseJournalAction } from "@/app/actions";
import { formatDate, money } from "@/lib/format";
import { getEntry, priorPeriodEntry, reviewChecklist, type CheckStatus, type JeDetail } from "@/lib/journal";
import { entryType, formatPeriod, jeNumber, nextPeriodStart } from "@/lib/journal-types";
import { ActionForm } from "@/components/action-form";
import { DeleteButton } from "@/components/delete-button";
import { PrintButton } from "@/components/print-button";
import { Amount, PageHeader } from "@/components/ui";
import { EntryStatusBadge, TypeBadge } from "../badges";

const CHECK_STYLE: Record<CheckStatus, { icon: string; cls: string }> = {
  pass: { icon: "✓", cls: "bg-emerald-100 text-emerald-700" },
  warn: { icon: "!", cls: "bg-amber-100 text-amber-700" },
  fail: { icon: "✕", cls: "bg-red-100 text-red-700" },
  info: { icon: "i", cls: "bg-slate-100 text-slate-500" },
};

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const e = getEntry(id);
  if (!e) notFound();
  const def = entryType(e.entry_type);
  const prior = priorPeriodEntry(e);
  const checks = reviewChecklist(e, prior);
  const flagged = checks.filter((c) => c.status === "warn" || c.status === "fail");
  const editable = e.source === "manual" || e.source === "reversal";
  const sourceHref = e.source_id && (e.source === "invoice" || e.source === "payment") ? `/invoices/${e.source_id}` : e.source === "expense" ? "/expenses" : null;

  return (
    <>
      <PageHeader
        title={e.number}
        actions={
          <>
            <Link href="/journal" className="btn-secondary">Back</Link>
            <PrintButton />
            <a href={`/journal/${id}/export`} className="btn-secondary">Export CSV</a>
            {e.status === "draft" && <Link href={`/journal/${id}/edit`} className="btn-secondary">Edit</Link>}
            {editable && (
              <form action={deleteJournalAction.bind(null, id)}>
                <DeleteButton confirmText={`Delete ${e.number}${e.reversal ? " and its reversal" : ""}?`} />
              </form>
            )}
          </>
        }
      />

      {e.status === "draft" && (
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            <strong>Draft.</strong> This entry does not affect the ledger or reports until it is posted.
            {flagged.length > 0 && ` ${flagged.length} review item(s) need attention.`}
          </p>
          <ActionForm action={postJournalAction.bind(null, id)} className="flex flex-wrap items-center gap-2">
            <button className="btn" disabled={e.total_debit !== e.total_credit}>Post entry</button>
          </ActionForm>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {/* The entry, in standard journal format */}
          <article className="card">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Journal Entry</p>
                <h2 className="text-lg font-semibold">{def.label} — {formatPeriod(e.period)}</h2>
                {e.memo !== `${def.label} — ${formatPeriod(e.period)}` && <p className="mt-1 text-sm text-slate-600">{e.memo}</p>}
              </div>
              <div className="flex gap-2"><TypeBadge type={e.entry_type} /><EntryStatusBadge status={e.status} /></div>
            </div>
            <dl className="grid gap-x-6 gap-y-2 py-4 text-sm sm:grid-cols-4">
              <Meta label="Date" value={formatDate(e.date)} />
              <Meta label="Prepared by" value={e.prepared_by || "—"} />
              <Meta label="Reference" value={e.reference || "—"} />
              <Meta label="Posted" value={e.posted_at ? formatDate(e.posted_at.slice(0, 10)) : "Not posted"} />
            </dl>

            <div className="-mx-5 overflow-x-auto px-5">
              <table className="table min-w-[680px]">
                <thead>
                  <tr><th className="w-10">Line</th><th className="w-20">Code</th><th>Account</th><th className="num">Debit</th><th className="num">Credit</th><th>Department</th><th>Memo</th></tr>
                </thead>
                <tbody>
                  {e.lines.map((l, i) => (
                    <tr key={l.id}>
                      <td className="text-slate-400">{i + 1}</td>
                      <td className="tabular-nums text-slate-500">{l.account_code}</td>
                      <td className={`whitespace-nowrap ${l.credit ? "pl-8" : ""}`}><Link href={`/accounts/${l.account_id}`} className="hover:underline">{l.account_name}</Link></td>
                      <td className="num">{l.debit ? <Amount value={l.debit} /> : ""}</td>
                      <td className="num">{l.credit ? <Amount value={l.credit} /> : ""}</td>
                      <td className="text-slate-600">{l.department || "—"}</td>
                      <td className="text-slate-600">{l.description}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50">
                    <td colSpan={3} className="text-right font-semibold">Total</td>
                    <td className="num"><Amount value={e.total_debit} strong /></td>
                    <td className="num"><Amount value={e.total_credit} strong /></td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <h3 className="mb-1 font-semibold">Supporting detail</h3>
                <p className="whitespace-pre-line text-slate-600">{e.supporting_detail || "None provided."}</p>
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Reversal</h3>
                <ReversalInfo e={e} />
                {sourceHref && <p className="mt-2"><Link href={sourceHref} className="link">View source document</Link></p>}
              </div>
            </div>
          </article>

          {/* Prior period comparison */}
          <section className="card">
            <h2 className="mb-3 font-semibold">Comparison to prior period</h2>
            {prior ? <Comparison current={e} prior={prior} /> : (
              <p className="text-sm text-slate-500">
                {e.entry_type === "general" ? "Comparison applies to recurring entry types only." : `No earlier posted ${def.short} entry to compare with.`}
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Review checklist</h2>
              <span className="text-xs text-slate-500">{checks.filter((c) => c.status === "pass").length}/{checks.length} passed</span>
            </div>
            <ul className="space-y-3">
              {checks.map((c) => (
                <li key={c.label} className="flex gap-3">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${CHECK_STYLE[c.status].cls}`}>
                    {CHECK_STYLE[c.status].icon}
                  </span>
                  <div className="text-sm">
                    <p className="font-medium">{c.label}</p>
                    <p className="text-xs text-slate-500">{c.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {e.status === "posted" && !e.reversal && !e.reversal_of && editable && (
            <section className="card no-print">
              <h2 className="mb-1 font-semibold">Reverse entry</h2>
              <p className="mb-3 text-xs text-slate-500">Posts an equal and opposite entry. Posted entries are never edited.</p>
              <ActionForm action={reverseJournalAction.bind(null, id)} className="space-y-3">
                <input type="date" name="date" defaultValue={nextPeriodStart(e.period ?? e.date.slice(0, 7))} className="input" aria-label="Reversal date" required />
                <button className="btn-secondary w-full">Post reversal</button>
              </ActionForm>
            </section>
          )}

          <section className="card text-sm">
            <h2 className="mb-2 font-semibold">Posting</h2>
            <p className="text-slate-600">
              {e.status === "posted"
                ? "Posted to the general ledger. It is included in all balances and reports."
                : "Post from this page, or export the CSV to upload into another ERP (columns: account code, debit, credit, department, memo)."}
            </p>
            <p className="mt-3 text-xs text-slate-400">Entries should be reviewed by a qualified accountant before posting.</p>
          </section>
        </aside>
      </div>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function ReversalInfo({ e }: { e: JeDetail }) {
  if (e.reversal_of)
    return <p className="text-slate-600">This entry reverses <Link href={`/journal/${e.reversal_of}`} className="link">{jeNumber(e.reversal_of)}</Link>.</p>;
  if (e.reversal)
    return <p className="text-slate-600">Yes — reversed by <Link href={`/journal/${e.reversal.id}`} className="link">{jeNumber(e.reversal.id)}</Link> on {formatDate(e.reversal.date)}.</p>;
  if (e.reverse_on) return <p className="text-slate-600">Yes — will reverse on {formatDate(e.reverse_on)} when posted.</p>;
  return <p className="text-slate-600">No</p>;
}

function Comparison({ current, prior }: { current: JeDetail; prior: JeDetail }) {
  const byAccount = (x: JeDetail) => {
    const m = new Map<string, { name: string; amount: number }>();
    for (const l of x.lines) {
      const k = l.account_code;
      const prev = m.get(k) ?? { name: l.account_name, amount: 0 };
      m.set(k, { name: l.account_name, amount: prev.amount + l.debit - l.credit });
    }
    return m;
  };
  const now = byAccount(current);
  const before = byAccount(prior);
  const codes = [...new Set([...now.keys(), ...before.keys()])].sort();
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <p className="mb-2 text-sm text-slate-500">
        vs <Link href={`/journal/${prior.id}`} className="link">{prior.number}</Link> ({formatPeriod(prior.period)}), net amount per account.
      </p>
      <table className="table min-w-[520px]">
        <thead>
          <tr><th>Account</th><th className="num">{formatPeriod(prior.period)}</th><th className="num">{formatPeriod(current.period)}</th><th className="num">Change</th></tr>
        </thead>
        <tbody>
          {codes.map((code) => {
            const a = before.get(code)?.amount ?? 0;
            const b = now.get(code)?.amount ?? 0;
            // Compare magnitudes so a growing credit balance reads as an increase.
            const pct = a ? Math.round(((Math.abs(b) - Math.abs(a)) / Math.abs(a)) * 100) : null;
            return (
              <tr key={code}>
                <td>{code} · {(now.get(code) ?? before.get(code))!.name}</td>
                <td className="num"><DrCr value={a} /></td>
                <td className="num"><DrCr value={b} /></td>
                <td className={`num ${pct !== null && Math.abs(pct) > 25 ? "font-semibold text-amber-600" : "text-slate-500"}`}>
                  {pct === null ? "new" : `${pct >= 0 ? "+" : ""}${pct}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DrCr({ value }: { value: number }) {
  if (!value) return <span className="text-slate-400">—</span>;
  return (
    <span className="tabular-nums">
      {money(Math.abs(value))} <span className="text-xs text-slate-400">{value > 0 ? "Dr" : "Cr"}</span>
    </span>
  );
}
