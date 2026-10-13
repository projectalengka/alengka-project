"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import type { Project, Category } from "@/types"
import { X, Printer, Landmark, Loader2, Edit3, Plus, Minus } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { replaceOklchColors } from "@/lib/print-colors"
import { useEscape } from "@/lib/use-escape"

/** Tanggal lokal dalam format "YYYY-MM-DD" untuk <input type="date">. */
function isoDate(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

interface InvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  selectedProjects: Project[]
  categories: Category[]
}

export default function InvoiceModal({ isOpen, onClose, selectedProjects, categories }: InvoiceModalProps) {
  /* Nilai awal langsung diisi (lazy initializer), bukan "". Dulu state tanggal
     mulai dari "" dan baru diisi oleh useEffect SETELAH render pertama —
     pada render itu formatDate("") melempar RangeError dan seluruh halaman
     jatuh ke layar "Terjadi Kesalahan". formatDate kini juga sudah aman, tapi
     mengisi nilai yang benar sejak awal sekaligus menghilangkan kedipan "—". */
  const [invoiceNo, setInvoiceNo] = useState(
    () => `INV-${isoDate().replaceAll("-", "")}-${Math.floor(100 + Math.random() * 900)}`,
  )
  const [issueDate, setIssueDate] = useState(() => isoDate())
  const [dueDate, setDueDate] = useState(() => isoDate(14))
  const [clientName, setClientName] = useState("")
  const [clientContact, setClientContact] = useState("")
  const [clientAddress, setClientAddress] = useState("")
  const [taxPercent, setTaxPercent] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [progress, setProgress] = useState(0)
  const [previewScale, setPreviewScale] = useState(1)
  const sheetRef = useRef<HTMLDivElement>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = previewContainerRef.current
    if (!container || !isOpen) return

    const updateScale = () => {
      const pad = 48
      const availW = container.clientWidth - pad
      const availH = container.clientHeight - pad
      const pxPerMm = 96 / 25.4
      const sheetW = 210 * pxPerMm
      const sheetH = 297 * pxPerMm
      const s = Math.min(availW / sheetW, availH / sheetH, 1)
      setPreviewScale(Math.max(s, 0.25))
    }

    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(container)
    return () => observer.disconnect()
  }, [isOpen])

  /* Peta nama kategori untuk lookup O(1). Sebelumnya `categories.find()`
     dijalankan sekali per baris invoice. */
  const categoryNameMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  )

  /**
   * Kunci pilihan — hanya id, terurut.
   *
   * Ini memperbaiki bug nyata: efek inisialisasi dulu bergantung pada
   * `selectedProjects` (IDENTITAS array). Setiap penyegaran data menghasilkan
   * array baru, sehingga React menganggap "pilihan berubah" dan mengosongkan
   * tanggal serta nama klien yang baru saja diketik. Sekarang inisialisasi
   * hanya berjalan ketika SUSUNAN pilihan benar-benar berbeda.
   */
  const selectionKey = useMemo(
    () => selectedProjects.map((p) => p.id).slice().sort().join("|"),
    [selectedProjects],
  )

  useEffect(() => {
    if (selectedProjects.length === 0) return
    const uniqueClients = Array.from(new Set(selectedProjects.map((p) => p.clientName)))
    setClientName(uniqueClients.length === 1 ? uniqueClients[0] : uniqueClients.join(", "))
    // Nomor invoice hanya dibuat bila masih kosong — kalau tidak, mengubah
    // pilihan saat modal terbuka akan menimpa nomor yang sudah diedit.
    setInvoiceNo((prev) =>
      prev || `INV-${isoDate().replaceAll("-", "")}-${Math.floor(100 + Math.random() * 900)}`,
    )
    setIssueDate(isoDate())
    setDueDate(isoDate(14))
    // Sengaja TIDAK memakai `selectedProjects` sebagai dependensi (lihat catatan
    // di atas). `selectionKey` sudah mewakili perubahan yang relevan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey, isOpen])

  useEscape(isOpen, onClose)

  if (!isOpen || selectedProjects.length === 0) return null

  const subtotal = selectedProjects.reduce((acc, p) => acc + p.price, 0)
  const taxAmount = (subtotal * taxPercent) / 100
  /* Diskon dibatasi pada subtotal + pajak. Sebelumnya hanya dijaga >= 0,
     sehingga diskon yang lebih besar dari tagihan menghasilkan total NEGATIF
     yang tercetak sebagai "-Rp ..." di PDF. */
  const maxDiscount = subtotal + taxAmount
  const safeDiscount = Math.min(Math.max(0, discountAmount), maxDiscount)
  const totalAmount = subtotal + taxAmount - safeDiscount

  const getCategoryName = (catId: string) => categoryNameMap.get(catId) ?? catId

  const handlePrint = async () => {
    setIsGeneratingPdf(true)
    setProgress(10)
    try {
      const { default: html2canvas } = await import("html2canvas")
      setProgress(30)
      const { default: jsPDF } = await import("jspdf")
      setProgress(50)

      const element = sheetRef.current
      if (!element) { setIsGeneratingPdf(false); return }

      // temporarily make overflow visible so html2canvas captures full element
      const previewEl = element.closest("[class*='overflow']") as HTMLElement | null
      const origOverflow = previewEl?.style.overflow ?? ""
      if (previewEl) previewEl.style.overflow = "visible"

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        onclone: (doc) => {
          const el = doc.querySelector(".printable-invoice-sheet") as HTMLElement | null
          if (el) {
            el.style.transform = "none"
            el.style.position = "static"
            el.style.width = "210mm"
            el.style.minHeight = "297mm"
            el.style.maxHeight = "none"
          }
          /* WAJIB — ini yang membuat "Cetak PDF" dulu tidak pernah jalan.

             Tailwind v4 menyusun seluruh paletnya dalam ruang warna oklch().
             html2canvas tidak mengenali fungsi warna itu dan MELEMPAR
             "Attempting to parse an unsupported color function" begitu bertemu
             satu nilai oklch — baik itu class di lembar invoice itu sendiri
             (bg-white, text-neutral-900, border-neutral-200...) maupun di
             rantai induknya. Tanpa konversi di bawah, setiap klik "Cetak PDF"
             gagal dan jatuh ke cabang catch -> window.print() tanpa penjelasan.

             replaceOklchColors menelusuri seluruh badan dokumen kloning
             (lembar + semua induknya) dan menulis padanan rgb sebagai inline
             style, yang menimpa class Tailwind pada salinan itu. */
          replaceOklchColors(doc.body)
        },
      })

      // restore overflow
      if (previewEl) previewEl.style.overflow = origOverflow
      setProgress(70)

      const imgData = canvas.toDataURL("image/png")

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageWidth = 210
      const pageHeight = 297
      const pageMargin = 10
      const imgWidth = pageWidth - pageMargin * 2
      // Tinggi gambar saat diskalakan ke lebar area cetak
      const scaledHeight = (canvas.height * imgWidth) / canvas.width

      /* Pemotongan multi-halaman.
       *
       * Versi lama menambahkan gambar penuh lalu hanya digeser dengan
       * `position = -pageHeight` setiap halaman, sehingga geometri halaman
       * pertama (mulai y=0) tidak sinkron dengan halaman berikutnya dan isi di
       * sekitar batas halaman bisa hilang/terpotong. Di sini setiap halaman
       * digambar pada offset yang kelipatan tinggi halaman, sehingga
       * sambungannya tepat. */
      let renderedHeight = 0
      let pageIndex = 0

      while (renderedHeight < scaledHeight - 0.5) {
        if (pageIndex > 0) pdf.addPage()
        const yOffset = -renderedHeight
        pdf.addImage(
          imgData, "PNG", pageMargin, yOffset, imgWidth, scaledHeight,
          undefined, "FAST",
        )
        renderedHeight += pageHeight
        pageIndex += 1
        if (pageIndex > 20) break // pengaman terhadap loop tak terbatas
      }

      setProgress(95)
      pdf.save(`Invoice_${invoiceNo.replace(/\s+/g, "_")}.pdf`)
    } catch (error) {
      console.error("PDF failed:", error)
      window.print()
    } finally {
      setIsGeneratingPdf(false)
      setProgress(0)
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 md:p-4 overflow-y-auto bg-[#09090b]/40 dark:bg-black/60">
      <div className="relative bg-neutral-50 dark:bg-neutral-950 w-full max-w-5xl h-full md:h-auto md:max-h-[94vh] flex flex-col md:rounded-2xl border border-neutral-200 dark:border-neutral-900 shadow-2xl overflow-hidden">

        {/* === HEADER === */}
        <div className="flex items-center justify-between px-5 md:px-7 py-3.5 border-b border-neutral-200 dark:border-neutral-900 bg-white dark:bg-[#0d0d0f]/80 sticky top-0 z-10 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-1.5 px-2.5 bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-[9px] font-semibold rounded-md uppercase tracking-wider shadow-xs">
              DS
            </div>
            <div>
              <h2 className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-neutral-400" />
                Invoice
              </h2>
              <p className="text-[9.5px] text-neutral-400 dark:text-neutral-500">
                {selectedProjects.length} proyek dipilih &middot; Total <span className="font-semibold text-neutral-700 dark:text-neutral-300">{formatCurrency(totalAmount)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isGeneratingPdf}
              className="px-4 py-2 bg-neutral-950 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-60 text-white dark:text-neutral-950 font-semibold rounded-xl text-xs flex items-center gap-2 transition cursor-pointer active:scale-[0.97] shadow-xs"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="flex items-center gap-1.5">
                    {progress < 70 ? "Merender..." : progress < 90 ? "Menyusun PDF..." : "Menyimpan..."}
                    <span className="text-[9px] opacity-60 font-mono">{progress}%</span>
                  </span>
                </>
              ) : (
                <><Printer className="w-3.5 h-3.5" /> Cetak PDF</>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* === BODY === */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

          {/* === SIDEBAR SETTINGS === */}
          <div className="lg:w-80 bg-white dark:bg-[#0d0d0f]/30 border-b lg:border-b-0 lg:border-r border-neutral-200 dark:border-neutral-900/60 p-5 space-y-5 print:hidden shrink-0 overflow-y-auto">
            <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-neutral-400 dark:text-neutral-500">
              <Edit3 className="w-3 h-3" />
              Atur Invoice
            </div>

            <div className="space-y-4 text-xs">
              {/* Invoice Number */}
              <div className="space-y-1">
                <label className="block text-[8.5px] uppercase font-semibold tracking-[0.15em] text-neutral-450 dark:text-neutral-500">No. Invoice</label>
                <input type="text" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)}
                  className="w-full bg-[#f5f5f7] dark:bg-[#121214]/60 border border-neutral-200/60 dark:border-neutral-850/40 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors font-mono" />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-[8.5px] uppercase font-semibold tracking-[0.15em] text-neutral-450 dark:text-neutral-500">Tanggal</label>
                  <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full bg-[#f5f5f7] dark:bg-[#121214]/60 border border-neutral-200/60 dark:border-neutral-850/40 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[8.5px] uppercase font-semibold tracking-[0.15em] text-neutral-450 dark:text-neutral-500">Jatuh Tempo</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-[#f5f5f7] dark:bg-[#121214]/60 border border-neutral-200/60 dark:border-neutral-850/40 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors" />
                </div>
              </div>

              {/* Client */}
              <div className="space-y-1.5">
                <label className="block text-[8.5px] uppercase font-semibold tracking-[0.15em] text-neutral-450 dark:text-neutral-500">Nama Klien</label>
                <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-[#f5f5f7] dark:bg-[#121214]/60 border border-neutral-200/60 dark:border-neutral-850/40 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[8.5px] uppercase font-semibold tracking-[0.15em] text-neutral-450 dark:text-neutral-500">Kontak Klien</label>
                <input type="text" value={clientContact} onChange={(e) => setClientContact(e.target.value)} placeholder="Email / Telepon"
                  className="w-full bg-[#f5f5f7] dark:bg-[#121214]/60 border border-neutral-200/60 dark:border-neutral-850/40 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[8.5px] uppercase font-semibold tracking-[0.15em] text-neutral-450 dark:text-neutral-500">Alamat Klien</label>
                <textarea value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} rows={2} placeholder="Opsional"
                  className="w-full bg-[#f5f5f7] dark:bg-[#121214]/60 border border-neutral-200/60 dark:border-neutral-850/40 rounded-lg px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors resize-none" />
              </div>

              <hr className="border-neutral-100 dark:border-neutral-900/60" />

              {/* Adjustments */}
              <div className="space-y-3 p-3.5 bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-150 dark:border-neutral-850 rounded-xl">
                <span className="block text-[9px] font-bold text-neutral-450 dark:text-neutral-400 uppercase tracking-wider">Penyesuaian</span>

                {/* Tax */}
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium whitespace-nowrap">Pajak</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setTaxPercent(Math.max(0, taxPercent - 1))}
                      className="p-1 rounded-md bg-white dark:bg-[#0d0d0f] border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-12 text-center text-xs font-mono font-semibold text-neutral-800 dark:text-neutral-200 bg-white dark:bg-[#121214] border border-neutral-200 dark:border-neutral-800 rounded-md px-2 py-1">
                      {taxPercent}%
                    </span>
                    <button
                      onClick={() => setTaxPercent(Math.min(50, taxPercent + 1))}
                      className="p-1 rounded-md bg-white dark:bg-[#0d0d0f] border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Discount */}
                {/* Diskon */}
                <div className="space-y-1">
                  <label className="block text-[9.5px] font-medium text-neutral-500 dark:text-neutral-400">Diskon (Rp)</label>
                  <input type="number" value={discountAmount || ""} onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value)) || 0)} min="0"
                    className="w-full bg-white dark:bg-[#121214] border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-right text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors" />
                  {discountAmount > maxDiscount && (
                    <p className="text-[9.5px] text-amber-600 dark:text-amber-400 leading-snug">
                      Diskon dibatasi {formatCurrency(maxDiscount)} supaya total tidak negatif.
                    </p>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-neutral-950/5 dark:bg-white/5 rounded-xl p-3.5 space-y-1.5">
                <div className="flex justify-between text-[10px] text-neutral-500 dark:text-neutral-400">
                  <span>Subtotal</span>
                  <span className="font-mono font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {taxPercent > 0 && (
                  <div className="flex justify-between text-[10px] text-neutral-500 dark:text-neutral-400">
                    <span>Pajak {taxPercent}%</span>
                    <span className="font-mono font-medium">+{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                {safeDiscount > 0 && (
                  <div className="flex justify-between text-[10px] text-red-500">
                    <span>Diskon</span>
                    <span className="font-mono font-medium">-{formatCurrency(safeDiscount)}</span>
                  </div>
                )}
                <div className="border-t border-neutral-200 dark:border-neutral-800 pt-1.5 mt-1.5" />
                <div className="flex justify-between text-xs font-bold text-neutral-900 dark:text-white">
                  <span>Total Tagihan</span>
                  <span className="font-mono text-sm">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* === INVOICE PREVIEW === */}
          <div
            ref={previewContainerRef}
            className="flex-1 bg-[#f0f0f2] dark:bg-[#0a0a0c] p-4 md:p-6 overflow-auto min-w-0"
          >
            <div
              style={{
                width: previewScale < 1 ? `${210 * previewScale}mm` : "210mm",
                height: previewScale < 1 ? `${297 * previewScale}mm` : "297mm",
                overflow: "hidden",
                margin: "0 auto",
                position: "relative",
              }}
            >
              <div
                ref={sheetRef}
                className="printable-invoice-sheet bg-white text-neutral-900"
                style={{
                  width: "210mm",
                  minHeight: "297mm",
                  padding: "18mm 16mm 12mm",
                  fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                  fontSize: "9pt",
                  lineHeight: "1.5",
                  transformOrigin: "top left",
                  transform: previewScale < 1 ? `scale(${previewScale})` : "none",
                  position: "absolute",
                  top: 0,
                  left: 0,
                }}
              >

              {/* TOP DECORATIVE LINE */}
              <div style={{ height: "3px", background: "linear-gradient(90deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", borderRadius: "2px", marginBottom: "20px" }} />

              {/* HEADER */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <div style={{
                      width: "32px", height: "32px",
                      background: "#1a1a2e", color: "#ffffff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: "6px", fontSize: "11px", fontWeight: 700,
                      letterSpacing: "2px", fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic",
                    }}>ds</div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>Design Studio</div>
                      <div style={{ fontSize: "7.5pt", color: "#888" }}>Creative Design Solutions</div>
                    </div>
                  </div>
                  <div style={{ fontSize: "7.5pt", color: "#999", marginTop: "4px", lineHeight: "1.6" }}>
                    <div>Graha Desain Kreatif, Jakarta Raya (12160)</div>
                    <div>studio@example.com | +62 812-3456-7890</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{
                    fontSize: "22pt", fontWeight: 800, letterSpacing: "4px",
                    color: "#1a1a2e", lineHeight: "1",
                  }}>INVOICE</div>
                  <div style={{ fontSize: "7.5pt", color: "#aaa", marginTop: "6px", fontFamily: "'JetBrains Mono', monospace" }}>
                    No: <span style={{ fontWeight: 600, color: "#555" }}>{invoiceNo}</span>
                  </div>
                </div>
              </div>

              {/* DIVIDER */}
              <div style={{ height: "1px", background: "#eee", marginBottom: "20px" }} />

              {/* BILL TO / DATES */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "28px" }}>
                <div style={{ maxWidth: "55%" }}>
                  <div style={{ fontSize: "6.5pt", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "#aaa", marginBottom: "8px" }}>Ditagihkan Kepada</div>
                  <div style={{ fontSize: "10pt", fontWeight: 700, color: "#1a1a2e", marginBottom: "2px" }}>{clientName}</div>
                  {clientContact && <div style={{ fontSize: "7.5pt", color: "#888" }}>{clientContact}</div>}
                  {clientAddress && <div style={{ fontSize: "7.5pt", color: "#888", marginTop: "2px", maxWidth: "260px" }}>{clientAddress}</div>}
                </div>
                <div style={{ textAlign: "right", fontSize: "7.5pt" }}>
                  <div style={{ fontSize: "6.5pt", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "#aaa", marginBottom: "8px" }}>Tanggal</div>
                  <div style={{ color: "#666", marginBottom: "2px" }}>
                    Terbit: <span style={{ fontWeight: 600, color: "#444", fontFamily: "'JetBrains Mono', monospace" }}>{formatDate(issueDate)}</span>
                  </div>
                  <div style={{ color: "#666" }}>
                    Jatuh Tempo: <span style={{ fontWeight: 600, color: "#444", fontFamily: "'JetBrains Mono', monospace" }}>{formatDate(dueDate)}</span>
                  </div>
                </div>
              </div>

              {/* TABLE */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt", marginBottom: "24px" }}>
                <thead>
                  <tr style={{
                    borderBottom: "2px solid #1a1a2e",
                    fontSize: "6.5pt",
                    fontWeight: 700,
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    color: "#888",
                  }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", width: "36px" }}>No</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Proyek</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Kategori</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", width: "120px" }}>Harga</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProjects.map((p, idx) => (
                    <tr key={p.id} style={{
                      borderBottom: "1px solid #f0f0f0",
                      transition: "background 0.15s",
                    }}>
                      <td style={{ padding: "10px 10px", fontFamily: "'JetBrains Mono', monospace", color: "#aaa", fontSize: "8pt" }}>
                        {String(idx + 1).padStart(2, "0")}
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        <div style={{ fontWeight: 600, fontSize: "9pt", color: "#1a1a2e", marginBottom: "1px" }}>{p.projectTitle}</div>
                        <div style={{ fontSize: "7pt", color: "#bbb" }}>{p.clientName}</div>
                      </td>
                      <td style={{ padding: "10px 10px", color: "#888", fontSize: "8pt" }}>{getCategoryName(p.categoryId)}</td>
                      <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: "8.5pt" }}>
                        {formatCurrency(p.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* TOTALS */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "32px" }}>
                <div style={{ width: "220px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "8.5pt", color: "#888" }}>
                    <span>Subtotal</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>{formatCurrency(subtotal)}</span>
                  </div>
                  {taxPercent > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "8.5pt", color: "#888" }}>
                      <span>Pajak ({taxPercent}%)</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, color: "#2e7d32" }}>+{formatCurrency(taxAmount)}</span>
                    </div>
                  )}
                  {safeDiscount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "8.5pt", color: "#c62828" }}>
                      <span>Diskon</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>-{formatCurrency(safeDiscount)}</span>
                    </div>
                  )}
                  <div style={{ borderTop: "2px solid #1a1a2e", margin: "6px 0 4px" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 0", fontSize: "11pt", fontWeight: 800, color: "#1a1a2e" }}>
                    <span>Total Tagihan</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatCurrency(totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* BANK INFO */}
              <div style={{
                border: "1px solid #eee", background: "#fafafa",
                borderRadius: "6px", padding: "12px 14px",
                display: "flex", alignItems: "center", gap: "10px",
                marginBottom: "24px",
              }}>
                <div style={{
                  width: "28px", height: "28px",
                  background: "#1a1a2e", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "4px", fontSize: "12px",
                }}>
                  <Landmark className="w-3.5 h-3.5" style={{ width: "14px", height: "14px" }} />
                </div>
                <div>
                  <div style={{ fontSize: "6.5pt", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#aaa", marginBottom: "2px" }}>Rekening</div>
                  <div style={{ fontSize: "8.5pt", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: "#555" }}>
                    BCA 872-0492-911 a.n. Design Studio
                  </div>
                </div>
              </div>

              {/* FOOTER NOTE */}
              <div style={{
                textAlign: "center",
                fontSize: "7.5pt",
                color: "#bbb",
                fontStyle: "italic",
                borderTop: "1px solid #f0f0f0",
                paddingTop: "16px",
                marginTop: "8px",
              }}>
                Terima kasih atas kerja samanya. Pembayaran paling lambat sesuai tanggal jatuh tempo.
              </div>

              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
