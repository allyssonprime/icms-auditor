import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const pillVariants = cva(
  "inline-block rounded-[6px] px-2.5 py-0.5 text-[11px] font-medium leading-tight",
  {
    variants: {
      tone: {
        ok: "bg-[#DEF7EC] text-[#046C4E]",
        warn: "bg-[#FDF6B2] text-[#8A5A00]",
        neutral: "bg-[var(--navy-100)] text-[var(--navy-800)]",
        danger: "bg-[#FDE2E2] text-[#9B1C1C]",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
)

export interface PillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pillVariants> {}

function Pill({ className, tone, ...props }: PillProps) {
  return <span className={cn(pillVariants({ tone }), className)} {...props} />
}

export { Pill, pillVariants }
