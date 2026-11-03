import { notFound, redirect } from "next/navigation";
import { listAccounts } from "@/lib/accounting";
import { getEntry } from "@/lib/journal";
import { entryType, nextPeriodStart } from "@/lib/journal-types";
import { PageHeader } from "@/components/ui";
import { JournalForm, type FormValues } from "../../journal-form";

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const e = getEntry(id);
  if (!e) notFound();
  if (e.status !== "draft") redirect(`/journal/${id}`);

  const def = entryType(e.entry_type);
  const period = e.period ?? e.date.slice(0, 7);
  const accounts = listAccounts().map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type }));
  const initial: FormValues = {
    entryType: def.value,
    period,
    date: e.date,
    memo: e.memo,
    reference: e.reference ?? "",
    preparedBy: e.prepared_by ?? "",
    supportingDetail: e.supporting_detail ?? "",
    reverse: !!e.reverse_on,
    reverseOn: e.reverse_on ?? nextPeriodStart(period),
    lines: e.lines.map((l) => {
      // Re-link lines to template keys so the calculator still works on drafts.
      const t = def.template.find((t) => t.accountCode === l.account_code && t.side === (l.debit ? "debit" : "credit"));
      return {
        key: t?.key,
        side: t?.side,
        accountId: String(l.account_id),
        description: l.description ?? "",
        department: l.department ?? "",
        debit: l.debit ? (l.debit / 100).toFixed(2) : "",
        credit: l.credit ? (l.credit / 100).toFixed(2) : "",
      };
    }),
  };

  return (
    <>
      <PageHeader title={`Edit draft ${e.number}`} />
      <JournalForm accounts={accounts} initial={initial} entryId={id} />
    </>
  );
}
