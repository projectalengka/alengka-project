"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import dynamic from "next/dynamic"
import type { Project, Category, Tab, ProjectFormData, ProjectStatus, DashboardPayload } from "@/types"
import {
  getDashboardData, createProject, updateProject, deleteProject, updateProjectStatus,
} from "@/actions/projects"
import Sidebar from "@/components/layout/Sidebar"
import StatsGrid from "@/components/dashboard/StatsGrid"
import ProjectList from "@/components/projects/ProjectList"
import ConfirmModal from "@/components/projects/ConfirmModal"
import Toast, { type ToastType } from "@/components/ui/Toast"
import ErrorBoundary from "@/components/ErrorBoundary"
import { PlusCircle, RefreshCw, Sun, Moon, Columns } from "lucide-react"

/* Tab yang tidak terlihat tidak perlu ikut di bundel awal. */
const AnalyticsSection = dynamic(() => import("@/components/dashboard/AnalyticsSection"), {
  loading: () => <TabSkeleton />,
})
const CategoryManager = dynamic(() => import("@/components/categories/CategoryManager"), {
  loading: () => <TabSkeleton />,
})
const ProjectForm = dynamic(() => import("@/components/projects/ProjectForm"), {
  ssr: false,
})

/* Kerangka statis. Dulu memakai denyut tak berujung (pulse) yang melukis ulang
   tiga blok ini terus-menerus. Kerangka statis memberi sinyal "sedang memuat"
   yang sama tanpa biaya render. */
function TabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-40 bg-neutral-100 dark:bg-neutral-900 rounded" />
      <div className="h-48 bg-neutral-100/70 dark:bg-neutral-900/50 rounded-xl" />
      <div className="h-32 bg-neutral-100/50 dark:bg-neutral-900/30 rounded-xl" />
    </div>
  )
}

const EMPTY_STATS = {
  total: 0, onProgress: 0, revisi: 0, done: 0, cancel: 0,
  totalIncome: 0, pipelineIncome: 0, overdue: 0,
}

