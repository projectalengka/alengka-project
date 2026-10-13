"use client"

import { useMemo, useState } from "react"
import type { Client, Project } from "@/types"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ReceiptText, ChevronDown, CheckCircle2, Undo2, ArrowRight } from "lucide-react"

interface InvoiceWorkspaceProps {
  clients: Client[]
  projects: Project[]
  /** Membuka lembar invoice untuk satu klien + daftar proyeknya. */
  onOpenInvoice: (clientId: string, projectIds: string[]) => void
  /** Melepas penanda "sudah ditagih" bila salah tandai. */
  onUnmark: (ids: string[]) => void
  /** Menandai manual, mis. bila invoice dicetak lewat jalur cadangan. */
  onMark: (ids: string[]) => void
  onGoToBoard: () => void
}

interface BillableGroup {
  client: Client
  projects: Project[]
  total: number
}

export default function InvoiceWorkspace({
  clients, projects, onOpenInvoice, onUnmark, onMark, onGoToBoard,
}: InvoiceWorkspaceProps) {
  const [showHistory, setShowHistory] = useState(false)

  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients],
  )

  /*
   * Inti penyederhanaan alur: proyek yang perlu ditagih dicari OTOMATIS.
   * Dulu pengguna harus membuka tabel proyek, mencari satu per satu, lalu
   * mencentangnya — dan identitas klien diketik ulang dari nol.
   */
  const billable = useMemo<BillableGroup[]>(() => {
    const map = new Map<string, Project[]>()
    for (const p of projects) {
      if (p.status !== "Done" || p.invoicedAt) continue
      const list = map.get(p.clientId)
      if (list) list.push(p)
      else map.set(p.clientId, [p])
    }
    return [...map.entries()]
      .map(([clientId, list]) => ({
        client: clientById.get(clientId) ?? list[0].client,
        projects: list,
        total: list.reduce((s, p) => s + p.price, 0),
      }))
      .sort((a, b) => b.total - a.total)
  }, [projects, clientById])

  const invoiced = useMemo(() => {
    const map = new Map<string, Project[]>()
    for (const p of projects) {
      if (!p.invoicedAt) continue
      const list = map.get(p.clientId)
      if (list) list.push(p)
      else map.set(p.clientId, [p])
    }
    return [...map.entries()].map(([clientId, list]) => ({
      client: clientById.get(clientId) ?? list[0].client,
      projects: list,
      total: list.reduce((s, p) => s + p.price, 0),
    })).sort((a, b) => b.total - a.total)
  }, [projects, clientById])

  const totalBillable = billable.reduce((s, g) => s + g.total, 0)
  const totalInvoiced = invoiced.reduce((s, g) => s + g.total, 0)

  return (
    <div className="space-y-5">
      {/* --------------------------------- Ringkasan ------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-[#111113] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            Belum ditagih
          </p>
          <p className="text-2xl font-semibold text-neutral-900 dark:text-white mt-1.5 tracking-tight">
            {formatCurrency(totalBillable)}
          </p>
          <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {billable.reduce((s, g) => s + g.projects.length, 0)} proyek dari {billable.length} klien
          </p>
        </div>
        <div className="bg-white dark:bg-[#111113] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            Sudah ditagih
          </p>
          <p className="text-2xl font-semibold text-neutral-900 dark:text-white mt-1.5 tracking-tight">
            {formatCurrency(totalInvoiced)}
          </p>
          <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            {invoiced.reduce((s, g) => s + g.projects.length, 0)} proyek
          </p>
        </div>
      </div>

      {/* ------------------------------- Siap ditagih ----------------------------- */}
      <section className="space-y-2.5">
        <h3 className="text-[13px] font-semibold text-neutral-900 dark:text-white px-0.5">
          Siap ditagih
        </h3>

        {billable.length === 0 ? (
          <div className="bg-white dark:bg-[#111113] border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl py-14 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">Semua sudah ditagih</p>
            <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-1 mb-4">
              Tidak ada proyek selesai yang menunggu invoice.
            </p>
            <button
              onClick={onGoToBoard}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
            >
              Buka papan <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          billable.map((g) => (
            <div
              key={g.client.id}
              className="bg-white dark:bg-[#111113] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-[14px] font-semibold text-neutral-900 dark:text-white truncate">
                    {g.client.name}
                  </h4>
                  <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {g.projects.length} proyek &middot; {formatCurrency(g.total)}
                  </p>
                </div>
                <button
                  onClick={() => onOpenInvoice(g.client.id, g.projects.map((p) => p.id))}
                  className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold transition-colors cursor-pointer"
                >
                  <ReceiptText className="w-4 h-4" />
                  Buat Invoice
                </button>
              </div>

              <ul className="mt-3 space-y-1.5">
                {g.projects.map((p) => (
                  <li key={p.id} className="flex items-center gap-2.5 text-[11.5px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-neutral-700 dark:text-neutral-300">
                      {p.projectTitle}
                    </span>
                    <span className="font-mono text-neutral-600 dark:text-neutral-400 shrink-0">
                      {formatCurrency(p.price)}
                    </span>
                    {/* Jalan keluar bila invoice dicetak lewat jalur cadangan
                        (window.print) sehingga penandaan otomatis tidak jalan. */}
                    <button
                      onClick={() => onMark([p.id])}
                      title="Tandai sudah ditagih"
                      aria-label={`Tandai ${p.projectTitle} sudah ditagih`}
                      className="shrink-0 p-1.5 rounded-lg text-neutral-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {/* --------------------------------- Riwayat -------------------------------- */}
      {invoiced.length > 0 && (
        <section className="space-y-2.5">
          <button
            onClick={() => setShowHistory((v) => !v)}
            aria-expanded={showHistory}
            className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900 dark:text-white px-0.5 cursor-pointer"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${showHistory ? "rotate-180" : ""}`} />
            Sudah ditagih ({invoiced.reduce((s, g) => s + g.projects.length, 0)})
          </button>

          {showHistory && (
            <div className="space-y-2.5">
              {invoiced.map((g) => (
                <div
                  key={g.client.id}
                  className="bg-white dark:bg-[#111113] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-[13px] font-semibold text-neutral-900 dark:text-white truncate">
                        {g.client.name}
                      </h4>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {g.projects.length} proyek &middot; {formatCurrency(g.total)}
                      </p>
                    </div>
                    <button
                      onClick={() => onUnmark(g.projects.map((p) => p.id))}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-[11.5px] font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      Batalkan
                    </button>
                  </div>
                  <ul className="mt-2.5 space-y-1">
                    {g.projects.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                        <CheckCircle2 className="w-3 h-3 text-violet-500 shrink-0" />
                        <span className="flex-1 min-w-0 truncate">{p.projectTitle}</span>
                        <span className="shrink-0">
                          {p.invoicedAt ? formatDate(p.invoicedAt) : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
