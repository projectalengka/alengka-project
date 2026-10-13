import { test } from "node:test"
import assert from "node:assert/strict"

/*
 * Uji regresi analitik — memakai KODE ASLI dari lib/analytics.ts (bukan
 * salinan), dijalankan lewat tsx sebagai loader.
 *
 * Latar belakang temuan sesi ini: `computeStats()` menghitung jumlah proyek
 * terlambat dengan MEMBANDINGKAN STEMPEL WAKTU (`deadline < Date.now()`),
 * sedangkan lencana baris tabel memakai `isOverdue()` yang membandingkan
 * TANGGAL di zona WIB. Dua definisi berbeda membuat angka di header bisa tidak
 * cocok dengan jumlah baris yang benar-benar disorot.
 */
import { computeStats, buildMonthlySeries, buildCategorySlices } from "../lib/analytics.ts"

/** Proyek minimal yang cukup untuk fungsi-fungsi murni ini. */
function mk(over = {}) {
  return {
    id: "p1",
    clientName: "Klien",
    projectTitle: "Proyek",
    categoryId: "k1",
    category: { id: "k1", name: "Kategori", iconName: "Tag" },
    price: 1_000_000,
    status: "On Progress",
    deadline: new Date(),
    notes: "",
    previewImage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }
}

/* ------------------------------------------------------------ keterlambatan */

test("deadline HARI INI tidak dihitung terlambat (definisi tanggal, bukan jam)", () => {
  // Tengah malam hari ini: dengan perbandingan stempel waktu ini "sudah lewat"
  // begitu jam berjalan, padahal secara tanggal jatuh temponya masih hari ini.
  const t = new Date()
  const startOfToday = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0, 0, 0)
  assert.equal(computeStats([mk({ deadline: startOfToday })]).overdue, 0)
})

test("deadline kemarin dihitung terlambat", () => {
  const y = new Date()
  y.setDate(y.getDate() - 1)
  assert.equal(computeStats([mk({ deadline: y })]).overdue, 1)
})

test("proyek Selesai/Batal tidak pernah dihitung terlambat", () => {
  const y = new Date()
  y.setDate(y.getDate() - 10)
  assert.equal(computeStats([mk({ status: "Done", deadline: y })]).overdue, 0)
  assert.equal(computeStats([mk({ status: "Cancel", deadline: y })]).overdue, 0)
})

test("statistik dasar dihitung benar", () => {
  const s = computeStats([
    mk({ status: "Done", price: 2_000_000 }),
    mk({ status: "On Progress", price: 3_000_000 }),
    mk({ status: "Revisi", price: 1_000_000 }),
    mk({ status: "Cancel", price: 9_000_000 }),
  ])
  assert.equal(s.total, 4)
  assert.equal(s.done, 1)
  assert.equal(s.onProgress, 1)
  assert.equal(s.revisi, 1)
  assert.equal(s.cancel, 1)
  assert.equal(s.totalIncome, 2_000_000, "hanya proyek selesai")
  assert.equal(s.pipelineIncome, 4_000_000, "berjalan + revisi")
})

/* --------------------------------------------------------------- deret bulan */

test("deret bulanan asli selalu 12 bulan dan hanya Done jadi pendapatan", () => {
  const year = new Date().getFullYear()
  assert.equal(buildMonthlySeries([], year).length, 12)

  const series = buildMonthlySeries([
    mk({ status: "Done", price: 5_000_000, createdAt: new Date(year, 0, 15) }),
    mk({ status: "On Progress", price: 9_999_999, createdAt: new Date(year, 0, 16) }),
  ], year)
  assert.equal(series[0].income, 5_000_000)
  assert.equal(series[0].count, 2, "semua proyek dihitung sebagai jumlah")
})

test("tanggal rusak dilewati, tidak menjatuhkan perhitungan", () => {
  const year = new Date().getFullYear()
  const series = buildMonthlySeries([mk({ createdAt: "bukan-tanggal" })], year)
  assert.equal(series.reduce((s, b) => s + b.count, 0), 0)
})

/* ------------------------------------------------------------- sebaran kat. */

test("sebaran kategori: rasio dijumlahkan 100%", () => {
  const slices = buildCategorySlices([
    mk({ categoryId: "a", price: 100 }),
    mk({ categoryId: "a", price: 200 }),
    mk({ categoryId: "b", price: 300 }),
  ])
  const total = slices.reduce((s, x) => s + x.ratio, 0)
  assert.ok(Math.abs(total - 100) < 1e-9, `rasio total ${total}`)
  assert.equal(slices[0].id, "a", "urut dari yang terbanyak")
  assert.equal(slices[0].count, 2)
  assert.equal(slices[0].totalValue, 300)
})

test("tanpa proyek, sebaran kosong (bukan pembagian nol)", () => {
  assert.deepEqual(buildCategorySlices([]), [])
})
