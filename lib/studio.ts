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
    account: "2650529912",
    holder: "Muchammad Andi Setiyawan",
  },
  /**
   * Logo ditulis sebagai teks (bukan gambar inline) supaya identitas ini tetap
   * dapat diserialisasi dan tidak menarik React ke dalam berkas konfigurasi.
   * Berkas fisiknya ada di `public/alengka-logo.png` (tinta gelap, untuk
   * kertas putih) dan `public/alengka-logo-light.png` (tinta putih, untuk
   * permukaan gelap).
   *
   * PNG ini menggantikan pasangan SVG lama. Berkas SVG itu kehilangan
   * `fill-rule="evenodd"`, sehingga seluruh counter huruf — misalnya lubang
   * segitiga di dalam "A" — terisi tinta dan wordmark tampak sebagai bongkahan
   * hitam, bukan huruf. PNG di sini berasal langsung dari artwork pemilik
   * studio, jadi bentuknya pasti benar. Untuk mengganti logo, cukup timpa
   * kedua berkas PNG ini (jaga latar transparan dan rasio 3,1789 : 1).
   */
  logo: "/alengka-logo.png",
  logoLight: "/alengka-logo-light.png",
  /** Rasio lebar:tinggi artwork logo (8157 : 2566 = 3,1789 : 1). */
  logoAspect: 8157 / 2566,
} as const
