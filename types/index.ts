/**
 * Status proyek mengikuti alur kerja nyata: desain masuk -> dikerjakan ->
 * (revisi) -> selesai -> ditagih.
 *
 * `Masuk` adalah tahap awal. Sebelumnya tidak ada wadah untuk brief yang baru
 * diterima, sehingga proyek selalu lahir sebagai "sedang dikerjakan".
 */
export type ProjectStatus = "Masuk" | "On Progress" | "Revisi" | "Done" | "Cancel"

/** Nilai status sebagai array runtime — dipakai untuk validasi, bukan hanya sebagai tipe. */
export const PROJECT_STATUSES = ["Masuk", "On Progress", "Revisi", "Done", "Cancel"] as const

export function isProjectStatus(v: unknown): v is ProjectStatus {
  return typeof v === "string" && (PROJECT_STATUSES as readonly string[]).includes(v)
}

/** Urutan kolom di papan pipeline. `Cancel` sengaja tidak punya kolom. */
export const BOARD_COLUMNS: ProjectStatus[] = ["Masuk", "On Progress", "Revisi", "Done"]

/** Label bahasa Indonesia untuk setiap status. */
export const STATUS_LABEL: Record<ProjectStatus, string> = {
  Masuk: "Masuk",
  "On Progress": "Dikerjakan",
  Revisi: "Revisi",
  Done: "Selesai",
  Cancel: "Dibatalkan",
}

export interface Client {
  id: string
  name: string
  contact: string
  address: string
  notes: string
  _count?: { projects: number }
}

export interface ClientFormData {
  name: string
  contact: string
  address: string
  notes: string
}

export interface Project {
  id: string
  projectTitle: string
  clientId: string
  client: Client
  categoryId: string
  category: Category
  price: number
  status: ProjectStatus
  deadline: Date
  notes: string
  previewImage: string | null
  /** Terisi bila proyek sudah pernah masuk ke sebuah invoice. */
  invoicedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ProjectFormData {
  projectTitle: string
  clientId: string
  categoryId: string
  price: number
  status: ProjectStatus
  deadline: string
  notes: string
  previewImage?: string | null
}

export interface Category {
  id: string
  name: string
  iconName: string
  _count?: { projects: number }
}

/** Tujuan navigasi. `board` adalah beranda baru (papan pipeline). */
export type Tab = "board" | "clients" | "invoice" | "analytics" | "categories"

export type ToastType = "success" | "warning" | "info"

export interface Filters {
  search: string
  status: "All" | ProjectStatus
  category: string
  sortBy: "createdAt_desc" | "createdAt_asc" | "price_desc" | "deadline_asc"
}

export interface DashboardStats {
  total: number
  masuk: number
  onProgress: number
  revisi: number
  done: number
  cancel: number
  /** Proyek selesai yang belum pernah ditagih — inti kolom "Siap Ditagih". */
  siapDitagih: number
  /** Proyek yang sudah masuk invoice. */
  sudahDitagih: number
  /** Nilai proyek yang sudah ditagih. */
  incomeDitagih: number
  /** Nilai proyek selesai yang menunggu ditagih. */
  incomeSiapDitagih: number
  /** Nilai proyek yang masih dalam pengerjaan. */
  incomePipeline: number
  overdue: number
}

/**
 * Hasil Server Action yang tidak melempar.
 *
 * Semua action mengembalikan bentuk ini supaya pemanggil WAJIB menangani kedua
 * cabang, sehingga tidak ada kegagalan yang hilang tanpa pesan.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

/** Payload lengkap aplikasi: satu action, satu round trip. */
export interface DashboardPayload {
  projects: Project[]
  categories: Category[]
  clients: Client[]
  stats: DashboardStats
}

/** Sebaran kategori untuk laporan. */
export interface CategorySlice {
  id: string
  name: string
  count: number
  ratio: number
  totalValue: number
}

/** Titik data bulanan untuk grafik pendapatan. */
export interface MonthlyPoint {
  key: string
  name: string
  shortName: string
  income: number
  count: number
}
