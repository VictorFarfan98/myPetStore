"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  History,
  LogOut,
  Mail,
  Package,
  PawPrint,
  Scissors,
  Settings,
  Store,
  TicketPercent,
  UserCog,
  UsersRound
} from "lucide-react";
import { signOut } from "@/lib/auth-actions";
import logo from "../logo/Mirandas logo.svg";

const navItems = [
  { label: "Panel", href: "/", icon: BarChart3 },
  { label: "Agenda", href: "/agenda", icon: CalendarDays },
  { label: "Hojas", href: "/hojas", icon: ClipboardCheck },
  { label: "Mascotas", href: "/mascotas", icon: PawPrint },
  { label: "Clientes", href: "/clientes", icon: UsersRound },
  { label: "Cupones", href: "/cupones", icon: TicketPercent },
  { label: "Paquetes", href: "/paquetes", icon: Package },
  { label: "Servicios", href: "/servicios", icon: Scissors },
  { label: "Sucursales", href: "/sucursales", icon: Store },
  { label: "Equipo", href: "/equipo", icon: UserCog },
  { label: "Configuración", href: "/configuracion", icon: Settings },
  { label: "Reportes", href: "/reportes", icon: ClipboardList },
  { label: "Auditoría", href: "/auditorias", icon: History },
  { label: "Correos", href: "/correos", icon: Mail }
];

const workerRestrictedPaths = ["/", "/mascotas", "/clientes", "/servicios", "/correos"];

export function AppShellClient({ children, role, userName }: { children: ReactNode; role?: string; userName?: string }) {
  const pathname = usePathname();
  const canManageAdmin = role === "administrador" || role === "propietario";
  const canViewReports = canManageAdmin || role === "encargado";
  const canViewBackOffice = role !== undefined && !["groomer", "driver"].includes(role);

  return (
    <div className="min-h-screen bg-cloud">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-brand-black bg-brand-black px-4 py-5 lg:flex lg:flex-col">
        <Link className="flex items-center gap-3 px-2" href="/">
          <span className="flex h-10 w-10 items-center justify-center">
            <Image src={logo} alt="Miranda's Pet Boutique" width={32} height={32} className="object-contain" />
          </span>
          <div>
            <p className="text-base font-semibold text-white">Miranda&apos;s Pet Boutique</p>
          </div>
        </Link>
        {userName && <p className="mt-4 px-2 text-sm font-medium text-slate-300">Hola {userName}</p>}
        <nav className="mt-8 space-y-1">
          {navItems.filter((item) => (item.href === "/reportes" ? canViewReports : workerRestrictedPaths.includes(item.href) ? canViewBackOffice : !["/sucursales", "/equipo", "/configuracion", "/cupones", "/paquetes", "/auditorias"].includes(item.href) || canManageAdmin)).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive ? "bg-brand-gold text-brand-black" : "text-slate-200 hover:bg-white/10 hover:text-white"
                  }`}
                href={item.href}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action={signOut} className="mt-auto pt-6">
          <button
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-gold focus:ring-offset-2 focus:ring-offset-brand-black"
            type="submit"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Cerrar sesión
          </button>
        </form>
      </aside>
      <main className="lg:pl-64">{children}</main>
    </div>
  );
}
