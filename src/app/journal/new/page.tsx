import { listAccounts } from "@/lib/accounting";
import { today } from "@/lib/format";
import { JournalForm } from "./journal-form";
import { PageHeader } from "@/components/ui";

export default function NewEntryPage() {
  const accounts = listAccounts().map((a) => ({ id: a.id, label: `${a.code} · ${a.name}` }));
  return (
    <>
      <PageHeader
        title="New journal entry"
        description="Record any transaction directly. Total debits must equal total credits."
      />
      <JournalForm accounts={accounts} defaultDate={today()} />
    </>
  );
}
