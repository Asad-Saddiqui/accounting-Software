"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as acc from "@/lib/accounting";
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

export async function createEntryAction(_: FormState, f: FormData): Promise<FormState> {
  const result = attempt(() => {
    const raw = JSON.parse(str(f, "lines") || "[]") as {
      accountId: string;
      debit: string;
      credit: string;
      description: string;
    }[];
    const lines = raw.map((l) => ({
      accountId: Number(l.accountId),
      debit: toCents(l.debit),
      credit: toCents(l.credit),
      description: l.description,
    }));
    if (lines.some((l) => Number.isNaN(l.debit) || Number.isNaN(l.credit)))
      throw new acc.AccountingError("Amounts must be numbers.");
    acc.postEntry({ date: str(f, "date"), memo: str(f, "memo"), lines });
  });
  if (result) return result;
  refresh();
  redirect("/journal");
}

export async function deleteEntryAction(id: number) {
  acc.deleteManualEntry(id);
  refresh();
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
