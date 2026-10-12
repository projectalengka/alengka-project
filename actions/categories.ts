"use server"

import { prisma } from "@/lib/prisma"
import type { Category, ActionResult } from "@/types"

const MAX_CATEGORY_NAME = 60

/**
 * Catatan penting soal ID kategori.
 *
 * Versi sebelumnya menurunkan id dari nama:
 *   name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()
 * sehingga "Logo Design" dan "Logo-Design" dua-duanya menjadi "logo_design"
 * -> primary key bentrok -> 500 mentah. Nama kategori berbahasa Indonesia
 * hampir selalu mengandung spasi, jadi ini bukan kasus tepi.
 *
 * Sekarang id dibuat acak (cuid) dan keunikan nama dijaga oleh kolom
 * `name @unique` di schema, yang memang tempatnya.
 */
function mapCategory(c: {
  id: string; name: string; iconName: string; _count?: { projects: number }
}): Category {
  return { id: c.id, name: c.name, iconName: c.iconName, _count: c._count }
}

export async function getCategories(): Promise<Category[]> {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { projects: true } } },
    orderBy: { name: "asc" },
  })
  return categories.map(mapCategory)
}

function validateName(name: string): string | null {
  const trimmed = name?.trim()
  if (!trimmed) return "Nama kategori harus diisi."
  if (trimmed.length > MAX_CATEGORY_NAME)
    return `Nama kategori terlalu panjang (maks ${MAX_CATEGORY_NAME} karakter).`
  return null
}

/** Cek duplikat nama (case-insensitive), mengabaikan diri sendiri saat edit. */
async function nameTaken(name: string, exceptId?: string): Promise<boolean> {
  const found = await prisma.category.findFirst({
    where: {
      name: { equals: name.trim(), mode: "insensitive" },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  })
  return found !== null
}

export async function createCategory(
  name: string,
  iconName: string,
): Promise<ActionResult<Category>> {
  const validationError = validateName(name)
  if (validationError) return { ok: false, error: validationError }

  if (await nameTaken(name)) return { ok: false, error: "Nama kategori sudah ada." }

  try {
    // id dibuat acak; tidak lagi diturunkan dari nama sehingga tidak bisa bentrok
    const c = await prisma.category.create({
      data: { id: crypto.randomUUID(), name: name.trim(), iconName },
    })
    return { ok: true, data: mapCategory(c) }
  } catch (err) {
    console.error("[createCategory]", err)
    return { ok: false, error: "Gagal menambah kategori." }
  }
}

export async function updateCategory(
  id: string,
  name: string,
  iconName: string,
): Promise<ActionResult<Category>> {
  const validationError = validateName(name)
  if (validationError) return { ok: false, error: validationError }

  if (await nameTaken(name, id)) return { ok: false, error: "Nama kategori sudah ada." }

  try {
    const c = await prisma.category.update({
      where: { id },
      data: { name: name.trim(), iconName },
    })
    return { ok: true, data: mapCategory(c) }
  } catch (err) {
    console.error("[updateCategory]", err)
    const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : ""
    if (code === "P2025") return { ok: false, error: "Kategori sudah tidak ada." }
    return { ok: false, error: "Gagal memperbarui kategori." }
  }
}

/**
 * Hapus kategori. Menolak bila masih dipakai proyek, dan mengembalikan pesan
 * yang bisa ditampilkan — bukan melempar. Sebelumnya call site-nya tidak punya
 * try/catch sama sekali, sehingga penolakan ini hilang tanpa jejak.
 */
export async function deleteCategory(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const projectCount = await prisma.project.count({ where: { categoryId: id } })
    if (projectCount > 0) {
      return {
        ok: false,
        error: `Tidak bisa hapus kategori: ${projectCount} proyek masih menggunakannya.`,
      }
    }
    await prisma.category.delete({ where: { id } })
    return { ok: true, data: { id } }
  } catch (err) {
    console.error("[deleteCategory]", err)
    const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : ""
    if (code === "P2025") return { ok: false, error: "Kategori sudah tidak ada." }
    return { ok: false, error: "Gagal menghapus kategori." }
  }
}
