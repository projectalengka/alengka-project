import { test } from "node:test"
import assert from "node:assert/strict"

/**
 * Uji regresi untuk logika yang sebelumnya salah.
 * Dijalankan dengan `npm test` (node --test) — tidak butuh database.
 */

/* ---------------------------------------------------------------- analytics */

/**
 * Salinan murni dari buildMonthlySeries() di actions/projects.ts.
 * Versi lama memakai array income/count hardcoded dan hanya 7 bulan.
 */
function buildMonthlySeries(projects, year) {
  const buckets = Array.from({ length: 12 }, (_, i) => ({
    key: `${year}-${String(i + 1).padStart(2, "0")}`,
    income: 0,
    count: 0,
  }))
  for (const p of projects) {
    const d = new Date(p.createdAt)
    const idx = d.getMonth()
    if (d.getFullYear() !== year || idx < 0 || idx > 11) continue
    buckets[idx].count += 1
    if (p.status === "Done") buckets[idx].income += p.price
  }
  return buckets
}

test("laporan mencakup 12 bulan, bukan 7", () => {
  const series = buildMonthlySeries([], 2026)
  assert.equal(series.length, 12)
  assert.equal(series[0].key, "2026-01")
  assert.equal(series[11].key, "2026-12")
})

test("proyek Agustus-Desember tidak lagi hilang", () => {
  const series = buildMonthlySeries([
    { price: 1_000_000, status: "Done", createdAt: new Date(2026, 7, 10) },
    { price: 2_000_000, status: "Done", createdAt: new Date(2026, 11, 20) },
  ], 2026)
  assert.equal(series[7].count, 1, "Agustus harus terlihat")
  assert.equal(series[11].count, 1, "Desember harus terlihat")
})

test("pendapatan nol saat tidak ada data, bukan angka karangan", () => {
  const series = buildMonthlySeries([], 2026)
  assert.equal(series.reduce((s, b) => s + b.income, 0), 0)
  assert.ok(series.every((b) => b.count === 0))
})

test("hanya proyek Done dihitung sebagai pendapatan", () => {
  const series = buildMonthlySeries([
    { price: 3_200_000, status: "Done", createdAt: new Date(2026, 5, 1) },
    { price: 9_999_999, status: "On_Progress", createdAt: new Date(2026, 5, 2) },
    { price: 9_999_999, status: "Cancel", createdAt: new Date(2026, 5, 3) },
  ], 2026)
  assert.equal(series[5].income, 3_200_000)
  assert.equal(series[5].count, 3, "semua proyek tetap dihitung sebagai jumlah")
})

test("proyek tahun lain tidak bocor", () => {
  const series = buildMonthlySeries([
    { price: 5_000_000, status: "Done", createdAt: new Date(2025, 5, 1) },
  ], 2026)
  assert.equal(series.reduce((s, b) => s + b.income, 0), 0)
})

/* ------------------------------------------------------------ validasi form */

/**
 * Cermin dari validateProject() di actions/projects.ts.
 *
 * Perubahan sesi ini: identitas klien bukan lagi teks bebas (`clientName`) di
 * dalam proyek, melainkan rujukan ke tabel `clients` (`clientId`). Status juga
 * bertambah satu tahap paling awal, `Masuk`.
 */
function validateProject(data) {
  if (!data.projectTitle?.trim()) return "Judul proyek harus diisi."
  if (!data.clientId) return "Klien harus dipilih."
  if (!data.categoryId) return "Kategori harus dipilih."
  if (typeof data.price !== "number" || !Number.isFinite(data.price) || data.price < 0) return "Harga tidak valid."
  if (!["Masuk", "On Progress", "Revisi", "Done", "Cancel"].includes(data.status)) return "Status tidak dikenal."
  if (!data.deadline) return "Deadline harus diisi."
  return null
}

const base = {
  projectTitle: "Logo", clientId: "cli_1", categoryId: "Logo",
  price: 1000, status: "Masuk", deadline: "2026-06-15",
}

test("proyek valid lolos", () => assert.equal(validateProject(base), null))

