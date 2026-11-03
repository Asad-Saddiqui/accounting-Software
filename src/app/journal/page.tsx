import Link from "next/link";
import { formatDate } from "@/lib/format";
import { journalStats, listJournal } from "@/lib/journal";
import { ENTRY_TYPES, formatPeriod } from "@/lib/journal-types";
import { Amount, Empty, PageHeader } from "@/components/ui";
import { EntryStatusBadge, TypeBadge } from "./badges";

const SOURCE_LABEL: Record<string, string> = { invoice: "Invoice", payment: "Payment", expense: "Expense", reversal: "Auto-reversal" };

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; period?: string; q?: string }>;
}) {
  const f = await searchParams;
  const entries = listJournal(f);
  const stats = journalStats();
  const filtered = !!(f.type || f.status || f.period || f.q);

  return (
    <>
      <PageHeader
        title="Journal Entries"
        description="Prepare, review and post entries. Invoices, payments and expenses post here automatically."
        actions={<Link href="/journal/new" className="btn">New journal entry</Link>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Link href="/journal?status=draft" className="card block hover:border-amber-300">
          <p className="text-sm text-slate-500">Drafts awaiting review</p>
          <p className="mt-1 text-2xl font-semibold">{stats.drafts}</p>
        </Link>
        <Link href="/journal?status=posted" className="card block hover:border-emerald-300">
          <p className="text-sm text-slate-500">Posted entries</p>
          <p className="mt-1 text-2xl font-semibold">{stats.posted}</p>
        </Link>
        <div className="card">
          <p className="text-sm text-slate-500">Scheduled reversals</p>
          <p className="mt-1 text-2xl font-semibold">{stats.upcomingReversals}</p>
        </div>
      </div>

      <div className="no-print mb-4 flex flex-wrap gap-2">
        <span className="self-center text-xs font-medium uppercase tracking-wide text-slate-400">Quick start:</span>
        {ENTRY_TYPES.filter((t) => t.value !== "general").map((t) => (
          <Link key={t.value} href={`/journal/new?type=${t.value}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm hover:border-indigo-300 hover:text-indigo-700">
            + {t.label}
          </Link>
        ))}
      </div>

      <form className="no-print card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_140px_170px_auto]">
        <input name="q" defaultValue={f.q} placeholder="Search memo, reference, preparer…" className="input" aria-label="Search" />
        <select name="type" defaultValue={f.type ?? ""} className="input" aria-label="Type">
          <option value="">All types</option>
          {ENTRY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select name="status" defaultValue={f.status ?? ""} className="input" aria-label="Status">
          <option value="">Any status</option>
          <option value="draft">Draft</option>
          <option value="posted">Posted</option>
        </select>
        <input type="month" name="period" defaultValue={f.period} className="input" aria-label="Period" />
        <div className="flex gap-2">
          <button className="btn">Filter</button>
          {filtered && <Link href="/journal" className="btn-secondary">Clear</Link>}
        </div>
      </form>

      <section className="card overflow-x-auto p-0">
        {entries.length === 0 ? (
          <Empty>{filtered ? "No entries match these filters." : "No journal entries yet."}</Empty>
        ) : (
          <table className="table min-w-[860px]">
            <thead>
              <tr><th className="pl-5">Number</th><th>Date</th><th>Period</th><th>Type</th><th>Memo</th><th>Prepared by</th><th>Status</th><th className="num pr-5">Amount</th></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className={`hover:bg-slate-50 ${e.status === "draft" ? "bg-amber-50/40" : ""}`}>
                  <td className="pl-5"><Link href={`/journal/${e.id}`} className="link font-medium">{e.number}</Link></td>
                  <td className="whitespace-nowrap">{formatDate(e.date)}</td>
                  <td className="whitespace-nowrap text-slate-500">{formatPeriod(e.period ?? e.date.slice(0, 7))}</td>
                  <td><TypeBadge type={e.entry_type} /></td>
                  <td className="max-w-xs">
                    <p className="truncate">{e.memo || "Journal entry"}</p>
                    {(SOURCE_LABEL[e.source] || e.reverse_on) && (
                      <p className="text-xs text-slate-400">
                        {SOURCE_LABEL[e.source]}
                        {e.reverse_on && !e.reversal_of ? `Reverses ${formatDate(e.reverse_on)}` : ""}
                      </p>
                    )}
                  </td>
                  <td className="text-slate-600">{e.prepared_by || "—"}</td>
                  <td><EntryStatusBadge status={e.status} /></td>
                  <td className="num pr-5">
                    <Amount value={e.total_debit} />
                    {e.total_debit !== e.total_credit && <p className="text-xs text-red-600">Unbalanced</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
