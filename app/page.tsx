"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import dynamic from "next/dynamic"
import type {
  Project, Category, Client, ClientFormData, Tab, ProjectFormData, ProjectStatus, DashboardPayload,
} from "@/types"
import {
  getDashboardData, createProject, updateProject, deleteProject,
  updateProjectStatus, setProjectsInvoiced,
} from "@/actions/projects"
import { updateClient } from "@/actions/clients"
import Sidebar from "@/components/layout/Sidebar"
import HomeOverview from "@/components/dashboard/HomeOverview"
import ConfirmModal from "@/components/projects/ConfirmModal"
import Toast, { type ToastType } from "@/components/ui/Toast"
import ErrorBoundary from "@/components/ErrorBoundary"
import { RefreshCw, Wifi, WifiOff } from "lucide-react"

/* Tab yang tidak terlihat tidak perlu ikut di bundel awal. */
const ProjectsWorkspace = dynamic(() => import("@/components/projects/ProjectsWorkspace"), { loading: () => <TabSkeleton /> })
const AnalyticsSection = dynamic(() => import("@/components/dashboard/AnalyticsSection"), { loading: () => <TabSkeleton /> })
const CategoryManager = dynamic(() => import("@/components/categories/CategoryManager"), { loading: () => <TabSkeleton /> })
const ClientManager = dynamic(() => import("@/components/clients/ClientManager"), { loading: () => <TabSkeleton /> })
const InvoiceWorkspace = dynamic(() => import("@/components/invoice/InvoiceWorkspace"), { loading: () => <TabSkeleton /> })
const ProjectForm = dynamic(() => import("@/components/projects/ProjectForm"), { ssr: false })
const InvoiceModal = dynamic(() => import("@/components/projects/InvoiceModal"), { ssr: false })

function TabSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-10 bg-neutral-100 dark:bg-neutral-900 rounded-xl" />
      <div className="h-40 bg-neutral-100/70 dark:bg-neutral-900/50 rounded-2xl" />
    </div>
  )
}

const EMPTY_STATS = {
  total: 0, masuk: 0, onProgress: 0, revisi: 0, done: 0, cancel: 0,
  siapDitagih: 0, sudahDitagih: 0, incomeDitagih: 0, incomeSiapDitagih: 0,
  incomePipeline: 0, overdue: 0,
}

const POLL_INTERVAL_MS = 30_000

