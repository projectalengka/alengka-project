"use client"

import { useState } from "react"
import { Calendar, Pencil, Trash2, ReceiptText, AlertTriangle, CheckCircle2, StickyNote } from "lucide-react"
import type { Project, ProjectStatus } from "@/types"
import { formatCurrency, formatDate, isOverdue } from "@/lib/utils"
import { renderIcon } from "@/lib/icons"
import { STATUS_META, INVOICED_CHIP, READY_TO_BILL_CHIP } from "@/lib/status"

interface ProjectCardProps {
  project: Project
  onEdit: (p: Project) => void
  onDelete: (p: Project) => void
  onStatusChange: (id: string, status: ProjectStatus) => void
  /** Membuat invoice khusus untuk proyek ini (langsung dari kolom Siap Ditagih). */
  onInvoice?: (p: Project) => void
}

/**
 * Kartu proyek di papan.
 *
 * Beberapa keputusan tata letak yang disengaja:
 *  - Lencana STATUS tidak ditampilkan. Di papan, kolom tempat kartu berada
 *    SUDAH menyatakan statusnya, dan daftar pilihan di bawah juga menampilkan
 *    label yang sama — menambahkannya lagi hanya memakan ruang. Yang tetap
 *    ditampilkan adalah keadaan yang TIDAK terlihat dari kolom: "sudah ditagih"
 *    dan "lewat deadline".
 *  - Nama kategori diletakkan di barisnya sendiri agar tidak terpotong. Di
 *    kolom yang sempit (~220px), menaruhnya sebaris dengan harga membuat nama
 *    seperti "Desain Logo Identitas" terpangkas jadi "Des…".
 *  - Setiap aksi yang sering dipakai punya tombolnya sendiri dengan sasaran
 *    sentuh besar, karena sebagian besar pemakaian terjadi di ponsel.
 */
export default function ProjectCard({
  project, onEdit, onDelete, onStatusChange, onInvoice,
}: ProjectCardProps) {
  const [showNotes, setShowNotes] = useState(false)
  const late = isOverdue(project.deadline) &&
    project.status !== "Done" && project.status !== "Cancel"
  const readyToBill = project.status === "Done" && !project.invoicedAt
  const alreadyInvoiced = project.invoicedAt !== null

  return (
    <article className="group bg-white dark:bg-[#111113] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-3.5 space-y-2.5 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
      {/* Judul dapat lebar penuh; harga turun ke baris klien.
          Sebelumnya harga diletakkan sebaris dengan judul, dan di kolom selebar
          ~220px itu menyisakan ~110px untuk judul sehingga judul seperti
          "Design System & Component Library" terpotong jadi dua potongan pendek.
          Isi kartu yang paling penting untuk dibaca sekilas adalah judulnya. */}
      <div className="space-y-1">
        <h4 className="text-[13px] font-semibold text-neutral-900 dark:text-white leading-snug line-clamp-2">
          {project.projectTitle}
        </h4>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate min-w-0">
            {project.client.name}
          </p>
          <span className="text-[12.5px] font-semibold font-mono text-neutral-900 dark:text-white shrink-0">
            {formatCurrency(project.price)}
          </span>
        </div>
      </div>

      {/* Kategori + keadaan yang tidak terlihat dari kolom */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          title={project.category.name}
          className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-900 px-2 py-1 rounded-lg max-w-full"
        >
          <span className="shrink-0">{renderIcon(project.category.iconName, "w-3.5 h-3.5")}</span>
          <span className="truncate">{project.category.name}</span>
        </span>
        {alreadyInvoiced && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border ${INVOICED_CHIP}`}>
            <CheckCircle2 className="w-3 h-3" />Sudah ditagih
          </span>
        )}
        {late && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20">
            <AlertTriangle className="w-3 h-3" />Lewat deadline
          </span>
        )}
      </div>

      {/* Deadline */}
      <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
        <Calendar className="w-3.5 h-3.5 shrink-0" />
        <span className={late ? "text-amber-700 dark:text-amber-300 font-medium" : ""}>
          {formatDate(project.deadline)}
        </span>
        {project.notes && (
          <button
            onClick={() => setShowNotes((v) => !v)}
            aria-expanded={showNotes}
            className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <StickyNote className="w-3 h-3" />
            {showNotes ? "Tutup" : "Catatan"}
          </button>
        )}
      </div>

      {showNotes && project.notes && (
        <p className="text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 rounded-xl p-2.5 whitespace-pre-wrap max-h-40 overflow-y-auto">
          {project.notes}
        </p>
      )}

      {/* Aksi utama: tagih. Hanya muncul saat memang siap ditagih. */}
      {readyToBill && onInvoice && (
        <button
          onClick={() => onInvoice(project)}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-bold border transition-colors cursor-pointer ${READY_TO_BILL_CHIP}`}
        >
          <ReceiptText className="w-4 h-4" />
          Buat Invoice
        </button>
      )}

      {/* Aksi sekunder */}
      <div className="flex items-center gap-2 pt-0.5">
        <select
          value={project.status}
          onChange={(e) => onStatusChange(project.id, e.target.value as ProjectStatus)}
          aria-label={`Ubah status ${project.projectTitle}`}
          className="flex-1 min-w-0 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-[11px] font-medium px-2.5 py-2 text-neutral-700 dark:text-neutral-300 cursor-pointer focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
        >
          {Object.entries(STATUS_META).map(([value, m]) => (
            <option key={value} value={value}>{m.label}</option>
          ))}
        </select>
        <button
          onClick={() => onEdit(project)}
          aria-label={`Edit ${project.projectTitle}`}
          className="p-2 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(project)}
          aria-label={`Hapus ${project.projectTitle}`}
          className="p-2 rounded-xl text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </article>
  )
}
