import * as React from "react"

import { cn } from "@/lib/utils"

export interface PageHeaderProps {
  title: React.ReactNode
  breadcrumb?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, breadcrumb, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-end justify-between gap-4 pb-3 border-b border-[var(--border-soft)]",
        className
      )}
    >
      <div className="min-w-0">
        {breadcrumb && (
          <div className="text-[13px] text-muted-foreground inline-flex items-center gap-1.5 mb-1">
            {breadcrumb}
          </div>
        )}
        <h1 className="text-[24px] font-bold text-[color:var(--prime-navy)] tracking-tight leading-tight m-0 truncate">
          {title}
        </h1>
      </div>
      {actions && <div className="flex gap-2.5 shrink-0">{actions}</div>}
    </div>
  )
}
