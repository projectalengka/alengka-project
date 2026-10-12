export type ProjectStatus = "On Progress" | "Revisi" | "Done" | "Cancel"

/** Nilai status sebagai array runtime — dipakai untuk validasi, bukan hanya sebagai tipe. */
export const PROJECT_STATUSES = ["On Progress", "Revisi", "Done", "Cancel"] as const

export function isProjectStatus(v: unknown): v is ProjectStatus {
  return typeof v === "string" && (PROJECT_STATUSES as readonly string[]).includes(v)
}

export interface Project {
  id: string
  clientName: string
  projectTitle: string
  categoryId: string
  category: Category
  price: number
  status: ProjectStatus
  deadline: Date
  notes: string
  previewImage: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ProjectFormData {
  clientName: string
  projectTitle: string
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

export type Tab = "dashboard" | "projects" | "analytics" | "categories"

export type ToastType = "success" | "warning" | "info"

export interface Filters {
  search: string
  status: "All" | ProjectStatus
  category: string
  sortBy: "createdAt_desc" | "createdAt_asc" | "price_desc" | "deadline_asc"
}

export interface DashboardStats {
  total: number
  onProgress: number
  revisi: number
  done: number
  cancel: number
  totalIncome: number
  pipelineIncome: number
  overdue: number
}

/**
 * Hasil Server Action yang tidak melempar.
 *
 * Sebelumnya semua action melempar Error mentah, sehingga call site yang lupa
 * try/catch gagal dalam senyap (lihat CategoryManager hapus kategori).
 * Semua action sekarang mengembalikan bentuk ini supaya pemanggil WAJIB
 * menangani kedua cabang.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

/** Payload lengkap dashboard: satu action, satu round trip. */
export interface DashboardPayload {
  projects: Project[]
  categories: Category[]
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
