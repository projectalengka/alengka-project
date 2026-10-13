"use client"

import { useState, useMemo } from "react"
import type { Project } from "@/types"
import { BarChart3, TrendingUp, Info, CalendarRange } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { buildMonthlySeries, buildCategorySlices, computeStats } from "@/lib/analytics"

interface AnalyticsSectionProps {
  projects: Project[]
}

export default function AnalyticsSection({ projects }: AnalyticsSectionProps) {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null)

  const statusDistribution = useMemo(() => computeStats(projects), [projects])
  const categoryDistribution = useMemo(() => buildCategorySlices(projects), [projects])
  const monthlyData = useMemo(() => buildMonthlySeries(projects), [projects])

  const hasAnyData = projects.length > 0
  const maxIncome = Math.max(...monthlyData.map((d) => d.income), 1)
  const totalCount = projects.length
  const doneCount = statusDistribution.done
  const completionRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
  const peakMonth = monthlyData.reduce((a, b) => (b.income > a.income ? b : a), monthlyData[0])
  const yearLabel = new Date().getFullYear()

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between border-b border-neutral-200/50 dark:border-neutral-900 pb-5">
        <div>
          <h2 className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 tracking-[0.2em] uppercase">Analisis Proyek</h2>
          <p className="text-xs text-neutral-450 dark:text-neutral-400 mt-0.5">Grafik dan statistik nilai proyek dari waktu ke waktu.</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/60 dark:bg-[#121214] border border-neutral-150 dark:border-neutral-850 rounded text-[9px] text-neutral-500 dark:text-neutral-400 font-mono tracking-wider">
          <CalendarRange className="w-3.5 h-3.5 opacity-70" />
          <span>{yearLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-4 bg-white dark:bg-[#0d0d0f]/50 border border-neutral-200 dark:border-neutral-900/60 p-6 sm:p-8 rounded-xl flex flex-col items-center text-center shadow-xs">
          <div className="w-full flex items-center justify-between">
            <span className="text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.15em]">Progres</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>

          <div className="my-10 relative flex items-center justify-center w-48 h-48">
            <div className="absolute inset-0 rounded-full border border-neutral-50 dark:border-neutral-900 p-3">
              <div className="w-full h-full rounded-full border border-dashed border-neutral-150 dark:border-neutral-850/60" />
            </div>
            <svg className="w-full h-full transform -rotate-90 scale-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" strokeWidth="1.5" className="stroke-neutral-100 dark:stroke-neutral-850" fill="transparent" />
              {/* warna diambil dari token tema, bukan boolean darkMode yang di-drill dari induk */}
              <circle
                cx="50" cy="50" r="42" strokeWidth="3"
                className="stroke-neutral-950 dark:stroke-neutral-50"
                strokeDasharray={`${completionRate * 2.64} 264`}
                strokeLinecap="round" fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center w-32 h-32 rounded-full">
              <span className="text-4xl font-light text-neutral-950 dark:text-neutral-50 tracking-tighter flex items-start">
                {completionRate}<span className="text-xs text-neutral-400 font-medium mt-1 pl-0.5">%</span>
              </span>
              <span className="text-[9px] uppercase tracking-[0.15em] font-medium text-neutral-400 dark:text-neutral-500 mt-1">Selesai</span>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">{doneCount} dari {totalCount}</span>
            </div>
          </div>

          <div className="w-full grid grid-cols-4 gap-2 border-t border-neutral-100 dark:border-neutral-900 pt-5">
            {([
              ["Masuk", statusDistribution.masuk],
              ["Dikerjakan", statusDistribution.onProgress],
              ["Revisi", statusDistribution.revisi],
              ["Selesai", statusDistribution.done],
            ] as const).map(([label, value], i) => (
              <div key={label} className={`text-center ${i > 0 ? "border-l border-neutral-100 dark:border-neutral-900" : ""}`}>
                <span className="text-[8px] uppercase tracking-[0.1em] text-neutral-400 dark:text-neutral-500 block">{label}</span>
                <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-550 mt-0.5 block font-mono">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8 bg-white dark:bg-[#0d0d0f]/50 border border-neutral-200 dark:border-neutral-900/60 p-6 sm:p-8 rounded-xl shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-neutral-50 dark:bg-neutral-900 rounded border border-neutral-150 dark:border-neutral-850">
                <TrendingUp className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
              </div>
              <div>
                <span className="text-xs font-semibold text-neutral-850 dark:text-neutral-150 block">Nilai Ditagih Bulanan</span>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block">Nilai proyek yang sudah ditagih per bulan, {yearLabel}</span>
              </div>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <span className="text-[9px] uppercase tracking-[0.15em] font-medium text-neutral-400 dark:text-neutral-500 block">Tertinggi</span>
              <span className="text-sm font-light text-neutral-950 dark:text-neutral-50 tracking-tight block">
                {hasAnyData ? formatCurrency(peakMonth.income) : "—"}
              </span>
              {hasAnyData && peakMonth.income > 0 && (
                <span className="text-[9px] text-neutral-400 dark:text-neutral-500 block">{peakMonth.name}</span>
              )}
            </div>
          </div>

          <div className="mt-8 flex gap-4 h-48 w-full items-stretch">
            <div className="flex flex-col justify-between text-[8px] text-neutral-400 dark:text-neutral-500 font-mono w-14 pr-2 text-right">
              {[1, 0.75, 0.5, 0.25, 0].map((ratio, idx) => (
                <span key={idx} className="block translate-y-[4px]">{formatCurrency(ratio * maxIncome)}</span>
              ))}
            </div>
            <div className="flex-1 relative h-full">
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => (
                <div key={idx} className="absolute left-0 right-0 border-t border-neutral-100 dark:border-neutral-900/40 pointer-events-none" style={{ bottom: `${ratio * 100}%` }} />
              ))}

              {!hasAnyData ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] text-neutral-400 dark:text-neutral-500">Belum ada nilai yang ditagih untuk digambarkan.</span>
                </div>
              ) : (
                <svg className="w-full h-full overflow-visible z-10" viewBox="0 0 1100 150" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="incomeShadow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.10" />
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* garis dasar memakai currentColor + text-* sehingga otomatis ikut tema */}
                  <g className="text-neutral-950 dark:text-neutral-50">
                    <line x1="0" y1="150" x2="1100" y2="150" className="stroke-neutral-200 dark:stroke-neutral-900" strokeWidth="1" />
                    {(() => {
                      /*
                       * Titik diletakkan di TENGAH setiap pita bulan, bukan di tepi.
                       *
                       * Versi lama memakai idx * (1100 / (n-1)), sehingga Januari
                       * menempel di tepi kiri dan Desember di tepi kanan, sedangkan
                       * label bulan di bawahnya memakai `justify-between` yang
                       * membagi jarak ANTAR KOTAK. Dua acuan yang berbeda membuat
                       * label makin melenceng dari titiknya — terukur 13,8px di
                       * ujung kiri dan 13,7px di ujung kanan, sekitar 26% dari
                       * jarak antar titik. Dengan konvensi pita, titik dan label
                       * memakai acuan yang sama dan sejajar persis.
                       */
                      const band = 1100 / (monthlyData.length || 1)
                      const points = monthlyData.map((d, idx) => ({
                        x: (idx + 0.5) * band,
                        y: 150 - (d.income / maxIncome) * 135,
                      }))
                      let dPath = `M ${points[0].x},${points[0].y}`
                      for (let i = 0; i < points.length - 1; i++) {
                        const cx = (points[i + 1].x - points[i].x) / 2.6
                        dPath += ` C ${points[i].x + cx},${points[i].y} ${points[i + 1].x - cx},${points[i + 1].y} ${points[i + 1].x},${points[i + 1].y}`
                      }
                      return (
                        <>
                          <path d={`${dPath} L 1100,150 L 0,150 Z`} fill="url(#incomeShadow)" />
                          <path d={dPath} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                          {points.map((pt, idx) => (
                            <g key={idx}>
                              {hoveredMonth === idx && (
                                <line x1={pt.x} y1="150" x2={pt.x} y2={pt.y} stroke="currentColor" strokeWidth="1" strokeDasharray="3,3" className="opacity-40" vectorEffect="non-scaling-stroke" />
                              )}
                              <circle
                                cx={pt.x} cy={pt.y} r="3"
                                fill="currentColor"
                                className="cursor-pointer transition-transform duration-150"
                                onMouseEnter={() => setHoveredMonth(idx)}
                                onMouseLeave={() => setHoveredMonth(null)}
                                style={{ transform: hoveredMonth === idx ? "scale(1.6)" : "scale(1)", transformOrigin: `${pt.x}px ${pt.y}px` }}
                              />
                              {/* target hover yang lebih besar supaya bulan bernilai kecil tetap mudah disorot */}
                              <circle
                                cx={pt.x} cy={pt.y} r="12" fill="transparent"
                                className="cursor-pointer"
                                onMouseEnter={() => setHoveredMonth(idx)}
                                onMouseLeave={() => setHoveredMonth(null)}
                              />
                            </g>
                          ))}
                        </>
                      )
                    })()}
                  </g>
                </svg>
              )}

              {hoveredMonth !== null && (
                <div
                  className="absolute z-40 bg-white/95 dark:bg-[#121214]/95 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 shadow-xl pointer-events-none animate-fade-in"
                  style={{ left: `${((hoveredMonth + 0.5) / monthlyData.length) * 100}%`, transform: "translateX(-50%)", bottom: "35%" }}
                >
                  <div className="text-[9px] text-neutral-400 dark:text-neutral-500 tracking-wider uppercase font-medium">{monthlyData[hoveredMonth].name} {yearLabel}</div>
                  <div className="text-xs font-semibold text-neutral-950 dark:text-neutral-50 mt-1">{formatCurrency(monthlyData[hoveredMonth].income)}</div>
                  <div className="text-[10px] text-neutral-550 dark:text-neutral-455 mt-0.5">{monthlyData[hoveredMonth].count} Proyek</div>
                </div>
              )}
            </div>
          </div>
          {/* px-1 sengaja TIDAK dipakai: baris grafik di atas memakai
              `flex gap-4` tanpa padding samping. Menambahkan px-1 di sini
              membuat area label ~8px lebih sempit daripada area grafik,
              sehingga label bergeser +3,7px di ujung kiri dan -3,7px di ujung
              kanan. Kedua baris harus bergeometri identik agar label tepat
              duduk di bawah titiknya. */}
          <div className="flex gap-4 mt-4">
            <div className="w-14 shrink-0" />
            {/* Grid sama-banyak dengan titik data, tiap label dipusatkan di
                kolomnya — acuan yang sama dengan `band` di atas, sehingga tiap
                label duduk tepat di bawah titiknya (sebelumnya justify-between
                membagi jarak antar kotak, bukan memusatkan pada titik). */}
            <div
              className="flex-1 grid border-t border-neutral-100 dark:border-neutral-900 pt-3"
              style={{ gridTemplateColumns: `repeat(${monthlyData.length}, minmax(0, 1fr))` }}
            >
              {monthlyData.map((d, idx) => (
                <span key={d.key} className={`text-center text-[9.5px] tracking-wide uppercase ${hoveredMonth === idx ? "text-neutral-950 dark:text-neutral-50 font-semibold" : "text-neutral-400"}`}>{d.shortName}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0d0d0f]/50 border border-neutral-200 dark:border-neutral-900/60 p-6 sm:p-8 rounded-xl shadow-xs">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-1.5 bg-neutral-55 dark:bg-neutral-900 rounded border border-neutral-200/50 dark:border-neutral-800">
            <BarChart3 className="w-4 h-4 text-neutral-400" />
          </div>
          <div>
            <span className="text-xs font-semibold text-neutral-850 dark:text-neutral-200 block">Kategori</span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 block">Sebaran proyek berdasarkan kategori</span>
          </div>
        </div>
        {categoryDistribution.length === 0 ? (
          <div className="flex items-center gap-2 py-8 justify-center">
            <Info className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500">Belum ada proyek untuk dihitung.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
            {categoryDistribution.map((slice) => (
              <div key={slice.id} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-800 dark:text-neutral-300 font-medium">{slice.name}</span>
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="text-neutral-450 dark:text-neutral-500 text-[10px]">{slice.count} proyek</span>
                    <span className="text-neutral-850 dark:text-neutral-300 font-mono text-[10px]">({Math.round(slice.ratio)}%)</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-900 rounded-full overflow-hidden">
                  <div className="h-full bg-neutral-950 dark:bg-[#f5f5f7] rounded-full transition-[width] duration-300 ease-out" style={{ width: `${Math.min(slice.ratio, 100)}%` }} />
                </div>
                <span className="text-[9.5px] text-neutral-400 dark:text-neutral-500 font-mono block">{formatCurrency(slice.totalValue)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
