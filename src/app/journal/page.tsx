import Link from "next/link";
import { listEntries } from "@/lib/accounting";
import { deleteEntryAction } from "@/app/actions";
import { formatDate } from "@/lib/format";
import { DeleteButton } from "@/components/delete-button";
import { Amount, Empty, PageHeader } from "@/components/ui";

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  invoice: "Invoice",
  payment: "Payment",
  expense: "Expense",
};

export default function JournalPage() {
  const entries = listEntries();
  return (
    <>
      <PageHeader
        title="Journal Entries"
        description="Every transaction, in double-entry form. Invoices, payments and expenses post here automatically."
        actions={<Link href="/journal/new" className="btn">New journal entry</Link>}
      />
      {entries.length === 0 ? (
        <div className="card"><Empty>No journal entries yet.</Empty></div>
      ) : (
        <div className="space-y-4">
          {entries.map((e) => (
            <section key={e.id} className="card overflow-x-auto">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{e.memo || "Journal entry"}</p>
                  <p className="text-xs text-slate-500">
                    #{e.id} · {formatDate(e.date)} · {SOURCE_LABEL[e.source] ?? e.source}
                  </p>
                </div>
                {e.source === "manual" ? (
                  <form action={deleteEntryAction.bind(null, e.id)}>
                    <DeleteButton confirmText="Delete this journal entry?" />
                  </form>
                ) : e.source_id && e.source !== "expense" ? (
                  <Link href={`/invoices/${e.source_id}`} className="link text-sm">View invoice</Link>
                ) : null}
              </div>
              <table className="table">
                <thead>
                  <tr><th>Account</th><th>Description</th><th className="num">Debit</th><th className="num">Credit</th></tr>
                </thead>
                <tbody>
                  {e.lines.map((l) => (
                    <tr key={l.id}>
                      <td className={l.credit ? "pl-8" : ""}>
                        <Link href={`/accounts/${l.account_id}`} className="link">{l.account_code} · {l.account_name}</Link>
                      </td>
                      <td className="text-slate-500">{l.description}</td>
                      <td className="num">{l.debit ? <Amount value={l.debit} /> : ""}</td>
                      <td className="num">{l.credit ? <Amount value={l.credit} /> : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
