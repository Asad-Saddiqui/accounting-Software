"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as acc from "@/lib/accounting";
import * as jr from "@/lib/journal";
import { toCents } from "@/lib/format";

export type FormState = { error?: string } | undefined;

const str = (f: FormData, key: string) => String(f.get(key) ?? "");
const num = (f: FormData, key: string) => Number(f.get(key));

/** Runs a mutation and turns user-facing errors into form state. */
function attempt(fn: () => void): FormState {
  try {
    fn();
    return undefined;
  } catch (e) {
    if (e instanceof acc.AccountingError) return { error: e.message };
    console.error(e);
    return { error: "Something went wrong. Please try again." };
  }
}

function refresh() {
  revalidatePath("/", "layout");
}

/* Accounts */

export async function createAccountAction(_: FormState, f: FormData): Promise<FormState> {
  const result = attempt(() =>
    acc.createAccount({
      code: str(f, "code"),
      name: str(f, "name"),
      type: str(f, "type"),
      isCash: f.get("is_cash") === "on",
      description: str(f, "description"),
    }),
  );
  if (result) return result;
  refresh();
  return { error: undefined };
}

export async function deleteAccountAction(id: number) {
  acc.deleteAccount(id);
  refresh();
  redirect("/accounts");
}

/* Journal */

export async function saveJournalAction(id: number | null, _: FormState, f: FormData): Promise<FormState> {
  const post = str(f, "intent") === "post";
  let savedId = 0;
  const result = attempt(() => {
    const raw = JSON.parse(str(f, "payload") || "{}") as {
      entryType: string;
      period: string;
      date: string;
      memo: string;
      reference: string;
      preparedBy: string;
      supportingDetail: string;
      reverse: boolean;
      reverseOn: string;
      lines: { accountId: string; debit: string; credit: string; department: string; description: string }[];
    };
    const lines = (raw.lines ?? []).map((l) => ({
      accountId: Number(l.accountId) || 0,
      debit: toCents(l.debit),
      credit: toCents(l.credit),
      department: l.department,
      description: l.description,
    }));
    if (lines.some((l) => Number.isNaN(l.debit) || Number.isNaN(l.credit)))
      throw new acc.AccountingError("Amounts must be numbers.");
    savedId = jr.saveEntry(
      {
        entryType: raw.entryType,
        period: raw.period,
        date: raw.date,
        memo: raw.memo ?? "",
        reference: raw.reference,
        preparedBy: raw.preparedBy,
        supportingDetail: raw.supportingDetail,
        reverseOn: raw.reverse ? raw.reverseOn : null,
        lines,
      },
      { post, id: id ?? undefined },
    );
  });
  if (result) return result;
  refresh();
  redirect(`/journal/${savedId}`);
}

export async function postJournalAction(id: number): Promise<FormState> {
  const result = attempt(() => jr.postDraft(id));
  if (result) return result;
  refresh();
  return { error: undefined };
}

export async function reverseJournalAction(id: number, _: FormState, f: FormData): Promise<FormState> {
  const result = attempt(() => jr.reverseEntry(id, str(f, "date")));
  if (result) return result;
  refresh();
  return { error: undefined };
}

export async function deleteJournalAction(id: number) {
  jr.deleteEntry(id);
  refresh();
  redirect("/journal");
}

/* Customers */

export async function createCustomerAction(_: FormState, f: FormData): Promise<FormState> {
  const result = attempt(() =>
    acc.createCustomer({
      name: str(f, "name"),
      email: str(f, "email"),
      phone: str(f, "phone"),
      address: str(f, "address"),
    }),
  );
  if (result) return result;
  refresh();
  return { error: undefined };
}

export async function deleteCustomerAction(id: number) {
  acc.deleteCustomer(id);
  refresh();
}

/* Invoices */

export async function createInvoiceAction(_: FormState, f: FormData): Promise<FormState> {
  let invoiceId = 0;
  const result = attempt(() => {
    const raw = JSON.parse(str(f, "items") || "[]") as {
      description: string;
      quantity: string;
      unitPrice: string;
      accountId: string;
    }[];
    const items = raw.map((i) => ({
      description: i.description,
      quantity: Number(i.quantity),
      unitPrice: toCents(i.unitPrice),
      accountId: Number(i.accountId),
    }));
    invoiceId = acc.createInvoice({
      customerId: num(f, "customer_id"),
      date: str(f, "date"),
      dueDate: str(f, "due_date"),
      notes: str(f, "notes"),
      items,
    });
  });
  if (result) return result;
  refresh();
  redirect(`/invoices/${invoiceId}`);
}

export async function recordPaymentAction(invoiceId: number, _: FormState, f: FormData): Promise<FormState> {
  const result = attempt(() => {
    const amount = toCents(f.get("amount"));
    if (Number.isNaN(amount)) throw new acc.AccountingError("Amount must be a number.");
    acc.recordPayment(invoiceId, { date: str(f, "date"), amount, accountId: num(f, "account_id") });
  });
  if (result) return result;
  refresh();
  return { error: undefined };
}

export async function deleteInvoiceAction(id: number) {
  acc.deleteInvoice(id);
  refresh();
  redirect("/invoices");
}

/* Expenses */

export async function createExpenseAction(_: FormState, f: FormData): Promise<FormState> {
  const result = attempt(() => {
    const amount = toCents(f.get("amount"));
    if (Number.isNaN(amount)) throw new acc.AccountingError("Amount must be a number.");
    acc.createExpense({
      date: str(f, "date"),
      payee: str(f, "payee"),
      description: str(f, "description"),
      amount,
      expenseAccountId: num(f, "expense_account_id"),
      paidFromAccountId: num(f, "paid_from_account_id"),
    });
  });
  if (result) return result;
  refresh();
  return { error: undefined };
}

export async function deleteExpenseAction(id: number) {
  acc.deleteExpense(id);
  refresh();
}
