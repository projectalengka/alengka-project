export function formatCurrency(val: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val)
}

/**
 * Format tanggal yang aman untuk SSR + CSR.
 *
 * Sebelumnya memakai toLocaleDateString("id-ID") polos: opsi default berbeda
 * antara runtime server dan browser, dan di batas hari (dekat tengah malam)
 * hasilnya bisa berbeda -> React melempar hydration mismatch. Semua opsi
 * dipatok eksplisit dan timeZone ditetapkan supaya deterministik.
 */
const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", DATE_FORMAT).format(new Date(date))
}

/** Versi ringkas untuk tooltip / label sempit, mis. "12 Okt". */
export function formatDateShort(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(date))
}

/** Kunci bucket bulanan dalam zona WIB, mis. "2026-06". */
export function monthKey(date: Date | string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
  }).formatToParts(new Date(date))
  const y = parts.find((p) => p.type === "year")?.value ?? "0000"
  const m = parts.find((p) => p.type === "month")?.value ?? "00"
  return `${y}-${m}`
}

/** Label bulan Indonesia dari kunci "YYYY-MM". */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number)
  return new Intl.DateTimeFormat("id-ID", { month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, (m ?? 1) - 1, 1)))
}

/** Nama bulan Indonesia (urut Januari..Desember). */
export const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
] as const

/** Kunci tanggal dalam zona WIB, mis. "2026-06-15". */
function dateKey(date: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(date))
}

/** Apakah deadline sudah lewat, dibanding "hari ini" di zona WIB. */
export function isOverdue(deadline: Date | string): boolean {
  return dateKey(deadline) < dateKey(new Date())
}
