import { listAccounts } from "@/lib/accounting";
import { today } from "@/lib/format";
import { ENTRY_TYPES, entryType, formatPeriod, nextPeriodStart, periodEnd, type EntryType } from "@/lib/journal-types";
import { PageHeader } from "@/components/ui";
import { JournalForm, type FormValues } from "../journal-form";

export default async function NewEntryPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const accounts = listAccounts().map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type }));
  const byCode = new Map(accounts.map((a) => [a.code, a.id]));
  const def = entryType(ENTRY_TYPES.some((t) => t.value === type) ? type! : "general");
  const period = today().slice(0, 7);

  const initial: FormValues = {
    entryType: def.value as EntryType,
    period,
    date: def.value === "general" ? today() : periodEnd(period),
    memo: def.value === "general" ? "" : `${def.label} — ${formatPeriod(period)}`,
    reference: "",
    preparedBy: "",
    supportingDetail: "",
    reverse: def.reverses,
    reverseOn: nextPeriodStart(period),
    lines: def.template.length
      ? def.template.map((t) => ({
          key: t.key,
          side: t.side,
          accountId: String(byCode.get(t.accountCode) ?? ""),
          description: t.description,
          department: "",
          debit: "",
          credit: "",
        }))
      : [0, 1].map(() => ({ accountId: "", description: "", department: "", debit: "", credit: "" })),
  };

  return (
    <>
      <PageHeader
        title="New journal entry"
        description="Pick a type to load its standard accounts, calculate the amounts, then save as a draft or post."
      />
      <JournalForm accounts={accounts} initial={initial} />
    </>
  );
}
