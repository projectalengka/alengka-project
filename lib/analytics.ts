import type { Project, DashboardStats, MonthlyPoint, CategorySlice } from "@/types"
import { monthKey, monthLabel, MONTH_NAMES_ID, isOverdue } from "@/lib/utils"

/**
 * Perhitungan laporan.
 *
 * Fungsi-fungsi ini murni (tidak menyentuh database) dan sengaja diletakkan di
 * luar actions/projects.ts: berkas Server Action hanya boleh mengekspor fungsi
 * async, sehingga helper sinkron akan menggagalkan build.
 */

export function computeStats(projects: Project[]): DashboardStats {
  const done = projects.filter((p) => p.status === "Done")
  const pipeline = projects.filter((p) => p.status === "On Progress" || p.status === "Revisi")
  return {
    total: projects.length,
    onProgress: projects.filter((p) => p.status === "On Progress").length,
    revisi: projects.filter((p) => p.status === "Revisi").length,
    done: done.length,
    cancel: projects.filter((p) => p.status === "Cancel").length,
    totalIncome: done.reduce((sum, p) => sum + p.price, 0),
    pipelineIncome: pipeline.reduce((sum, p) => sum + p.price, 0),
    /*
     * Memakai `isOverdue` yang SAMA dengan yang dipakai lencana baris tabel.
     * Sebelumnya di sini membandingkan stempel waktu (`deadline < Date.now()`),
     * sedangkan tabel membandingkan tanggal di zona WIB — dua definisi berbeda,
     * sehingga angka "N proyek lewat deadline" di header bisa tidak cocok
     * dengan jumlah baris yang benar-benar disorot kuning.
     */
    overdue: pipeline.filter((p) => isOverdue(p.deadline)).length,
  }
}

/**
 * Pendapatan & jumlah proyek per bulan, 12 bulan penuh pada tahun berjalan.
 *
 * Versi lama memakai array income/count yang di-hardcode lalu menambahkan data
 * asli di atasnya, dan hanya mencakup Januari–Juli sehingga proyek Agustus–
 * Desember hilang tanpa jejak. Sekarang seluruhnya diturunkan dari `projects`.
 */
export function buildMonthlySeries(
  projects: Project[],
  year = new Date().getFullYear(),
): MonthlyPoint[] {
  const buckets = new Map<string, { income: number; count: number }>()
  for (let m = 1; m <= 12; m++) {
    buckets.set(`${year}-${String(m).padStart(2, "0")}`, { income: 0, count: 0 })
  }

  for (const p of projects) {
    const key = monthKey(p.createdAt)
    // monthKey mengembalikan null untuk tanggal rusak; lewati, jangan masukkan
    // ke bucket mana pun. Sebelumnya nilai rusak akan menjatuhkan halaman.
    if (!key) continue
    const bucket = buckets.get(key)
    if (!bucket) continue // di luar tahun yang ditampilkan
    bucket.count += 1
    if (p.status === "Done") bucket.income += p.price
  }

  return [...buckets.entries()].map(([key, v]) => {
    const monthIndex = Number(key.slice(5, 7)) - 1
    return {
      key,
      name: monthLabel(key),
      shortName: MONTH_NAMES_ID[monthIndex].slice(0, 3),
      income: v.income,
      count: v.count,
    }
  })
}

export function buildCategorySlices(projects: Project[]): CategorySlice[] {
  const total = projects.length
  const map = new Map<string, CategorySlice>()
  for (const p of projects) {
    const existing = map.get(p.categoryId)
    if (existing) {
      existing.count += 1
      existing.totalValue += p.price
    } else {
      map.set(p.categoryId, {
        id: p.categoryId,
        name: p.category?.name ?? p.categoryId,
        count: 1,
        totalValue: p.price,
        ratio: 0,
      })
    }
  }
  const slices = [...map.values()]
  slices.forEach((s) => { s.ratio = total > 0 ? (s.count / total) * 100 : 0 })
  return slices.sort((a, b) => b.count - a.count)
}
