"use server"

import { prisma } from "@/lib/prisma"
import { ProjectStatus as PrismaStatus } from "@prisma/client"
import type {
  Project, Category, Client, ProjectFormData, ProjectStatus,
  ActionResult, DashboardPayload,
} from "@/types"
import { isProjectStatus } from "@/types"
import { computeStats } from "@/lib/analytics"

/**
 * Enum di database memakai penamaan Prisma (On_Progress) karena identifier
 * enum SQL tidak boleh mengandung spasi, sedangkan UI memakai label manusia
 * ("On Progress"). Dua fungsi ini adalah satu-satunya tempat penerjemahannya,
 * supaya tidak ada pemetaan tersebar di banyak file.
 */
const PRISMA_STATUS: Record<ProjectStatus, PrismaStatus> = {
  Masuk: PrismaStatus.Masuk,
  "On Progress": PrismaStatus.On_Progress,
  Revisi: PrismaStatus.Revisi,
  Done: PrismaStatus.Done,
  Cancel: PrismaStatus.Cancel,
}

const UI_STATUS: Record<PrismaStatus, ProjectStatus> = {
  [PrismaStatus.Masuk]: "Masuk",
  [PrismaStatus.On_Progress]: "On Progress",
  [PrismaStatus.Revisi]: "Revisi",
  [PrismaStatus.Done]: "Done",
  [PrismaStatus.Cancel]: "Cancel",
}

function toPrismaStatus(status: ProjectStatus): PrismaStatus {
  return PRISMA_STATUS[status]
}

function toUiStatus(status: PrismaStatus): ProjectStatus {
  return UI_STATUS[status] ?? "Masuk"
}

type PrismaProjectWithRelations = {
  id: string; projectTitle: string; clientId: string; categoryId: string
  price: number; status: PrismaStatus; deadline: Date; notes: string
  previewImage: string | null; invoicedAt: Date | null
  createdAt: Date; updatedAt: Date
  client: { id: string; name: string; contact: string; address: string; notes: string }
  category: { id: string; name: string; iconName: string }
}

function mapProject(p: PrismaProjectWithRelations): Project {
  return {
    id: p.id,
    projectTitle: p.projectTitle,
    clientId: p.clientId,
    client: p.client as Client,
    categoryId: p.categoryId,
    category: p.category as Category,
    price: p.price,
    status: toUiStatus(p.status),
    deadline: p.deadline,
    notes: p.notes,
    previewImage: p.previewImage,
    invoicedAt: p.invoicedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

const PROJECT_INCLUDE = { client: true, category: true } as const

/* -------------------------------------------------------------------------- */
/* Query                                                                      */
/* -------------------------------------------------------------------------- */

export async function getProjects(): Promise<Project[]> {
  const projects = await prisma.project.findMany({
    include: PROJECT_INCLUDE,
    orderBy: { createdAt: "desc" },
  })
  return projects.map(mapProject)
}

/**
 * Satu action untuk seluruh data aplikasi.
 *
 * Aplikasi memanggil getProjects() + categories + clients terpisah (tiga round
 * trip), lalu mengulanginya lagi setelah setiap mutasi karena revalidatePath
 * tidak berpengaruh pada state komponen klien. Sekarang semuanya lewat satu
 * pintu, sehingga pemuatan ulang cukup sekali jalan.
 */
export async function getDashboardData(): Promise<ActionResult<DashboardPayload>> {
  try {
    const [projects, categories, clients] = await Promise.all([
      getProjects(),
      prisma.category.findMany({
        include: { _count: { select: { projects: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.client.findMany({
        include: { _count: { select: { projects: true } } },
        orderBy: { name: "asc" },
      }),
    ])
    return {
      ok: true,
      data: {
        projects,
        categories: categories.map((c) => ({
          id: c.id, name: c.name, iconName: c.iconName, _count: c._count,
        })),
        clients: clients.map((c) => ({
          id: c.id, name: c.name, contact: c.contact, address: c.address,
          notes: c.notes, _count: c._count,
        })),
        stats: computeStats(projects),
      },
    }
  } catch (err) {
    console.error("[getDashboardData]", err)
    return { ok: false, error: "Gagal memuat data. Coba refresh halaman." }
  }
}

/* -------------------------------------------------------------------------- */
/* Validasi                                                                   */
/* -------------------------------------------------------------------------- */

const MAX_TITLE_LENGTH = 120
const MAX_PRICE = 1_000_000_000_000 // 1 triliun — guard terhadap salah ketik
const MAX_NOTES_LENGTH = 5000

function validateProject(data: ProjectFormData): string | null {
  if (!data.projectTitle?.trim()) return "Judul proyek harus diisi."
  if (data.projectTitle.trim().length > MAX_TITLE_LENGTH)
    return `Judul proyek terlalu panjang (maks ${MAX_TITLE_LENGTH} karakter).`
  if (!data.clientId) return "Klien harus dipilih."
  if (!data.categoryId) return "Kategori harus dipilih."
  if (typeof data.price !== "number" || !Number.isFinite(data.price) || data.price < 0)
    return "Harga tidak valid."
  if (data.price > MAX_PRICE) return "Harga terlalu besar. Periksa kembali angka yang dimasukkan."
  if (!isProjectStatus(data.status))
    return "Status tidak dikenal. Pilih salah satu: Masuk, On Progress, Revisi, Done, Cancel."
  if (!data.deadline) return "Deadline harus diisi."
  if (Number.isNaN(new Date(data.deadline).getTime())) return "Format deadline tidak valid."
  if (data.notes && data.notes.length > MAX_NOTES_LENGTH)
    return `Catatan terlalu panjang (maks ${MAX_NOTES_LENGTH} karakter).`
  return null
}

/**
 * Pastikan klien & kategori benar-benar ada sebelum insert/update.
 * Tanpa ini, id yang salah muncul sebagai 500 FK-violation, bukan pesan.
 */
async function relationGuard(clientId: string, categoryId: string): Promise<string | null> {
  const [client, category] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }),
    prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } }),
  ])
  if (!client) return "Klien yang dipilih tidak ditemukan. Muat ulang halaman."
  if (!category) return "Kategori yang dipilih tidak ditemukan. Muat ulang halaman."
  return null
}

