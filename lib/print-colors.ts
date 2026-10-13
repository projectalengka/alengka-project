/**
 * Penyelamat warna untuk html2canvas.
 *
 * Tailwind v4 menyusun SELURUH paletnya dalam ruang warna `oklch()`. html2canvas
 * tidak mengenal fungsi warna itu dan menggagalkan render dengan:
 *
 *   Error: Attempting to parse an unsupported color function "oklch"
 *
 * Akibatnya pembuatan PDF invoice selalu gagal dan diam-diam jatuh ke
 * `window.print()` — persis gejala "fitur invoice belum berjalan".
 *
 * Fungsi di sini dipanggil dari `onclone` html2canvas: setiap warna oklch pada
 * elemen hasil kloning diubah menjadi rgb LEBIH DULU, dengan memakai canvas
 * untuk menghitung nilai rgb-nya (peramban yang mengonversi, jadi hasilnya
 * akurat). Karena ditulis sebagai inline style pada elemen kloning, nilai itu
 * menimpa kelas Tailwind-nya dan html2canvas hanya melihat rgb.
 */

/** Properti yang bisa memuat warna dan dibaca html2canvas. */
const COLOR_PROPS = [
  "color",
  "backgroundColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
  "textDecorationColor",
  "caretColor",
  "columnRuleColor",
  "fill",
  "stroke",
] as const

let cache: Map<string, string> | null = null

/**
 * Mengubah satu nilai warna oklch menjadi rgb/rgba.
 * Mengembalikan null bila nilainya bukan oklch atau gagal dikonversi.
 */
function oklchToRgb(value: string): string | null {
  if (!value || !value.includes("oklch")) return null

  if (!cache) cache = new Map()
  const cached = cache.get(value)
  if (cached) return cached

  try {
    const canvas = document.createElement("canvas")
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null

    // Setel ke hitam dulu: bila peramban tidak mengenali nilainya, fillStyle
    // tetap hitam dan kita bisa mendeteksi bahwa konversi tidak terjadi.
    ctx.fillStyle = "#000000"
    ctx.fillStyle = value
    if (ctx.fillStyle === "#000000") return null

    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    const out =
      a === 255
        ? `rgb(${r}, ${g}, ${b})`
        : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`

    cache.set(value, out)
    return out
  } catch {
    return null
  }
}

/**
 * Mengganti semua warna oklch di dalam `root` (termasuk root itu sendiri)
 * dengan padanan rgb, ditulis sebagai inline style.
 *
 * CATATAN PENTING soal `getComputedStyle`: fungsi ini dipanggil dari callback
 * `onclone` html2canvas, yang menerima dokumen KLONING di dalam iframe buatan
 * html2canvas — bukan dokumen utama. Karena itu computed style HARUS dibaca
 * lewat view milik elemen itu sendiri (`ownerDocument.defaultView`). Memakai
 * `window` induk pada elemen dari dokumen lain tidak dijamin bekerja.
 */
export function replaceOklchColors(root: HTMLElement): void {
  const elements: HTMLElement[] = [
    root,
    ...Array.from(root.querySelectorAll<HTMLElement>("*")),
  ]

  for (const el of elements) {
    const view = el.ownerDocument?.defaultView ?? window
    const computed = view.getComputedStyle(el)

    for (const prop of COLOR_PROPS) {
      const value = computed[prop]
      if (typeof value !== "string" || !value.includes("oklch")) continue
      const rgb = oklchToRgb(value)
      if (rgb) {
        // Inline style menimpa kelas Tailwind pada elemen hasil kloning.
        ;(el.style as unknown as Record<string, string>)[prop] = rgb
      }
    }

    // box-shadow memuat warna juga, dan bentuknya terlalu rumit untuk
    // diterjemahkan sebagian — lebih baik dibuang di PDF daripada gagal render.
    const shadow = computed.boxShadow
    if (shadow && shadow.includes("oklch")) el.style.boxShadow = "none"
  }
}