const TAB_TITLE: Record<Tab, { title: string; subtitle: string }> = {
  board: { title: "Beranda", subtitle: "Ringkasan pekerjaan dan hal yang perlu tindakan" },
  projects: { title: "Proyek", subtitle: "Order berjalan dan riwayat proyek" },
  clients: { title: "Klien", subtitle: "Data klien & proyeknya" },
  invoice: { title: "Invoice", subtitle: "Pilih proyek, cek pratinjau, lalu unduh" },
  analytics: { title: "Laporan", subtitle: "Nilai yang sudah ditagih" },
  categories: { title: "Kategori", subtitle: "Jenis layanan desain" },
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [stats, setStats] = useState(EMPTY_STATS)
  const [activeTab, setActiveTab] = useState<Tab>("board")
  const [darkMode, setDarkMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState("")
  const [toast, setToast] = useState<{ message: string; type?: ToastType } | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [invoiceTarget, setInvoiceTarget] = useState<{ clientId: string; projectIds: string[] } | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Dibaca di dalam interval tanpa menjadikannya dependency -> interval tidak
  // ikut dibongkar-pasang setiap kali dialog dibuka/ditutup.
  const uiBusyRef = useRef(false)
  useEffect(() => {
    uiBusyRef.current = formOpen || projectToDelete !== null || invoiceTarget !== null
  }, [formOpen, projectToDelete, invoiceTarget])

  /* ---------------------------------------------------------------- tema --- */
  useEffect(() => {
    const saved = localStorage.getItem("theme")
    if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setDarkMode(true)
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode)
    localStorage.setItem("theme", darkMode ? "dark" : "light")
  }, [darkMode])

  const triggerToast = useCallback((message: string, type: ToastType = "success") => {
    setToast({ message, type })
  }, [])

  /* ------------------------------------------------------- pemuatan data --- */
  /**
   * Sumber kebenaran tunggal.
   *
   * Action yang mengembalikan seluruh payload, dan satu fungsi ini yang
   * memasangnya. Halaman tidak memanggil revalidatePath (tidak berpengaruh pada
   * state komponen klien) dan tidak melakukan polling buta.
   */
  const applyPayload = useCallback((payload: DashboardPayload) => {
    setProjects(payload.projects)
    setCategories(payload.categories)
    setClients(payload.clients)
    setStats(payload.stats)
    setLoadError(null)
    setLastSync(new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }))
  }, [])

  const loadData = useCallback(async (opts?: { showLoader?: boolean; silent?: boolean }) => {
    const { showLoader = false, silent = false } = opts ?? {}
    if (showLoader) setLoading(true)
    /*
     * try/catch WAJIB ada di sini.
     *
     * Action memang dirancang mengembalikan ActionResult, tetapi ia tetap bisa
     * MELEMPAR tanpa sempat mengembalikan apa pun — koneksi database putus,
     * fungsi serverless gagal cold-start, atau jaringan pengguna terputus.
     * Dulu tidak ada penanganan, sehingga `setLoading(false)` tidak pernah
     * dijalankan dan halaman menggantung selamanya di layar "Memuat...".
     */
    try {
      const res = await getDashboardData()
      if (res.ok) {
        applyPayload(res.data)
      } else if (!silent) {
        setLoadError(res.error)
      }
    } catch (e) {
      if (!silent) {
        setLoadError(
          e instanceof Error
            ? `Gagal memuat data: ${e.message}`
            : "Gagal memuat data. Periksa koneksi lalu coba lagi.",
        )
      }
    } finally {
      // Selalu dijalankan, apa pun yang terjadi — ini yang mencegah layar macet.
      if (showLoader) setLoading(false)
    }
  }, [applyPayload])

  useEffect(() => { loadData({ showLoader: true }) }, [loadData])

  // Muat data terakhir saat tab kembali aktif, lalu jadwalkan poll berikutnya
  // dari titik itu (bukan dari selang tetap yang jalan terus).
  useEffect(() => {
    const schedule = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => {
        if (document.hidden || uiBusyRef.current) return
        void loadData({ silent: true })
      }, POLL_INTERVAL_MS)
    }

    const onVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      } else {
        void loadData({ silent: true })
        schedule()
      }
    }

    schedule()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [loadData])

  /* ------------------------------------------------------------- mutasi --- */

  const handleSaveProject = useCallback(async (data: ProjectFormData): Promise<boolean> => {
    const res = projectToEdit
      ? await updateProject(projectToEdit.id, data)
      : await createProject(data)

    if (!res.ok) {
      triggerToast(res.error, "warning")
      return false // biarkan modal tetap terbuka supaya isian tidak hilang
    }
    triggerToast(projectToEdit ? "Proyek diperbarui." : "Proyek baru tersimpan.")
    setProjectToEdit(null)
    void loadData({ silent: true })
    return true
  }, [projectToEdit, triggerToast, loadData])

  const handleEditClick = useCallback((project: Project) => {
    setProjectToEdit(project)
    setFormOpen(true)
  }, [])

  const handleQuickStatusChange = useCallback(async (id: string, status: ProjectStatus): Promise<boolean> => {
    try {
      const res = await updateProjectStatus(id, status)
      if (!res.ok) {
        triggerToast(res.error, "warning")
        return false
      }
      triggerToast(`Status proyek diperbarui menjadi ${status === "On Progress" ? "Dikerjakan" : status === "Done" ? "Selesai" : status === "Cancel" ? "Dibatalkan" : status}.`)
      void loadData({ silent: true })
      return true
    } catch {
      triggerToast("Status gagal diperbarui. Coba lagi.", "warning")
      return false
    }
  }, [triggerToast, loadData])

  const handleDeleteClick = useCallback((project: Project) => {
    setProjectToDelete(project)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    const target = projectToDelete
    if (!target) return
    setDeletingId(target.id)
    const res = await deleteProject(target.id)
    setDeletingId(null)
    if (!res.ok) {
      triggerToast(res.error, "warning")
      return // modal tetap terbuka agar user bisa mencoba lagi / membatalkan
    }
    triggerToast(`"${target.projectTitle}" dihapus.`, "warning")
    setProjectToDelete(null)
    void loadData({ silent: true })
  }, [projectToDelete, triggerToast, loadData])

  const handleSetInvoiced = useCallback(async (ids: string[], invoiced: boolean) => {
    if (ids.length === 0) return
    const res = await setProjectsInvoiced(ids, invoiced)
    if (!res.ok) { triggerToast(res.error, "warning"); return }
    triggerToast(
      invoiced
        ? `${res.data.count} proyek ditandai sudah ditagih.`
        : `${res.data.count} proyek dikembalikan ke Siap Ditagih.`,
      invoiced ? "success" : "warning",
    )
    void loadData({ silent: true })
  }, [triggerToast, loadData])

  const openInvoiceFor = useCallback((clientId: string, projectIds: string[]) => {
    setInvoiceTarget({ clientId, projectIds })
  }, [])

  const handleSaveInvoiceClient = useCallback(async (data: ClientFormData): Promise<boolean> => {
    if (!invoiceTarget) return false
    const res = await updateClient(invoiceTarget.clientId, data)
    if (!res.ok) {
      triggerToast(res.error, "warning")
      return false
    }
    triggerToast("Data klien diperbarui.")
    void loadData({ silent: true })
    return true
  }, [invoiceTarget, triggerToast, loadData])

  /* ------------------------------------------------------------- turunan --- */

  /** Klien yang masih punya proyek siap ditagih — untuk lencana di navigasi. */
  const invoiceBadge = useMemo(() => {
    const set = new Set<string>()
    for (const p of projects) {
      if (p.status === "Done" && !p.invoicedAt) set.add(p.clientId)
    }
    return set.size
  }, [projects])

  const invoiceClient = useMemo(
    () => (invoiceTarget ? clients.find((c) => c.id === invoiceTarget.clientId) ?? null : null),
    [invoiceTarget, clients],
  )

  const invoiceProjects = useMemo(() => {
    if (!invoiceTarget) return []
    const wanted = new Set(invoiceTarget.projectIds)
    return projects.filter((p) => wanted.has(p.id))
  }, [invoiceTarget, projects])

  /* ------------------------------------------------------------- render --- */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f8] dark:bg-[#08080a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          {/* Padding asimetris: koreksi optis yang sama seperti mark di sidebar. */}
          <div
            className="w-9 h-9 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center font-bold text-[13px]"
            style={{ paddingTop: "1.5px", paddingRight: "0.7px" }}
          >
            DS
          </div>
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium">Memuat data...</span>
        </div>
      </div>
    )
  }

  const heading = TAB_TITLE[activeTab]

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#f7f7f8] dark:bg-[#08080a] text-neutral-900 dark:text-neutral-100 flex">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          invoiceBadge={invoiceBadge}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode((v) => !v)}
        />

        <main className="flex-1 min-w-0 pb-24 md:pb-0">
          {/* Header halaman */}
          <header className="sticky top-0 z-30 bg-[#f7f7f8]/95 dark:bg-[#08080a]/95 border-b border-neutral-200 dark:border-neutral-900">
            <div className="px-4 md:px-6 py-3.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-[17px] md:text-xl font-semibold tracking-tight truncate">
                  {heading.title}
                </h1>
                <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 truncate">
                  {heading.subtitle}
                </p>
              </div>

              <div
                className="hidden sm:flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400"
                title={lastSync ? `Terakhir sinkron: ${lastSync}` : undefined}
              >
                {loadError
                  ? <WifiOff className="w-3.5 h-3.5 text-red-500" />
                  : <Wifi className="w-3.5 h-3.5 text-emerald-500" />}
                <span className="font-medium">{loadError ? "Offline" : "Tersinkron"}</span>
              </div>

              <button
                onClick={() => loadData({ silent: true })}
                aria-label="Segarkan data"
                className="p-2.5 rounded-xl text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {loadError && (
              <div className="px-4 md:px-6 pb-3">
                <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-3">
                  <span className="text-red-700 dark:text-red-400 text-[12px] font-medium flex-1">{loadError}</span>
                  <button
                    onClick={() => loadData({ showLoader: true })}
                    className="text-[12px] font-semibold text-red-700 dark:text-red-400 hover:underline cursor-pointer shrink-0"
                  >
                    Coba lagi
                  </button>
                </div>
              </div>
            )}
          </header>

          <div className="p-4 md:p-6 space-y-4">
            {activeTab === "board" && (
              <HomeOverview
                projects={projects}
                stats={stats}
                clientCount={clients.length}
                onOpenProjects={() => setActiveTab("projects")}
                onOpenInvoice={() => setActiveTab("invoice")}
                onNewProject={() => { setProjectToEdit(null); setFormOpen(true) }}
              />
            )}

            {activeTab === "projects" && (
              <ProjectsWorkspace
                projects={projects}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
                onStatusChange={handleQuickStatusChange}
              />
            )}

            {activeTab === "clients" && (
              <ClientManager
                clients={clients}
                projects={projects}
                onChanged={() => loadData({ silent: true })}
                onToast={triggerToast}
                onInvoiceClient={(clientId) => {
                  const ids = projects
                    .filter((p) => p.clientId === clientId && p.status === "Done" && !p.invoicedAt)
                    .map((p) => p.id)
                  if (ids.length === 0) {
                    triggerToast("Klien ini belum punya proyek selesai yang siap ditagih.", "warning")
                    return
                  }
                  openInvoiceFor(clientId, ids)
                }}
              />
            )}

            {activeTab === "invoice" && (
              <InvoiceWorkspace
                clients={clients}
                projects={projects}
                onOpenInvoice={openInvoiceFor}
              />
            )}

            {activeTab === "analytics" && <AnalyticsSection projects={projects} />}

            {activeTab === "categories" && (
              <CategoryManager
                categories={categories}
                onChanged={() => loadData({ silent: true })}
                onToast={triggerToast}
              />
            )}
          </div>
        </main>

        {/* ------------------------------- Dialog ------------------------------- */}
        <ProjectForm
          isOpen={formOpen}
          onClose={() => { setFormOpen(false); setProjectToEdit(null) }}
          onSave={handleSaveProject}
          projectToEdit={projectToEdit}
          clients={clients}
          categories={categories}
        />

        <ConfirmModal
          isOpen={projectToDelete !== null}
          title="Hapus Proyek"
          projectName={projectToDelete?.projectTitle || ""}
          busy={deletingId !== null}
          onConfirm={handleConfirmDelete}
          onCancel={() => setProjectToDelete(null)}
        />

        {invoiceTarget && (
          <InvoiceModal
            isOpen
            onClose={() => setInvoiceTarget(null)}
            client={invoiceClient}
            projects={invoiceProjects}
            onSaveClient={handleSaveInvoiceClient}
            onGenerated={(ids) => {
              setInvoiceTarget(null)
              const unbilledIds = projects.filter((project) => ids.includes(project.id) && !project.invoicedAt).map((project) => project.id)
              if (unbilledIds.length > 0) void handleSetInvoiced(unbilledIds, true)
            }}
          />
        )}

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </ErrorBoundary>
  )
}
