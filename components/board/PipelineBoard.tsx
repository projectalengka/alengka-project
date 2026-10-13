"use client"

import { useMemo, useState, useCallback, useEffect } from "react"
import type { Project, ProjectStatus } from "@/types"
import { formatCurrency } from "@/lib/utils"
import { STATUS_META } from "@/lib/status"
import { Search, Plus, FileSpreadsheet, Archive, X } from "lucide-react"
import ProjectCard from "./ProjectCard"

/** Satu kolom papan: cara memilih anggotanya + tampilannya. */
interface ColumnDef {
  key: string
  label: string
  hint: string
  /** Kelas aksen kepala kolom. */
  accent: string
  /** Apakah proyek masuk kolom ini. */
  match: (p: Project) => boolean
}

/*
 * Lima kolom yang mencerminkan alur nyata "desain masuk sampai invoice".
 *
 * Kolom terakhir bukan status tersendiri: `Done` dipecah dua berdasarkan
 * penanda `invoicedAt`, sehingga pekerjaan yang sudah selesai langsung terlihat
 * apakah masih menunggu ditagih atau sudah ditagih.
 */
const COLUMNS: ColumnDef[] = [
  {
    key: "Masuk", label: "Masuk", hint: "Brief baru", accent: STATUS_META.Masuk.accent,
    match: (p) => p.status === "Masuk",
  },
  {
    key: "On Progress", label: "Dikerjakan", hint: "Sedang digarap", accent: STATUS_META["On Progress"].accent,
    match: (p) => p.status === "On Progress",
  },
  {
    key: "Revisi", label: "Revisi", hint: "Perlu perbaikan", accent: STATUS_META.Revisi.accent,
    match: (p) => p.status === "Revisi",
  },
  {
    key: "Siap Ditagih", label: "Siap Ditagih", hint: "Selesai, belum ditagih", accent: "bg-violet-500",
    match: (p) => p.status === "Done" && !p.invoicedAt,
  },
  {
    key: "Sudah Ditagih", label: "Sudah Ditagih", hint: "Sudah masuk invoice", accent: "bg-neutral-400",
    match: (p) => p.invoicedAt !== null,
  },
]

interface PipelineBoardProps {
  projects: Project[]
  onEdit: (p: Project) => void
  onDelete: (p: Project) => void
  onStatusChange: (id: string, status: ProjectStatus) => void
  onInvoice: (p: Project) => void
  onNewProject: () => void
}