/** Ubah error Prisma/low-level menjadi pesan Indonesia yang aman ditampilkan. */
function toFriendlyError(err: unknown, fallback: string): string {
  const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : ""
  switch (code) {
    case "P2025": return "Data sudah tidak ada. Mungkin baru dihapus di tempat lain."
    case "P2002": return "Data dengan identitas itu sudah ada."
    case "P2003": return "Klien atau kategori yang dipilih tidak valid."
    default: return fallback
  }
}

/* -------------------------------------------------------------------------- */
/* Mutasi — semuanya mengembalikan ActionResult, tidak pernah melempar         */
/* -------------------------------------------------------------------------- */

export async function createProject(data: ProjectFormData): Promise<ActionResult<Project>> {
  const validationError = validateProject(data)
  if (validationError) return { ok: false, error: validationError }
  const relError = await relationGuard(data.clientId, data.categoryId)
  if (relError) return { ok: false, error: relError }

  try {
    const p = await prisma.project.create({
      data: {
        projectTitle: data.projectTitle.trim(),
        clientId: data.clientId,
        categoryId: data.categoryId,
        price: data.price,
        status: toPrismaStatus(data.status),
        deadline: new Date(data.deadline),
        notes: data.notes?.trim() || "",
        previewImage: data.previewImage || null,
      },
      include: PROJECT_INCLUDE,
    })
    return { ok: true, data: mapProject(p) }
  } catch (err) {
    console.error("[createProject]", err)
    return { ok: false, error: toFriendlyError(err, "Gagal menyimpan proyek baru.") }
  }
}

export async function updateProject(id: string, data: ProjectFormData): Promise<ActionResult<Project>> {
  const validationError = validateProject(data)
  if (validationError) return { ok: false, error: validationError }
  const relError = await relationGuard(data.clientId, data.categoryId)
  if (relError) return { ok: false, error: relError }

  try {
    const p = await prisma.project.update({
      where: { id },
      data: {
        projectTitle: data.projectTitle.trim(),
        clientId: data.clientId,
        categoryId: data.categoryId,
        price: data.price,
        status: toPrismaStatus(data.status),
        deadline: new Date(data.deadline),
        notes: data.notes?.trim() || "",
        previewImage: data.previewImage || null,
      },
      include: PROJECT_INCLUDE,
    })
    return { ok: true, data: mapProject(p) }
  } catch (err) {
    console.error("[updateProject]", err)
    return { ok: false, error: toFriendlyError(err, "Gagal memperbarui proyek.") }
  }
}

export async function deleteProject(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    await prisma.project.delete({ where: { id } })
    return { ok: true, data: { id } }
  } catch (err) {
    console.error("[deleteProject]", err)
    return { ok: false, error: toFriendlyError(err, "Gagal menghapus proyek.") }
  }
}

export async function updateProjectStatus(
  id: string,
  status: ProjectStatus,
): Promise<ActionResult<Project>> {
  if (!isProjectStatus(status)) return { ok: false, error: "Status tidak dikenal." }
  try {
    const p = await prisma.project.update({
      where: { id },
      data: { status: toPrismaStatus(status) },
      include: PROJECT_INCLUDE,
    })
    return { ok: true, data: mapProject(p) }
  } catch (err) {
    console.error("[updateProjectStatus]", err)
    return { ok: false, error: toFriendlyError(err, "Gagal mengubah status.") }
  }
}

/**
 * Menandai / melepas penanda "sudah ditagih" untuk sekumpulan proyek.
 *
 * Dipakai setelah invoice dibuat. Invoice sendiri tidak disimpan sebagai tabel
 * (keputusan pemilik produk), jadi penanda inilah yang mencegah proyek yang
 * sama ikut tertagih dua kali pada invoice berikutnya.
 */
export async function setProjectsInvoiced(
  ids: string[],
  invoiced: boolean,
): Promise<ActionResult<{ count: number }>> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: "Tidak ada proyek yang ditandai." }
  }
  if (ids.length > 500) return { ok: false, error: "Terlalu banyak proyek sekaligus." }

  try {
    const res = await prisma.project.updateMany({
      where: { id: { in: ids } },
      data: { invoicedAt: invoiced ? new Date() : null },
    })
    return { ok: true, data: { count: res.count } }
  } catch (err) {
    console.error("[setProjectsInvoiced]", err)
    return { ok: false, error: toFriendlyError(err, "Gagal menandai proyek sebagai ditagih.") }
  }
}
