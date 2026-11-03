"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const SECTIONS = [
  {
    title: "Overview",
    links: [{ href: "/", label: "Dashboard" }],
  },
  {
    title: "Sales",
    links: [
      { href: "/invoices", label: "Invoices" },
      { href: "/customers", label: "Customers" },
    ],
  },
  {
    title: "Purchases",
    links: [{ href: "/expenses", label: "Expenses" }],
  },
  {
    title: "Accounting",
    links: [
      { href: "/journal", label: "Journal Entries" },
      { href: "/accounts", label: "Chart of Accounts" },
    ],
  },
  {
    title: "Reports",
    links: [
      { href: "/reports/profit-loss", label: "Profit & Loss" },
      { href: "/reports/balance-sheet", label: "Balance Sheet" },
      { href: "/reports/trial-balance", label: "Trial Balance" },
    ],
  },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="no-print border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r">
      <div className="flex items-center justify-between px-5 py-4">
        <Link href="/" className="text-lg font-semibold text-indigo-700">
          Ledgerly
        </Link>
        <button className="btn-secondary md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          Menu
        </button>
      </div>
      <nav className={`${open ? "block" : "hidden"} px-3 pb-4 md:block`}>
        {SECTIONS.map((s) => (
          <div key={s.title} className="mb-4">
            <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{s.title}</p>
            {s.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`block rounded-md px-2 py-1.5 text-sm ${
                  isActive(l.href) ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
