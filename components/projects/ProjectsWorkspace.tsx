"use client"

import { useMemo, useState } from "react"
import type { Project, ProjectStatus } from "@/types"
import { isProjectStatus, PROJECT_STATUSES } from "@/types"
import { formatCurrency, formatDate } from "@/lib/utils"
import { STATUS_META } from "@/lib/status"
import { CalendarClock, Check, ChevronDown, Clock3, Loader2, Pencil, Search, SlidersHorizontal, Trash2 } from "lucide-react"

type ProjectFilter = "all" | "active" | "done" | "cancelled"

interface ProjectsWorkspaceProps {
  projects: Project[]
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
  onStatusChange: (projectId: string, status: ProjectStatus) => Promise<boolean>
}

const FILTERS: { id: ProjectFilter; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "active", label: "Berjalan" },
  { id: "done", label: "Selesai" },
  { id: "cancelled", label: "Dibatalkan" },
]

export default function ProjectsWorkspace({ projects, onEdit, onDelete, onStatusChange }: ProjectsWorkspaceProps) {
  const [filter, setFilter] = useState<ProjectFilter>("all")
  const [search, setSearch] = useState("")
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null)

  const changeStatus = async (project: Project, nextValue: string) => {
    if (!isProjectStatus(nextValue) || nextValue === project.status || savingStatusId) return
    setSavingStatusId(project.id)
    try {
      await onStatusChange(project.id, nextValue)
    } finally {
      setSavingStatusId(null)
    }
  }

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID")
    return [...projects]
      .filter((project) => {
        if (filter === "active" && !["Masuk", "On Progress", "Revisi"].includes(project.status)) return false
        if (filter === "done" && project.status !== "Done") return false
        if (filter === "cancelled" && project.status !== "Cancel") return false
        if (!query) return true
        return [project.projectTitle, project.client.name, project.category.name]
          .some((value) => value.toLocaleLowerCase("id-ID").includes(query))
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [projects, filter, search])

  const countFor = (id: ProjectFilter) => projects.filter((project) => {
    if (id === "active") return ["Masuk", "On Progress", "Revisi"].includes(project.status)
    if (id === "done") return project.status === "Done"
    if (id === "cancelled") return project.status === "Cancel"
    return true
  }).length

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#111113] md:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold">Daftar proyek</h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Cari riwayat order, klien, harga, dan tanggal selesai.</p>
          </div>
          <label className="relative block w-full lg:max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} type="search" placeholder="Cari proyek, klien, jenis order..." className="min-h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-10 pr-3 text-sm outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:focus:border-neutral-600" />
          </label>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-0.5" aria-label="Filter proyek">
          {FILTERS.map((item) => (
            <button key={item.id} onClick={() => setFilter(item.id)} aria-pressed={filter === item.id} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-xs font-semibold transition-colors ${filter === item.id ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-[#111113] dark:text-neutral-300 dark:hover:bg-neutral-900"}`}>
              {item.label}<span className={filter === item.id ? "opacity-70" : "text-neutral-400"}>{countFor(item.id)}</span>
            </button>
          ))}
          <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-neutral-400 sm:inline-flex"><SlidersHorizontal className="h-3.5 w-3.5" /> Terbaru diperbarui</span>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-[#111113]">
        <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(110px,1fr)_minmax(100px,.8fr)_minmax(105px,.8fr)_minmax(115px,.9fr)_80px] gap-4 border-b border-neutral-100 bg-neutral-50/70 px-5 py-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-900 dark:bg-neutral-900/30 lg:grid">
          <span>Proyek / klien</span><span>Jenis order</span><span>Harga</span><span>Status</span><span>Selesai / target</span><span />
        </div>
        {visible.length === 0 ? (
          <div className="px-5 py-14 text-center"><p className="text-sm font-semibold">Tidak ada proyek ditemukan</p><p className="mt-1 text-xs text-neutral-500">Coba ubah kata pencarian atau filter.</p></div>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-900">
            {visible.map((project) => {
              const meta = STATUS_META[project.status]
              return (
                <li key={project.id} className="relative grid gap-2.5 p-4 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1.6fr)_minmax(110px,1fr)_minmax(100px,.8fr)_minmax(105px,.8fr)_minmax(115px,.9fr)_80px] lg:items-center lg:gap-4 lg:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{project.projectTitle}</p>
                    <p className="mt-0.5 truncate text-[11px] text-neutral-500 dark:text-neutral-400">{project.client.name}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs lg:block">
                    <span className="text-[10px] text-neutral-400 lg:hidden">Jenis order</span>
                    <span className="truncate text-neutral-700 dark:text-neutral-300">{project.category.name}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 lg:block">
                    <span className="text-[10px] text-neutral-400 lg:hidden">Harga</span>
                    <span className="text-xs font-semibold tabular-nums">{formatCurrency(project.price)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 lg:block">
                    <span className="text-[10px] text-neutral-400 lg:hidden">Status · tekan untuk ubah</span>
                    <label className="relative inline-flex min-h-10 cursor-pointer items-center rounded-xl focus-within:ring-2 focus-within:ring-violet-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-[#111113]">
                      <span className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 pr-9 text-[11px] font-semibold transition-colors ${meta.chip} ${savingStatusId === project.id ? "opacity-65" : ""}`}>
                        {savingStatusId === project.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <span className={`h-2 w-2 rounded-full ${meta.dot}`} />}
                        {meta.label}
                      </span>
                      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 h-3.5 w-3.5 opacity-65" />
                      <select
                        value={project.status}
                        onChange={(event) => void changeStatus(project, event.target.value)}
                        disabled={savingStatusId !== null}
                        aria-label={`Ubah status ${project.projectTitle}`}
                        title="Tekan untuk ubah status"
                        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-wait"
                      >
                        {PROJECT_STATUSES.map((status) => (
                          <option key={status} value={status}>{STATUS_META[status].label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-2 lg:block">
                    <span className="text-[10px] text-neutral-400 lg:hidden">Selesai / target</span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-300">
                      {project.completedAt ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : project.status === "Done" ? <Clock3 className="h-3.5 w-3.5 text-amber-500" /> : <CalendarClock className="h-3.5 w-3.5 text-neutral-400" />}
                      {project.completedAt ? formatDate(project.completedAt) : project.status === "Done" ? "Tanggal lama tak tercatat" : `Target ${formatDate(project.deadline)}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => onEdit(project)} aria-label={`Edit ${project.projectTitle}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => onDelete(project)} aria-label={`Hapus ${project.projectTitle}`} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <p className="px-1 text-[10px] leading-relaxed text-neutral-400">Untuk proyek lama, tanggal selesai hanya ditampilkan bila pernah tercatat. Mulai sekarang tanggalnya otomatis dicatat saat status diubah menjadi Selesai.</p>
    </div>
  )
}