test("status di luar enum ditolak", () => {
  assert.match(validateProject({ ...base, status: "Selesai" }), /Status tidak dikenal/)
})

test("status 'Masuk' adalah tahap awal yang sah", () => {
  assert.equal(validateProject({ ...base, status: "Masuk" }), null)
})

test("proyek tanpa klien ditolak", () => {
  assert.match(validateProject({ ...base, clientId: "" }), /Klien harus dipilih/)
})

test("harga non-numerik ditolak", () => {
  assert.ok(validateProject({ ...base, price: NaN }))
  assert.ok(validateProject({ ...base, price: -1 }))
})

test("judul hanya berisi spasi ditolak", () => {
  assert.ok(validateProject({ ...base, projectTitle: "   " }))
})

/* ------------------------------------------------------- tabrakan slug/id --- */

test("bug lama: dua nama kategori berbeda menghasilkan id sama", () => {
  const legacy = (n) => n.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()
  assert.equal(legacy("Logo Design"), legacy("Logo-Design"),
    "inilah tabrakan primary key yang dulu membuat create gagal")
})

test("id acak tidak bertabrakan", () => {
  const ids = new Set(Array.from({ length: 500 }, () => crypto.randomUUID()))
  assert.equal(ids.size, 500)
})

/* ----------------------------------------------------------------- tanggal -- */

test("format tanggal deterministik dan tidak bergantung locale runtime", () => {
  const fmt = (d) => new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta",
  }).format(new Date(d))
  const out = fmt("2026-06-15")
  assert.ok(out.includes("2026"), out)
  assert.ok(out.includes("Jun"), out)
  assert.equal(fmt("2026-06-15"), out, "panggilan berulang harus identik")
})

test("perbandingan deadline di batas hari", () => {
  const key = (d) => new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Jakarta",
  }).format(new Date(d))
  assert.equal(key("2020-01-01") < key(new Date()), true)
  assert.equal(key("2999-01-01") < key(new Date()), false)
})

/* ------------------------------------------------------------------ invoice - */

/** Cermin dari perhitungan di InvoiceModal setelah diskon dibatasi. */
function invoiceTotals(subtotal, taxPercent, discount) {
  const taxAmount = (subtotal * taxPercent) / 100
  const safeDiscount = Math.min(Math.max(0, discount), subtotal + taxAmount)
  return {
    subtotal, taxAmount, discount: safeDiscount,
    total: subtotal + taxAmount - safeDiscount,
  }
}

test("total invoice tidak pernah negatif", () => {
  const r = invoiceTotals(1_000_000, 11, 99_999_999)
  assert.equal(r.discount, 1_110_000)
  assert.equal(r.total, 0)
  assert.ok(r.total >= 0)
})

test("diskon wajar tetap dihitung apa adanya", () => {
  assert.equal(invoiceTotals(1_000_000, 0, 250_000).total, 750_000)
})

test("diskon negatif diperlakukan sebagai nol", () => {
  assert.equal(invoiceTotals(1_000_000, 0, -50_000).total, 1_000_000)
})

/* ----------------------------------------------------------------- pilihan -- */

test("pilihan proyek dipangkas saat proyeknya sudah hilang", () => {
  const projects = [{ id: "a" }, { id: "b" }]
  const pruned = ["a", "b", "sudah-dihapus"].filter((id) => projects.some((p) => p.id === id))
  assert.deepEqual(pruned, ["a", "b"])
})

test("select-all diturunkan dari id, bukan dari jumlah", () => {
  const selected = new Set(["a", "b"])
  const visible = [{ id: "a" }, { id: "b" }]
  assert.equal(visible.length > 0 && visible.every((p) => selected.has(p.id)), true)
  // jumlah bisa sama tapi id berbeda -> inilah bug checkbox lama
  const otherVisible = [{ id: "a" }, { id: "c" }]
  assert.equal(otherVisible.length === selected.size, true, "jumlahnya sama")
  assert.equal(otherVisible.every((p) => selected.has(p.id)), false, "tapi harusnya tidak tercentang penuh")
})
