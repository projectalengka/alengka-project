import { PrismaClient, ProjectStatus } from "@prisma/client"

const prisma = new PrismaClient()

/*
 * Tanggal pada data contoh dibuat RELATIF terhadap hari ini, bukan dipatok mati.
 *
 * Versi sebelumnya memakai tanggal mati (deadline Mei–Juni 2026) dan tidak
 * menyetel createdAt sama sekali. Dua akibatnya:
 *  1. createdAt jatuh ke now(), sedangkan bucket grafik pendapatan dihitung
 *     dari createdAt — jadi seluruh proyek menumpuk di satu bulan dan grafik
 *     12 bulan tampak kosong, seolah fiturnya rusak.
 *  2. deadline yang dipatok mati membuat semua proyek "terlambat" begitu
 *     tanggal berjalan melewatinya, sehingga penanda overdue tidak informatif.
 *
 * Dengan offset relatif, data contoh selalu memperlihatkan sebaran beberapa
 * bulan sekaligus campuran proyek yang masih berjalan dan yang sudah lewat
 * deadline — jadi fitur grafik dan penanda overdue benar-benar terlihat.
 */
const DAY = 24 * 60 * 60 * 1000
const now = Date.now()
const daysAgo = (n: number) => new Date(now - n * DAY)
const daysAhead = (n: number) => new Date(now + n * DAY)

const categories = [
  { id: "Logo", name: "Desain Logo Identitas", iconName: "Sparkles" },
  { id: "Jersey", name: "Koleksi Jersey Olahraga", iconName: "Shirt" },
  { id: "Clothing", name: "Desain T-Shirt & Apparel", iconName: "Shirt" },
  { id: "Poster", name: "Poster & Media Cetak", iconName: "PenTool" },
  { id: "UI Design", name: "Desain Antarmuka Web/App", iconName: "Laptop" },
  { id: "Branding", name: "Pedoman Panduan Brand", iconName: "Compass" },
  { id: "Illustration", name: "Ilustrasi Digital", iconName: "ImageIcon" },
  { id: "Motion Design", name: "Motion Graphic Grafis", iconName: "Video" },
]

/** Klien kini data tersendiri, lengkap dengan kontak & alamat untuk invoice. */
const clients = [
  { key: "nexa", name: "Nexa Tech Solutions", contact: "halo@nexatech.id | +62 811-2233-4455", address: "Menara Sentraya Lt. 18, Jl. Iskandarsyah Raya No. 1A, Jakarta Selatan 12160" },
  { key: "velo", name: "Velo Athletic Co.", contact: "design@veloathletic.co | +62 812-8899-1010", address: "Jl. Raya Kertajaya Indah No. 42, Surabaya 60116" },
  { key: "krypton", name: "Krypton Labs", contact: "ops@kryptonlabs.io", address: "CoHive Coworking, Jl. Wolter Monginsidi No. 88, Jakarta Selatan 12180" },
  { key: "apex", name: "Apex Esports", contact: "manager@apexesports.gg | +62 813-5566-7788", address: "Ruko Golden Boulevard Blok B No. 7, Tangerang 15310" },
  { key: "elysian", name: "Elysian Wear", contact: "studio@elysianwear.com", address: "Jl. Cihampelas No. 120, Bandung 40131" },
  { key: "symphony", name: "Symphony Hall", contact: "marketing@symphonyhall.id | +62 21-555-0199", address: "Jl. Gatot Subroto Kav. 21, Jakarta Selatan 12930" },
  { key: "arcane", name: "Arcane Brew Co.", contact: "hello@arcanebrew.co", address: "Jl. Kemang Raya No. 15, Jakarta Selatan 12730" },
  { key: "holo", name: "Holo Stream", contact: "partnership@holostream.tv", address: "Jl. Pangeran Antasari No. 55, Jakarta Selatan 12150" },
  { key: "lumina", name: "Lumina Studio", contact: "hi@luminastudio.design | +62 817-4040-2020", address: "Jl. Danau Tamblingan No. 9, Denpasar 80228" },
]

/*
 * Sebaran sengaja mencakup SEMUA tahap alur agar papan pipeline terlihat hidup:
 * ada yang baru masuk, dikerjakan, revisi, selesai-belum-ditagih (siap ditagih),
 * sudah ditagih, dan dibatalkan.
 */
