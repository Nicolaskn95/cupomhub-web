"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import Image from "next/image";
import { QrCode } from "lucide-react";
import { ProfileMenu } from "@/components/ProfileMenu";
import { useSessionProfileColor } from "@/lib/profile-color";

type NavItem = {
  href: string;
  label: string;
  isCenterAction?: boolean;
};

export function MainNav() {
  const pathname = usePathname();
  const { color, preset } = useSessionProfileColor();

  const items: NavItem[] = useMemo(
    () => [
      { href: "/notasfiscais", label: "Notas Fiscais" },
      { href: "/produtos", label: "Produtos" },
      { href: "/", label: "Escanear Cupom", isCenterAction: true },
      { href: "/financeiro", label: "Financeiro" },
      { href: "/lista-compras", label: "Lista de Compras" },
    ],
    []
  );

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname?.startsWith(href));

  const secondaryColor = preset ? preset.secondaryHex : color;

  return (
    <nav
      className="text-white shadow-lg transition-all duration-300 relative z-30 border-b border-white/10"
      style={{
        background: `linear-gradient(135deg, ${secondaryColor}, ${color})`,
      }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-white/15 p-1 flex items-center justify-center border border-white/20 shadow-sm group-hover:scale-105 transition-transform">
            <Image
              src="/icons/icon-192x192.png"
              alt="Logo De Olho na Nota"
              width={28}
              height={28}
              className="rounded-lg object-contain"
            />
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight text-white drop-shadow-sm group-hover:opacity-90 transition-opacity">
            De Olho na Nota
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-1.5 lg:gap-2">
          {items.map((item) => {
            const active = isActive(item.href);
            if (item.isCenterAction) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mx-1 px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 transition-all duration-200 shadow-md ${
                    active
                      ? "bg-white text-slate-900 scale-105 ring-2 ring-white/50"
                      : "bg-white/95 text-slate-900 hover:bg-white hover:scale-105"
                  }`}
                  style={{ color: color || "#047857" }}
                >
                  <QrCode className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-white/20 text-white font-semibold shadow-inner border border-white/30 backdrop-blur-sm"
                    : "text-white/85 hover:text-white hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* User Profile Menu */}
        <div className="flex items-center gap-2">
          <ProfileMenu />
        </div>
      </div>
    </nav>
  );
}
