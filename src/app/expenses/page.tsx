import { listAccounts, listExpenses } from "@/lib/accounting";
import { createExpenseAction, deleteExpenseAction } from "@/app/actions";
import { formatDate, today } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { DeleteButton } from "@/components/delete-button";
import { Amount, Empty, PageHeader } from "@/components/ui";

export default function ExpensesPage() {
  const expenses = listExpenses();
  const accounts = listAccounts();
  const categories = accounts.filter((a) => a.type === "expense");
  const payFrom = accounts.filter((a) => a.is_cash || a.type === "liability");
  const total = expenses.reduce((s, x) => s + x.amount, 0);

  return (
    <>
      <PageHeader title="Expenses" description="Money your business spends. Each expense posts to the journal automatically." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="card overflow-x-auto">
          {expenses.length === 0 ? (
            <Empty>No expenses recorded yet.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Payee</th><th>Category</th><th>Paid from</th><th className="num">Amount</th><th /></tr>
              </thead>
              <tbody>
                {expenses.map((x) => (
                  <tr key={x.id}>
                    <td className="whitespace-nowrap">{formatDate(x.date)}</td>
                    <td>{x.payee}{x.description && <div className="text-xs text-slate-500">{x.description}</div>}</td>
                    <td>{x.expense_account_name}</td>
                    <td>{x.paid_from_account_name}</td>
                    <td className="num"><Amount value={x.amount} /></td>
                    <td className="num">
                      <form action={deleteExpenseAction.bind(null, x.id)}>
                        <DeleteButton confirmText="Delete this expense?" />
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={4} className="text-right font-semibold">Total</td><td className="num"><Amount value={total} strong /></td><td /></tr>
              </tfoot>
            </table>
          )}
        </section>

        <section className="card h-fit">
          <h2 className="mb-4 font-semibold">Record expense</h2>
          <ActionForm action={createExpenseAction} className="space-y-3">
            <div><label className="label" htmlFor="date">Date</label><input id="date" name="date" type="date" defaultValue={today()} className="input" required /></div>
            <div><label className="label" htmlFor="payee">Payee</label><input id="payee" name="payee" className="input" placeholder="e.g. K-Electric" required /></div>
            <div><label className="label" htmlFor="amount">Amount</label><input id="amount" name="amount" inputMode="decimal" className="input" placeholder="0.00" required /></div>
            <div>
              <label className="label" htmlFor="expense_account_id">Category</label>
              <select id="expense_account_id" name="expense_account_id" className="input">
                {categories.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="paid_from_account_id">Paid from</label>
              <select id="paid_from_account_id" name="paid_from_account_id" className="input">
                {payFrom.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div><label className="label" htmlFor="description">Description</label><input id="description" name="description" className="input" /></div>
            <button className="btn w-full">Save expense</button>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
