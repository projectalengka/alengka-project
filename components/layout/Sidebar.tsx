"use client"

import { LayoutGrid, Users, ReceiptText, BarChart3, Tags, Sun, Moon } from "lucide-react"
import type { Tab } from "@/types"

interface SidebarProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  /** Jumlah klien yang punya proyek siap ditagih — ditampilkan sebagai lencana. */
  invoiceBadge?: number
  darkMode: boolean
  onToggleTheme: () => void
}

/*
 * Navigasi baru mengikuti alur kerja, bukan struktur data:
 *   Papan    -> alur desain masuk sampai siap ditagih
 *   Klien    -> siapa yang dikerjakan
 *   Invoice  -> menagih
 *   Laporan  -> melihat hasil
 *   Kategori -> mengatur jenis layanan (jarang dipakai, ditaruh paling bawah)
 */
const PRIMARY_NAV: { id: Tab; label: string; icon: typeof LayoutGrid }[] = [
  { id: "board", label: "Papan", icon: LayoutGrid },
  { id: "clients", label: "Klien", icon: Users },
  { id: "invoice", label: "Invoice", icon: ReceiptText },
  { id: "analytics", label: "Laporan", icon: BarChart3 },
]

const SECONDARY_NAV: { id: Tab; label: string; icon: typeof LayoutGrid }[] = [
  { id: "categories", label: "Kategori", icon: Tags },
]

const MOBILE_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV]

function NavButton({
  label, icon: Icon, active, badge, onClick,
}: {
  label: string; icon: typeof LayoutGrid; active: boolean; badge?: number; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors cursor-pointer ${
        active
          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold"
          : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-900 dark:hover:text-neutral-100 font-medium"
      }`}
    >
      <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
          active ? "bg-white/25 text-white dark:bg-neutral-900/20 dark:text-neutral-900" : "bg-violet-600 text-white"
        }`}>
          {badge}
        </span>
      )}
    </button>
  )
}

export default function Sidebar({
  activeTab, onTabChange, invoiceBadge = 0, darkMode, onToggleTheme,
}: SidebarProps) {
  return (
    <>
      {/* ---------------- Desktop: sidebar tetap ---------------- */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 h-screen sticky top-0 bg-white dark:bg-[#0b0b0d] border-r border-neutral-200 dark:border-neutral-900">
        <div className="px-5 py-5 flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-[13px] tracking-tight"
            /* Padding asimetris menutup geseran optis monogram huruf besar.
               Diukur dari piksel hasil render: "DS" duduk 0,67px terlalu tinggi
               dan 0,33px terlalu ke kanan. Huruf besar tidak punya tinta di
               bawah garis dasar, sehingga memusatkan kotak baris selalu
               membuatnya tampak naik. Angka padding = dua kali geserannya,
               karena padding menggeser kotak baris hanya setengahnya. */
            style={{ paddingTop: "1.5px", paddingRight: "0.7px" }}
          >
            DS
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold text-neutral-900 dark:text-white">Design Studio</p>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500">Manajemen Proyek</p>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {PRIMARY_NAV.map((item) => (
            <NavButton
              key={item.id}
              label={item.label}
              icon={item.icon}
              active={activeTab === item.id}
              badge={item.id === "invoice" ? invoiceBadge : undefined}
              onClick={() => onTabChange(item.id)}
            />
          ))}

          <div className="pt-4 mt-2 border-t border-neutral-100 dark:border-neutral-900">
            <p className="px-3 pb-1.5 text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-600 font-semibold">
              Pengaturan
            </p>
            {SECONDARY_NAV.map((item) => (
              <NavButton
                key={item.id}
                label={item.label}
                icon={item.icon}
                active={activeTab === item.id}
                onClick={() => onTabChange(item.id)}
              />
            ))}
          </div>
        </nav>

        <div className="p-3 border-t border-neutral-100 dark:border-neutral-900">
          <button
            onClick={onToggleTheme}
            aria-label="Ganti tema"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
          >
            {darkMode ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            <span>{darkMode ? "Mode Terang" : "Mode Gelap"}</span>
          </button>
        </div>
      </aside>

      {/* ---------------- Mobile: navigasi bawah ---------------- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#0b0b0d] border-t border-neutral-200 dark:border-neutral-900 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch">
          {MOBILE_NAV.map((item) => {
            const active = activeTab === item.id
            const Icon = item.icon
            const badge = item.id === "invoice" ? invoiceBadge : 0
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                aria-current={active ? "page" : undefined}
                className={`relative flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors cursor-pointer ${
                  active ? "text-neutral-900 dark:text-white" : "text-neutral-400 dark:text-neutral-500"
                }`}
              >
                <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.4 : 1.8} />
                <span className={`text-[10px] ${active ? "font-semibold" : "font-medium"}`}>{item.label}</span>
                {badge > 0 && (
                  <span className="absolute top-1.5 right-1/2 translate-x-4 min-w-[16px] h-4 px-1 rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
