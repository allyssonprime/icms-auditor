import * as React from "react"

import { cn } from "@/lib/utils"

const tones = {
  gray: { bg: "#F3F4F6", fg: "#6B7280" },
  clip: { bg: "#E7ECF1", fg: "#124477" },
  gold: { bg: "#FDF6B2", fg: "#8A5A00" },
  blue: { bg: "#E1EFFE", fg: "#1E429F" },
  violet: { bg: "#EDE9FE", fg: "#6D28D9" },
  orange: { bg: "#FFEDD5", fg: "#9A3412" },
  success: { bg: "#DEF7EC", fg: "#046C4E" },
  danger: { bg: "#FDE2E2", fg: "#9B1C1C" },
} as const

export type StatCardTone = keyof typeof tones

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode
  value: React.ReactNode
  label: React.ReactNode
  tone?: StatCardTone
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ icon, value, label, tone = "gray", className, ...props }, ref) => {
    const t = tones[tone] ?? tones.gray
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-3 rounded-lg bg-card shadow-card p-5",
          className
        )}
        {...props}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-md shrink-0"
          style={{ background: t.bg, color: t.fg }}
          aria-hidden
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[24px] font-bold text-foreground leading-none tabular-nums">
            {value}
          </div>
          <div className="text-[13px] text-muted-foreground mt-0.5 truncate">
            {label}
          </div>
        </div>
      </div>
    )
  }
)
StatCard.displayName = "StatCard"

export { StatCard }
