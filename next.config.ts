import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [],
    // Gambar pratinjau disimpan sebagai data URL yang sudah diperkecil di
    // peramban (lihat lib/image.ts), jadi tidak ada host eksternal yang perlu
    // diizinkan di sini.
  },
  experimental: {
    serverActions: {
      // Diturunkan dari 5mb. Batas besar sebelumnya hanya diperlukan karena
      // gambar dikirim sebagai base64 mentah; sekarang gambar diperkecil di
      // klien lebih dulu (target < 120KB), sehingga 1mb sudah lega dan
      // permintaan raksasa ditolak lebih awal.
      bodySizeLimit: "1mb",
    },
  },
}

export default nextConfig
