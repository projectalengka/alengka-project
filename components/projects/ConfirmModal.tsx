"use client"

import { Trash2, AlertOctagon, Loader2 } from "lucide-react"

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  projectName: string
  /** True selagi proses hapus berjalan — mencegah klik ganda. */
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  isOpen, title, projectName, busy = false, onConfirm, onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#09090b]/40 dark:bg-black/60 backdrop-blur-md" onClick={busy ? undefined : onCancel} />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative bg-white dark:bg-[#0d0d0f] border border-neutral-200/70 dark:border-neutral-900 rounded-lg w-full max-w-md p-6 sm:p-8 shadow-2xl animate-fade-in text-neutral-800 dark:text-neutral-200">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded text-red-500 flex-shrink-0">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</h3>
            <p className="mt-2 text-xs text-neutral-450 dark:text-neutral-400 leading-relaxed">
              Yakin mau hapus proyek{" "}
              <span className="font-semibold italic text-neutral-900 dark:text-white">&quot;{projectName}&quot;</span>? Data bakal kehapus permanen, lho.
            </p>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-neutral-100 dark:border-neutral-900/60 pt-4">
          <button onClick={onCancel} disabled={busy} className="px-4 py-2 border border-neutral-200 dark:border-neutral-850 text-neutral-500 dark:text-neutral-400 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            Batal
          </button>
          <button onClick={onConfirm} disabled={busy} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all text-xs flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {busy ? "Menghapus..." : "Hapus"}
          </button>
        </div>
      </div>
    </div>
  )
}
