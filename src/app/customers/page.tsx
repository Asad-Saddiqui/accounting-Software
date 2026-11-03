import Link from "next/link";
import { listCustomers } from "@/lib/accounting";
import { createCustomerAction, deleteCustomerAction } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { DeleteButton } from "@/components/delete-button";
import { Amount, Empty, PageHeader } from "@/components/ui";

export default function CustomersPage() {
  const customers = listCustomers();
  return (
    <>
      <PageHeader title="Customers" description="People and businesses you invoice." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="card overflow-x-auto">
          {customers.length === 0 ? (
            <Empty>No customers yet. Add your first one.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Contact</th><th className="num">Invoiced</th><th className="num">Outstanding</th><th /></tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <p className="font-medium">{c.name}</p>
                      {c.address && <p className="text-xs text-slate-500">{c.address}</p>}
                    </td>
                    <td className="text-slate-600">
                      {c.email && <div>{c.email}</div>}
                      {c.phone && <div>{c.phone}</div>}
                    </td>
                    <td className="num"><Amount value={c.invoiced} /><div className="text-xs text-slate-400">{c.invoice_count} invoice(s)</div></td>
                    <td className="num"><Amount value={c.invoiced - c.paid} /></td>
                    <td className="num">
                      {c.invoice_count === 0 ? (
                        <form action={deleteCustomerAction.bind(null, c.id)}>
                          <DeleteButton confirmText={`Delete ${c.name}?`} />
                        </form>
                      ) : (
                        <Link href={`/invoices/new?customer=${c.id}`} className="link">New invoice</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card h-fit">
          <h2 className="mb-4 font-semibold">Add customer</h2>
          <ActionForm action={createCustomerAction} className="space-y-3">
            <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" className="input" required /></div>
            <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" /></div>
            <div><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" className="input" /></div>
            <div><label className="label" htmlFor="address">Address</label><textarea id="address" name="address" rows={2} className="input" /></div>
            <button className="btn w-full">Add customer</button>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
