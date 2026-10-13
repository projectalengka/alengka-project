import type { ProjectStatus } from "@/types"

/**
 * Satu sumber kebenaran untuk warna & label status.
 *
 * Sebelumnya label status ditulis ulang di beberapa komponen (`statusLabels`,
 * `STATUS_OPTS`, badge, dropdown) sehingga mudah tidak sinkron. Semua warna
 * ditulis eksplisit lengkap dengan varian gelapnya supaya tidak bergantung pada
 * kelas dinamis (Tailwind tidak bisa menyusun nama kelas dari potongan string).
 */
export interface StatusMeta {
  /** Label bahasa Indonesia yang tampil ke pengguna. */
  label: string
  /** Keterangan singkat, dipakai sebagai subjudul kolom papan. */
  hint: string
  /** Titik penanda warna. */
  dot: string
  /** Lencana kecil (chip) untuk kartu & filter. */
  chip: string
  /** Warna aksen judul kolom papan. */
  accent: string
}

export const STATUS_META: Record<ProjectStatus, StatusMeta> = {
  Masuk: {
    label: "Masuk",
    hint: "Brief baru, belum dikerjakan",
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/20",
    accent: "bg-slate-400",
  },
  "On Progress": {
    label: "Dikerjakan",
    hint: "Sedang digarap",
    dot: "bg-blue-500",
    chip: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",
    accent: "bg-blue-500",
  },
  Revisi: {
    label: "Revisi",
    hint: "Menunggu perbaikan",
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
    accent: "bg-amber-500",
  },
  Done: {
    label: "Selesai",
    hint: "Sudah kelar, siap ditagih",
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
    accent: "bg-emerald-500",
  },
  Cancel: {
    label: "Dibatalkan",
    hint: "Tidak jadi dikerjakan",
    dot: "bg-red-500",
    chip: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20",
    accent: "bg-red-500",
  },
}

/** Lencana untuk proyek yang sudah pernah masuk invoice. */
export const INVOICED_CHIP =
  "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/20"

/** Lencana untuk proyek selesai yang belum ditagih — panggilan untuk bertindak. */
export const READY_TO_BILL_CHIP =
  "bg-violet-600 text-white border-violet-600 dark:bg-violet-500 dark:border-violet-500"
