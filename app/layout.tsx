import type { Metadata } from "next"
import "./globals.css"

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
 * Kalau suatu saat ingin sepenuhnya lepas dari Google Fonts, langkah yang
 * benar adalah menaruh berkas .woff2 di /public dan memakai @font-face
 * (menghindari unduhan pihak ketiga sekaligus tetap tanpa jaringan saat build).
 */
export const metadata: Metadata = {
  title: "DESIGN STUDIO — Manajemen Proyek Desain",
  description: "Catat dan kelola proyek desain freelance dengan mudah",
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;1,400;1,600&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
        {/* Tema dipasang sebelum cat pertama supaya tidak ada kedipan putih
            saat mode gelap. Dijalankan inline, bukan di useEffect. */}
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`
        }} />
      </head>
      <body className="min-h-screen bg-[#f5f5f7] dark:bg-[#09090b] text-[#1d1d1f] dark:text-[#f5f5f7] font-sans transition-colors duration-500">
        {children}
      </body>
    </html>
  )
}
