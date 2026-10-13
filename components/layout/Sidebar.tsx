"use client"

import { LayoutDashboard, FolderDot, BarChart3, Tag, Columns } from "lucide-react"
import type { Tab } from "@/types"

interface SidebarProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

const navItems = [
  { id: "dashboard" as Tab, label: "Beranda", icon: <LayoutDashboard className="w-4 h-4 stroke-[1.5]" /> },
  { id: "projects" as Tab, label: "Proyek", icon: <FolderDot className="w-4 h-4 stroke-[1.5]" /> },
  { id: "analytics" as Tab, label: "Laporan", icon: <BarChart3 className="w-4 h-4 stroke-[1.5]" /> },
  { id: "categories" as Tab, label: "Kategori", icon: <Tag className="w-4 h-4 stroke-[1.5]" /> },
]

export default function Sidebar({ activeTab, onTabChange, sidebarOpen, onToggleSidebar }: SidebarProps) {
  return (
    <>
      <aside className={`hidden md:flex flex-col bg-white dark:bg-[#09090b] border-r border-[#e5e5eb] dark:border-neutral-900 h-screen sticky top-0 text-neutral-800 dark:text-neutral-200 transition-[width] duration-200 ease-out select-none flex-shrink-0 z-40 overflow-hidden ${sidebarOpen ? "w-64" : "w-0 !border-r-0"}`}>
        <div className="w-64 flex flex-col h-full shrink-0">
          <div className="p-8 border-b border-neutral-100 dark:border-neutral-900 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 flex items-center justify-center font-serif italic text-xs font-medium uppercase">ds</div>
              <div>
                <h1 className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-950 dark:text-white">DESIGN STUDIO</h1>
                <p className="text-[8px] text-neutral-400 dark:text-neutral-500 tracking-[0.1em] uppercase mt-0.5">CURATED ARCHIVE</p>
              </div>
            </div>
            <button onClick={onToggleSidebar} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-400 hover:text-neutral-950 dark:hover:text-white rounded-lg transition-colors cursor-pointer" title="Sembunyikan Sidebar">
              <Columns className="w-3.5 h-3.5" />
            </button>
          </div>

          <nav className="flex-1 px-4 py-8 space-y-1">
            <span className="px-3 text-[8.5px] uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500 font-medium block mb-4">Menu</span>
            {navItems.map((item) => {
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-colors text-xs ${
                    isActive
                      ? "bg-neutral-100/60 dark:bg-neutral-900/60 text-neutral-950 dark:text-neutral-50 border border-neutral-200/30 dark:border-neutral-800/40 font-medium"
                      : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50/10 dark:hover:bg-neutral-900/10 hover:text-neutral-800 dark:hover:text-neutral-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={isActive ? "text-neutral-950 dark:text-neutral-50" : "text-neutral-400"}>{item.icon}</div>
                    <span className="font-medium">{item.label}</span>
                  </div>
                </button>
              )
            })}
          </nav>
          <div className="p-4 border-t border-neutral-200/50 dark:border-neutral-900 bg-neutral-50/50 dark:bg-[#0d0d0f]/50">
            <div className="flex items-center gap-2 px-1">
              <div className="w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 flex items-center justify-center text-neutral-500 flex-shrink-0">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
              <div className="overflow-hidden">
                <span className="text-[9px] font-mono text-neutral-400 dark:text-neutral-500 block uppercase tracking-wider truncate">Pemilik</span>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-450 block truncate">Designer</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-black/80 border-t border-neutral-200/50 dark:border-neutral-900 text-neutral-500 py-3 px-6 flex items-center justify-around z-50 shadow-sm">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          return (
            <button key={item.id} onClick={() => onTabChange(item.id)} aria-current={isActive ? "page" : undefined} className={`flex flex-col items-center gap-1 transition-colors ${isActive ? "text-neutral-950 dark:text-white font-medium" : "text-neutral-400"}`}>
              <div className="p-1 rounded-lg">{item.icon}</div>
              <span className="text-[8px] uppercase tracking-wider">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
