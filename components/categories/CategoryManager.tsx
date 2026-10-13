"use client"

import { useState, useCallback } from "react"
import type { Category, ToastType } from "@/types"
import { Plus, Trash2, AlertTriangle, X, Check, Loader2 } from "lucide-react"
import { renderIcon } from "@/lib/icons"
import { createCategory, updateCategory, deleteCategory } from "@/actions/categories"
import { useEscape } from "@/lib/use-escape"

const AVAILABLE_ICONS = [
  { name: "Sparkles", label: "Kreatif" }, { name: "Shirt", label: "Pakaian" },
  { name: "PenTool", label: "Vektor" }, { name: "Laptop", label: "UI/Web" },
  { name: "Compass", label: "Branding" }, { name: "ImageIcon", label: "Ilustrasi" },
  { name: "Video", label: "Animasi" }, { name: "Layers", label: "Umum" },
  { name: "Palette", label: "Warna" }, { name: "Briefcase", label: "Bisnis" },
  { name: "Brush", label: "Lukisan" }, { name: "Smartphone", label: "Aplikasi" },
  { name: "BookOpen", label: "Editorial" }, { name: "Tag", label: "Label" },
  { name: "Scissors", label: "Kerajinan" },
]

interface CategoryManagerProps {
  categories: Category[]
  onChanged?: () => void
  onToast?: (message: string, type?: ToastType) => void
}

