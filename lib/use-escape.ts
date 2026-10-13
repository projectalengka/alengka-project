"use client"

import { useEffect } from "react"

/**
 * Menutup dialog dengan tombol Escape.
 *
 * Sebelumnya tidak ada satu pun modal yang bisa ditutup lewat keyboard —
 * pengguna harus mengklik tombol atau area gelap di belakangnya. Untuk dialog
 * yang menutupi seluruh layar, itu terasa seperti jebakan.
 *
 * `enabled` dipakai supaya listener hanya terpasang saat dialog benar-benar
 * terbuka, dan `onEscape` diambil lewat dependensi sehingga selalu memanggil
 * versi terbaru (tidak tertahan oleh closure lama).
 */
export function useEscape(enabled: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [enabled, onEscape])
}
