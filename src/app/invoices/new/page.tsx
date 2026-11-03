import Link from "next/link";
import { listAccounts, listCustomers, nextInvoiceNumber } from "@/lib/accounting";
import { addDays, today } from "@/lib/format";
import { Empty, PageHeader } from "@/components/ui";
import { InvoiceForm } from "./invoice-form";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { customer } = await searchParams;
  const customers = listCustomers().map((c) => ({ id: c.id, name: c.name }));
  const incomeAccounts = listAccounts()
    .filter((a) => a.type === "income")
    .map((a) => ({ id: a.id, label: `${a.code} · ${a.name}` }));

  return (
    <>
      <PageHeader title={`New invoice ${nextInvoiceNumber()}`} />
      {customers.length === 0 ? (
        <div className="card">
          <Empty>
            You need a customer before creating an invoice.{" "}
            <Link href="/customers" className="link">Add a customer</Link>
          </Empty>
        </div>
      ) : (
        <InvoiceForm
          customers={customers}
          incomeAccounts={incomeAccounts}
          defaultCustomer={customer ?? ""}
          defaultDate={today()}
          defaultDueDate={addDays(today(), 30)}
        />
      )}
    </>
  );
}