export default function CategoryManager({ categories, onChanged, onToast }: CategoryManagerProps) {
  const [newName, setNewName] = useState("")
  const [selectedIcon, setSelectedIcon] = useState("Tag")
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Escape menutup dialog konfirmasi hapus kategori (kecuali sedang menghapus).
  useEscape(deleteTarget !== null && !deleting, () => setDeleteTarget(null))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError("")
    const name = newName.trim()
    if (!name) { setError("Nama kategori harus diisi."); return }

    setBusy(true)
    try {
      // Validasi duplikat dipercayakan ke server (mode insensitive + aman dari
      // balapan); di klien hanya untuk umpan balik cepat.
      const res = editing
        ? await updateCategory(editing.id, name, selectedIcon)
        : await createCategory(name, selectedIcon)

      if (!res.ok) { setError(res.error); return }

      onToast?.(editing ? "Kategori diperbarui." : "Kategori ditambahkan.")
      setEditing(null)
      setNewName("")
      setSelectedIcon("Tag")
      onChanged?.()
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = useCallback(async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      const res = await deleteCategory(deleteTarget.id)
      if (!res.ok) {
        // Sebelumnya kegagalan di sini hilang tanpa jejak karena tidak ada
        // try/catch sama sekali.
        onToast?.(res.error, "warning")
        setError(res.error)
        return
      }
      onToast?.(`Kategori "${deleteTarget.name}" dihapus.`, "warning")
      setDeleteTarget(null)
      onChanged?.()
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, deleting, onToast, onChanged])

  const startEdit = (cat: Category) => {
    setEditing(cat); setNewName(cat.name); setSelectedIcon(cat.iconName); setError("")
  }
  const cancelEdit = () => { setEditing(null); setNewName(""); setSelectedIcon("Tag"); setError("") }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 tracking-[0.2em] uppercase">Kategori</h2>
        <p className="text-xs text-neutral-450 dark:text-neutral-400 mt-0.5">Tambah atau edit kategori proyek.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-white dark:bg-[#0d0d0f]/50 border border-neutral-200/60 dark:border-neutral-900/40 rounded-xl p-6 shadow-xs h-fit space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold text-neutral-850 dark:text-neutral-200 block">{editing ? "Edit Kategori" : "Tambah Kategori"}</span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-550 block mt-0.5">{editing ? "Ubah nama dan ikon." : "Kasih nama dan pilih ikon."}</span>
            </div>
            {editing && <button onClick={cancelEdit} className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-lg bg-neutral-100 dark:bg-neutral-900 transition-colors cursor-pointer" aria-label="Batalkan edit"><X className="w-3.5 h-3.5" /></button>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="category-name" className="block text-[9px] uppercase font-medium tracking-[0.15em] text-neutral-450 dark:text-neutral-500">Nama Kategori</label>
              <input id="category-name" type="text" required placeholder="cth: Desain Logo" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-[#f5f5f7] dark:bg-[#121214]/60 border border-neutral-200/60 dark:border-neutral-850/40 text-xs px-3.5 py-2.5 rounded-lg text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700 transition-colors" />
            </div>
            <div className="space-y-2.5">
              <span className="block text-[9px] uppercase font-medium tracking-[0.15em] text-neutral-450 dark:text-neutral-500">Pilih Ikon</span>
              <div className="grid grid-cols-4 gap-2 border border-neutral-200/50 dark:border-neutral-850/50 p-3 rounded-lg bg-neutral-50/50 dark:bg-[#121214]/20">
                {AVAILABLE_ICONS.map((ico) => (
                  <button key={ico.name} type="button" onClick={() => setSelectedIcon(ico.name)} title={ico.label} aria-label={ico.label}
                    className={`p-2.5 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                      selectedIcon === ico.name ? "bg-neutral-950 dark:bg-neutral-100 border-transparent text-white dark:text-neutral-950 scale-105 shadow-xs" : "bg-white dark:bg-[#0d0d0f]/60 border-neutral-200/70 dark:border-neutral-900 text-neutral-400 hover:text-neutral-800 dark:hover:text-white"
                    }`}>
                    {renderIcon(ico.name)}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-[10px] text-red-500 font-medium bg-red-500/10 p-2.5 rounded-lg flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}</p>}
            <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-lg bg-neutral-950 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-neutral-950 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : editing ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {busy ? "Menyimpan..." : editing ? "Simpan" : "Tambah"}
            </button>
            {editing && <button type="button" onClick={cancelEdit} disabled={busy} className="w-full py-2.5 text-xs font-medium rounded-lg text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer border border-neutral-200 dark:border-neutral-800 disabled:opacity-50">Batal</button>}
          </form>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <span className="text-xs font-semibold text-neutral-850 dark:text-neutral-200 block">Semua Kategori ({categories.length})</span>
          {categories.length === 0 ? (
            <div className="bg-white dark:bg-[#0d0d0f]/30 border border-dashed border-neutral-200 dark:border-neutral-900 rounded-xl p-10 text-center">
              <p className="text-xs text-neutral-450 dark:text-neutral-500">Belum ada kategori. Tambahkan satu untuk mulai membuat proyek.</p>
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {categories.map((cat) => (
              <div key={cat.id} className="bg-white dark:bg-[#0d0d0f]/30 border border-neutral-200/60 dark:border-neutral-900/40 rounded-xl p-5 flex items-center justify-between group transition-colors hover:border-neutral-350 dark:hover:border-neutral-800">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-150 dark:border-neutral-850 flex items-center justify-center text-neutral-600 dark:text-neutral-300">
                    {renderIcon(cat.iconName)}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-100 block truncate">{cat.name}</span>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block">{cat._count?.projects || 0} proyek</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => startEdit(cat)} aria-label={`Edit ${cat.name}`} className={`p-2 rounded-lg transition-colors cursor-pointer ${editing?.id === cat.id ? "bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 scale-105 shadow-xs" : "text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={() => setDeleteTarget(cat)} aria-label={`Hapus ${cat.name}`} className="p-2 text-neutral-400 hover:text-red-500 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#09090b]/40 dark:bg-black/60" onClick={deleting ? undefined : () => setDeleteTarget(null)} />
          <div role="dialog" aria-modal="true" className="relative bg-white dark:bg-[#0d0d0f] border border-neutral-200/70 dark:border-neutral-900 rounded-lg w-full max-w-sm p-6 sm:p-7 shadow-2xl animate-fade-in">
            <div className="flex items-start gap-3.5">
              <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-500 flex-shrink-0"><AlertTriangle className="w-4 h-4" /></div>
              <div className="flex-1">
                <h3 className="text-xs font-bold text-neutral-900 dark:text-white">Hapus Kategori?</h3>
                <p className="mt-1.5 text-[11px] text-neutral-450 dark:text-neutral-400 leading-relaxed">
                  Yakin mau hapus kategori <span className="font-semibold">&quot;{deleteTarget.name}&quot;</span>?
                  {(deleteTarget._count?.projects || 0) > 0 && (
                    <span className="block mt-2 text-[10px] text-amber-600 dark:text-amber-400 font-medium bg-amber-500/10 p-2 rounded border border-amber-500/10">
                      Kategori ini masih dipakai {deleteTarget._count?.projects} proyek, jadi belum bisa dihapus. Pindahkan atau hapus proyeknya dulu.
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-neutral-100 dark:border-neutral-900/60 pt-3.5">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-850 text-neutral-500 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors text-[11px] font-medium cursor-pointer disabled:opacity-50">Batal</button>
              <button onClick={handleDelete} disabled={deleting || (deleteTarget._count?.projects || 0) > 0} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md transition-colors text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed">
                {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                {deleting ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
