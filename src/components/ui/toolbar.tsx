import * as React from "react"

import { cn } from "@/lib/utils"

export type ToolbarProps = React.HTMLAttributes<HTMLDivElement>

const Toolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="toolbar"
      className={cn(
        "flex items-center gap-2.5 px-5 py-4 border-b border-[var(--border-soft)]",
        className
      )}
      {...props}
    />
  )
)
Toolbar.displayName = "Toolbar"

export { Toolbar }
