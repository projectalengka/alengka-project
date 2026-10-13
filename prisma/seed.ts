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

const projects = [
  {
    clientName: "Nexa Tech Solutions",
    projectTitle: "Minimalist Brand Identity & Styleguide",
    categoryId: "Branding",
    price: 3200000,
    status: ProjectStatus.Done,
    // Dijaga tetap di dalam tahun berjalan: grafik pendapatan hanya menghitung
    // 12 bulan tahun ini, jadi proyek di tahun sebelumnya tidak akan terlihat.
    createdAt: daysAgo(268),
    deadline: daysAgo(240),
    notes: "Completed full branding suite including brand manual, color schemes, typography definition, and social media layout packs.",
  },
  {
    clientName: "Velo Athletic Co.",
    projectTitle: "Premium Cycling Jersey Design v2",
    categoryId: "Jersey",
    price: 1800000,
    status: ProjectStatus.Revisi,
    createdAt: daysAgo(247),
    deadline: daysAgo(238),
    notes: "Reviewing layout of the chest stripes and corporate sponsor logos.",
  },
  {
    clientName: "Krypton Labs",
    projectTitle: "SaaS Analytics Dashboard UI",
    categoryId: "UI Design",
    price: 4900000,
    status: ProjectStatus.On_Progress,
    createdAt: daysAgo(124),
    deadline: daysAhead(14),
    notes: "In progress of wireframing the central dashboard interactive widgets.",
  },
  {
    clientName: "Apex Esports",
    projectTitle: "Championship Jersey & Team Hoodie Pack",
    categoryId: "Jersey",
    price: 2400000,
    status: ProjectStatus.On_Progress,
    createdAt: daysAgo(88),
    deadline: daysAhead(7),
    notes: "Designing futuristic jersey with cybernetic neon patterns.",
  },
  {
    clientName: "Elysian Wear",
    projectTitle: "Summer Solstice Apparel Collection",
    categoryId: "Clothing",
    price: 3500000,
    status: ProjectStatus.Done,
    createdAt: daysAgo(203),
    deadline: daysAgo(171),
    notes: "Designed a series of 5 minimalist screen-print graphics for heavyweight organic cotton t-shirts.",
  },
  {
    clientName: "Symphony Hall",
    projectTitle: "Annual Jazz Festival Poster Design",
    categoryId: "Poster",
    price: 1200000,
    status: ProjectStatus.Done,
    createdAt: daysAgo(152),
    deadline: daysAgo(131),
    notes: "Created an abstract vector lithograph design mixing bold Swiss typography.",
  },
  {
    clientName: "Arcane Brew Co.",
    projectTitle: "Artisanal Coffee Packaging Illustration",
    categoryId: "Illustration",
    price: 2100000,
    status: ProjectStatus.On_Progress,
    createdAt: daysAgo(61),
    deadline: daysAgo(5),
    notes: "Hand-drawn pen and ink illustration detailing mythical coffee shrubs.",
  },
  {
    clientName: "Holo Stream",
    projectTitle: "App Launch - Web Animatic & Motion Intro",
    categoryId: "Motion Design",
    price: 4000000,
    status: ProjectStatus.Cancel,
    createdAt: daysAgo(179),
    deadline: daysAgo(158),
    notes: "Project cancelled by client due to funding constraints.",
  },
  {
    clientName: "Lumina Studio",
    projectTitle: "Corporate Logo Redesign Suite",
    categoryId: "Logo",
    price: 1500000,
    status: ProjectStatus.Revisi,
    createdAt: daysAgo(37),
    deadline: daysAgo(11),
    notes: "Second iteration of the corporate emblem with warmer palette.",
  },
]

async function main() {
  console.log("Seeding database...")

  // Urutan penting: projects lebih dulu karena FK-nya ON DELETE RESTRICT.
  await prisma.project.deleteMany()
  await prisma.category.deleteMany()

  for (const cat of categories) {
    await prisma.category.create({ data: cat })
  }

  for (const proj of projects) {
    await prisma.project.create({ data: proj })
  }

  console.log(`Seeded ${categories.length} categories and ${projects.length} projects.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