const POLL_INTERVAL_MS = 30_000

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [stats, setStats] = useState(EMPTY_STATS)
  const [activeTab, setActiveTab] = useState<Tab>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  /* Modal invoice hidup di dalam ProjectList, jadi halaman tidak tahu kapan ia
     terbuka. Tanpa penanda ini, poll 30 detik tetap berjalan selagi pengguna
     mengisi invoice — dan karena daftar proyek ikut disegarkan, modal invoice
     menganggap "pilihan berubah" lalu mengosongkan tanggal/nama klien yang
     baru saja diketik. */
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [toast, setToast] = useState<{ message: string; type?: ToastType } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Dibaca di dalam interval tanpa menjadikannya dependency -> interval tidak
  // ikut dibongkar-pasang setiap kali modal dibuka/ditutup.
  const uiBusyRef = useRef(false)
  useEffect(() => {
    uiBusyRef.current = isModalOpen || isConfirmOpen || invoiceOpen
  }, [isModalOpen, isConfirmOpen, invoiceOpen])

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
   * Sebelumnya: revalidatePath("/") dipanggil di setiap action, tetapi halaman
   * ini "use client" dan datanya ada di useState — invalidation Router Cache
   * tidak bisa menyentuh useState, jadi hasilnya tidak pernah terpakai dan
   * App mengandalkan poll 15 detik untuk me-refresh. Sekarang action yang
   * mengembalikan data, dan satu fungsi ini yang memasangnya.
   */
  const applyPayload = useCallback((payload: DashboardPayload) => {
    setProjects(payload.projects)
    setCategories(payload.categories)
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
     * dijalankan dan halaman menggantung selamanya di layar "Memuat...",
     * tanpa pesan apa pun. Terbukti terjadi saat deploy pertama.
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
        // data pasti basi setelah tab disembunyikan -> segarkan diam-diam
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
    triggerToast(projectToEdit ? "Proyek berhasil diperbarui!" : "Proyek berhasil ditambahkan!")
    setProjectToEdit(null)
    void loadData({ silent: true })
    return true
  }, [projectToEdit, triggerToast, loadData])

  const handleStatusChange = useCallback(async (id: string, status: ProjectStatus) => {
    /* Optimistis: ubah di layar dulu, kembalikan bila gagal.
       Rollback sengaja hanya menyentuh SATU proyek (bukan menimpa seluruh
       array dengan snapshot lama) — kalau tidak, perubahan status lain yang
       berhasil di sela-sela akan ikut terhapus. */
    let previousStatus: ProjectStatus | undefined
    setProjects((prev) => prev.map((p) => {
      if (p.id !== id) return p
      previousStatus = p.status
      return { ...p, status }
    }))
    const res = await updateProjectStatus(id, status)
    if (!res.ok) {
      if (previousStatus !== undefined) {
        setProjects((prev) => prev.map((p) =>
          p.id === id ? { ...p, status: previousStatus as ProjectStatus } : p,
        ))
      }
      triggerToast(res.error, "warning")
      return
    }
    triggerToast(`Status diganti jadi ${status}.`)
    void loadData({ silent: true })
  }, [triggerToast, loadData])

  const handleEditClick = useCallback((project: Project) => {
    setProjectToEdit(project)
    setIsModalOpen(true)
  }, [])

  const handleDeleteClick = useCallback((project: Project) => {
    setProjectToDelete(project)
    setIsConfirmOpen(true)
  }, [])

  const closeConfirm = useCallback(() => {
    setIsConfirmOpen(false)
    setProjectToDelete(null)
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
    triggerToast(`"${target.projectTitle}" berhasil dihapus.`, "warning")
    closeConfirm()
    void loadData({ silent: true })
  }, [projectToDelete, triggerToast, closeConfirm, loadData])

  /* ------------------------------------------------------------- render --- */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#09090b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 flex items-center justify-center font-sans italic text-xs font-medium uppercase">ds</div>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono tracking-widest uppercase">Memuat...</span>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#09090b] text-[#1d1d1f] dark:text-[#f5f5f7] flex flex-col md:flex-row font-sans transition-colors duration-200">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      <main className={`flex-1 p-4 sm:p-6 lg:p-8 w-full space-y-6 overflow-y-auto mb-16 md:mb-0 transition-[max-width] duration-200 ease-out mx-auto ${sidebarOpen ? "max-w-6xl" : "max-w-7xl"}`}>
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-neutral-200/30 dark:border-neutral-900 pb-6">
          <div>
            <div className="flex items-center gap-2" title={lastSync ? `Terakhir sinkron: ${lastSync}` : undefined}>
              <span className={`w-1.5 h-1.5 rounded-full ${loadError ? "bg-red-500" : "bg-emerald-500"}`} />
              <span className="text-[8.5px] text-neutral-400 dark:text-neutral-500 font-mono uppercase tracking-[0.2em] font-medium">
                {loadError ? "Offline" : "Live"}
              </span>
              {lastSync && <span className="text-[8px] text-neutral-400/60 dark:text-neutral-600 font-mono">{lastSync}</span>}
            </div>
            <h1 className="text-2xl sm:text-3xl font-light text-neutral-950 dark:text-neutral-50 tracking-tight mt-1.5 flex items-center gap-2">
              {!sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)} className="hidden md:inline-flex p-1.5 mr-1 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-400 hover:text-neutral-950 dark:hover:text-white rounded-lg transition-colors cursor-pointer">
                  <Columns className="w-4 h-4" />
                </button>
              )}
              {activeTab === "dashboard" && <>Beranda <span className="font-serif italic font-normal text-neutral-400 dark:text-neutral-500">Desk</span></>}
              {activeTab === "projects" && <>Proyek <span className="font-serif italic font-normal text-neutral-400 dark:text-neutral-500">Desain</span></>}
              {activeTab === "analytics" && <>Laporan <span className="font-serif italic font-normal text-neutral-400 dark:text-neutral-500">Keuangan</span></>}
              {activeTab === "categories" && <>Kategori <span className="font-serif italic font-normal text-neutral-400 dark:text-neutral-500">Layanan</span></>}
            </h1>
            {stats.overdue > 0 && (activeTab === "dashboard" || activeTab === "projects") && (
              <p className="text-[10.5px] text-amber-600 dark:text-amber-400 mt-1.5">
                {stats.overdue} proyek aktif sudah melewati deadline.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button onClick={() => setDarkMode((v) => !v)} aria-label="Ganti tema" className="p-2 text-neutral-400 hover:text-neutral-950 dark:hover:text-white rounded-lg transition-colors cursor-pointer bg-neutral-100/10 hover:bg-neutral-100/30 dark:bg-neutral-900/10 dark:hover:bg-neutral-900/30">
              {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-neutral-500" />}
            </button>
            <button onClick={() => loadData({ silent: true })} className="px-3 py-1.5 text-neutral-400 hover:text-neutral-950 dark:hover:text-white rounded-lg transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-neutral-100/30 dark:hover:bg-neutral-900/30">
              <RefreshCw className="w-3 h-3" />Refresh
            </button>
            <button onClick={() => { setProjectToEdit(null); setIsModalOpen(true) }} className="px-4 py-1.5 bg-neutral-950 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-white text-white dark:text-neutral-950 font-medium rounded-full text-xs flex items-center gap-2 transition cursor-pointer shadow-xs active:scale-[0.98]">
              <PlusCircle className="w-3.5 h-3.5" />Baru
            </button>
          </div>
        </header>

        {loadError && (
          <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg p-3.5">
            <span className="text-red-500 text-xs font-medium flex-1">{loadError}</span>
            <button onClick={() => loadData({ showLoader: true })} className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline cursor-pointer shrink-0">
              Coba lagi
            </button>
          </div>
        )}

        <div className="space-y-6 min-h-[50vh]">
          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-fade-in">
              <StatsGrid stats={stats} />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-12">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em]">Proyek Terbaru</h3>
                      <p className="text-xs text-neutral-450 dark:text-neutral-400 mt-0.5">5 proyek terbaru</p>
                    </div>
                    <button onClick={() => setActiveTab("projects")} className="text-xs text-neutral-500 hover:text-neutral-950 dark:hover:text-white font-medium flex items-center gap-1 cursor-pointer">
                      Lihat Semua &rarr;
                    </button>
                  </div>
                  <ProjectList projects={projects} categories={categories} onEdit={handleEditClick} onDelete={handleDeleteClick} onStatusChange={handleStatusChange} onInvoiceOpenChange={setInvoiceOpen} isDashboard />
                </div>
              </div>
            </div>
          )}

          {activeTab === "projects" && (
            <div className="animate-fade-in">
              <div className="mb-5">
                <h3 className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em]">Semua Proyek</h3>
                <p className="text-xs text-neutral-450 dark:text-neutral-400 mt-0.5">Semua proyek yang pernah dikerjain.</p>
              </div>
              <ProjectList projects={projects} categories={categories} onEdit={handleEditClick} onDelete={handleDeleteClick} onStatusChange={handleStatusChange} onInvoiceOpenChange={setInvoiceOpen} />
            </div>
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

      <ProjectForm
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setProjectToEdit(null) }}
        onSave={handleSaveProject}
        projectToEdit={projectToEdit}
        categories={categories}
      />

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Hapus Proyek"
        projectName={projectToDelete?.projectTitle || ""}
        busy={deletingId !== null}
        onConfirm={handleConfirmDelete}
        onCancel={closeConfirm}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
    </ErrorBoundary>
  )
}
