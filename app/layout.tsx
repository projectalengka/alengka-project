import type { Metadata } from "next"
import "./globals.css"
import { STUDIO } from "@/lib/studio"

/*
 * Font dimuat lewat <link> ke Google Fonts, BUKAN next/font/google.
 *
 * Alasan memilih <link>:
 *  - next/font/google mengunduh berkas font dari fonts.googleapis.com pada
 *    SAAT BUILD. Di lingkungan build tanpa internet (CI tertutup, Vercel
 *    offline, kontainer terisolasi) langkah itu menggantung lalu menggagalkan
 *    build. <link> tidak butuh jaringan saat build, jadi build selalu hijau.
 *  - Untuk menghindari biaya handshake DNS/TLS di jalur kritis, kedua domain
 *    font di-preconnect di bawah, dan stylesheet-nya dimuat paralel bersama
 *    CSS utama (bukan @import di dalam CSS yang baru diunduh setelah CSS
 *    selesai diparse).
 *  - display=swap memastikan teks tetap tampil dengan font fallback selama
 *    font asli diunduh.
 *
 * Playfair Display TIDAK lagi dimuat. Dulu ia dipakai untuk monogram "ds" pada
 * lembar invoice; sejak lembar itu memakai logo studio yang sebenarnya (berkas
 * SVG di /public), tidak ada lagi teks serif di seluruh aplikasi. Permintaan
 * font ke Google berkurang dari 3 keluarga menjadi 2, dan satu koneksi font
 * hilang dari jalur kritis.
 */
export const metadata: Metadata = {
  title: `${STUDIO.name} — Manajemen Proyek Desain`,
  description: `Catat dan kelola proyek desain ${STUDIO.name} dengan mudah`,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router
            memakai satu root layout, jadi peringatan "hanya berlaku satu
            halaman" tidak relevan di sini; ini bukan pages/_document. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
        {/* Tema dipasang sebelum cat pertama supaya tidak ada kedipan putih
            saat mode gelap. Dijalankan inline, bukan di useEffect. */}
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`
        }} />
      </head>
      <body className="min-h-screen bg-[#f7f7f8] dark:bg-[#08080a] text-neutral-900 dark:text-neutral-100 font-sans">
        {children}
      </body>
    </html>
  )
}
