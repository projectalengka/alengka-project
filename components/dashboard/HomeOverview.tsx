"use client"

import type { ReactNode } from "react"
import type { DashboardStats, Project } from "@/types"
import { formatCurrency, formatDate } from "@/lib/utils"
import { STATUS_META } from "@/lib/status"
import { ArrowRight, BriefcaseBusiness, Plus, ReceiptText, Users } from "lucide-react"

interface HomeOverviewProps {
  projects: Project[]
  stats: DashboardStats
  clientCount: number
  onOpenProjects: () => void
  onOpenInvoice: () => void
  onNewProject: () => void
}

export default function HomeOverview({
  projects, stats, clientCount, onOpenProjects, onOpenInvoice, onNewProject,
}: HomeOverviewProps) {
  const activeCount = stats.masuk + stats.onProgress + stats.revisi
  const recent = [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)

  return (
    <div className="mx-auto max-w-6xl space-y-5 md:space-y-7">
      <section className="flex flex-col gap-4 rounded-3xl bg-neutral-900 p-5 text-white md:flex-row md:items-center md:justify-between md:p-7 dark:bg-white dark:text-neutral-950">
        <div>
          <p className="text-xs font-medium text-white/65 dark:text-neutral-600">Ringkasan hari ini</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">Semua pekerjaan, lebih jelas.</h2>
          <p className="mt-1 text-sm text-white/70 dark:text-neutral-600">Kelola proyek dan tagihan dari satu tempat.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onNewProject} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-neutral-900 hover:bg-neutral-100 md:flex-none dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800">
            <Plus className="h-4 w-4" /> Proyek baru
          </button>
          <button onClick={onOpenProjects} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/25 px-4 text-sm font-semibold text-white hover:bg-white/10 md:flex-none dark:border-neutral-300 dark:text-neutral-900 dark:hover:bg-neutral-100">
            Lihat proyek <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section aria-label="Ringkasan proyek" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Proyek berjalan" value={String(activeCount)} detail={`${stats.masuk} baru · ${stats.onProgress} dikerjakan · ${stats.revisi} revisi`} icon={<BriefcaseBusiness className="h-4 w-4" />} />
        <button onClick={onOpenInvoice} className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-left transition-colors hover:border-violet-400 dark:border-violet-500/20 dark:bg-violet-500/5">
          <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300"><ReceiptText className="h-4 w-4" /><span className="text-[11px] font-semibold">Perlu invoice</span></div>
          <p className="mt-2 text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">{stats.siapDitagih} proyek</p>
          <p className="mt-0.5 truncate text-[11px] text-neutral-500 dark:text-neutral-400">{formatCurrency(stats.incomeSiapDitagih)} · buka invoice</p>
        </button>
        <SummaryCard label="Semua proyek" value={String(stats.total)} detail={`${stats.done} selesai · ${stats.cancel} dibatalkan`} icon={<BriefcaseBusiness className="h-4 w-4" />} />
        <SummaryCard label="Klien" value={String(clientCount)} detail="klien tersimpan" icon={<Users className="h-4 w-4" />} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-[#111113]">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-4 dark:border-neutral-900 md:px-5">
          <div>
            <h3 className="text-sm font-semibold">Perubahan terbaru</h3>
            <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">Lima proyek terakhir diperbarui</p>
          </div>
          <button onClick={onOpenProjects} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900">Semua proyek <ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
        {recent.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium">Belum ada proyek</p>
            <p className="mt-1 text-xs text-neutral-500">Tambahkan proyek pertama untuk mulai.</p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-900">
            {recent.map((project) => {
              const status = STATUS_META[project.status]
              return (
                <li key={project.id} className="flex items-center gap-3 px-4 py-3.5 md:px-5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${status.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{project.projectTitle}</p>
                    <p className="mt-0.5 truncate text-[11px] text-neutral-500 dark:text-neutral-400">{project.client.name} · {project.category.name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold">{formatCurrency(project.price)}</p>
                    <p className="mt-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">{status.label}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {recent.length > 0 && <p className="px-4 pb-3 text-[10px] text-neutral-400 md:px-5">{recent.some((p) => p.completedAt) ? `Selesai terakhir: ${formatDate(recent.find((p) => p.completedAt)!.completedAt!)}` : "Tanggal selesai mulai tercatat otomatis saat proyek ditandai Selesai."}</p>}
      </section>
    </div>
  )
}

function SummaryCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#111113]">
      <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">{icon}<span className="text-[11px] font-semibold">{label}</span></div>
      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 truncate text-[10.5px] text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  )
}
