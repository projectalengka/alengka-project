"use client"

import { useEffect } from "react"
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react"
import type { ToastType } from "@/types"

export type { ToastType }

interface ToastProps {
  message: string
  type?: ToastType
  onClose: () => void
  duration?: number
}

export default function Toast({ message, type = "success", onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [onClose, duration])

  const config = {
    success: { icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, progress: "bg-emerald-500" },
    warning: { icon: <AlertTriangle className="w-4 h-4 text-amber-500" />, progress: "bg-amber-500" },
    info: { icon: <Info className="w-4 h-4 text-blue-500" />, progress: "bg-blue-500" },
  }

  const { icon, progress } = config[type]

  return (
    <div
      role="alert"
      className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3.5 border border-neutral-200/50 dark:border-neutral-850 rounded-lg shadow-xl backdrop-blur-xl animate-fade-in max-w-sm bg-white/90 dark:bg-neutral-950/90"
    >
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 text-xs font-medium font-sans leading-relaxed text-neutral-800 dark:text-neutral-100">{message}</div>
      <button onClick={onClose} className="text-neutral-400 hover:text-neutral-800 dark:hover:text-white transition-colors cursor-pointer">
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-100 dark:bg-neutral-900 rounded-b-lg overflow-hidden">
        <div className={`h-full ${progress}`} style={{ animation: `shrink ${duration}ms linear forwards` }} />
      </div>
    </div>
  )
}
