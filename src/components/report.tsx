import Link from "next/link";
import type { AccountWithBalance } from "@/lib/accounting";
import { Amount } from "./ui";

/** GET form for picking report dates; values land in the URL so reports are shareable. */
export function DateFilter({ fields }: { fields: { name: string; label: string; value: string }[] }) {
  return (
    <form className="no-print card mb-6 flex flex-wrap items-end gap-3">
      {fields.map((f) => (
        <div key={f.name}>
          <label className="label" htmlFor={f.name}>{f.label}</label>
          <input id={f.name} name={f.name} type="date" defaultValue={f.value} className="input" />
        </div>
      ))}
      <button className="btn">Run report</button>
    </form>
  );
}

export function ReportSection({
  title,
  accounts,
  total,
  totalLabel,
  extra,
}: {
  title: string;
  accounts: AccountWithBalance[];
  total: number;
  totalLabel: string;
  extra?: { label: string; value: number }[];
}) {
  return (
    <table className="table mb-6">
      <thead>
        <tr><th colSpan={2}>{title}</th></tr>
      </thead>
      <tbody>
        {accounts.length === 0 && !extra?.length && (
          <tr><td colSpan={2} className="text-slate-400">None</td></tr>
        )}
        {accounts.map((a) => (
          <tr key={a.id}>
            <td className="pl-6"><Link href={`/accounts/${a.id}`} className="hover:underline">{a.code} · {a.name}</Link></td>
            <td className="num"><Amount value={a.balance} /></td>
          </tr>
        ))}
        {extra?.map((e) => (
          <tr key={e.label}>
            <td className="pl-6">{e.label}</td>
            <td className="num"><Amount value={e.value} /></td>
          </tr>
        ))}
        <tr className="bg-slate-50">
          <td className="font-semibold">{totalLabel}</td>
          <td className="num"><Amount value={total} strong /></td>
        </tr>
      </tbody>
    </table>
  );
}
