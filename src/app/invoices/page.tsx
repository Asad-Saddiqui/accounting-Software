import Link from "next/link";
import { listInvoices } from "@/lib/accounting";
import { formatDate } from "@/lib/format";
import { Amount, Empty, PageHeader, StatusBadge } from "@/components/ui";

export default function InvoicesPage() {
  const invoices = listInvoices();
  const outstanding = invoices.reduce((s, i) => s + i.balance, 0);
  return (
    <>
      <PageHeader
        title="Invoices"
        description="Bill your customers and track what they owe."
        actions={<Link href="/invoices/new" className="btn">New invoice</Link>}
      />
      <section className="card overflow-x-auto">
        {invoices.length === 0 ? (
          <Empty>No invoices yet.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Number</th><th>Customer</th><th>Date</th><th>Due</th><th>Status</th><th className="num">Total</th><th className="num">Balance due</th></tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td><Link href={`/invoices/${i.id}`} className="link font-medium">{i.number}</Link></td>
                  <td>{i.customer_name}</td>
                  <td className="whitespace-nowrap">{formatDate(i.date)}</td>
                  <td className="whitespace-nowrap">{formatDate(i.due_date)}</td>
                  <td><StatusBadge status={i.status} /></td>
                  <td className="num"><Amount value={i.total} /></td>
                  <td className="num"><Amount value={i.balance} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={6} className="text-right font-semibold">Total outstanding</td><td className="num"><Amount value={outstanding} strong /></td></tr>
            </tfoot>
          </table>
        )}
      </section>
    </>
  );
}
