"use client"

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react"
import type { Project, Category, ProjectFormData, ProjectStatus } from "@/types"
import { X, Upload, FileImage, AlertTriangle, Loader2 } from "lucide-react"
import {
  compressImage, isAcceptedImage, formatBytes, dataUrlBytes,
  MAX_UPLOAD_BYTES,
} from "@/lib/image"
import { useEscape } from "@/lib/use-escape"

interface ProjectFormProps {
  isOpen: boolean
  onClose: () => void
  /** Mengembalikan true bila berhasil. Modal hanya menutup saat true. */
  onSave: (data: ProjectFormData) => Promise<boolean>
  projectToEdit?: Project | null
  categories: Category[]
}

const STATUS_OPTS = [
  { value: "On Progress" as ProjectStatus, label: "Berjalan" },
  { value: "Revisi" as ProjectStatus, label: "Revisi" },
  { value: "Done" as ProjectStatus, label: "Selesai" },
  { value: "Cancel" as ProjectStatus, label: "Batal" },
]

export default function ProjectForm({ isOpen, onClose, onSave, projectToEdit, categories }: ProjectFormProps) {
  const [clientName, setClientName] = useState("")
  const [projectTitle, setProjectTitle] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [price, setPrice] = useState<number | "">("")
  const [status, setStatus] = useState<ProjectStatus>("On Progress")
  const [deadline, setDeadline] = useState("")
  const [notes, setNotes] = useState("")
  const [previewImage, setPreviewImage] = useState("")
  const [imageError, setImageError] = useState("")
  const [imageMeta, setImageMeta] = useState("")
  const [compressing, setCompressing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  /*
   * Reset penuh HANYA ketika modal dibuka/ditutup atau target edit berubah.
   *
   * Sebelumnya `categories` ikut menjadi dependensi, sehingga setiap kali
   * daftar kategori mendapat identitas array baru (mis. hasil penyegaran data)
   * React menganggap efek harus jalan lagi — dan isian form yang sedang diketik
   * ikut dikosongkan. Pemuatan kategori bawaan kini dipisah ke efek kedua.
   */
  useEffect(() => {
    if (projectToEdit) {
      setClientName(projectToEdit.clientName)
      setProjectTitle(projectToEdit.projectTitle)
      setCategoryId(projectToEdit.categoryId)
      setPrice(projectToEdit.price)
      setStatus(projectToEdit.status)
      setDeadline(new Date(projectToEdit.deadline).toISOString().split("T")[0])
      setNotes(projectToEdit.notes)
      setPreviewImage(projectToEdit.previewImage || "")
    } else {
      setClientName("")
      setProjectTitle("")
      setCategoryId("")
      setPrice("")
      setStatus("On Progress")
      setDeadline("")
      setNotes("")
      setPreviewImage("")
    }
    setImageError("")
    setImageMeta("")
    setFormError("")
  }, [projectToEdit, isOpen])

  /* Isi kategori bawaan bila kolomnya masih kosong — termasuk saat daftar
     kategori baru tiba setelah form terbuka. Tidak menyentuh kolom lain. */
  useEffect(() => {
    if (isOpen && !projectToEdit && !categoryId && categories[0]) {
      setCategoryId(categories[0].id)
    }
  }, [categories, isOpen, projectToEdit, categoryId])

  useEscape(isOpen, onClose)

  if (!isOpen) return null

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    setImageError("")
    const input = e.target
    const file = input.files?.[0]
    if (!file) return

    if (!isAcceptedImage(file)) {
      setImageError("Format harus JPG, PNG, atau WebP.")
      input.value = ""
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setImageError(`Maksimal ${formatBytes(MAX_UPLOAD_BYTES)}.`)
      input.value = ""
      return
    }

    setCompressing(true)
    try {
      // Diperkecil di peramban: yang tersimpan cukup ringan untuk dikirim
      // bersama setiap pemuatan data, tanpa perlu storage terpisah.
      const compressed = await compressImage(file)
      setPreviewImage(compressed)
      setImageMeta(`${formatBytes(file.size)} → ${formatBytes(dataUrlBytes(compressed))}`)
    } catch {
      // Peramban lama / kanvas tidak tersedia -> pakai berkas aslinya,
      // tetapi tetap beri tahu bahwa ukurannya besar.
      const reader = new FileReader()
      reader.onerror = () => setImageError("Gagal membaca berkas. Coba gambar lain.")
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setPreviewImage(reader.result)
          setImageMeta(`asli ${formatBytes(file.size)} (tidak terkompresi)`)
          if (file.size > 500 * 1024) {
            setImageError("Gambar tidak bisa dikompres di peramban ini, jadi ukurannya besar. Pakai gambar yang lebih kecil bila memungkinkan.")
          }
        }
      }
      reader.readAsDataURL(file)
    } finally {
      setCompressing(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError("")
    if (!clientName.trim() || !projectTitle.trim() || price === "" || !deadline) {
      setFormError("Lengkapi dulu kolom bertanda *.")
      return
    }
    if (!categoryId) {
      setFormError("Pilih kategori dulu. Kalau kosong, tambahkan kategori di tab Kategori.")
      return
    }
    setSaving(true)
    try {
      const success = await onSave({
        clientName: clientName.trim(),
        projectTitle: projectTitle.trim(),
        categoryId,
        price: Number(price),
        status,
        deadline,
        notes: notes.trim(),
        previewImage: previewImage || undefined,
      })
      // Hanya tutup bila benar-benar tersimpan; kalau gagal, isian tetap di sini
      // supaya tidak perlu diketik ulang.
      if (success) onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-[#09090b]/40 dark:bg-black/60" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#0d0d0f] border border-neutral-200/70 dark:border-neutral-900 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in">
        <div className="sticky top-0 bg-white dark:bg-[#0d0d0f] px-8 py-5 border-b border-neutral-100 dark:border-neutral-900 flex items-center justify-between z-20">
          <div>
            <h2 className="text-[10px] font-medium text-neutral-400 dark:text-neutral-550 uppercase tracking-[0.2em]">
              {projectToEdit ? "Edit Proyek" : "Tambah Proyek"}
            </h2>
            <p className="text-xs text-neutral-450 dark:text-neutral-400 mt-0.5">Isi detail proyek yang mau dikerjain.</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-900 border border-neutral-150 dark:border-neutral-850 text-neutral-400 hover:text-neutral-800 dark:hover:text-white rounded-lg transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label htmlFor="client-name" className="block text-[9px] uppercase font-medium tracking-[0.15em] text-neutral-400 dark:text-neutral-500">Nama Klien *</label>
              <input id="client-name" type="text" placeholder="cth: Nexa Group" value={clientName} onChange={(e) => setClientName(e.target.value)} required className="w-full bg-[#f5f5f7] dark:bg-[#121214] border border-neutral-200/60 dark:border-neutral-850 rounded-lg text-xs px-4 py-2.5 text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 transition-colors" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="project-title" className="block text-[9px] uppercase font-medium tracking-[0.15em] text-neutral-400 dark:text-neutral-500">Judul Proyek *</label>
              <input id="project-title" type="text" placeholder="cth: Desain Logo" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} required className="w-full bg-[#f5f5f7] dark:bg-[#121214] border border-neutral-200/60 dark:border-neutral-850 rounded-lg text-xs px-4 py-2.5 text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 transition-colors" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label htmlFor="category-select" className="block text-[9px] uppercase font-medium tracking-[0.15em] text-neutral-400 dark:text-neutral-500">Kategori</label>
              <select id="category-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full bg-[#f5f5f7] dark:bg-[#121214] border border-neutral-200/60 dark:border-neutral-850 rounded-lg text-xs px-4 py-2.5 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 cursor-pointer transition-colors">
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="project-price" className="block text-[9px] uppercase font-medium tracking-[0.15em] text-neutral-400 dark:text-neutral-500">Harga *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-neutral-400 font-mono font-medium">Rp</span>
                <input id="project-price" type="number" min="0" placeholder="3000000" value={price} onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))} required className="w-full bg-[#f5f5f7] dark:bg-[#121214] border border-neutral-200/60 dark:border-neutral-850 rounded-lg text-xs pl-11 pr-4 py-2.5 text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 font-mono transition-colors" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="project-deadline" className="block text-[9px] uppercase font-medium tracking-[0.15em] text-neutral-400 dark:text-neutral-500">Deadline *</label>
              <input id="project-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} required className="w-full bg-[#f5f5f7] dark:bg-[#121214] border border-neutral-200/60 dark:border-neutral-850 rounded-lg text-xs px-4 py-2.5 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 cursor-pointer transition-colors" />
            </div>
          </div>

          <div className="space-y-2.5">
            <span className="block text-[9px] uppercase font-medium tracking-[0.15em] text-neutral-400 dark:text-neutral-500">Status</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border border-neutral-100 dark:border-neutral-900 p-1 bg-neutral-50/50 dark:bg-neutral-900/30 rounded-lg">
              {STATUS_OPTS.map((item) => (
                <button key={item.value} type="button" onClick={() => setStatus(item.value)} className={`px-3 py-2 text-xs font-medium text-center rounded transition-colors cursor-pointer ${status === item.value ? "bg-white dark:bg-neutral-950 text-neutral-950 dark:text-neutral-50 shadow-sm border border-neutral-150 dark:border-neutral-800 font-semibold" : "text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-350"}`}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="project-notes" className="block text-[9px] uppercase font-medium tracking-[0.15em] text-neutral-400 dark:text-neutral-500">Catatan</label>
            <textarea id="project-notes" rows={4} placeholder="Catatan tambahan..." value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-[#f5f5f7] dark:bg-[#121214] border border-neutral-200/60 dark:border-neutral-850 rounded-lg text-xs px-4 py-2.5 text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 resize-y leading-relaxed transition-colors" />
          </div>

          <div className="space-y-2.5">
            <span className="block text-[9px] uppercase font-medium tracking-[0.15em] text-neutral-400 dark:text-neutral-500">Gambar (Opsional)</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
              <div className="relative border border-dashed border-neutral-200 dark:border-neutral-850 bg-neutral-50/20 dark:bg-[#121214]/15 hover:bg-neutral-100/60 dark:hover:bg-neutral-900/30 rounded-lg p-6 text-center transition-colors cursor-pointer">
                <input type="file" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleImageChange} disabled={compressing} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-wait" />
                <div className="space-y-2.5">
                  <div className="mx-auto w-8 h-8 rounded-md bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 flex items-center justify-center text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-white transition-colors shadow-xs">
                    {compressing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-neutral-750 dark:text-neutral-300 block">
                      {compressing ? "Memperkecil gambar..." : "Unggah Gambar"}
                    </span>
                    <span className="text-[10px] text-neutral-450 dark:text-neutral-500 block mt-0.5">JPG/PNG/WebP, maks 5MB</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center">
                {previewImage ? (
                  <div className="relative border border-neutral-150 dark:border-neutral-900 bg-neutral-55 dark:bg-neutral-950 rounded-lg p-3 w-full flex flex-col items-center">
                    {/* next/image tidak dipakai di sini: sumbernya data URL hasil
                        kompresi di peramban (lib/image.ts), dan next/image tidak
                        bisa mengoptimalkan data URL — hanya menambah lapisan
                        pembungkus tanpa manfaat. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewImage} alt="Pratinjau" className="max-h-24 w-auto rounded object-contain border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs" />
                    <div className="mt-2.5 flex items-center justify-between w-full gap-2">
                      <span className="text-[9px] font-mono text-neutral-400 dark:text-neutral-500 uppercase tracking-widest truncate" title={imageMeta || undefined}>
                        {imageMeta || "Gambar"}
                      </span>
                      <button type="button" onClick={() => { setPreviewImage(""); setImageMeta(""); setImageError("") }} className="text-[10px] text-red-500 hover:text-red-700 font-medium cursor-pointer shrink-0">Hapus</button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-neutral-150 dark:border-neutral-900 bg-[#f5f5f7]/40 dark:bg-neutral-950/20 rounded-lg w-full h-28 flex flex-col items-center justify-center p-4 text-center">
                    <FileImage className="w-5 h-5 text-neutral-300 dark:text-neutral-800 mb-1.5" />
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 leading-normal">Belum ada gambar</span>
                  </div>
                )}
              </div>
            </div>
            {imageError && <p className="text-[11px] text-red-500 font-medium">{imageError}</p>}
          </div>

          {categories.length === 0 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              Belum ada kategori. Tambahkan dulu di tab Kategori sebelum menyimpan proyek.
            </p>
          )}

          {formError && (
            <p className="text-[11px] text-red-500 font-medium bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{formError}
            </p>
          )}

          <div className="border-t border-neutral-100 dark:border-neutral-900/60 pt-6 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} disabled={saving || compressing} className="px-4 py-2 border border-neutral-200 dark:border-neutral-850 text-neutral-500 dark:text-neutral-400 rounded-lg hover:bg-neutral-50 hover:text-neutral-850 dark:hover:text-neutral-100 dark:hover:bg-neutral-900 transition-colors text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">Batal</button>
            <button type="submit" disabled={saving || compressing || categories.length === 0} className="px-5 py-2 bg-neutral-950 dark:bg-neutral-50 text-white dark:text-neutral-950 font-semibold rounded-lg hover:opacity-90 transition text-xs cursor-pointer shadow-xs active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {saving || compressing ? (
                <><span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />{compressing ? "Memproses gambar..." : projectToEdit ? "Menyimpan..." : "Menambah..."}</>
              ) : (
                projectToEdit ? "Simpan" : "Tambah Proyek"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
