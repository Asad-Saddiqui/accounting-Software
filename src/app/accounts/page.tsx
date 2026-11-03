import Link from "next/link";
import { ACCOUNT_TYPES, accountBalances } from "@/lib/accounting";
import { createAccountAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Amount, PageHeader } from "@/components/ui";

export default function AccountsPage() {
  const accounts = accountBalances();
  return (
    <>
      <PageHeader title="Chart of Accounts" description="Every account your transactions are recorded in." />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {ACCOUNT_TYPES.map((t) => {
            const list = accounts.filter((a) => a.type === t.value);
            return (
              <section key={t.value} className="card overflow-x-auto">
                <h2 className="mb-2 font-semibold">{t.label}</h2>
                <table className="table">
                  <thead>
                    <tr><th className="w-20">Code</th><th>Name</th><th className="num">Balance</th></tr>
                  </thead>
                  <tbody>
                    {list.map((a) => (
                      <tr key={a.id}>
                        <td className="text-slate-500 tabular-nums">{a.code}</td>
                        <td>
                          <Link href={`/accounts/${a.id}`} className="link">{a.name}</Link>
                          {a.is_cash ? <span className="ml-2 rounded bg-sky-50 px-1.5 text-xs text-sky-700">cash</span> : null}
                          {a.system_key ? <span className="ml-2 rounded bg-slate-100 px-1.5 text-xs text-slate-500">system</span> : null}
                        </td>
                        <td className="num"><Amount value={a.balance} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>

        <section className="card h-fit lg:sticky lg:top-8">
          <h2 className="mb-4 font-semibold">Add account</h2>
          <ActionForm action={createAccountAction} className="space-y-3">
            <div>
              <label className="label" htmlFor="code">Code</label>
              <input id="code" name="code" className="input" placeholder="e.g. 6600" required />
            </div>
            <div>
              <label className="label" htmlFor="name">Name</label>
              <input id="name" name="name" className="input" placeholder="e.g. Travel Expense" required />
            </div>
            <div>
              <label className="label" htmlFor="type">Type</label>
              <select id="type" name="type" className="input" defaultValue="expense">
                {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_cash" /> Cash or bank account (assets only)
            </label>
            <div>
              <label className="label" htmlFor="description">Description</label>
              <input id="description" name="description" className="input" />
            </div>
            <button className="btn w-full">Add account</button>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
