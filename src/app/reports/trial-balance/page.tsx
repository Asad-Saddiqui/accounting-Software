import Link from "next/link";
import { trialBalance } from "@/lib/accounting";
import { formatDate, isDate, today } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import { DateFilter } from "@/components/report";
import { Amount, Empty, PageHeader } from "@/components/ui";

export default async function TrialBalancePage({ searchParams }: { searchParams: Promise<{ asOf?: string }> }) {
  const sp = await searchParams;
  const asOf = sp.asOf && isDate(sp.asOf) ? sp.asOf : today();
  const r = trialBalance(asOf);

  return (
    <>
      <PageHeader title="Trial Balance" description={`As of ${formatDate(asOf)}`} actions={<PrintButton />} />
      <DateFilter fields={[{ name: "asOf", label: "As of", value: asOf }]} />
      <section className="card overflow-x-auto">
        {r.rows.length === 0 ? (
          <Empty>No balances yet.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Code</th><th>Account</th><th>Type</th><th className="num">Debit</th><th className="num">Credit</th></tr>
            </thead>
            <tbody>
              {r.rows.map((a) => (
                <tr key={a.id}>
                  <td className="text-slate-500">{a.code}</td>
                  <td><Link href={`/accounts/${a.id}`} className="hover:underline">{a.name}</Link></td>
                  <td className="capitalize text-slate-500">{a.type}</td>
                  <td className="num">{a.debitBalance ? <Amount value={a.debitBalance} /> : ""}</td>
                  <td className="num">{a.creditBalance ? <Amount value={a.creditBalance} /> : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50">
                <td colSpan={3} className="font-semibold">Total</td>
                <td className="num"><Amount value={r.totalDebit} strong /></td>
                <td className="num"><Amount value={r.totalCredit} strong /></td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>
    </>
  );
}
