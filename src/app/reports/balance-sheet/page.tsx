import { balanceSheet } from "@/lib/accounting";
import { formatDate, isDate, today } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import { DateFilter, ReportSection } from "@/components/report";
import { Amount, PageHeader } from "@/components/ui";

export default async function BalanceSheetPage({ searchParams }: { searchParams: Promise<{ asOf?: string }> }) {
  const sp = await searchParams;
  const asOf = sp.asOf && isDate(sp.asOf) ? sp.asOf : today();
  const r = balanceSheet(asOf);
  const totalLE = r.totalLiabilities + r.totalEquity;
  const balanced = totalLE === r.totalAssets;

  return (
    <>
      <PageHeader title="Balance Sheet" description={`As of ${formatDate(asOf)}`} actions={<PrintButton />} />
      <DateFilter fields={[{ name: "asOf", label: "As of", value: asOf }]} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-x-auto">
          <ReportSection title="Assets" accounts={r.assets} total={r.totalAssets} totalLabel="Total assets" />
        </section>
        <section className="card overflow-x-auto">
          <ReportSection title="Liabilities" accounts={r.liabilities} total={r.totalLiabilities} totalLabel="Total liabilities" />
          <ReportSection
            title="Equity"
            accounts={r.equity}
            total={r.totalEquity}
            totalLabel="Total equity"
            extra={[{ label: "Retained earnings (net profit to date)", value: r.retainedEarnings }]}
          />
          <div className="flex justify-between rounded-lg bg-indigo-50 px-3 py-3 font-semibold">
            <span>Total liabilities & equity</span>
            <Amount value={totalLE} strong />
          </div>
        </section>
      </div>
      <p className={`mt-4 text-sm ${balanced ? "text-emerald-600" : "text-red-600"}`}>
        {balanced ? "✓ Assets equal liabilities plus equity." : "Warning: the balance sheet does not balance."}
      </p>
    </>
  );
}
