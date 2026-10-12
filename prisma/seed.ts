import { PrismaClient, ProjectStatus } from "@prisma/client"

const prisma = new PrismaClient()

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
    deadline: new Date("2026-06-15"),
    notes: "Completed full branding suite including brand manual, color schemes, typography definition, and social media layout packs.",
  },
  {
    clientName: "Velo Athletic Co.",
    projectTitle: "Premium Cycling Jersey Design v2",
    categoryId: "Jersey",
    price: 1800000,
    status: ProjectStatus.Revisi,
    deadline: new Date("2026-06-02"),
    notes: "Reviewing layout of the chest stripes and corporate sponsor logos.",
  },
  {
    clientName: "Krypton Labs",
    projectTitle: "SaaS Analytics Dashboard UI",
    categoryId: "UI Design",
    price: 4900000,
    status: ProjectStatus.On_Progress,
    deadline: new Date("2026-06-20"),
    notes: "In progress of wireframing the central dashboard interactive widgets.",
  },
  {
    clientName: "Apex Esports",
    projectTitle: "Championship Jersey & Team Hoodie Pack",
    categoryId: "Jersey",
    price: 2400000,
    status: ProjectStatus.On_Progress,
    deadline: new Date("2026-06-10"),
    notes: "Designing futuristic jersey with cybernetic neon patterns.",
  },
  {
    clientName: "Elysian Wear",
    projectTitle: "Summer Solstice Apparel Collection",
    categoryId: "Clothing",
    price: 3500000,
    status: ProjectStatus.Done,
    deadline: new Date("2026-05-20"),
    notes: "Designed a series of 5 minimalist screen-print graphics for heavyweight organic cotton t-shirts.",
  },
  {
    clientName: "Symphony Hall",
    projectTitle: "Annual Jazz Festival Poster Design",
    categoryId: "Poster",
    price: 1200000,
    status: ProjectStatus.Done,
    deadline: new Date("2026-05-05"),
    notes: "Created an abstract vector lithograph design mixing bold Swiss typography.",
  },
  {
    clientName: "Arcane Brew Co.",
    projectTitle: "Artisanal Coffee Packaging Illustration",
    categoryId: "Illustration",
    price: 2100000,
    status: ProjectStatus.On_Progress,
    deadline: new Date("2026-06-18"),
    notes: "Hand-drawn pen and ink illustration detailing mythical coffee shrubs.",
  },
  {
    clientName: "Holo Stream",
    projectTitle: "App Launch - Web Animatic & Motion Intro",
    categoryId: "Motion Design",
    price: 4000000,
    status: ProjectStatus.Cancel,
    deadline: new Date("2026-05-30"),
    notes: "Project cancelled by client due to funding constraints.",
  },
  {
    clientName: "Lumina Studio",
    projectTitle: "Corporate Logo Redesign Suite",
    categoryId: "Logo",
    price: 1500000,
    status: ProjectStatus.Revisi,
    deadline: new Date("2026-06-05"),
    notes: "Second iteration of the corporate emblem with warmer palette.",
  },
]

async function main() {
  console.log("Seeding database...")

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
