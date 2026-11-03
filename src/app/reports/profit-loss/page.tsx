import { profitAndLoss } from "@/lib/accounting";
import { formatDate, isDate, today, yearStart } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import { DateFilter, ReportSection } from "@/components/report";
import { Amount, PageHeader } from "@/components/ui";

export default async function ProfitLossPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const from = sp.from && isDate(sp.from) ? sp.from : yearStart();
  const to = sp.to && isDate(sp.to) ? sp.to : today();
  const r = profitAndLoss(from, to);

  return (
    <>
      <PageHeader title="Profit & Loss" description={`${formatDate(from)} – ${formatDate(to)}`} actions={<PrintButton />} />
      <DateFilter fields={[{ name: "from", label: "From", value: from }, { name: "to", label: "To", value: to }]} />
      <section className="card overflow-x-auto">
        <ReportSection title="Income" accounts={r.income} total={r.totalIncome} totalLabel="Total income" />
        <ReportSection title="Expenses" accounts={r.expenses} total={r.totalExpenses} totalLabel="Total expenses" />
        <div className="flex justify-between rounded-lg bg-indigo-50 px-3 py-3 text-base font-semibold">
          <span>{r.netIncome >= 0 ? "Net profit" : "Net loss"}</span>
          <Amount value={r.netIncome} strong />
        </div>
      </section>
    </>
  );
}
