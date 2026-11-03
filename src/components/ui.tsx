import type { InvoiceStatus } from "@/lib/accounting";
import { money } from "@/lib/format";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  partial: "bg-amber-50 text-amber-700 ring-amber-200",
  overdue: "bg-red-50 text-red-700 ring-red-200",
  unpaid: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

/** Money cell; negative values are shown in parentheses, accounting style. */
export function Amount({ value, strong }: { value: number; strong?: boolean }) {
  const text = value < 0 ? `(${money(-value)})` : money(value);
  return <span className={`tabular-nums ${strong ? "font-semibold" : ""} ${value < 0 ? "text-red-600" : ""}`}>{text}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-slate-500">{children}</p>;
}
