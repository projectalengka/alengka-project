import { test } from "node:test"
import assert from "node:assert/strict"

/*
 * Uji regresi analitik — memakai KODE ASLI dari lib/analytics.ts (bukan
 * salinan), dijalankan lewat tsx sebagai loader.
 *
 * Dua hal yang dijaga berkas ini:
 *  1. "Terlambat" hanya boleh punya SATU definisi. Dulu `computeStats`
 *     membandingkan stempel waktu sementara kartu proyek membandingkan tanggal
 *     di zona WIB, sehingga angka di ringkasan tidak cocok dengan jumlah kartu
 *     yang benar-benar disorot.
 *  2. Sejak alur invoice dipisah dari status, "siap ditagih" BUKAN status
 *     melainkan turunan: proyek `Done` yang belum punya `invoicedAt`.
 */
import { computeStats, buildMonthlySeries, buildCategorySlices } from "../lib/analytics.ts"

/** Proyek minimal yang cukup untuk fungsi-fungsi murni ini. */
function mk(over = {}) {
  return {
    id: "p1",
    projectTitle: "Proyek",
    clientId: "c1",
    client: { id: "c1", name: "Klien", contact: "", address: "", notes: "" },
    categoryId: "k1",
    category: { id: "k1", name: "Kategori", iconName: "Tag" },
    price: 1_000_000,
    status: "Masuk",
    deadline: new Date(),
    notes: "",
    previewImage: null,
    invoicedAt: null,
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

/* --------------------------------------------------------------- statistik */

test("setiap tahap alur dihitung pada kolomnya sendiri", () => {
  const s = computeStats([
    mk({ status: "Masuk" }),
    mk({ status: "On Progress" }),
    mk({ status: "Revisi" }),
    mk({ status: "Done" }),
    mk({ status: "Cancel" }),
  ])
  assert.equal(s.total, 5)
  assert.equal(s.masuk, 1)
  assert.equal(s.onProgress, 1)
  assert.equal(s.revisi, 1)
  assert.equal(s.done, 1)
  assert.equal(s.cancel, 1)
})

test("siap ditagih = Selesai yang belum pernah masuk invoice", () => {
  const s = computeStats([
    mk({ status: "Done", price: 2_000_000 }),                          // siap ditagih
    mk({ status: "Done", price: 3_000_000, invoicedAt: new Date() }),  // sudah ditagih
    mk({ status: "On Progress", price: 9_000_000 }),                   // belum selesai
  ])
  assert.equal(s.siapDitagih, 1)
  assert.equal(s.sudahDitagih, 1)
  assert.equal(s.incomeSiapDitagih, 2_000_000)
  assert.equal(s.incomeDitagih, 3_000_000)
})

test("proyek yang masih dikerjakan tidak dihitung sebagai pendapatan", () => {
  const s = computeStats([
    mk({ status: "Masuk", price: 1_000_000 }),
    mk({ status: "On Progress", price: 2_000_000 }),
    mk({ status: "Revisi", price: 3_000_000 }),
  ])
  assert.equal(s.incomePipeline, 6_000_000)
  assert.equal(s.incomeDitagih, 0)
  assert.equal(s.incomeSiapDitagih, 0)
})

/* --------------------------------------------------------------- deret bulan */

test("deret bulanan asli selalu 12 bulan", () => {
  const year = new Date().getFullYear()
  assert.equal(buildMonthlySeries([], year).length, 12)
})

test("pendapatan bulanan hanya dari proyek yang SUDAH ditagih", () => {
  const year = new Date().getFullYear()
  const series = buildMonthlySeries([
    mk({ status: "Done", price: 5_000_000, invoicedAt: new Date(), createdAt: new Date(year, 0, 15) }),
    mk({ status: "Done", price: 9_000_000, invoicedAt: null, createdAt: new Date(year, 0, 16) }),
  ], year)
  assert.equal(series[0].income, 5_000_000, "yang belum ditagih tidak dihitung")
  assert.equal(series[0].count, 2, "tetapi jumlah proyek tetap dihitung")
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