export default function PipelineBoard({
  projects, onEdit, onDelete, onStatusChange, onInvoice, onNewProject,
}: PipelineBoardProps) {
  const [search, setSearch] = useState("")
  const [showCancelled, setShowCancelled] = useState(false)
  const [mobileColumn, setMobileColumn] = useState<string>(COLUMNS[0].key)

  /*
   * Hanya SATU versi papan yang dirender, bukan keduanya lalu disembunyikan CSS.
   *
   * Sebelumnya versi desktop (`hidden lg:grid`) dan versi mobile (`lg:hidden`)
   * sama-sama ada di DOM, sehingga setiap kartu proyek dirender dua kali —
   * di ponsel itu berarti seluruh daftar proyek dibangun dua kali meski satu di
   * antaranya tidak pernah terlihat.
   *
   * Pembacaan matchMedia di initializer aman dari hydration mismatch karena
   * papan ini memang tidak pernah dirender di server: selama data belum tiba,
   * halaman menampilkan layar "Memuat", sehingga HTML dari server tidak memuat
   * markup papan sama sekali.
   */
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 1024px)").matches,
  )
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  const searched = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return projects
    return projects.filter(
      (p) =>
        p.projectTitle.toLowerCase().includes(s) ||
        p.client.name.toLowerCase().includes(s) ||
        p.notes.toLowerCase().includes(s),
    )
  }, [projects, search])

  const grouped = useMemo(() => {
    const map = new Map<string, Project[]>()
    for (const col of COLUMNS) map.set(col.key, [])
    for (const p of searched) {
      const col = COLUMNS.find((c) => c.match(p))
      if (col) map.get(col.key)!.push(p)
    }
    return map
  }, [searched])

  const cancelled = useMemo(
    () => searched.filter((p) => p.status === "Cancel"),
    [searched],
  )

  const handleExportCSV = useCallback(() => {
    const headers = ["Klien", "Proyek", "Kategori", "Nilai", "Status", "Deadline", "Sudah Ditagih", "Catatan"]
    const rows = searched.map((p) => [
      p.client.name,
      p.projectTitle,
      p.category.name,
      p.price,
      STATUS_META[p.status].label,
      p.deadline,
      p.invoicedAt ? "Ya" : "Belum",
      p.notes.replace(/\n/g, " "),
    ])
    const csv = [headers.join(";"), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))].join("\r\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Proyek_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [searched])

  const activeMobile = COLUMNS.find((c) => c.key === mobileColumn) ?? COLUMNS[0]
  const activeMobileCards = grouped.get(activeMobile.key) ?? []

  return (
    <div className="space-y-4">
      {/* ------------------------------- Bilah alat ------------------------------- */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari proyek atau klien..."
            className="w-full bg-white dark:bg-[#111113] border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm pl-10 pr-4 py-2.5 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={searched.length === 0}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button
            onClick={onNewProject}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Proyek Baru
          </button>
        </div>
      </div>

      {/* --------------------------- Papan (desktop) ----------------------------- */}
      {isDesktop && (
      <div className="grid grid-cols-5 gap-3 items-start">
        {COLUMNS.map((col) => {
          const cards = grouped.get(col.key) ?? []
          const total = cards.reduce((s, p) => s + p.price, 0)
          return (
            <section key={col.key} className="flex flex-col min-h-[60vh]">
              <header className="flex items-center gap-2 px-1 pb-2.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${col.accent}`} />
                <h3 className="text-[13px] font-semibold text-neutral-900 dark:text-white">{col.label}</h3>
                <span className="text-[11px] font-mono text-neutral-400 dark:text-neutral-500">{cards.length}</span>
                <span className="ml-auto text-[10px] font-mono text-neutral-400 dark:text-neutral-500">
                  {total > 0 ? formatCurrency(total) : ""}
                </span>
              </header>
              <div className="flex-1 space-y-2.5 bg-neutral-100/60 dark:bg-neutral-900/30 rounded-2xl p-2.5">
                {cards.length === 0 ? (
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-600 text-center py-6">
                    Belum ada
                  </p>
                ) : (
                  cards.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onStatusChange={onStatusChange}
                      onInvoice={onInvoice}
                    />
                  ))
                )}
              </div>
            </section>
          )
        })}
      </div>
      )}

      {/* --------------------------- Papan (mobile) ------------------------------ */}
      {!isDesktop && (
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {COLUMNS.map((col) => {
            const count = (grouped.get(col.key) ?? []).length
            const active = mobileColumn === col.key
            return (
              <button
                key={col.key}
                onClick={() => setMobileColumn(col.key)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold border transition-colors cursor-pointer ${
                  active
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-transparent"
                    : "bg-white dark:bg-[#111113] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${col.accent}`} />
                {col.label}
                <span className={`font-mono text-[10px] ${active ? "opacity-70" : "text-neutral-400"}`}>{count}</span>
              </button>
            )
          })}
        </div>

        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 px-1">{activeMobile.hint}</p>

        <div className="space-y-2.5">
          {activeMobileCards.length === 0 ? (
            <div className="bg-white dark:bg-[#111113] border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl py-12 text-center">
              <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
                {search ? "Tidak ada hasil untuk pencarian ini." : "Belum ada proyek di tahap ini."}
              </p>
            </div>
          ) : (
            activeMobileCards.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                onInvoice={onInvoice}
              />
            ))
          )}
        </div>
      </div>
      )}

      {/* ----------------------------- Arsip dibatalkan -------------------------- */}
      {cancelled.length > 0 && (
        <div className="pt-2">
          <button
            onClick={() => setShowCancelled((v) => !v)}
            className="flex items-center gap-2 text-[12px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <Archive className="w-4 h-4" />
            {showCancelled ? "Sembunyikan" : "Lihat"} proyek dibatalkan ({cancelled.length})
          </button>
          {showCancelled && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {cancelled.map((p) => (
                <div key={p.id} className="relative">
                  <ProjectCard
                    project={p}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onStatusChange={onStatusChange}
                  />
                  <button
                    onClick={() => onStatusChange(p.id, "Masuk")}
                    title="Kembalikan ke papan"
                    className="absolute top-3.5 right-3.5 p-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