const projects = [
  {
    clientKey: "nexa",
    projectTitle: "Minimalist Brand Identity & Styleguide",
    categoryId: "Branding",
    price: 3200000,
    status: ProjectStatus.Done,
    createdAt: daysAgo(268),
    deadline: daysAgo(240),
    invoicedAt: daysAgo(230),
    notes: "Completed full branding suite including brand manual, color schemes, typography definition, and social media layout packs.",
  },
  {
    clientKey: "velo",
    projectTitle: "Premium Cycling Jersey Design v2",
    categoryId: "Jersey",
    price: 1800000,
    status: ProjectStatus.Revisi,
    createdAt: daysAgo(247),
    deadline: daysAgo(238),
    notes: "Reviewing layout of the chest stripes and corporate sponsor logos.",
  },
  {
    clientKey: "krypton",
    projectTitle: "SaaS Analytics Dashboard UI",
    categoryId: "UI Design",
    price: 4900000,
    status: ProjectStatus.On_Progress,
    createdAt: daysAgo(124),
    deadline: daysAhead(14),
    notes: "In progress of wireframing the central dashboard interactive widgets.",
  },
  {
    clientKey: "apex",
    projectTitle: "Championship Jersey & Team Hoodie Pack",
    categoryId: "Jersey",
    price: 2400000,
    status: ProjectStatus.On_Progress,
    createdAt: daysAgo(88),
    deadline: daysAhead(7),
    notes: "Designing futuristic jersey with cybernetic neon patterns.",
  },
  {
    clientKey: "elysian",
    projectTitle: "Summer Solstice Apparel Collection",
    categoryId: "Clothing",
    price: 3500000,
    status: ProjectStatus.Done,
    createdAt: daysAgo(203),
    deadline: daysAgo(171),
    // sengaja BELUM ditagih -> muncul di kolom "Siap Ditagih"
    notes: "Designed a series of 5 minimalist screen-print graphics for heavyweight organic cotton t-shirts.",
  },
  {
    clientKey: "symphony",
    projectTitle: "Annual Jazz Festival Poster Design",
    categoryId: "Poster",
    price: 1200000,
    status: ProjectStatus.Done,
    createdAt: daysAgo(152),
    deadline: daysAgo(131),
    // sengaja BELUM ditagih -> muncul di kolom "Siap Ditagih"
    notes: "Created an abstract vector lithograph design mixing bold Swiss typography.",
  },
  {
    clientKey: "arcane",
    projectTitle: "Artisanal Coffee Packaging Illustration",
    categoryId: "Illustration",
    price: 2100000,
    status: ProjectStatus.On_Progress,
    createdAt: daysAgo(61),
    deadline: daysAgo(5),
    notes: "Hand-drawn pen and ink illustration detailing mythical coffee shrubs.",
  },
  {
    clientKey: "holo",
    projectTitle: "App Launch - Web Animatic & Motion Intro",
    categoryId: "Motion Design",
    price: 4000000,
    status: ProjectStatus.Cancel,
    createdAt: daysAgo(179),
    deadline: daysAgo(158),
    notes: "Project cancelled by client due to funding constraints.",
  },
  {
    clientKey: "lumina",
    projectTitle: "Corporate Logo Redesign Suite",
    categoryId: "Logo",
    price: 1500000,
    status: ProjectStatus.Revisi,
    createdAt: daysAgo(37),
    deadline: daysAgo(11),
    notes: "Second iteration of the corporate emblem with warmer palette.",
  },
  {
    clientKey: "nexa",
    projectTitle: "Product Landing Page Redesign",
    categoryId: "UI Design",
    price: 2750000,
    status: ProjectStatus.Masuk,
    createdAt: daysAgo(4),
    deadline: daysAhead(21),
    notes: "Brief baru masuk. Menunggu materi konten dan aset produk dari klien.",
  },
  {
    clientKey: "krypton",
    projectTitle: "Design System & Component Library",
    categoryId: "UI Design",
    price: 5200000,
    status: ProjectStatus.Masuk,
    createdAt: daysAgo(2),
    deadline: daysAhead(45),
    notes: "Permintaan awal: token warna, tipografi, dan komponen dasar untuk tim internal.",
  },
]

async function main() {
  console.log("Seeding database...")

  // Urutan penting: projects lebih dulu karena FK-nya ON DELETE RESTRICT.
  await prisma.project.deleteMany()
  await prisma.category.deleteMany()
  await prisma.client.deleteMany()

  for (const cat of categories) {
    await prisma.category.create({ data: cat })
  }

  const clientIdByKey = new Map<string, string>()
  for (const c of clients) {
    const created = await prisma.client.create({
      data: { id: crypto.randomUUID(), name: c.name, contact: c.contact, address: c.address },
    })
    clientIdByKey.set(c.key, created.id)
  }

  for (const { clientKey, ...rest } of projects) {
    const clientId = clientIdByKey.get(clientKey)
    if (!clientId) throw new Error(`Klien tidak dikenal pada seed: ${clientKey}`)
    await prisma.project.create({ data: { ...rest, clientId } })
  }

  console.log(
    `Seeded ${categories.length} categories, ${clients.length} clients, ${projects.length} projects.`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
