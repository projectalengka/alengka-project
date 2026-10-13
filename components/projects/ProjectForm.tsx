"use client"

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react"
import type { Project, Category, Client, ProjectFormData, ProjectStatus } from "@/types"
import { STATUS_META } from "@/lib/status"
import { X, Upload, AlertTriangle, Loader2, Plus, UserPlus } from "lucide-react"
import { createClient } from "@/actions/clients"
import { useEscape } from "@/lib/use-escape"
import {
  compressImage, isAcceptedImage, formatBytes, dataUrlBytes,
  MAX_UPLOAD_BYTES,
} from "@/lib/image"

interface ProjectFormProps {
  isOpen: boolean
  onClose: () => void
  /** Mengembalikan true bila berhasil. Modal hanya menutup saat true. */
  onSave: (data: ProjectFormData) => Promise<boolean>
  projectToEdit?: Project | null
  clients: Client[]
  categories: Category[]
}

/** Urutan pilihan status mengikuti alur kerja, bukan urutan alfabet. */
const STATUS_OPTS = Object.keys(STATUS_META) as ProjectStatus[]

export default function ProjectForm({
  isOpen, onClose, onSave, projectToEdit, clients, categories,
}: ProjectFormProps) {
  const [projectTitle, setProjectTitle] = useState("")
  const [clientId, setClientId] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [price, setPrice] = useState<number | "">("")
  const [status, setStatus] = useState<ProjectStatus>("Masuk")
  const [deadline, setDeadline] = useState("")
  const [notes, setNotes] = useState("")
  const [previewImage, setPreviewImage] = useState("")
  const [imageError, setImageError] = useState("")
  const [imageMeta, setImageMeta] = useState("")
  const [compressing, setCompressing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  /* Klien baru bisa dibuat langsung dari sini, tanpa harus pindah ke tab Klien
     lalu kembali lagi — inilah salah satu hal yang membuat alurnya dulu ribet. */
  const [newClientMode, setNewClientMode] = useState(false)
  const [newClientName, setNewClientName] = useState("")
  const [newClientContact, setNewClientContact] = useState("")
  const [newClientAddress, setNewClientAddress] = useState("")

  /*
   * Reset penuh HANYA ketika modal dibuka/ditutup atau target edit berubah.
   *
   * Sebelumnya `clients`/`categories` ikut menjadi dependensi, sehingga setiap
   * kali daftar itu mendapat identitas array baru (mis. hasil penyegaran data)
   * React menganggap efek harus jalan lagi — dan isian form yang sedang diketik
   * ikut dikosongkan. Pemuatan nilai bawaan kini dipisah ke efek kedua.
   */
  useEffect(() => {
    if (projectToEdit) {
      setProjectTitle(projectToEdit.projectTitle)
      setClientId(projectToEdit.clientId)
      setCategoryId(projectToEdit.categoryId)
      setPrice(projectToEdit.price)
      setStatus(projectToEdit.status)
      setDeadline(new Date(projectToEdit.deadline).toISOString().split("T")[0])
      setNotes(projectToEdit.notes)
      setPreviewImage(projectToEdit.previewImage || "")
    } else {
      setProjectTitle("")
      setClientId("")
      setCategoryId("")
      setPrice("")
      setStatus("Masuk")
      setDeadline("")
      setNotes("")
      setPreviewImage("")
    }
    setNewClientMode(false)
    setNewClientName("")
    setNewClientContact("")
    setNewClientAddress("")
    setImageError("")
    setImageMeta("")
    setFormError("")
  }, [projectToEdit, isOpen])

  /* Isi nilai bawaan bila kolomnya masih kosong — termasuk saat daftar baru tiba
     setelah form terbuka. Tidak menyentuh kolom lain. */
  useEffect(() => {
    if (!isOpen || projectToEdit) return
    if (!categoryId && categories[0]) setCategoryId(categories[0].id)
    if (!clientId && clients[0]) setClientId(clients[0].id)
  }, [categories, clients, isOpen, projectToEdit, categoryId, clientId])

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
    if (!projectTitle.trim() || price === "" || !deadline) {
      setFormError("Lengkapi dulu kolom bertanda *.")
      return
    }

    setSaving(true)
    try {
      let finalClientId = clientId

      // Klien baru dibuat lebih dulu, baru proyeknya — supaya tidak ada proyek
      // yang gagal tersimpan hanya karena klien belum ada.
      if (newClientMode) {
        const name = newClientName.trim()
        if (!name) { setFormError("Nama klien baru harus diisi."); return }
        const res = await createClient({
          name,
          contact: newClientContact.trim(),
          address: newClientAddress.trim(),
          notes: "",
        })
        if (!res.ok) { setFormError(res.error); return }
        finalClientId = res.data.id
      }

      if (!finalClientId) {
        setFormError("Pilih klien dulu, atau tambahkan klien baru.")
        return
      }
      if (!categoryId) {
        setFormError("Pilih kategori dulu. Kalau kosong, tambahkan kategori di tab Kategori.")
        return
      }

      const success = await onSave({
        projectTitle: projectTitle.trim(),
        clientId: finalClientId,
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

  const inputCls = "w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm px-3.5 py-2.5 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
  const labelCls = "block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400"

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-neutral-900/50 dark:bg-black/70" onClick={saving ? undefined : onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative bg-white dark:bg-[#111113] border border-neutral-200 dark:border-neutral-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[94vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-900 sticky top-0 bg-white dark:bg-[#111113] z-10">
          <div>
            <h2 className="text-[15px] font-semibold text-neutral-900 dark:text-white">
              {projectToEdit ? "Edit Proyek" : "Proyek Baru"}
            </h2>
            <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              {projectToEdit ? "Ubah detail proyek." : "Catat desain yang baru masuk."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Judul */}
          <div className="space-y-1.5">
            <label htmlFor="project-title" className={labelCls}>
              Judul proyek <span className="text-red-500">*</span>
            </label>
            <input
              id="project-title"
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="cth: Desain Logo Nexa"
              className={inputCls}
            />
          </div>

          {/* Klien */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="project-client" className={labelCls}>
                Klien <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setNewClientMode((v) => !v)}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
              >
                {newClientMode ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                {newClientMode ? "Pakai klien yang ada" : "Klien baru"}
              </button>
            </div>

            {newClientMode ? (
              <div className="space-y-2.5 p-3.5 rounded-xl bg-violet-50/60 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20">
                <input
                  id="project-client"
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Nama klien baru *"
                  className={inputCls}
                />
                <input
                  type="text"
                  value={newClientContact}
                  onChange={(e) => setNewClientContact(e.target.value)}
                  placeholder="Kontak (email / telepon) — opsional"
                  className={inputCls}
                />
                <textarea
                  rows={2}
                  value={newClientAddress}
                  onChange={(e) => setNewClientAddress(e.target.value)}
                  placeholder="Alamat penagihan — opsional"
                  className={`${inputCls} resize-none`}
                />
                <p className="text-[10.5px] text-neutral-500 dark:text-neutral-400">
                  Klien akan tersimpan, dan identitasnya otomatis dipakai saat membuat invoice.
                </p>
              </div>
            ) : (
              <select
                id="project-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className={`${inputCls} cursor-pointer`}
              >
                <option value="">— Pilih klien —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            {!newClientMode && clients.length === 0 && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Belum ada klien. Klik &quot;Klien baru&quot; di atas untuk menambahkannya.
              </p>
            )}
          </div>

          {/* Kategori + harga + deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="project-category" className={labelCls}>Kategori</label>
              <select
                id="project-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={`${inputCls} cursor-pointer`}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="project-price" className={labelCls}>
                Harga <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-neutral-400 font-mono">Rp</span>
                <input
                  id="project-price"
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="3000000"
                  className={`${inputCls} pl-10 font-mono`}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="project-deadline" className={labelCls}>
                Deadline <span className="text-red-500">*</span>
              </label>
              <input
                id="project-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className={`${inputCls} cursor-pointer`}
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <span className={labelCls}>Status</span>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTS.map((value) => {
                const m = STATUS_META[value]
                const active = status === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatus(value)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-semibold border transition-colors cursor-pointer ${
                      active
                        ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-transparent"
                        : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Catatan */}
          <div className="space-y-1.5">
            <label htmlFor="project-notes" className={labelCls}>Catatan</label>
            <textarea
              id="project-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Brief, permintaan klien, revisi..."
              className={`${inputCls} resize-y leading-relaxed`}
            />
          </div>

          {/* Gambar */}
          <div className="space-y-2">
            <span className={labelCls}>Gambar pratinjau <span className="text-neutral-400 font-normal">(opsional)</span></span>
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  onChange={handleImageChange}
                  disabled={compressing}
                  aria-label="Unggah gambar"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-wait"
                />
                <div className="w-16 h-16 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-neutral-400 bg-neutral-50 dark:bg-neutral-900">
                  {compressing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                {previewImage ? (
                  <div className="flex items-center gap-3">
                    {/* next/image tidak dipakai di sini: sumbernya data URL hasil
                        kompresi di peramban (lib/image.ts), dan next/image tidak
                        bisa mengoptimalkan data URL — hanya menambah lapisan
                        pembungkus tanpa manfaat. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewImage} alt="Pratinjau" className="w-16 h-16 rounded-xl object-cover border border-neutral-200 dark:border-neutral-800" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 truncate">
                        {imageMeta || "Gambar"}
                      </p>
                      <button
                        type="button"
                        onClick={() => { setPreviewImage(""); setImageMeta(""); setImageError("") }}
                        className="text-[11px] font-medium text-red-600 dark:text-red-400 hover:underline cursor-pointer mt-0.5"
                      >
                        Hapus gambar
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Ketuk kotak untuk memilih gambar. JPG/PNG/WebP, maks {formatBytes(MAX_UPLOAD_BYTES)}.
                    Gambar diperkecil otomatis di peramban.
                  </p>
                )}
              </div>
            </div>
            {imageError && <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">{imageError}</p>}
          </div>

          {formError && (
            <p className="text-[12px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />{formError}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-neutral-100 dark:border-neutral-900 flex items-center justify-end gap-2.5 sticky bottom-0 bg-white dark:bg-[#111113]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving || compressing}
            className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving || compressing}
            className="px-5 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {saving || compressing
              ? <><Loader2 className="w-4 h-4 animate-spin" />{compressing ? "Memproses gambar..." : "Menyimpan..."}</>
              : <><Plus className="w-4 h-4" />{projectToEdit ? "Simpan Perubahan" : "Simpan Proyek"}</>}
          </button>
        </div>
      </form>
    </div>
  )
}
