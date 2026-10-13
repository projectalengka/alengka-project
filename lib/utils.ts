/**
 * Mengubah nilai apa pun menjadi Date yang valid, atau null.
 *
 * PENTING: `Intl.DateTimeFormat.format()` MELEMPAR `RangeError: Invalid time
 * value` bila diberi Invalid Date — ia tidak mengembalikan string kosong.
 * Nilai tidak valid sangat mudah muncul di aplikasi ini:
 *   - state awal form masih "" (mis. `issueDate` di InvoiceModal), dan efek
 *     yang mengisinya baru berjalan SETELAH render pertama;
 *   - `new Date("")`, `new Date(undefined)`, atau tanggal rusak dari database.
 *
 * Dulu hal ini membuat seluruh halaman jatuh ke layar "Terjadi Kesalahan"
 * begitu Invoice dibuka. Semua formatter di bawah kini lewat sini dulu.
 */
function toValidDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/*
 * Semua instance Intl dibuat SEKALI di level modul, lalu dipakai ulang.
 *
 * formatCurrency/formatDate dipanggil sangat sering: setiap baris tabel
 * memanggilnya beberapa kali (harga, deadline, dibuat), ditambah bilah
 * seleksi, toast, dan label grafik — semuanya berulang pada setiap render,
 * termasuk setiap ketikan di kotak pencarian. Membuat instance
 * Intl.NumberFormat/Intl.DateTimeFormat baru setiap panggilan membuang-buang
 * waktu yang terasa sebagai halaman terasa "berat" saat data bertambah.
 * Instance formatter bersifat stateless untuk format(), jadi aman dipakai
 * bersamaan.
 */
const CURRENCY_FORMATTER = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
})

export function formatCurrency(val: number): string {
  return CURRENCY_FORMATTER.format(val)
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

const DATE_FORMATTER = new Intl.DateTimeFormat("id-ID", DATE_FORMAT)

/** Mengembalikan "—" untuk tanggal kosong/rusak, bukan melempar. */
export function formatDate(date: Date | string | null | undefined): string {
  const d = toValidDate(date)
  if (!d) return "—"
  return DATE_FORMATTER.format(d)
}

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  timeZone: "Asia/Jakarta",
})

/** Versi ringkas untuk tooltip / label sempit, mis. "12 Okt". */
export function formatDateShort(date: Date | string | null | undefined): string {
  const d = toValidDate(date)
  if (!d) return "—"
  return SHORT_DATE_FORMATTER.format(d)
}

const MONTH_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  timeZone: "Asia/Jakarta",
})

/** Kunci bucket bulanan dalam zona WIB, mis. "2026-06". Null bila tak valid. */
export function monthKey(date: Date | string | null | undefined): string | null {
  const d = toValidDate(date)
  if (!d) return null
  const parts = MONTH_KEY_FORMATTER.formatToParts(d)
  const y = parts.find((p) => p.type === "year")?.value ?? "0000"
  const m = parts.find((p) => p.type === "month")?.value ?? "00"
  return `${y}-${m}`
}

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  timeZone: "UTC",
})

/** Label bulan Indonesia dari kunci "YYYY-MM". */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number)
  return MONTH_LABEL_FORMATTER.format(new Date(Date.UTC(y, (m ?? 1) - 1, 1)))
}

/** Nama bulan Indonesia (urut Januari..Desember). */
export const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
] as const

const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Jakarta",
})

/** Kunci tanggal dalam zona WIB, mis. "2026-06-15". Null bila tidak valid. */
function dateKey(date: Date | string | null | undefined): string | null {
  const d = toValidDate(date)
  if (!d) return null
  return DATE_KEY_FORMATTER.format(d)
}

/**
 * Apakah deadline sudah lewat, dibanding "hari ini" di zona WIB.
 * Deadline kosong/rusak dianggap TIDAK terlambat — lebih baik tidak menuduh
 * proyek terlambat daripada menjatuhkan halaman karena tanggal tak terbaca.
 */
export function isOverdue(deadline: Date | string | null | undefined): boolean {
  const dk = dateKey(deadline)
  const today = dateKey(new Date())
  if (!dk || !today) return false
  return dk < today
}
