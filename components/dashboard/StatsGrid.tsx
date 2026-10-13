"use client"

import type { DashboardStats } from "@/types"
import { Layers, Activity, GitPullRequestDraft, CheckCircle2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface StatsGridProps {
  stats: DashboardStats
}

export default function StatsGrid({ stats }: StatsGridProps) {
  const cards = [
    { label: "Total Proyek", value: stats.total, desc: "Total semua proyek", icon: <Layers className="w-3.5 h-3.5 text-neutral-400" /> },
    { label: "Berjalan", value: stats.onProgress, desc: "Proyek yang lagi dikerjain", icon: <Activity className="w-3.5 h-3.5 text-neutral-400" /> },
    { label: "Revisi", value: stats.revisi, desc: "Butuh direvisi lagi", icon: <GitPullRequestDraft className="w-3.5 h-3.5 text-neutral-400" /> },
    { label: "Selesai", value: stats.done, desc: "Proyek yang udah kelar", icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> },
  ]

  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-[#0d0d0f]/50 border border-neutral-200 dark:border-neutral-900/60 rounded-xl p-6 sm:p-8 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x divide-neutral-200/60 dark:divide-neutral-900/60">
          <div className="space-y-1">
            <span className="text-[8.5px] text-neutral-400 dark:text-neutral-500 tracking-[0.2em] uppercase font-semibold block">PENDAPATAN</span>
            <div className="text-3xl sm:text-4xl font-light tracking-tight text-neutral-950 dark:text-white">{formatCurrency(stats.totalIncome)}</div>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">Total dari proyek yang udah selesai.</span>
          </div>
          <div className="space-y-1 pt-6 md:pt-0 md:pl-8">
            <span className="text-[8.5px] text-neutral-400 dark:text-neutral-500 tracking-[0.2em] uppercase font-semibold block">ESTIMASI</span>
            <div className="text-3xl sm:text-4xl font-light tracking-tight text-neutral-850 dark:text-neutral-300">{formatCurrency(stats.pipelineIncome)}</div>
            <span className="text-[10px] text-neutral-450 dark:text-neutral-500 font-medium">Estimasi dari proyek yang masih jalan.</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pl-1">
        {cards.map((item, idx) => (
          <div key={idx} className="flex flex-col justify-between h-28 bg-white dark:bg-[#0d0d0f]/30 border border-neutral-200/60 dark:border-neutral-900/40 rounded-xl p-5 group shadow-xs hover:border-neutral-300 dark:hover:border-neutral-800 transition-colors duration-200">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-neutral-400 dark:text-neutral-500">
                {item.icon}
                <span className="text-[8.5px] font-semibold tracking-[0.15em] uppercase">{item.label}</span>
              </div>
              <div className="text-2xl font-light text-neutral-950 dark:text-white tracking-tight">{item.value}</div>
            </div>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate block">{item.desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
