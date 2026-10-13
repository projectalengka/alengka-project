"use client"

import type { DashboardStats } from "@/types"
import { formatCurrency } from "@/lib/utils"
import { ReceiptText, CheckCircle2, Loader, AlertTriangle } from "lucide-react"

interface SummaryStripProps {
  stats: DashboardStats
  /** Melompat ke tab Invoice saat kartu "Belum ditagih" ditekan. */
  onOpenInvoice: () => void
}

/**
 * Ringkasan angka di atas papan.
 *
 * Dulu blok ini menampilkan pendapatan besar-besar tanpa kaitan dengan aksi.
 * Sekarang yang ditonjolkan adalah hal yang menuntut tindakan — terutama
 * "belum ditagih", yang bisa langsung ditekan untuk membuat invoice.
 */
export default function SummaryStrip({ stats, onOpenInvoice }: SummaryStripProps) {
  const cards = [
    {
      key: "billable",
      label: "Belum ditagih",
      value: formatCurrency(stats.incomeSiapDitagih),
      sub: `${stats.siapDitagih} proyek siap ditagih`,
      icon: ReceiptText,
      tone: "text-violet-600 dark:text-violet-400",
      ring: "border-violet-200 dark:border-violet-500/25 bg-violet-50/60 dark:bg-violet-500/5",
      onClick: onOpenInvoice,
    },
    {
      key: "invoiced",
      label: "Sudah ditagih",
      value: formatCurrency(stats.incomeDitagih),
      sub: `${stats.sudahDitagih} proyek`,
      icon: CheckCircle2,
      tone: "text-emerald-600 dark:text-emerald-400",
      ring: "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111113]",
    },
    {
      key: "wip",
      label: "Sedang dikerjakan",
      value: String(stats.onProgress + stats.revisi),
      sub: `${stats.masuk} baru masuk`,
      icon: Loader,
      tone: "text-blue-600 dark:text-blue-400",
      ring: "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111113]",
    },
    {
      key: "late",
      label: "Lewat deadline",
      value: String(stats.overdue),
      sub: stats.overdue > 0 ? "perlu perhatian" : "semua aman",
      icon: AlertTriangle,
      tone: stats.overdue > 0 ? "text-amber-600 dark:text-amber-400" : "text-neutral-400",
      ring: stats.overdue > 0
        ? "border-amber-200 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/5"
        : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111113]",
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {cards.map(({ key, ...c }) => {
        const Icon = c.icon
        const Comp = c.onClick ? "button" : "div"
        return (
          <Comp
            key={key}
            onClick={c.onClick}
            className={`text-left border rounded-2xl p-3.5 ${c.ring} ${
              c.onClick ? "cursor-pointer hover:border-violet-400 dark:hover:border-violet-400 transition-colors" : ""
            }`}
          >
            <div className={`flex items-center gap-1.5 ${c.tone}`}>
              <Icon className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{c.label}</span>
            </div>
            <p className="text-[17px] sm:text-xl font-semibold text-neutral-900 dark:text-white mt-1.5 tracking-tight truncate">
              {c.value}
            </p>
            <p className="text-[10.5px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">{c.sub}</p>
          </Comp>
        )
      })}
    </div>
  )
}
