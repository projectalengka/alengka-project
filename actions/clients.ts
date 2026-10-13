"use server"

import { prisma } from "@/lib/prisma"
import type { Client, ClientFormData, ActionResult } from "@/types"

/**
 * CRUD klien.
 *
 * Klien sebelumnya hanya teks di dalam proyek (`clientName`), sehingga identitas
 * klien harus diketik ulang setiap kali membuat invoice. Sejak tabel `clients`
 * ada, invoice cukup memilih klien dan nama/kontak/alamatnya terisi otomatis.
 *
 * Semua fungsi di sini mengembalikan ActionResult dan TIDAK melempar, supaya
 * pemanggil wajib menangani cabang gagal.
 */

const MAX_NAME = 120
const MAX_CONTACT = 200
const MAX_ADDRESS = 500
const MAX_NOTES = 2000

function mapClient(c: {
  id: string; name: string; contact: string; address: string; notes: string
  _count?: { projects: number }
}): Client {
  return {
    id: c.id,
    name: c.name,
    contact: c.contact,
    address: c.address,
    notes: c.notes,
    _count: c._count,
  }
}

export async function getClients(): Promise<Client[]> {
  const clients = await prisma.client.findMany({
    include: { _count: { select: { projects: true } } },
    orderBy: { name: "asc" },
  })
  return clients.map(mapClient)
}

function validateClient(data: ClientFormData): string | null {
  const name = data.name?.trim()
  if (!name) return "Nama klien harus diisi."
  if (name.length > MAX_NAME) return `Nama klien terlalu panjang (maks ${MAX_NAME} karakter).`
  if (data.contact && data.contact.length > MAX_CONTACT)
    return `Kontak terlalu panjang (maks ${MAX_CONTACT} karakter).`
  if (data.address && data.address.length > MAX_ADDRESS)
    return `Alamat terlalu panjang (maks ${MAX_ADDRESS} karakter).`
  if (data.notes && data.notes.length > MAX_NOTES)
    return `Catatan terlalu panjang (maks ${MAX_NOTES} karakter).`
  return null
}

/** Cek duplikat nama (tidak peka huruf besar/kecil), mengabaikan diri sendiri saat edit. */
async function nameTaken(name: string, exceptId?: string): Promise<boolean> {
  const found = await prisma.client.findFirst({
    where: {
      name: { equals: name.trim(), mode: "insensitive" },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  })
  return found !== null
}

export async function createClient(data: ClientFormData): Promise<ActionResult<Client>> {
  const invalid = validateClient(data)
  if (invalid) return { ok: false, error: invalid }
  if (await nameTaken(data.name)) return { ok: false, error: "Nama klien sudah ada." }

  try {
    const c = await prisma.client.create({
      data: {
        id: crypto.randomUUID(),
        name: data.name.trim(),
        contact: data.contact?.trim() ?? "",
        address: data.address?.trim() ?? "",
        notes: data.notes?.trim() ?? "",
      },
      include: { _count: { select: { projects: true } } },
    })
    return { ok: true, data: mapClient(c) }
  } catch (err) {
    console.error("[createClient]", err)
    return { ok: false, error: "Gagal menambah klien." }
  }
}

export async function updateClient(
  id: string,
  data: ClientFormData,
): Promise<ActionResult<Client>> {
  const invalid = validateClient(data)
  if (invalid) return { ok: false, error: invalid }
  if (await nameTaken(data.name, id)) return { ok: false, error: "Nama klien sudah ada." }

  try {
    const c = await prisma.client.update({
      where: { id },
      data: {
        name: data.name.trim(),
        contact: data.contact?.trim() ?? "",
        address: data.address?.trim() ?? "",
        notes: data.notes?.trim() ?? "",
      },
      include: { _count: { select: { projects: true } } },
    })
    return { ok: true, data: mapClient(c) }
  } catch (err) {
    console.error("[updateClient]", err)
    const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : ""
    if (code === "P2025") return { ok: false, error: "Klien sudah tidak ada." }
    return { ok: false, error: "Gagal memperbarui klien." }
  }
}

/**
 * Hapus klien. Ditolak bila klien masih punya proyek, dan penolakan itu
 * dikembalikan sebagai pesan — bukan dilempar.
 */
export async function deleteClient(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const projectCount = await prisma.project.count({ where: { clientId: id } })
    if (projectCount > 0) {
      return {
        ok: false,
        error: `Tidak bisa hapus klien: masih ada ${projectCount} proyek milik klien ini.`,
      }
    }
    await prisma.client.delete({ where: { id } })
    return { ok: true, data: { id } }
  } catch (err) {
    console.error("[deleteClient]", err)
    const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : ""
    if (code === "P2025") return { ok: false, error: "Klien sudah tidak ada." }
    return { ok: false, error: "Gagal menghapus klien." }
  }
}
