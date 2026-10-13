import { test } from "node:test"
import assert from "node:assert/strict"

/*
 * Uji regresi tanggal — memakai KODE ASLI dari lib/utils.ts, bukan salinan.
 * Dijalankan dengan tsx sebagai loader (lihat script `test` di package.json).
 *
 * Latar belakang: `Intl.DateTimeFormat.format()` MELEMPAR RangeError bila
 * diberi Invalid Date. Di InvoiceModal, state `issueDate` masih "" pada render
 * pertama (efek pengisinya baru jalan setelah render), sehingga `new Date("")`
 * -> Invalid Date -> seluruh halaman jatuh ke layar "Terjadi Kesalahan".
 */
import { formatDate, formatDateShort, monthKey, isOverdue } from "../lib/utils.ts"

test("Intl memang melempar untuk Invalid Date (dasar kenapa guard ini ada)", () => {
  assert.throws(
    () => new Intl.DateTimeFormat("id-ID").format(new Date("")),
    /Invalid time value/,
  )
})

test("formatDate tidak melempar untuk nilai kosong/rusak", () => {
  for (const bad of ["", null, undefined, "bukan-tanggal", "2026-13-45"]) {
    assert.doesNotThrow(() => formatDate(bad), `formatDate(${JSON.stringify(bad)}) melempar`)
    assert.equal(formatDate(bad), "—")
  }
})

test("formatDate tetap benar untuk tanggal valid", () => {
  assert.equal(formatDate("2026-06-15"), "15 Jun 2026")
  assert.equal(formatDate(new Date("2026-06-15T00:00:00+07:00")), "15 Jun 2026")
})

test("formatDateShort tidak melempar untuk nilai kosong", () => {
  assert.equal(formatDateShort(""), "—")
  assert.equal(formatDateShort(null), "—")
  assert.equal(formatDateShort("2026-06-15"), "15 Jun")
})

test("monthKey mengembalikan null (bukan melempar) untuk tanggal rusak", () => {
  assert.equal(monthKey(""), null)
  assert.equal(monthKey("bukan-tanggal"), null)
  assert.equal(monthKey("2026-06-15"), "2026-06")
})

test("isOverdue aman untuk deadline kosong/rusak (dianggap tidak terlambat)", () => {
  assert.equal(isOverdue(""), false)
  assert.equal(isOverdue(null), false)
  assert.equal(isOverdue("bukan-tanggal"), false)
  // tanggal yang jelas sudah lewat
  assert.equal(isOverdue("2020-01-01"), true)
  // tanggal yang jelas di masa depan
  assert.equal(isOverdue("2999-01-01"), false)
})
