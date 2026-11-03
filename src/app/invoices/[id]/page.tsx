import Link from "next/link";
import { notFound } from "next/navigation";
import { getInvoice, listAccounts } from "@/lib/accounting";
import { deleteInvoiceAction, recordPaymentAction } from "@/app/actions";
import { formatDate, today } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { DeleteButton } from "@/components/delete-button";
import { PrintButton } from "@/components/print-button";
import { Amount, PageHeader, StatusBadge } from "@/components/ui";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const inv = getInvoice(id);
  if (!inv) notFound();
  const cashAccounts = listAccounts().filter((a) => a.is_cash);

  return (
    <>
      <PageHeader
        title={`Invoice ${inv.number}`}
        actions={
          <>
            <Link href="/invoices" className="btn-secondary">Back</Link>
            <PrintButton />
            <form action={deleteInvoiceAction.bind(null, id)}>
              <DeleteButton confirmText={`Delete ${inv.number} and its payments? This also removes the journal entries.`} />
            </form>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <article className="card">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <p className="text-xs uppercase text-slate-400">Bill to</p>
              <p className="font-semibold">{inv.customer.name}</p>
              {inv.customer.address && <p className="whitespace-pre-line text-sm text-slate-600">{inv.customer.address}</p>}
              {inv.customer.email && <p className="text-sm text-slate-600">{inv.customer.email}</p>}
              {inv.customer.phone && <p className="text-sm text-slate-600">{inv.customer.phone}</p>}
            </div>
            <div className="text-right text-sm">
              <p className="text-2xl font-semibold">{inv.number}</p>
              <p>Date: {formatDate(inv.date)}</p>
              <p>Due: {formatDate(inv.due_date)}</p>
              <p className="mt-1"><StatusBadge status={inv.status} /></p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Description</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Amount</th></tr>
              </thead>
              <tbody>
                {inv.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.description}<div className="no-print text-xs text-slate-400">{it.account_name}</div></td>
                    <td className="num">{it.quantity}</td>
                    <td className="num"><Amount value={it.unit_price} /></td>
                    <td className="num"><Amount value={it.amount} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3} className="text-right font-semibold">Total</td><td className="num"><Amount value={inv.total} strong /></td></tr>
                <tr><td colSpan={3} className="text-right">Paid</td><td className="num"><Amount value={inv.paid} /></td></tr>
                <tr><td colSpan={3} className="text-right font-semibold">Balance due</td><td className="num"><Amount value={inv.balance} strong /></td></tr>
              </tfoot>
            </table>
          </div>
          {inv.notes && <p className="mt-4 whitespace-pre-line text-sm text-slate-600">{inv.notes}</p>}
        </article>

        <div className="no-print space-y-6">
          {inv.balance > 0 && (
            <section className="card">
              <h2 className="mb-4 font-semibold">Record payment</h2>
              <ActionForm action={recordPaymentAction.bind(null, id)} className="space-y-3">
                <div><label className="label" htmlFor="date">Date</label><input id="date" name="date" type="date" defaultValue={today()} className="input" required /></div>
                <div>
                  <label className="label" htmlFor="amount">Amount</label>
                  <input id="amount" name="amount" inputMode="decimal" defaultValue={(inv.balance / 100).toFixed(2)} className="input" required />
                </div>
                <div>
                  <label className="label" htmlFor="account_id">Deposit to</label>
                  <select id="account_id" name="account_id" className="input">
                    {cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <button className="btn w-full">Record payment</button>
              </ActionForm>
            </section>
          )}
          <section className="card">
            <h2 className="mb-2 font-semibold">Payments</h2>
            {inv.payments.length === 0 ? (
              <p className="text-sm text-slate-500">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {inv.payments.map((p) => (
                  <li key={p.id} className="flex justify-between py-2">
                    <span>{formatDate(p.date)}<span className="block text-xs text-slate-500">{p.account_name}</span></span>
                    <Amount value={p.amount} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
