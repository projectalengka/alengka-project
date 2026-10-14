/**
 * Identitas studio yang tercetak di dokumen resmi (lembar invoice).
 *
 * Dikumpulkan di satu tempat supaya mengubah alamat, kontak, atau rekening
 * tidak perlu berburu string di dalam JSX. Nilai di sini juga dipakai oleh
 * metadata aplikasi sehingga nama studio di tab peramban dan di invoice
 * selalu sama.
 */
export const STUDIO = {
  name: "ALENGKA PROJECT",
  /** Baris pendukung di bawah nama studio pada lembar invoice. */
  tagline: "Creative Project & Design Studio",
  city: "Mojokerto, Jawa Timur",
  email: "projectalengka@gmail.com",
  phone: "087753222386",
  /** Rekening pembayaran yang dicetak pada blok "Rekening". */
  bank: {
    name: "BCA",
    account: "872-0492-911",
    holder: "Muchammad Andi Setiyawan",
  },
  /**
   * Logo ditulis sebagai teks (bukan SVG inline) supaya identitas ini tetap
   * dapat diserialisasi dan tidak menarik React ke dalam berkas konfigurasi.
   * Berkas fisiknya ada di `public/alengka-logo.svg` (tinta gelap, untuk
   * kertas putih) dan `public/alengka-logo-light.svg` (tinta putih, untuk
   * permukaan gelap).
   */
  logo: "/alengka-logo.svg",
  logoLight: "/alengka-logo-light.svg",
  /** Rasio lebar:tinggi asli artwork logo (31953.9 : 10051.88). */
  logoAspect: 31953.9 / 10051.88,
} as const
