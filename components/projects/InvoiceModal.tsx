"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import type { Project, Client, ClientFormData } from "@/types"
import { X, Printer, Loader2, Edit3, Plus, Minus, Eye, ArrowLeft, Download, Save, ZoomIn, ZoomOut, RotateCcw } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { replaceOklchColors } from "@/lib/print-colors"
import { useEscape } from "@/lib/use-escape"
import { STUDIO } from "@/lib/studio"

/** Tanggal lokal dalam format "YYYY-MM-DD" untuk <input type="date">. */
function isoDate(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

interface InvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  /** Klien yang ditagih — identitasnya mengisi kolom invoice secara otomatis. */
  client: Client | null
  /** Proyek yang masuk ke invoice ini. */
  projects: Project[]
  /** Menyimpan perubahan identitas klien ke data klien tersimpan. */
  onSaveClient?: (data: ClientFormData) => Promise<boolean>
  /** Dipanggil setelah PDF benar-benar tersimpan. */
  onGenerated?: (projectIds: string[]) => void
}

export default function InvoiceModal({
  isOpen, onClose, client, projects, onSaveClient, onGenerated,
}: InvoiceModalProps) {
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
  /* Identitas klien terisi otomatis dari data klien — inilah yang menghilangkan
     pengetikan ulang nama/kontak/alamat setiap kali membuat invoice. Nilainya
     tetap boleh disunting untuk kasus khusus. */
  const [clientName, setClientName] = useState(() => client?.name ?? "")
  const [clientContact, setClientContact] = useState(() => client?.contact ?? "")
  const [clientAddress, setClientAddress] = useState(() => client?.address ?? "")
  const [taxPercent, setTaxPercent] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [isSavingClient, setIsSavingClient] = useState(false)
  const [progress, setProgress] = useState(0)
  const [previewScale, setPreviewScale] = useState(1)
  const [zoomFactor, setZoomFactor] = useState(1)
  const [step, setStep] = useState<"edit" | "review">("edit")
  const [pdfError, setPdfError] = useState("")
  const sheetRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLImageElement>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = previewContainerRef.current
    if (!container || !isOpen) return

    const updateScale = () => {
      const horizontalPadding = 40
      const toolbarAndPadding = 88
      const availW = Math.max(0, container.clientWidth - horizontalPadding)
      const availH = Math.max(0, container.clientHeight - toolbarAndPadding)
      const pxPerMm = 96 / 25.4
      const sheetW = 210 * pxPerMm
      const sheetH = 297 * pxPerMm
      // Fit-to-view begins by fitting both page dimensions; manual zoom then
      // scales that fit size while the scroll viewport exposes the whole page.
      const s = Math.min(availW / sheetW, availH / sheetH, 1)
      setPreviewScale(Math.max(s, 0.25))
    }

    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(container)
    return () => observer.disconnect()
  }, [isOpen])

  /**
   * Kunci invoice — klien + susunan id proyek, bukan identitas array.
   *
   * Ini menjaga perbaikan dari sesi sebelumnya: efek inisialisasi tidak boleh
   * bergantung pada IDENTITAS array proyek, karena setiap penyegaran data
   * menghasilkan array baru dan akan mengosongkan tanggal serta nama klien yang
   * baru saja diketik. Inisialisasi hanya berjalan bila SUSUNAN-nya berubah.
   */
  const projectIds = useMemo(() => projects.map((p) => p.id), [projects])
  const selectionKey = useMemo(
    () => `${client?.id ?? ""}::${projectIds.slice().sort().join("|")}`,
    [client?.id, projectIds],
  )

  useEffect(() => {
    if (projects.length === 0) return
    setClientName(client?.name ?? "")
    setClientContact(client?.contact ?? "")
    setClientAddress(client?.address ?? "")
    // Nomor invoice hanya dibuat bila masih kosong — kalau tidak, mengubah
    // pilihan saat modal terbuka akan menimpa nomor yang sudah diedit.
    setInvoiceNo((prev) =>
      prev || `INV-${isoDate().replaceAll("-", "")}-${Math.floor(100 + Math.random() * 900)}`,
    )
    setIssueDate(isoDate())
    setDueDate(isoDate(14))
    // Sengaja TIDAK memakai `projects`/`client` sebagai dependensi (lihat catatan
    // di atas). `selectionKey` sudah mewakili perubahan yang relevan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey, isOpen])

  useEscape(isOpen, onClose)

  if (!isOpen || projects.length === 0) return null

  const renderedScale = previewScale * zoomFactor
  const zoomPercent = Math.round(zoomFactor * 100)
  const setClampedZoom = (next: number) => setZoomFactor(Math.min(3, Math.max(0.5, next)))

  const subtotal = projects.reduce((acc, p) => acc + p.price, 0)
  const taxAmount = (subtotal * taxPercent) / 100
  /* Diskon dibatasi pada subtotal + pajak. Sebelumnya hanya dijaga >= 0,
     sehingga diskon yang lebih besar dari tagihan menghasilkan total NEGATIF
     yang tercetak sebagai "-Rp ..." di PDF. */
  const maxDiscount = subtotal + taxAmount
  const safeDiscount = Math.min(Math.max(0, discountAmount), maxDiscount)
  const totalAmount = subtotal + taxAmount - safeDiscount

  const clientChanged = !!client && (
    clientName !== client.name || clientContact !== client.contact || clientAddress !== client.address
  )

  const handleSaveClient = async () => {
    if (!client || !onSaveClient || !clientChanged || isSavingClient) return
    setIsSavingClient(true)
    try {
      await onSaveClient({
        name: clientName.trim(),
        contact: clientContact.trim(),
        address: clientAddress.trim(),
        notes: client.notes,
      })
    } finally {
      setIsSavingClient(false)
    }
  }

  const handleDownload = async () => {
    if (step !== "review" || isGeneratingPdf) return
    setPdfError("")
    let overflowTarget: HTMLElement | null = null
    let previousOverflow = ""
    setIsGeneratingPdf(true)
    setProgress(10)
    try {
      const { default: html2canvas } = await import("html2canvas")
      setProgress(30)
      const { default: jsPDF } = await import("jspdf")
      setProgress(50)

      const element = sheetRef.current
      if (!element) { setIsGeneratingPdf(false); return }

      // Temporarily show the full sheet for html2canvas; always restore it below.
      overflowTarget = element.closest("[class*='overflow']") as HTMLElement | null
      previousOverflow = overflowTarget?.style.overflow ?? ""
      if (overflowTarget) overflowTarget.style.overflow = "visible"

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

      if (overflowTarget) overflowTarget.style.overflow = previousOverflow
      overflowTarget = null
      setProgress(70)

      /* Logo ditempel TERPISAH ke kanvas hasil tangkapan.
       *
       * Sebabnya ditemukan dengan mengukur piksel, bukan membaca kode:
       * html2canvas 1.4.1 memang menggambar <img> dengan benar saat elemen
       * yang ditangkap kecil (diuji: 400x200 px) dan juga saat menangkap
       * lembar setinggi 1500 px. Tetapi begitu yang ditangkap adalah lembar
       * penuh berukuran A4 (210mm x 297mm) pada scale 2 (kanvas ~1588x2246),
       * setiap isi <img> HILANG tanpa pesan apa pun — logo SVG, logo PNG,
       * maupun data URL, semuanya menghasilkan nol piksel tinta. Jadi ini
       * batas html2canvas, bukan kesalahan berkas logo: logo yang digambar
       * sendiri ke kanvas selalu benar (diuji: 52.096 piksel tinta).
       *
       * Solusinya: logo digambar ulang ke kanvas yang sudah jadi, pada posisi
       * yang diukur langsung dari DOM sehingga tidak mungkin meleset dari
       * tempatnya di lembar. Kapsul pembungkusnya bukan gambar, jadi tetap
       * ikut tertangkap html2canvas — hanya tinta logonya yang perlu ditempel.
       */
      const logoEl = logoRef.current
      if (logoEl && logoEl.complete && logoEl.naturalWidth > 0) {
        const sheetRect = element.getBoundingClientRect()
        const logoRect = logoEl.getBoundingClientRect()
        const ratio = canvas.width / sheetRect.width

        /* `decode()` memastikan bitmap SVG sudah siap sebelum digambar.
           Tanpa menunggunya, `drawImage` bisa menghasilkan bidang kosong pada
           peramban yang belum menyelesaikan dekode. Kalau API-nya tidak ada
           (atau decode gagal), elemen gambar yang sudah `complete` tetap
           dipakai — bukan kondisi gagal. */
        const logoImage = logoEl
        try {
          await logoImage.decode?.()
        } catch {
          /* Abaikan: `complete` + `naturalWidth > 0` sudah cukup untuk digambar. */
        }

        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.drawImage(
            logoImage,
            (logoRect.left - sheetRect.left) * ratio,
            (logoRect.top - sheetRect.top) * ratio,
            logoRect.width * ratio,
            logoRect.height * ratio,
          )
        }
      }

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

      /* Baru setelah berkas benar-benar dibuat, proyek ditandai sudah ditagih.
         Kalau penandaan dilakukan sebelum render berhasil, proyek bisa
         "menghilang" dari kolom Siap Ditagih padahal invoice-nya gagal dibuat. */
      onGenerated?.(projects.map((p) => p.id))
    } catch (error) {
      console.error("PDF failed:", error)
      setPdfError("PDF belum berhasil dibuat. Pratinjau dan perubahan Anda tetap aman; coba unduh lagi.")
    } finally {
      if (overflowTarget) overflowTarget.style.overflow = previousOverflow
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
            {/* Logo studio pada bilah alat. `alt` sengaja kosong: nama studio
                sudah dibaca sebagai teks di sebelahnya, jadi membacakannya lagi
                hanya menambah derau bagi pembaca layar. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- berkas SVG
                statis di /public; optimasi next/image tidak berlaku untuk SVG
                dan tidak diperlukan di sini. */}
            <img
              src={STUDIO.logo}
              alt=""
              className="h-4 w-auto shrink-0 dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={STUDIO.logoLight}
              alt=""
              className="hidden h-4 w-auto shrink-0 dark:block"
            />
            <div>
              <h2 className="text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-neutral-400" />
                Invoice
              </h2>
              <p className="text-[9.5px] text-neutral-400 dark:text-neutral-500">
                <span className="sm:hidden">{projects.length} order · {formatCurrency(totalAmount)}</span>
                <span className="hidden sm:inline">{step === "edit" ? "Langkah 1 · Atur data dan koreksi" : "Langkah 2 · Periksa sebelum unduh"} · {projects.length} proyek · {formatCurrency(totalAmount)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {step === "review" && (
              <button onClick={() => setStep("edit")} aria-label="Kembali koreksi" disabled={isGeneratingPdf} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-semibold text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-900 sm:px-3">
                <ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Kembali koreksi</span>
              </button>
            )}
            <button
              onClick={step === "edit" ? () => setStep("review") : handleDownload}
              aria-label={step === "edit" ? "Periksa pratinjau" : "Unduh PDF"}
              disabled={isGeneratingPdf}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-neutral-950 px-3 text-[11px] font-semibold text-white shadow-xs transition-colors hover:bg-neutral-800 disabled:opacity-60 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 sm:gap-2 sm:px-4 sm:text-xs"
            >
              {isGeneratingPdf ? <><Loader2 className="h-4 w-4 animate-spin" /><span className="hidden sm:inline">{progress < 70 ? "Merender..." : progress < 90 ? "Menyusun PDF..." : "Menyimpan..."} {progress}%</span></> : step === "edit" ? <><Eye className="h-4 w-4" /><span className="hidden sm:inline">Periksa pratinjau</span><span className="sm:hidden">Cek</span></> : <><Download className="h-4 w-4" /><span className="hidden sm:inline">Unduh PDF</span><span className="sm:hidden">PDF</span></>}
            </button>
            <button onClick={onClose} aria-label="Tutup invoice" className="rounded-xl bg-neutral-100 p-2 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* === BODY === */}
        {pdfError && <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">{pdfError}</p>}

        <div className={`flex-1 min-h-0 flex flex-col ${step === "edit" ? "lg:flex-row" : ""} overflow-hidden`}>

          {/* === SIDEBAR SETTINGS === */}
          {step === "edit" && <div className="lg:w-80 bg-white dark:bg-[#0d0d0f]/30 border-b lg:border-b-0 lg:border-r border-neutral-200 dark:border-neutral-900/60 p-5 space-y-5 print:hidden shrink-0 max-h-[42vh] lg:max-h-none overflow-y-auto">
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
              {onSaveClient && (
                <button type="button" onClick={handleSaveClient} disabled={!clientChanged || isSavingClient} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-neutral-200 px-3 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900">
                  {isSavingClient ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Simpan perubahan klien
                </button>
              )}

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
          </div>}

          {step === "review" && (
            <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-2.5 text-[11px] text-neutral-600 dark:border-neutral-900 dark:bg-[#111113] dark:text-neutral-300">
              <span>Pastikan nama klien, tanggal, daftar order, dan total sudah benar.</span>
              <span className="shrink-0 font-semibold">{projects.length} order · {formatCurrency(totalAmount)}</span>
            </div>
          )}

          {/* === INVOICE PREVIEW === */}
          <div
            ref={previewContainerRef}
            className="flex-1 min-h-0 bg-[#f0f0f2] dark:bg-[#0a0a0c] p-3 sm:p-4 md:p-6 overflow-auto min-w-0"
          >
            <div className="sticky top-0 z-10 mx-auto mb-3 flex w-fit max-w-full items-center gap-1.5 rounded-2xl border border-neutral-200 bg-white/95 p-1.5 shadow-lg dark:border-neutral-700 dark:bg-[#151518]/95">
              <span className="hidden px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400 sm:inline">Zoom</span>
              <button
                type="button"
                onClick={() => setClampedZoom(zoomFactor - 0.1)}
                disabled={zoomFactor <= 0.5}
                aria-label="Perkecil pratinjau invoice"
                title="Perkecil"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-35 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <output aria-live="polite" aria-label={`Zoom ${zoomPercent} persen`} className="min-w-[48px] text-center font-mono text-xs font-semibold tabular-nums text-neutral-800 dark:text-neutral-100">
                {zoomPercent}%
              </output>
              <button
                type="button"
                onClick={() => setClampedZoom(zoomFactor + 0.1)}
                disabled={zoomFactor >= 3}
                aria-label="Perbesar pratinjau invoice"
                title="Perbesar"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-35 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <input
                type="range"
                min={50}
                max={300}
                step={5}
                value={zoomPercent}
                onChange={(event) => setClampedZoom(Number(event.target.value) / 100)}
                aria-label="Atur perbesaran pratinjau invoice"
                title="Geser untuk mengatur perbesaran"
                className="mx-1 h-1.5 w-14 cursor-pointer accent-violet-600 sm:w-20 md:w-32"
              />
              <span className="mx-0.5 h-6 w-px bg-neutral-200 dark:bg-neutral-700" />
              <button
                type="button"
                onClick={() => setZoomFactor(1)}
                disabled={zoomFactor === 1}
                aria-label="Sesuaikan pratinjau ke layar"
                title="Kembalikan ke ukuran pas layar"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-[10px] font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-default disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Pas</span>
              </button>
            </div>
            <div
              style={{
                width: `${210 * renderedScale}mm`,
                height: `${297 * renderedScale}mm`,
                overflow: "hidden",
                margin: "0 auto",
                position: "relative",
                transition: "width 120ms ease-out, height 120ms ease-out",
              }}
            >
              <div
                ref={sheetRef}
                className="printable-invoice-sheet bg-white text-neutral-900"
                style={{
                  width: "210mm",
                  minHeight: "297mm",
                  padding: "18mm 16mm 14mm",
                  fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                  fontSize: "9pt",
                  lineHeight: "1.5",
                  transformOrigin: "top left",
                  transform: `scale(${renderedScale})`,
                  position: "absolute",
                  top: 0,
                  left: 0,
                  /* Flex kolom setinggi halaman.
                   *
                   * Sebelumnya blok-blok hanya ditumpuk lalu berhenti: pada
                   * invoice 3 baris hasilnya menyisakan ~80 mm ruang kosong di
                   * bawah (terukur, bukan perkiraan) sehingga lembar tampak
                   * menggantung di atas halaman. Dengan kolom flex, isi
                   * didorong mengisi tinggi kertas dan catatan kaki menempel
                   * pada margin bawah, jadi proporsinya tetap enak dilihat
                   * baik untuk 1 baris order maupun 12 baris. */
                  display: "flex",
                  flexDirection: "column",
                  boxSizing: "border-box",
                }}
              >

              {/* TOP DECORATIVE LINE */}
              <div style={{ height: "3px", background: "linear-gradient(90deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", borderRadius: "2px", marginBottom: "20px" }} />

              {/* KEPALA LEMBAR
                  Sisi kiri: logo studio asli (ALENGKA) beserta identitasnya.
                  Sisi kanan: judul INVOICE dan nomornya.

                  Kedua sisi disejajarkan pada garis atas yang sama
                  (`alignItems: "flex-start"`), dan logo diberi `display:block`
                  supaya tidak menyisakan celah baseline yang membuatnya tampak
                  melayang beberapa piksel lebih rendah dari teks di kanannya.
                  Tinggi logo dipatok dan lebarnya dihitung `auto`, sehingga
                  rasionya (3,1789 : 1) tidak pernah terdistorsi berapa pun
                  lebar halamannya. */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24px", marginBottom: "26px" }}>
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  {/* Logo di dalam "kapsul" tipis supaya tingginya terukur dan
                      tepinya rapi terhadap margin kiri lembar.
                      Tinggi dinaikkan ke 34px: pada 26px detail bersudut khas
                      wordmark ALENGKA (rasio 3,18:1, jadi hanya ~83px lebar)
                      hilang dan logonya tampak sekadar bercak kecil. */}
                  <div style={{
                    display: "inline-flex", alignItems: "center",
                    padding: "8px 14px",
                    border: "1px solid #ececef",
                    borderRadius: "8px",
                    background: "#fcfcfd",
                    marginBottom: "13px",
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element --
                        SVG statis; sengaja NOT raster, supaya tepinya tetap
                        tajam di PDF maupun saat dicetak. */}
                    <img
                      ref={logoRef}
                      src={STUDIO.logo}
                      alt={`Logo ${STUDIO.name}`}
                      style={{ display: "block", height: "34px", width: "auto" }}
                    />
                  </div>

                  <div style={{ fontSize: "11.5pt", fontWeight: 800, letterSpacing: "0.6px", color: "#111827", lineHeight: 1.25 }}>
                    {STUDIO.name}
                  </div>
                  <div style={{ fontSize: "7.5pt", color: "#8b8b93", marginTop: "1px" }}>
                    {STUDIO.tagline}
                  </div>

                  {/* Blok kontak memakai satu garis pemisah di tengah agar
                      alamat dan kontak terpisah jelas tanpa menambah baris. */}
                  <div style={{ fontSize: "7.5pt", color: "#8b8b93", marginTop: "8px", lineHeight: "1.6" }}>
                    <div>{STUDIO.city}</div>
                    <div>
                      {STUDIO.email}
                      <span style={{ color: "#d4d4d8", margin: "0 6px" }}>|</span>
                      {STUDIO.phone}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                  <div style={{
                    fontSize: "26pt", fontWeight: 800, letterSpacing: "3px",
                    color: "#111827", lineHeight: "0.95",
                  }}>INVOICE</div>
                  <div style={{ fontSize: "7.5pt", color: "#a1a1aa", marginTop: "8px" }}>
                    No.
                    <span style={{
                      marginLeft: "5px", fontWeight: 600, color: "#3f3f46",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>{invoiceNo}</span>
                  </div>
                </div>
              </div>

              {/* PEMISAH */}
              <div style={{ height: "1px", background: "#ececef", marginBottom: "22px" }} />

              {/* DITAGIHKAN KEPADA / TANGGAL */}
              <div style={{ display: "flex", justifyContent: "space-between", gap: "24px", marginBottom: "26px" }}>
                <div style={{ maxWidth: "55%", minWidth: 0 }}>
                  <div style={{ fontSize: "6.5pt", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "#a1a1aa", marginBottom: "7px" }}>Ditagihkan Kepada</div>
                  <div style={{ fontSize: "10pt", fontWeight: 700, color: "#111827", marginBottom: "2px" }}>{clientName}</div>
                  {clientContact && <div style={{ fontSize: "7.5pt", color: "#8b8b93" }}>{clientContact}</div>}
                  {clientAddress && <div style={{ fontSize: "7.5pt", color: "#8b8b93", marginTop: "2px", maxWidth: "260px" }}>{clientAddress}</div>}
                </div>
                <div style={{ textAlign: "right", fontSize: "7.5pt", flex: "0 0 auto" }}>
                  <div style={{ fontSize: "6.5pt", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "#a1a1aa", marginBottom: "7px" }}>Tanggal</div>
                  <div style={{ color: "#71717a", marginBottom: "2px" }}>
                    Terbit: <span style={{ fontWeight: 600, color: "#3f3f46", fontFamily: "'JetBrains Mono', monospace" }}>{formatDate(issueDate)}</span>
                  </div>
                  <div style={{ color: "#71717a" }}>
                    Jatuh Tempo: <span style={{ fontWeight: 600, color: "#3f3f46", fontFamily: "'JetBrains Mono', monospace" }}>{formatDate(dueDate)}</span>
                  </div>
                </div>
              </div>

              {/* TABEL ORDER */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt", marginBottom: "22px", tableLayout: "fixed" }}>
                {/* Lebar kolom dipatok (`tableLayout: fixed`) supaya kolom Proyek
                    tidak pernah melar menggeser kolom Harga — inilah yang dulu
                    membuat judul panjang dan angka rupiah berdesakan. */}
                <colgroup>
                  <col style={{ width: "34px" }} />
                  <col />
                  <col style={{ width: "26%" }} />
                  <col style={{ width: "108px" }} />
                </colgroup>
                <thead>
                  <tr style={{
                    borderBottom: "2px solid #111827",
                    fontSize: "6.5pt",
                    fontWeight: 700,
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    color: "#71717a",
                  }}>
                    <th style={{ padding: "8px 8px 8px 0", textAlign: "left" }}>No</th>
                    <th style={{ padding: "8px 8px", textAlign: "left" }}>Proyek</th>
                    <th style={{ padding: "8px 8px", textAlign: "left" }}>Kategori</th>
                    <th style={{ padding: "8px 0 8px 8px", textAlign: "right" }}>Harga</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p, idx) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f2f2f4" }}>
                      <td style={{ padding: "10px 8px 10px 0", fontFamily: "'JetBrains Mono', monospace", color: "#a1a1aa", fontSize: "8pt", verticalAlign: "top" }}>
                        {String(idx + 1).padStart(2, "0")}
                      </td>
                      <td style={{ padding: "10px 8px", verticalAlign: "top", overflowWrap: "anywhere" }}>
                        <div style={{ fontWeight: 600, fontSize: "9pt", color: "#111827", marginBottom: "1px" }}>{p.projectTitle}</div>
                        {/* Dulu baris ini menampilkan nama klien. Sejak invoice dibuat
                            per klien, mengulang nama yang sama di setiap baris jadi
                            mubazir — diganti tanggal deadline proyek, pada slot dan
                            gaya yang sama sehingga tata letak lembar tidak bergeser. */}
                        <div style={{ fontSize: "7pt", color: "#b4b4bb" }}>{formatDate(p.deadline)}</div>
                      </td>
                      <td style={{ padding: "10px 8px", color: "#8b8b93", fontSize: "8pt", verticalAlign: "top", overflowWrap: "anywhere" }}>{p.category.name}</td>
                      <td style={{ padding: "10px 0 10px 8px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: "8.5pt", color: "#111827", verticalAlign: "top", whiteSpace: "nowrap" }}>
                        {formatCurrency(p.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ flex: "1 1 auto", minHeight: 0 }} aria-hidden="true" />

              {/* RINGKASAN TAGIHAN */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "28px" }}>
                <div style={{ width: "240px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "4px 0", fontSize: "8.5pt", color: "#8b8b93" }}>
                    <span>Subtotal</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, color: "#3f3f46", whiteSpace: "nowrap" }}>{formatCurrency(subtotal)}</span>
                  </div>
                  {taxPercent > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "4px 0", fontSize: "8.5pt", color: "#8b8b93" }}>
                      <span>Pajak ({taxPercent}%)</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, color: "#2e7d32", whiteSpace: "nowrap" }}>+{formatCurrency(taxAmount)}</span>
                    </div>
                  )}
                  {safeDiscount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "4px 0", fontSize: "8.5pt", color: "#c62828" }}>
                      <span>Diskon</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, whiteSpace: "nowrap" }}>-{formatCurrency(safeDiscount)}</span>
                    </div>
                  )}
                  <div style={{ borderTop: "2px solid #111827", margin: "7px 0 5px" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", padding: "5px 0 0", fontSize: "11pt", fontWeight: 800, color: "#111827" }}>
                    <span>Total Tagihan</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>{formatCurrency(totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* PENYERAP RUANG
                  Ruang lebih dibagi ke DUA celah, bukan ditumpuk di satu
                  tempat. Dengan begitu selisih tinggi kertas terbagi rata:
                  satu jeda sebelum ringkasan tagihan dan satu jeda sebelum
                  blok rekening. Untuk invoice 3 order hasilnya lembar yang
                  terisi penuh tanpa lubang besar di satu titik; untuk invoice
                  panjang kedua celah ini menyusut ke nol dengan sendirinya. */}
              <div style={{ flex: "1 1 auto", minHeight: 0 }} aria-hidden="true" />

              {/* REKENING PEMBAYARAN
                  Tanpa ikon: informasi rekening sudah jelas dari labelnya,
                  dan ikon hanya menambah elemen visual yang tidak memberi
                  maklumat. Formatnya disusun sebagai label kecil di atas lalu
                  baris "bank + nomor" dan "atas nama" yang dipisah dengan
                  spasi konsisten, sehingga keterbacaannya lebih rapi. */}
              <div style={{
                border: "1px solid #ececef", background: "#fafafb",
                borderRadius: "8px", padding: "13px 16px",
                marginBottom: "22px",
              }}>
                <div style={{ fontSize: "6.5pt", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#a1a1aa", marginBottom: "7px" }}>Rekening</div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: "16px", rowGap: "3px" }}>
                  <div style={{ fontSize: "9pt", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: "#3f3f46" }}>
                    {STUDIO.bank.name} {STUDIO.bank.account}
                  </div>
                  <div style={{ fontSize: "7.5pt", color: "#8b8b93" }}>
                    a.n. <span style={{ fontWeight: 600, color: "#3f3f46" }}>{STUDIO.bank.holder}</span>
                  </div>
                </div>
              </div>

              {/* CATATAN KAKI
                  `marginTop: auto` menempelkannya ke margin bawah lembar —
                  konsisten di semua ukuran invoice, dan mengisi ruang yang
                  tadinya kosong dengan pemisah yang disengaja. */}
              <div style={{
                textAlign: "center",
                fontSize: "7.5pt",
                color: "#b4b4bb",
                fontStyle: "italic",
                borderTop: "1px solid #f2f2f4",
                paddingTop: "12px",
                marginTop: "auto",
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
