// Journal entry types, their default account templates and calculators.
// Shared by server and client code (no database access here).

export type EntryType = "general" | "ap-accrual" | "fixed-assets" | "prepaid" | "payroll" | "revenue";

export interface TemplateLine {
  /** Lines that share a key share the same amount (one debit, one credit). */
  key: string;
  accountCode: string;
  side: "debit" | "credit";
  description: string;
}

export interface CalcField {
  name: string;
  label: string;
  /** "money" values are entered in currency units; "number" values are plain numbers. */
  kind: "money" | "number" | "percent";
  defaultValue?: string;
}

export interface EntryTypeDef {
  value: EntryType;
  label: string;
  short: string;
  description: string;
  /** Accruals normally auto-reverse on the first day of the next period. */
  reverses: boolean;
  /** Account types expected on each side, used by the review checklist. */
  expect?: { debit: string[]; credit: string[] };
  template: TemplateLine[];
  calculator?: {
    fields: CalcField[];
    /** Returns amounts in cents per template key, plus a supporting-detail note. */
    compute: (v: Record<string, number>, fmt: (cents: number) => string) => {
      amounts: Record<string, number>;
      detail: string;
    };
  };
}

const c = (units: number) => Math.round(units * 100);

export const ENTRY_TYPES: EntryTypeDef[] = [
  {
    value: "general",
    label: "General / Adjustment",
    short: "General",
    description: "Any other adjusting or correcting entry.",
    reverses: false,
    template: [],
  },
  {
    value: "ap-accrual",
    label: "AP Accrual",
    short: "AP accrual",
    description: "Goods or services received but not yet invoiced at period end.",
    reverses: true,
    expect: { debit: ["expense", "asset"], credit: ["liability"] },
    template: [
      { key: "accrual", accountCode: "6900", side: "debit", description: "Services received, not yet invoiced" },
      { key: "accrual", accountCode: "2200", side: "credit", description: "Accrued liability" },
    ],
    calculator: {
      fields: [
        { name: "contract", label: "Monthly contract / PO value", kind: "money" },
        { name: "pct", label: "% delivered this period", kind: "percent", defaultValue: "100" },
        { name: "invoiced", label: "Already invoiced", kind: "money", defaultValue: "0" },
      ],
      compute: (v, fmt) => {
        const accrual = Math.max(0, c((v.contract * v.pct) / 100) - c(v.invoiced));
        return {
          amounts: { accrual },
          detail: `Accrual = ${fmt(c(v.contract))} × ${v.pct}% delivered − ${fmt(c(v.invoiced))} already invoiced = ${fmt(accrual)}. Based on PO receipts / contract terms; reverses when the vendor invoice is booked.`,
        };
      },
    },
  },
  {
    value: "fixed-assets",
    label: "Fixed Assets — Depreciation",
    short: "Depreciation",
    description: "Period depreciation and amortization of fixed assets and intangibles.",
    reverses: false,
    expect: { debit: ["expense"], credit: ["asset"] },
    template: [
      { key: "dep", accountCode: "6600", side: "debit", description: "Depreciation — equipment" },
      { key: "dep", accountCode: "1510", side: "credit", description: "Accumulated depreciation — equipment" },
      { key: "amort", accountCode: "6610", side: "debit", description: "Amortization — software & intangibles" },
      { key: "amort", accountCode: "1610", side: "credit", description: "Accumulated amortization" },
    ],
    calculator: {
      fields: [
        { name: "cost", label: "Equipment cost", kind: "money" },
        { name: "salvage", label: "Salvage value", kind: "money", defaultValue: "0" },
        { name: "life", label: "Useful life (months)", kind: "number", defaultValue: "60" },
        { name: "intCost", label: "Intangibles cost", kind: "money", defaultValue: "0" },
        { name: "intLife", label: "Intangibles life (months)", kind: "number", defaultValue: "36" },
      ],
      compute: (v, fmt) => {
        const dep = v.life > 0 ? Math.round(c(v.cost - v.salvage) / v.life) : 0;
        const amort = v.intLife > 0 ? Math.round(c(v.intCost) / v.intLife) : 0;
        return {
          amounts: { dep, amort },
          detail:
            `Straight-line depreciation: (${fmt(c(v.cost))} cost − ${fmt(c(v.salvage))} salvage) ÷ ${v.life} months = ${fmt(dep)}/month.` +
            (amort ? ` Amortization: ${fmt(c(v.intCost))} ÷ ${v.intLife} months = ${fmt(amort)}/month.` : "") +
            " Per fixed asset register.",
        };
      },
    },
  },
  {
    value: "prepaid",
    label: "Prepaid Amortization",
    short: "Prepaid",
    description: "Expense the used portion of prepaid insurance, software, rent and similar.",
    reverses: false,
    expect: { debit: ["expense"], credit: ["asset"] },
    template: [
      { key: "ins", accountCode: "6700", side: "debit", description: "Insurance — monthly amortization" },
      { key: "ins", accountCode: "1400", side: "credit", description: "Prepaid insurance" },
      { key: "sw", accountCode: "6800", side: "debit", description: "Software — monthly amortization" },
      { key: "sw", accountCode: "1400", side: "credit", description: "Prepaid software" },
    ],
    calculator: {
      fields: [
        { name: "insTotal", label: "Insurance prepaid (total)", kind: "money" },
        { name: "insMonths", label: "Insurance term (months)", kind: "number", defaultValue: "12" },
        { name: "swTotal", label: "Software prepaid (total)", kind: "money", defaultValue: "0" },
        { name: "swMonths", label: "Software term (months)", kind: "number", defaultValue: "12" },
      ],
      compute: (v, fmt) => {
        const ins = v.insMonths > 0 ? Math.round(c(v.insTotal) / v.insMonths) : 0;
        const sw = v.swMonths > 0 ? Math.round(c(v.swTotal) / v.swMonths) : 0;
        return {
          amounts: { ins, sw },
          detail: `Insurance: ${fmt(c(v.insTotal))} ÷ ${v.insMonths} months = ${fmt(ins)}. Software: ${fmt(c(v.swTotal))} ÷ ${v.swMonths} months = ${fmt(sw)}. Per prepaid amortization schedule.`,
        };
      },
    },
  },
  {
    value: "payroll",
    label: "Payroll Accrual",
    short: "Payroll",
    description: "Salaries, benefits, employer taxes and bonus earned but not yet paid.",
    reverses: true,
    expect: { debit: ["expense"], credit: ["liability"] },
    template: [
      { key: "salary", accountCode: "6200", side: "debit", description: "Accrued salaries — days worked, unpaid" },
      { key: "salary", accountCode: "2210", side: "credit", description: "Accrued salaries" },
      { key: "benefits", accountCode: "6210", side: "debit", description: "Accrued benefits" },
      { key: "benefits", accountCode: "2220", side: "credit", description: "Accrued benefits" },
      { key: "tax", accountCode: "6220", side: "debit", description: "Employer payroll taxes" },
      { key: "tax", accountCode: "2230", side: "credit", description: "Accrued payroll taxes" },
      { key: "bonus", accountCode: "6230", side: "debit", description: "Bonus accrual" },
      { key: "bonus", accountCode: "2240", side: "credit", description: "Accrued bonus" },
    ],
    calculator: {
      fields: [
        { name: "payroll", label: "Monthly gross payroll", kind: "money" },
        { name: "unpaidDays", label: "Days worked, not yet paid", kind: "number", defaultValue: "10" },
        { name: "workDays", label: "Working days in month", kind: "number", defaultValue: "22" },
        { name: "benefitsPct", label: "Benefits % of salary", kind: "percent", defaultValue: "8" },
        { name: "taxPct", label: "Employer tax % of salary", kind: "percent", defaultValue: "5" },
        { name: "bonusAnnual", label: "Annual bonus pool", kind: "money", defaultValue: "0" },
      ],
      compute: (v, fmt) => {
        const salary = v.workDays > 0 ? Math.round((c(v.payroll) * v.unpaidDays) / v.workDays) : 0;
        const benefits = Math.round((salary * v.benefitsPct) / 100);
        const tax = Math.round((salary * v.taxPct) / 100);
        const bonus = Math.round(c(v.bonusAnnual) / 12);
        return {
          amounts: { salary, benefits, tax, bonus },
          detail:
            `Salaries: ${fmt(c(v.payroll))} × ${v.unpaidDays}/${v.workDays} days = ${fmt(salary)}. ` +
            `Benefits: ${v.benefitsPct}% = ${fmt(benefits)}. Employer taxes: ${v.taxPct}% = ${fmt(tax)}.` +
            (bonus ? ` Bonus: ${fmt(c(v.bonusAnnual))} ÷ 12 = ${fmt(bonus)}.` : "") +
            " Per payroll register; reverses when payroll is paid.",
        };
      },
    },
  },
  {
    value: "revenue",
    label: "Revenue Recognition",
    short: "Revenue",
    description: "Recognize earned revenue and release deferred revenue.",
    reverses: false,
    expect: { debit: ["liability", "asset"], credit: ["income"] },
    template: [
      { key: "rev", accountCode: "2300", side: "debit", description: "Release deferred revenue" },
      { key: "rev", accountCode: "4100", side: "credit", description: "Service revenue earned" },
    ],
    calculator: {
      fields: [
        { name: "contract", label: "Contract value", kind: "money" },
        { name: "term", label: "Contract term (months)", kind: "number", defaultValue: "12" },
        { name: "months", label: "Months delivered this period", kind: "number", defaultValue: "1" },
      ],
      compute: (v, fmt) => {
        const rev = v.term > 0 ? Math.round((c(v.contract) * v.months) / v.term) : 0;
        return {
          amounts: { rev },
          detail: `Ratable recognition: ${fmt(c(v.contract))} ÷ ${v.term} months × ${v.months} month(s) delivered = ${fmt(rev)}. Performance obligation satisfied over time.`,
        };
      },
    },
  },
];

export function entryType(value: string): EntryTypeDef {
  return ENTRY_TYPES.find((t) => t.value === value) ?? ENTRY_TYPES[0];
}

/* Period helpers. A period is a month, written YYYY-MM. */

export function isPeriod(p: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
}

export function periodEnd(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function nextPeriodStart(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

export function formatPeriod(period: string | null): string {
  if (!period || !isPeriod(period)) return "—";
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function jeNumber(id: number) {
  return `JE-${String(id).padStart(5, "0")}`;
}
