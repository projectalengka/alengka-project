"use client"

import { useEffect, useMemo, useState } from "react"
import type { Client, Project } from "@/types"
import { formatCurrency, formatDate } from "@/lib/utils"
import { STATUS_META } from "@/lib/status"
import { AlertCircle, Check, ChevronDown, FilePlus2, History, Search } from "lucide-react"

interface InvoiceWorkspaceProps {
  clients: Client[]
  projects: Project[]
  onOpenInvoice: (clientId: string, projectIds: string[]) => void
}

type ProjectPool = "ready" | "unbilled" | "old"
const POOLS: { id: ProjectPool; label: string; help: string }[] = [
  { id: "ready", label: "Selesai, belum ditagih", help: "Proyek selesai yang belum pernah masuk invoice." },
  { id: "unbilled", label: "Semua belum ditagih", help: "Termasuk order yang masih dikerjakan atau belum selesai." },
  { id: "old", label: "Riwayat proyek", help: "Semua order lama, termasuk yang pernah ditagih." },
]

export default function InvoiceWorkspace({ clients, projects, onOpenInvoice }: InvoiceWorkspaceProps) {
  const [pool, setPool] = useState<ProjectPool>("ready")
  const [clientId, setClientId] = useState("")
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const orderedClients = useMemo(() => [...clients].sort((a, b) => a.name.localeCompare(b.name, "id")), [clients])
  const selectedClient = orderedClients.find((client) => client.id === clientId) ?? null

  useEffect(() => {
    if (clientId && orderedClients.some((client) => client.id === clientId)) return
    const firstWithReadyProject = orderedClients.find((client) => projects.some((p) => p.clientId === client.id && p.status === "Done" && !p.invoicedAt))
    setClientId(firstWithReadyProject?.id ?? orderedClients[0]?.id ?? "")
  }, [clientId, orderedClients, projects])

  const available = useMemo(() => {
    if (!clientId) return []
    const query = search.trim().toLocaleLowerCase("id-ID")
    return projects.filter((project) => {
      if (project.clientId !== clientId) return false
      if (pool === "ready" && (project.status !== "Done" || project.invoicedAt)) return false
      if (pool === "unbilled" && project.invoicedAt) return false
      if (query && !`${project.projectTitle} ${project.category.name}`.toLocaleLowerCase("id-ID").includes(query)) return false
      return true
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [projects, clientId, pool, search])

  const checkedProjects = useMemo(
    () => projects.filter((project) => selectedIds.has(project.id) && project.clientId === clientId),
    [projects, selectedIds, clientId],
  )
  const selectedTotal = checkedProjects.reduce((sum, project) => sum + project.price, 0)
  const allVisibleSelected = available.length > 0 && available.every((project) => selectedIds.has(project.id))

  const changePool = (next: ProjectPool) => { setPool(next); setSelectedIds(new Set()); setSearch("") }
  const changeClient = (next: string) => { setClientId(next); setSelectedIds(new Set()) }
  const toggleProject = (id: string) => setSelectedIds((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const toggleVisible = () => setSelectedIds((current) => {
    const next = new Set(current)
    if (allVisibleSelected) available.forEach((project) => next.delete(project.id))
    else available.forEach((project) => next.add(project.id))
    return next
  })

  const countFor = (id: ProjectPool) => projects.filter((project) => {
    if (project.clientId !== clientId) return false
    if (id === "ready") return project.status === "Done" && !project.invoicedAt
    if (id === "unbilled") return !project.invoicedAt
    return true
  }).length

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#111113] md:flex-row md:items-center md:justify-between md:p-5">
        <div>
          <h2 className="text-base font-semibold">Buat invoice</h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Pilih klien dan satu atau beberapa proyek. Periksa pratinjau sebelum unduh.</p>
        </div>
        <label className="w-full md:max-w-xs">
          <span className="mb-1.5 block text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Klien</span>
          <select value={clientId} onChange={(event) => changeClient(event.target.value)} className="min-h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 text-sm outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:focus:border-neutral-600">
            {orderedClients.length === 0 && <option value="">Belum ada klien</option>}
            {orderedClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>
      </section>

      <section className="grid gap-2 sm:grid-cols-3">
        {POOLS.map((item) => {
          const active = pool === item.id
          const Icon = item.id === "old" ? History : item.id === "ready" ? Check : FilePlus2
          return (
            <button key={item.id} onClick={() => changePool(item.id)} aria-pressed={active} className={`min-h-20 rounded-2xl border p-3.5 text-left transition-colors ${active ? "border-violet-400 bg-violet-50 dark:border-violet-500/50 dark:bg-violet-500/10" : "border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-[#111113] dark:hover:bg-neutral-900"}`}>
              <span className={`flex items-center gap-2 text-xs font-semibold ${active ? "text-violet-700 dark:text-violet-300" : "text-neutral-700 dark:text-neutral-300"}`}><Icon className="h-4 w-4" />{item.label}<span className="ml-auto rounded-full bg-black/5 px-2 py-0.5 text-[10px] dark:bg-white/10">{countFor(item.id)}</span></span>
              <span className="mt-1.5 block text-[10px] leading-relaxed text-neutral-500 dark:text-neutral-400">{item.help}</span>
            </button>
          )
        })}
      </section>

      {pool === "old" && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Riwayat proyek memuat semua order. Proyek berlabel “Pernah ditagih” akan menghasilkan invoice baru dengan nomor/tanggal baru; file invoice lama belum disimpan di sistem.
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-[#111113]">
        <div className="flex flex-col gap-3 border-b border-neutral-100 p-4 dark:border-neutral-900 sm:flex-row sm:items-center sm:justify-between md:px-5">
          <div>
            <h3 className="text-sm font-semibold">{selectedClient?.name ?? "Pilih klien"}</h3>
            <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{POOLS.find((item) => item.id === pool)?.help}</p>
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Cari proyek..." className="min-h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-xs outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:focus:border-neutral-600" />
          </label>
        </div>

        {available.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-2.5 dark:border-neutral-900 md:px-5">
            <button onClick={toggleVisible} className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-violet-700 dark:text-violet-300">
              <span className={`flex h-4 w-4 items-center justify-center rounded border ${allVisibleSelected ? "border-violet-600 bg-violet-600 text-white" : "border-neutral-300 dark:border-neutral-700"}`}>{allVisibleSelected && <Check className="h-3 w-3" />}</span>
              {allVisibleSelected ? "Batalkan pilihan" : "Pilih semua yang tampil"}
            </button>
            <span className="text-[10px] text-neutral-400">{available.length} proyek</span>
          </div>
        )}

        {available.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500 dark:bg-neutral-900"><FilePlus2 className="h-5 w-5" /></div>
            <p className="mt-3 text-sm font-semibold">{selectedClient ? "Tidak ada proyek di daftar ini" : "Tambahkan klien dulu"}</p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{pool === "ready" ? "Proyek yang selesai dan belum pernah ditagih akan muncul di sini." : "Coba pilih jenis proyek lain atau klien berbeda."}</p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-900">
            {available.map((project) => {
              const checked = selectedIds.has(project.id)
              const status = STATUS_META[project.status]
              return (
                <li key={project.id}>
                  <label className={`flex min-h-[76px] cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/50 md:items-center md:px-5 ${checked ? "bg-violet-50/60 dark:bg-violet-500/5" : ""}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleProject(project.id)} className="mt-1 h-4 w-4 shrink-0 accent-violet-600 md:mt-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{project.projectTitle}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                        <span>{project.category.name}</span><span aria-hidden="true">·</span><span className={`rounded-md px-1.5 py-0.5 ${status.chip}`}>{status.label}</span>
                        {project.invoicedAt && <span className="text-amber-700 dark:text-amber-300">Pernah ditagih {formatDate(project.invoicedAt)}</span>}
                      </span>
                    </span>
                    <span className="shrink-0 pt-0.5 text-right md:pt-0"><span className="block text-xs font-semibold tabular-nums">{formatCurrency(project.price)}</span><span className="mt-1 block text-[10px] text-neutral-400">{project.completedAt ? `Selesai ${formatDate(project.completedAt)}` : `Target ${formatDate(project.deadline)}`}</span></span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-lg md:bottom-4 md:p-4 dark:border-neutral-800 dark:bg-[#111113]">
        <div className="min-w-0">
          <p className="text-xs font-semibold">{checkedProjects.length} proyek dipilih</p>
          <p className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">Total sementara {formatCurrency(selectedTotal)}</p>
        </div>
        <button disabled={!selectedClient || checkedProjects.length === 0} onClick={() => selectedClient && onOpenInvoice(selectedClient.id, checkedProjects.map((project) => project.id))} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100">
          Lanjut ke invoice <ChevronDown className="h-4 w-4 -rotate-90" />
        </button>
      </div>
    </div>
  )
}
