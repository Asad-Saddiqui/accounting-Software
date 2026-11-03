import Link from "next/link";
import { notFound } from "next/navigation";
import { accountLedger, getAccount } from "@/lib/accounting";
import { deleteAccountAction } from "@/app/actions";
import { formatDate } from "@/lib/format";
import { DeleteButton } from "@/components/delete-button";
import { Amount, Empty, PageHeader } from "@/components/ui";

function sourceLink(source: string, sourceId: number | null) {
  if (sourceId && (source === "invoice" || source === "payment")) return `/invoices/${sourceId}`;
  if (source === "expense") return "/expenses";
  return "/journal";
}

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const account = getAccount(id);
  if (!account) notFound();
  const ledger = accountLedger(id);
  const balance = ledger.at(-1)?.balance ?? 0;

  return (
    <>
      <PageHeader
        title={`${account.code} · ${account.name}`}
        description={`${account.type[0].toUpperCase()}${account.type.slice(1)} account${account.description ? ` — ${account.description}` : ""}`}
        actions={
          <>
            <Link href="/accounts" className="btn-secondary">Back</Link>
            {ledger.length === 0 && !account.system_key && (
              <form action={deleteAccountAction.bind(null, id)}>
                <DeleteButton confirmText={`Delete account ${account.name}?`} />
              </form>
            )}
          </>
        }
      />
      <section className="card overflow-x-auto">
        <div className="mb-3 flex justify-between">
          <h2 className="font-semibold">Ledger</h2>
          <p className="text-sm">Balance: <Amount value={balance} strong /></p>
        </div>
        {ledger.length === 0 ? (
          <Empty>No transactions in this account yet.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Description</th><th className="num">Debit</th><th className="num">Credit</th><th className="num">Balance</th></tr>
            </thead>
            <tbody>
              {ledger.map((r, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap">{formatDate(r.date)}</td>
                  <td>
                    <Link href={sourceLink(r.source, r.source_id)} className="link">{r.memo || "Journal entry"}</Link>
                    {r.description && <div className="text-xs text-slate-500">{r.description}</div>}
                  </td>
                  <td className="num">{r.debit ? <Amount value={r.debit} /> : ""}</td>
                  <td className="num">{r.credit ? <Amount value={r.credit} /> : ""}</td>
                  <td className="num"><Amount value={r.balance} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
