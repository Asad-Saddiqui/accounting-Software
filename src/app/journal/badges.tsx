import type { EntryStatus } from "@/lib/journal";
import { entryType } from "@/lib/journal-types";

const TYPE_STYLE: Record<string, string> = {
  general: "bg-slate-100 text-slate-700",
  "ap-accrual": "bg-violet-50 text-violet-700",
  "fixed-assets": "bg-sky-50 text-sky-700",
  prepaid: "bg-teal-50 text-teal-700",
  payroll: "bg-rose-50 text-rose-700",
  revenue: "bg-emerald-50 text-emerald-700",
};

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLE[type] ?? TYPE_STYLE.general}`}>
      {entryType(type).short}
    </span>
  );
}

export function EntryStatusBadge({ status }: { status: EntryStatus }) {
  return status === "draft" ? (
    <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">Draft</span>
  ) : (
    <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">Posted</span>
  );
}
