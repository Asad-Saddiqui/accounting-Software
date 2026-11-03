"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createInvoiceAction } from "@/app/actions";
import { money, toCents } from "@/lib/format";

type Item = { description: string; quantity: string; unitPrice: string; accountId: string };

export function InvoiceForm({
  customers,
  incomeAccounts,
  defaultCustomer,
  defaultDate,
  defaultDueDate,
}: {
  customers: { id: number; name: string }[];
  incomeAccounts: { id: number; label: string }[];
  defaultCustomer: string;
  defaultDate: string;
  defaultDueDate: string;
}) {
  const defaultAccount = String(incomeAccounts[0]?.id ?? "");
  const blank = (): Item => ({ description: "", quantity: "1", unitPrice: "", accountId: defaultAccount });

  const [fields, setFields] = useState({
    customer_id: defaultCustomer,
    date: defaultDate,
    due_date: defaultDueDate,
    notes: "",
  });
  const [items, setItems] = useState<Item[]>([blank()]);
  const [state, action, pending] = useActionState(createInvoiceAction, undefined);

  const set = (patch: Partial<typeof fields>) => setFields((f) => ({ ...f, ...patch }));
  const update = (i: number, patch: Partial<Item>) =>
    setItems((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const lineTotal = (it: Item) => Math.round((Number(it.quantity) || 0) * (toCents(it.unitPrice) || 0));
  const total = items.reduce((s, it) => s + lineTotal(it), 0);

  return (
    <form action={action} className="card space-y-5">
      {state?.error && <p className="alert-error">{state.error}</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="customer_id">Customer</label>
          <select id="customer_id" name="customer_id" className="input" required value={fields.customer_id}
            onChange={(e) => set({ customer_id: e.target.value })}>
            <option value="">Select customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="date">Invoice date</label>
          <input id="date" name="date" type="date" className="input" required value={fields.date}
            onChange={(e) => set({ date: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="due_date">Due date</label>
          <input id="due_date" name="due_date" type="date" className="input" required value={fields.due_date}
            onChange={(e) => set({ due_date: e.target.value })} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table min-w-[720px]">
          <thead>
            <tr><th>Description</th><th className="w-24">Qty</th><th className="w-36">Price</th><th className="w-56">Income account</th><th className="num w-32">Amount</th><th className="w-10" /></tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td><input className="input" value={it.description} required placeholder="Product or service"
                  onChange={(e) => update(i, { description: e.target.value })} /></td>
                <td><input className="input text-right" inputMode="decimal" value={it.quantity}
                  onChange={(e) => update(i, { quantity: e.target.value })} /></td>
                <td><input className="input text-right" inputMode="decimal" value={it.unitPrice} placeholder="0.00"
                  onChange={(e) => update(i, { unitPrice: e.target.value })} /></td>
                <td>
                  <select className="input" value={it.accountId} onChange={(e) => update(i, { accountId: e.target.value })}>
                    {incomeAccounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                </td>
                <td className="num pt-4">{money(lineTotal(it))}</td>
                <td>
                  {items.length > 1 && (
                    <button type="button" className="pt-2 text-slate-400 hover:text-red-600" aria-label="Remove item"
                      onClick={() => setItems((list) => list.filter((_, j) => j !== i))}>✕</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>
                <button type="button" className="btn-secondary" onClick={() => setItems((list) => [...list, blank()])}>Add item</button>
              </td>
              <td className="num text-base font-semibold">{money(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div>
        <label className="label" htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={2} className="input" placeholder="Payment instructions, thank-you note…"
          value={fields.notes} onChange={(e) => set({ notes: e.target.value })} />
      </div>

      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <div className="flex gap-2">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Create invoice"}</button>
        <Link href="/invoices" className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
