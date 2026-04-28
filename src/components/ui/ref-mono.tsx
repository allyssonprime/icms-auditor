import * as React from "react"

import { cn } from "@/lib/utils"

export type RefMonoProps = React.HTMLAttributes<HTMLSpanElement>

const RefMono = React.forwardRef<HTMLSpanElement, RefMonoProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "font-mono text-[12px] tabular-nums text-foreground",
        className
      )}
      {...props}
    />
  )
)
RefMono.displayName = "RefMono"

export { RefMono }
