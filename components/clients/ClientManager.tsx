"use client"

import { useMemo, useState, useCallback } from "react"
import type { Client, ClientFormData, Project } from "@/types"
import { createClient, updateClient, deleteClient } from "@/actions/clients"
import { formatCurrency, formatDate } from "@/lib/utils"
import { STATUS_META, READY_TO_BILL_CHIP } from "@/lib/status"
import {
  Plus, Search, Pencil, Trash2, ChevronDown, Users, ReceiptText,
  Loader2, AlertTriangle, X, Mail, MapPin,
} from "lucide-react"

interface ClientManagerProps {
  clients: Client[]
  projects: Project[]
  onChanged: () => void
  onToast: (message: string, type?: "success" | "warning" | "info") => void
  onInvoiceClient: (clientId: string) => void
}

const EMPTY_FORM: ClientFormData = { name: "", contact: "", address: "", notes: "" }

export default function ClientManager({
  clients, projects, onChanged, onToast, onInvoiceClient,
}: ClientManagerProps) {
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState<ClientFormData>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState(false)

  /** Proyek dikelompokkan per klien sekali saja, bukan dicari berulang per kartu. */
  const projectsByClient = useMemo(() => {
    const map = new Map<string, Project[]>()
    for (const p of projects) {
      const list = map.get(p.clientId)
      if (list) list.push(p)
      else map.set(p.clientId, [p])
    }
    return map
  }, [projects])

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return clients
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.contact.toLowerCase().includes(s) ||
        c.address.toLowerCase().includes(s),
    )
  }, [clients, search])

  const openCreate = useCallback(() => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError("")
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((c: Client) => {
    setEditing(c)
    setForm({ name: c.name, contact: c.contact, address: c.address, notes: c.notes })
    setFormError("")
    setFormOpen(true)
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setFormError("")
    if (!form.name.trim()) { setFormError("Nama klien harus diisi."); return }

    setBusy(true)
    try {
      const res = editing
        ? await updateClient(editing.id, form)
        : await createClient(form)
      if (!res.ok) { setFormError(res.error); return }
      onToast(editing ? "Klien diperbarui." : "Klien ditambahkan.")
      setFormOpen(false)
      setEditing(null)
      setForm(EMPTY_FORM)
      onChanged()
    } finally {
      setBusy(false)
    }
  }, [busy, editing, form, onToast, onChanged])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      const res = await deleteClient(deleteTarget.id)
      if (!res.ok) { onToast(res.error, "warning"); return }
      onToast(`Klien "${deleteTarget.name}" dihapus.`, "warning")
      setDeleteTarget(null)
      if (expandedId === deleteTarget.id) setExpandedId(null)
      onChanged()
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, deleting, onToast, onChanged, expandedId])

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
            placeholder="Cari klien..."
            className="w-full bg-white dark:bg-[#111113] border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm pl-10 pr-4 py-2.5 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
          />
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Klien Baru
        </button>
      </div>

      {/* --------------------------------- Daftar -------------------------------- */}
      {visible.length === 0 ? (
        <div className="bg-white dark:bg-[#111113] border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl py-16 text-center">
          <Users className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">
            {search ? "Tidak ada klien yang cocok" : "Belum ada klien"}
          </p>
          <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mt-1">
            {search ? "Coba kata kunci lain." : "Tambahkan klien pertama Anda untuk mulai mencatat proyek."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((c) => {
            const list = projectsByClient.get(c.id) ?? []
            const total = list.reduce((s, p) => s + p.price, 0)
            const billable = list.filter((p) => p.status === "Done" && !p.invoicedAt)
            const billableTotal = billable.reduce((s, p) => s + p.price, 0)
            const expanded = expandedId === c.id

            return (
              <div
                key={c.id}
                className="bg-white dark:bg-[#111113] border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden"
              >
                <div className="p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-neutral-500 dark:text-neutral-400 font-bold text-[13px] shrink-0">
                    {c.name.trim().charAt(0).toUpperCase() || "?"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-semibold text-neutral-900 dark:text-white truncate">
                      {c.name}
                    </h3>
                    <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {list.length} proyek &middot; {formatCurrency(total)}
                    </p>
                    {billable.length > 0 && (
                      <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold px-2 py-1 rounded-lg border ${READY_TO_BILL_CHIP}`}>
                        <ReceiptText className="w-3 h-3" />
                        {billable.length} siap ditagih &middot; {formatCurrency(billableTotal)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(c)}
                      aria-label={`Edit ${c.name}`}
                      className="p-2 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(c)}
                      aria-label={`Hapus ${c.name}`}
                      className="p-2 rounded-xl text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setExpandedId(expanded ? null : c.id)}
                      aria-expanded={expanded}
                      aria-label={`Detail ${c.name}`}
                      className="p-2 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Kontak & alamat singkat */}
                {(c.contact || c.address) && !expanded && (
                  <div className="px-4 pb-3 -mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    {c.contact && (
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <Mail className="w-3 h-3 shrink-0" /><span className="truncate">{c.contact}</span>
                      </span>
                    )}
                    {c.address && (
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{c.address}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Detail: daftar proyek klien ini */}
                {expanded && (
                  <div className="border-t border-neutral-100 dark:border-neutral-900 bg-neutral-50/60 dark:bg-neutral-900/30 p-4 space-y-3">
                    {c.contact && (
                      <p className="text-[11.5px] text-neutral-600 dark:text-neutral-300 flex items-start gap-2">
                        <Mail className="w-3.5 h-3.5 mt-0.5 shrink-0 text-neutral-400" />{c.contact}
                      </p>
                    )}
                    {c.address && (
                      <p className="text-[11.5px] text-neutral-600 dark:text-neutral-300 flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-neutral-400" />{c.address}
                      </p>
                    )}
                    {c.notes && (
                      <p className="text-[11.5px] text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap">{c.notes}</p>
                    )}

                    {list.length === 0 ? (
                      <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400">
                        Belum ada proyek untuk klien ini.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {list.map((p) => {
                          const m = STATUS_META[p.status]
                          return (
                            <li
                              key={p.id}
                              className="flex items-center gap-2.5 bg-white dark:bg-[#111113] border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.dot}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-medium text-neutral-900 dark:text-white truncate">
                                  {p.projectTitle}
                                </p>
                                <p className="text-[10.5px] text-neutral-500 dark:text-neutral-400">
                                  {m.label} &middot; {formatDate(p.deadline)}
                                </p>
                              </div>
                              <span className="text-[11.5px] font-mono font-semibold text-neutral-700 dark:text-neutral-300 shrink-0">
                                {formatCurrency(p.price)}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    )}

                    {billable.length > 0 && (
                      <button
                        onClick={() => onInvoiceClient(c.id)}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-bold border transition-colors cursor-pointer ${READY_TO_BILL_CHIP}`}
                      >
                        <ReceiptText className="w-4 h-4" />
                        Buat Invoice untuk {billable.length} proyek siap ditagih
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ------------------------------- Form klien ------------------------------- */}
      {formOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-neutral-900/50 dark:bg-black/70"
            onClick={busy ? undefined : () => setFormOpen(false)}
          />
          <form
            onSubmit={handleSubmit}
            className="relative bg-white dark:bg-[#111113] border border-neutral-200 dark:border-neutral-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-900 sticky top-0 bg-white dark:bg-[#111113] z-10">
              <h2 className="text-[15px] font-semibold text-neutral-900 dark:text-white">
                {editing ? "Edit Klien" : "Klien Baru"}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label="Tutup"
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="client-name" className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                  Nama klien <span className="text-red-500">*</span>
                </label>
                <input
                  id="client-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="cth: Nexa Tech Solutions"
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm px-3.5 py-2.5 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="client-contact" className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                  Kontak <span className="text-neutral-400 font-normal">(email / telepon)</span>
                </label>
                <input
                  id="client-contact"
                  type="text"
                  value={form.contact}
                  onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                  placeholder="cth: halo@klien.com | +62 812-3456-7890"
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm px-3.5 py-2.5 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
                />
                <p className="text-[10.5px] text-neutral-400 dark:text-neutral-500">
                  Akan terisi otomatis di invoice klien ini.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="client-address" className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                  Alamat
                </label>
                <textarea
                  id="client-address"
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Alamat penagihan"
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm px-3.5 py-2.5 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="client-notes" className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                  Catatan
                </label>
                <textarea
                  id="client-notes"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Opsional"
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm px-3.5 py-2.5 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors resize-none"
                />
              </div>

              {formError && (
                <p className="text-[12px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />{formError}
                </p>
              )}
            </div>

            <div className="px-5 py-4 border-t border-neutral-100 dark:border-neutral-900 flex items-center justify-end gap-2.5 sticky bottom-0 bg-white dark:bg-[#111113]">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                disabled={busy}
                className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing ? "Simpan" : "Tambah Klien"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------ Konfirmasi hapus -------------------------- */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-neutral-900/50 dark:bg-black/70"
            onClick={deleting ? undefined : () => setDeleteTarget(null)}
          />
          <div role="dialog" aria-modal="true" className="relative bg-white dark:bg-[#111113] border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Hapus klien?</h3>
                <p className="mt-1.5 text-[12px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Klien <span className="font-semibold text-neutral-900 dark:text-white">&quot;{deleteTarget.name}&quot;</span> akan
                  dihapus. Klien yang masih punya proyek tidak bisa dihapus.
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
