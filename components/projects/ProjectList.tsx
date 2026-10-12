"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import dynamic from "next/dynamic"
import type { Project, Category, ProjectStatus, Filters } from "@/types"
import { formatCurrency, formatDate, isOverdue } from "@/lib/utils"
import {
  Search, Calendar, Eye, Edit2, Trash2, RotateCcw, ArrowUpDown,
  FileSpreadsheet, Layers, CheckCircle2, XOctagon, AlertTriangle,
} from "lucide-react"
import { renderIcon } from "@/lib/icons"

/* InvoiceModal hanya dibutuhkan saat user menekan "Buat Invoice" — jangan
   ikut membebani bundel awal (isinya html2canvas + jspdf, yang berat). */
const InvoiceModal = dynamic(() => import("./InvoiceModal"), { ssr: false })

function StatusBadge({ status }: { status: ProjectStatus }) {
  switch (status) {
    case "On Progress":
      return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium rounded bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-neutral-200/50 dark:border-neutral-800"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />Berjalan</span>
    case "Revisi":
      return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium rounded bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-450 border border-neutral-200/50 dark:border-neutral-800"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Revisi</span>
    case "Done":
      return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium rounded bg-emerald-500/10 text-[#0f5132] dark:text-[#a3cfbb] border border-emerald-500/20"><CheckCircle2 className="w-3 h-3 text-[#198754]" />Selesai</span>
    case "Cancel":
      return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"><XOctagon className="w-3 h-3 text-red-500" />Batal</span>
  }
}

interface ProjectListProps {
  projects: Project[]
  categories: Category[]
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
  onStatusChange: (id: string, status: ProjectStatus) => void
  isDashboard?: boolean
}

const STATUSES: ("All" | ProjectStatus)[] = ["All", "On Progress", "Revisi", "Done", "Cancel"]

const DEFAULT_FILTERS: Filters = { search: "", status: "All", category: "All", sortBy: "createdAt_desc" }

const statusLabels: Record<string, string> = {
  "On Progress": "Berjalan", Revisi: "Revisi", Done: "Selesai", Cancel: "Batal",
}

export default function ProjectList({
  projects, categories, onEdit, onDelete, onStatusChange, isDashboard = false,
}: ProjectListProps) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false)

  /* Satu peta untuk semua lookup kategori.
     Sebelumnya getCatName/getCatIcon masing-masing menjalankan
     categories.find() (O(n)) dan dipanggil 6x per baris. */
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  )

  const todayKey = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Jakarta",
    })
    return fmt.format(new Date())
  }, [])

  const getCatName = useCallback(
    (id: string) => categoryMap.get(id)?.name ?? "Tanpa kategori",
    [categoryMap],
  )
  const getCatIcon = useCallback(
    (id: string) => {
      const c = categoryMap.get(id)
      return c ? renderIcon(c.iconName) : <Layers className="w-3.5 h-3.5" />
    },
    [categoryMap],
  )

  /* ------------------------------------------------------------- filter --- */

  const visibleProjects = useMemo(() => {
    const sorted = isDashboard
      ? [...projects].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ).slice(0, 5)
      : projects
          .filter((p) => {
            const s = filters.search.trim().toLowerCase()
            const matchesText = !s ||
              p.clientName.toLowerCase().includes(s) ||
              p.projectTitle.toLowerCase().includes(s) ||
              p.notes.toLowerCase().includes(s)
            return matchesText &&
              (filters.status === "All" || p.status === filters.status) &&
              (filters.category === "All" || p.categoryId === filters.category)
          })
          .sort((a, b) => {
            switch (filters.sortBy) {
              case "createdAt_asc": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              case "price_desc": return b.price - a.price
              case "deadline_asc": return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
              default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            }
          })
    return sorted
  }, [projects, filters, isDashboard])

  /* Jumlah per kategori dihitung sekali, bukan per chip. */
  const countsByCategory = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of projects) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1)
    return counts
  }, [projects])

  /* --------------------------------------------------------- pilihan ----- */

  const visibleIds = useMemo(() => new Set(visibleProjects.map((p) => p.id)), [visibleProjects])

  /**
   * Pangkas pilihan yang sudah tidak terlihat.
   *
   * Sebelumnya selectedIds tidak pernah dibersihkan: menghapus proyek yang
   * terpilih membuat bilah invoice tetap mengklaim "N proyek dipilih" padahal
   * id-nya sudah hilang, dan InvoiceModal diam-diam menampilkan lebih sedikit.
   */
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = prev.filter((id) => projects.some((p) => p.id === id))
      return next.length === prev.length ? prev : next
    })
  }, [projects])

  const allVisibleSelected = visibleProjects.length > 0 &&
    visibleProjects.every((p) => selectedIds.includes(p.id))

  const toggleSelectAll = useCallback((checked: boolean) => {
    setSelectedIds(checked ? [...visibleIds] : [])
  }, [visibleIds])

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }, [])

  const selectedProjects = useMemo(
    () => projects.filter((p) => selectedIds.includes(p.id)),
    [projects, selectedIds],
  )

  /* ----------------------------------------------------------- ekspor ---- */

  const handleExportCSV = useCallback(() => {
    const headers = ["Klien", "Proyek", "Kategori", "Nilai", "Status", "Deadline", "Catatan", "Dibuat"]
    const rows = visibleProjects.map((p) => [
      p.clientName, p.projectTitle, getCatName(p.categoryId), p.price,
      statusLabels[p.status] || p.status, formatDate(p.deadline),
      p.notes.replace(/\n/g, " "), formatDate(p.createdAt),
    ])
    const csv = [headers.join(";"), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))].join("\r\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Proyek_${todayKey}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [visibleProjects, getCatName, todayKey])

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), [])
  const isFiltered = filters.search !== "" || filters.category !== "All" || filters.status !== "All"

  /* ------------------------------------------------------------- render -- */

  return (
    <div className="space-y-6">
      {!isDashboard && (
        <>
          <div className="space-y-2">
            <span className="block text-[8.5px] uppercase font-medium tracking-[0.2em] text-neutral-400 dark:text-neutral-500 pl-1">Kategori</span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {["All", ...categories.map((c) => c.id)].map((cat) => {
                const isSelected = filters.category === cat
                const count = cat === "All" ? projects.length : (countsByCategory.get(cat) ?? 0)
                return (
                  <button key={cat} onClick={() => setFilters((prev) => ({ ...prev, category: cat }))}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      isSelected ? "bg-neutral-950 dark:bg-neutral-100 border-transparent text-white dark:text-neutral-950 shadow-xs" : "bg-white dark:bg-[#0d0d0f]/60 border-neutral-200 dark:border-neutral-900/60 text-neutral-550 dark:text-neutral-400 hover:bg-neutral-50/60 hover:text-neutral-950 dark:hover:text-white"
                    }`}>
                    {cat === "All" ? <Layers className="w-3.5 h-3.5" /> : getCatIcon(cat)}
                    <span>{cat === "All" ? "Semua" : getCatName(cat)}</span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${isSelected ? "bg-white/20 dark:bg-neutral-950/20" : "bg-neutral-100 dark:bg-neutral-900 text-neutral-400"}`}>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-[#0d0d0f]/50 border border-neutral-200 dark:border-neutral-900/60 rounded-xl p-4 space-y-4 shadow-xs">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 w-3.5 h-3.5" />
                <input type="text" placeholder="Cari klien atau proyek..." value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                  className="w-full bg-[#f5f5f7] dark:bg-[#121214]/60 border border-neutral-200/60 dark:border-neutral-850/40 text-xs pl-10 pr-4 py-2 rounded-lg text-neutral-800 dark:text-neutral-250 placeholder-neutral-400 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 transition-all" />
              </div>
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-1.5 bg-[#f5f5f7] dark:bg-[#121214]/60 border border-neutral-200/60 dark:border-neutral-850/40 rounded-lg px-2.5 py-1.5">
                  <span className="text-[8.5px] font-semibold text-neutral-400 uppercase tracking-widest">Status:</span>
                  <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value as Filters["status"] }))} className="bg-transparent text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none font-medium cursor-pointer">
                    {STATUSES.map((st) => (
                      <option key={st} value={st}>{st === "All" ? "Semua Status" : statusLabels[st]}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5 bg-[#f5f5f7] dark:bg-[#121214]/60 border border-neutral-200/60 dark:border-neutral-850/40 rounded-lg px-2.5 py-1.5">
                  <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  <select value={filters.sortBy} onChange={(e) => setFilters((p) => ({ ...p, sortBy: e.target.value as Filters["sortBy"] }))} className="bg-transparent text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none font-medium cursor-pointer">
                    <option value="createdAt_desc">Terbaru</option>
                    <option value="createdAt_asc">Terlama</option>
                    <option value="price_desc">Termahal</option>
                    <option value="deadline_asc">Deadline</option>
                  </select>
                </div>
                {isFiltered && (
                  <button onClick={resetFilters} disabled={visibleProjects.length === 0} className="p-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900/60 dark:hover:bg-neutral-800 text-neutral-500 rounded-lg border border-neutral-200/60 dark:border-neutral-800/40 transition-colors cursor-pointer disabled:opacity-40">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={handleExportCSV} disabled={visibleProjects.length === 0} className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-850/50 text-neutral-500 bg-white dark:bg-[#121214]/30 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  <FileSpreadsheet className="w-3.5 h-3.5" />CSV
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {visibleProjects.length === 0 ? (
        <div className="py-16 px-6 text-center">
          <div className="w-10 h-10 rounded-lg bg-[#f5f5f7] dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800 flex items-center justify-center text-neutral-400 mx-auto mb-4">
            {isFiltered && !isDashboard ? <Search className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
          </div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
            {isFiltered && !isDashboard ? "Tidak Ada Hasil" : "Belum Ada Proyek"}
          </h3>
          <p className="text-xs text-neutral-450 dark:text-neutral-500 mt-1.5">
            {isFiltered && !isDashboard
              ? "Coba ubah kata kunci atau reset filter."
              : "Belum ada proyek nih~"}
          </p>
          {isFiltered && !isDashboard && (
            <button onClick={resetFilters} className="mt-4 px-3.5 py-1.5 text-[11px] font-semibold rounded-lg bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 cursor-pointer">
              Reset filter
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white dark:bg-[#0d0d0f]/50 border border-neutral-200 dark:border-neutral-900/60 rounded-xl shadow-xs overflow-hidden animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-900 text-[8.5px] uppercase font-semibold tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
                    <th className="py-4 px-5 w-12">
                      <input type="checkbox" checked={allVisibleSelected} onChange={(e) => toggleSelectAll(e.target.checked)}
                        ref={(el) => {
                          if (el) el.indeterminate = !allVisibleSelected && visibleProjects.some((p) => selectedIds.includes(p.id))
                        }}
                        aria-label="Pilih semua" className="w-3.5 h-3.5 rounded border-neutral-300 cursor-pointer" />
                    </th>
                    <th className="py-4 px-6">Klien &amp; Proyek</th>
                    <th className="py-4 px-4 text-center">Kategori</th>
                    <th className="py-4 px-4 text-center">Status</th>
                    <th className="py-4 px-4 text-right">Nilai</th>
                    <th className="py-4 px-4 text-center">Deadline</th>
                    <th className="py-4 px-6 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200/50 dark:divide-neutral-900/30">
                  {visibleProjects.map((p) => {
                    const late = isOverdue(p.deadline) && p.status !== "Done" && p.status !== "Cancel"
                    return (
                      <tr key={p.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-950/20 transition-colors text-xs">
                        <td className="py-4 px-5 text-center">
                          <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleOne(p.id)} className="w-3.5 h-3.5 rounded border-neutral-300 cursor-pointer" />
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-4">
                            {p.previewImage ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={p.previewImage} alt="" loading="lazy" className="w-10 h-10 rounded object-cover bg-[#f5f5f7] dark:bg-neutral-900 border border-neutral-150 dark:border-neutral-850" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-[#f5f5f7] dark:bg-neutral-900 border border-neutral-150 dark:border-neutral-850 flex items-center justify-center text-neutral-400 shrink-0">{getCatIcon(p.categoryId)}</div>
                            )}
                            <div className="max-w-xs overflow-hidden">
                              <span className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 block uppercase tracking-[0.12em]">{p.clientName}</span>
                              <span className="text-xs font-semibold text-neutral-850 dark:text-neutral-200 block truncate">{p.projectTitle}</span>
                              {p.notes && (
                                <button onClick={() => setExpandedNotesId(expandedNotesId === p.id ? null : p.id)} className="mt-1 text-[10px] text-neutral-450 dark:text-neutral-500 hover:text-neutral-950 dark:hover:text-neutral-200 flex items-center gap-1 cursor-pointer">
                                  <Eye className="w-3 h-3" />{expandedNotesId === p.id ? "Sembunyikan" : "Catatan"}
                                </button>
                              )}
                              {expandedNotesId === p.id && <p className="mt-2 text-[11px] text-neutral-600 dark:text-neutral-350 bg-neutral-50/50 dark:bg-neutral-900 border border-neutral-150 dark:border-neutral-850 rounded p-3 max-w-sm leading-relaxed whitespace-pre-wrap">{p.notes}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                            {getCatIcon(p.categoryId)}{getCatName(p.categoryId)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <select value={p.status} onChange={(e) => onStatusChange(p.id, e.target.value as ProjectStatus)}
                            className="appearance-none bg-[#f5f5f7]/80 dark:bg-[#121214] border border-neutral-150 dark:border-neutral-850 rounded text-[10px] font-medium py-1 pl-3 pr-7 text-neutral-600 dark:text-neutral-400 focus:outline-none cursor-pointer">
                            <option value="On Progress">Berjalan</option>
                            <option value="Revisi">Revisi</option>
                            <option value="Done">Selesai</option>
                            <option value="Cancel">Batal</option>
                          </select>
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-neutral-900 dark:text-[#f5f5f7] font-semibold text-xs">{formatCurrency(p.price)}</td>
                        <td className="py-4 px-4 text-center">
                          <div className="space-y-0.5">
                            <span className={`block text-xs font-semibold ${late ? "text-amber-600 dark:text-amber-400" : "text-neutral-850 dark:text-neutral-200"}`}>
                              {late && <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />}
                              {formatDate(p.deadline)}
                            </span>
                            <span className="text-[9px] text-neutral-400 dark:text-neutral-500 block">{formatDate(p.createdAt)}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            <button onClick={() => onEdit(p)} className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded transition-colors cursor-pointer" title="Edit" aria-label={`Edit ${p.projectTitle}`}><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => onDelete(p)} className="p-1 text-red-500 hover:text-red-700 rounded transition-colors cursor-pointer" title="Hapus" aria-label={`Hapus ${p.projectTitle}`}><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:hidden pb-20 animate-fade-in">
            {visibleProjects.map((p) => {
              const late = isOverdue(p.deadline) && p.status !== "Done" && p.status !== "Cancel"
              return (
                <div key={p.id} className="bg-white dark:bg-[#0d0d0f]/50 border border-neutral-200 dark:border-neutral-900/60 rounded-xl p-5 space-y-4 shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 max-w-[70%]">
                      <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleOne(p.id)} className="w-3.5 h-3.5 rounded border-neutral-300 mt-0.5 cursor-pointer" />
                      <div className="space-y-0.5 truncate">
                        <span className="text-[9px] font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500 block truncate">{p.clientName}</span>
                        <h4 className="text-xs font-semibold text-neutral-850 dark:text-neutral-200 leading-tight">{p.projectTitle}</h4>
                      </div>
                    </div>
                    <span className="text-xs font-semibold font-mono text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-2.5 py-0.5 rounded shrink-0">{formatCurrency(p.price)}</span>
                  </div>
                  {p.previewImage && (
                    <div className="border border-neutral-100 dark:border-neutral-900 bg-[#f5f5f7]/30 dark:bg-[#121214]/10 rounded overflow-hidden h-28 flex items-center justify-center p-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.previewImage} alt="" loading="lazy" className="max-h-24 w-auto object-contain rounded bg-white dark:bg-neutral-900 shadow-xs" />
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                    <span className="inline-flex items-center px-2 py-0.5 text-[9.5px] text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 border border-neutral-150 dark:border-[#1d1d23] rounded">
                      {getCatIcon(p.categoryId)}{getCatName(p.categoryId)}
                    </span>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="text-[10px] text-neutral-600 dark:text-neutral-400 space-y-1 bg-neutral-50/55 dark:bg-neutral-950/25 p-3 rounded-lg border border-neutral-150 dark:border-neutral-900/80">
                    <div className={`flex items-center gap-1.5 font-medium ${late ? "text-amber-600 dark:text-amber-400" : "text-neutral-750 dark:text-neutral-350"}`}>
                      {late ? <AlertTriangle className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5 text-neutral-400" />}
                      <span>Deadline: {formatDate(p.deadline)}</span>
                    </div>
                  </div>
                  <div className="border-t border-neutral-100 dark:border-neutral-900/60 pt-3 flex items-center justify-between">
                    <select value={p.status} onChange={(e) => onStatusChange(p.id, e.target.value as ProjectStatus)}
                      className="bg-transparent border border-neutral-150 dark:border-neutral-900 rounded px-2 py-1 text-[10px] text-neutral-600 dark:text-neutral-400 cursor-pointer focus:outline-none">
                      <option value="On Progress">Berjalan</option>
                      <option value="Revisi">Revisi</option>
                      <option value="Done">Selesai</option>
                      <option value="Cancel">Batal</option>
                    </select>
                    <div className="flex gap-1">
                      <button onClick={() => onEdit(p)} className="p-1.5 text-neutral-400 hover:text-neutral-800 dark:hover:text-white transition-colors cursor-pointer" aria-label={`Edit ${p.projectTitle}`}><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => onDelete(p)} className="p-1.5 text-red-500 hover:text-red-700 transition-colors cursor-pointer" aria-label={`Hapus ${p.projectTitle}`}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {selectedIds.length > 0 && !isDashboard && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] w-[calc(100%-2rem)] max-w-lg bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 rounded-xl p-4 shadow-2xl flex items-center justify-between gap-4 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-950 rounded-lg"><FileSpreadsheet className="w-4 h-4 text-emerald-400 dark:text-emerald-600" /></div>
            <div className="flex flex-col">
              <span className="text-xs font-bold">{selectedProjects.length} Proyek Dipilih</span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-550">Total {formatCurrency(selectedProjects.reduce((s, p) => s + p.price, 0))}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedIds([])} className="px-3 py-1.5 text-[10px] font-semibold text-neutral-450 hover:text-white dark:text-neutral-500 dark:hover:text-black hover:bg-white/10 dark:hover:bg-neutral-950/5 rounded-lg transition-colors cursor-pointer">Batal</button>
            <button onClick={() => setIsInvoiceOpen(true)} className="px-3.5 py-1.5 bg-neutral-100 dark:bg-neutral-950 text-neutral-950 dark:text-white hover:bg-neutral-200 dark:hover:bg-neutral-900 font-bold rounded-lg text-[11px] flex items-center gap-1.5 transition-all cursor-pointer">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />Buat Invoice
            </button>
          </div>
        </div>
      )}

      {isInvoiceOpen && (
        <InvoiceModal
          isOpen={isInvoiceOpen}
          onClose={() => setIsInvoiceOpen(false)}
          selectedProjects={selectedProjects}
          categories={categories}
        />
      )}
    </div>
  )
}
