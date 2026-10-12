/**
 * Utilitas gambar sisi klien.
 *
 * Masalah yang diselesaikan: sebelumnya ProjectForm membaca berkas apa adanya
 * sebagai data URL lalu menyimpannya ke kolom Postgres `previewImage`
 * (@db.Text). Satu foto 5MB menjadi ~6.7MB teks base64 di database, dan karena
 * seluruh data ikut terkirim pada setiap pemuatan/poll, dashboard membengkak
 * jadi beberapa megabyte. `next/image` juga tidak bisa mengoptimalkan data URL.
 *
 * Pendekatan di sini: perkecil di peramban SEBELUM dikirim, sehingga yang
 * tersimpan tetap berupa URL data tetapi berukuran wajar (biasanya < 60KB).
 * Kalau nanti pindah ke object storage, fungsi ini tinggal dipakai untuk
 * membuat versi pratinjau, dan yang disimpan adalah URL berkas aslinya.
 */

export interface CompressOptions {
  /** Sisi terpanjang gambar hasil, dalam px. */
  maxDimension?: number
  /** Kualitas JPEG 0..1. */
  quality?: number
  /** Batas ukuran hasil; di atas ini kualitas diturunkan bertahap. */
  maxBytes?: number
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 800,
  quality: 0.82,
  maxBytes: 120 * 1024, // ~120KB
}

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export function isAcceptedImage(file: File): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Baca berkas menjadi HTMLImageElement. Memakai createObjectURL + revoke
 * supaya berkas tidak perlu di-encode base64 dua kali hanya untuk diukur.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Gambar tidak bisa dibaca."))
    }
    img.src = url
  })
}

/**
 * Perkecil + kompres gambar menjadi data URL JPEG/WebP yang ringan.
 * Transparansi PNG dipertahankan sebagai WebP bila peramban mendukung;
 * kalau tidak, PNG dengan latar putih.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<string> {
  const { maxDimension, quality, maxBytes } = { ...DEFAULTS, ...options }

  const img = await loadImage(file)
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
  const targetW = Math.max(1, Math.round(img.width * scale))
  const targetH = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas tidak tersedia di peramban ini.")

  const hasAlpha = file.type === "image/png" || file.type === "image/webp"
  if (!hasAlpha) {
    // JPEG tidak punya alpha; isi latar putih agar tidak jadi hitam
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, targetW, targetH)
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, 0, 0, targetW, targetH)

  const canWebp = canvas.toDataURL("image/webp").startsWith("data:image/webp")
  const mime = hasAlpha && canWebp ? "image/webp" : "image/jpeg"

  // Turunkan kualitas bertahap sampai di bawah maxBytes.
  let q = quality
  let out = canvas.toDataURL(mime, q)
  for (let i = 0; i < 4 && out.length * 0.75 > maxBytes && q > 0.4; i++) {
    q = Math.max(0.4, q - 0.15)
    out = canvas.toDataURL(mime, q)
  }
  return out
}

/** Perkiraan ukuran biner dari sebuah data URL base64. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",")
  if (comma === -1) return dataUrl.length
  const b64 = dataUrl.slice(comma + 1)
  return Math.floor((b64.length * 3) / 4)
}
