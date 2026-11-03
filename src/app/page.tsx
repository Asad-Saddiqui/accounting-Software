import Link from "next/link";
import { dashboard } from "@/lib/accounting";
import { formatDate, money } from "@/lib/format";
import { Amount, Empty, PageHeader, StatusBadge } from "@/components/ui";

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${value < 0 ? "text-red-600" : ""}`}>{money(value)}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const d = dashboard();
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your business at a glance."
        actions={
          <>
            <Link href="/invoices/new" className="btn">New invoice</Link>
            <Link href="/expenses" className="btn-secondary">Record expense</Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Cash & bank" value={d.cashTotal} hint={d.cashAccounts.map((a) => `${a.name}: ${money(a.balance)}`).join(" · ")} />
        <Stat label="Receivables" value={d.receivable} hint={d.overdueCount ? `${d.overdueCount} overdue invoice(s)` : "Nothing overdue"} />
        <Stat label="Income this month" value={d.month.totalIncome} hint={`Expenses: ${money(d.month.totalExpenses)}`} />
        <Stat label="Net profit this month" value={d.month.netIncome} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Unpaid invoices</h2>
            <Link href="/invoices" className="link text-sm">View all</Link>
          </div>
          {d.openInvoices.length === 0 ? (
            <Empty>No unpaid invoices.</Empty>
          ) : (
            <table className="table">
              <tbody>
                {d.openInvoices.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/invoices/${i.id}`} className="link">{i.number}</Link>
                      <div className="text-xs text-slate-500">{i.customer_name}</div>
                    </td>
                    <td className="text-xs text-slate-500">Due {formatDate(i.due_date)}</td>
                    <td><StatusBadge status={i.status} /></td>
                    <td className="num"><Amount value={i.balance} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent transactions</h2>
            <Link href="/journal" className="link text-sm">View journal</Link>
          </div>
          {d.recentEntries.length === 0 ? (
            <Empty>No transactions yet. Create an invoice or record an expense to get started.</Empty>
          ) : (
            <table className="table">
              <tbody>
                {d.recentEntries.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-xs text-slate-500">{formatDate(e.date)}</td>
                    <td>{e.memo || <span className="text-slate-400">No memo</span>}</td>
                    <td className="num"><Amount value={e.total} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
