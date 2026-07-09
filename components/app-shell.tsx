"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, ClipboardCheck, ClipboardList, PawPrint, Scissors, UsersRound } from "lucide-react";

const navItems = [
  { label: "Panel", href: "/", icon: BarChart3 },
  { label: "Agenda", href: "/agenda", icon: CalendarDays },
  { label: "Hojas", href: "/hojas", icon: ClipboardCheck },
  { label: "Mascotas", href: "/mascotas", icon: PawPrint },
  { label: "Clientes", href: "/clientes", icon: UsersRound },
  { label: "Servicios", href: "/servicios", icon: Scissors },
  { label: "Reportes", href: "/reportes", icon: ClipboardList }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-cloud">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <Link className="flex items-center gap-3 px-2" href="/">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-jade text-white">
            <PawPrint className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-base font-semibold text-ink">MyPetStore</p>
            <p className="text-xs text-slate-500">Grooming GT</p>
          </div>
        </Link>
        <nav className="mt-8 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-jade text-white" : "text-slate-600 hover:bg-cloud hover:text-ink"
                }`}
                href={item.href}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="lg:pl-64">{children}</main>
    </div>
  );
}
