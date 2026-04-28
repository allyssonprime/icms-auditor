import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/icon-button"

export interface PaginationProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  className?: string
  siblingCount?: number
}

function buildRange(page: number, pageCount: number, sib: number): (number | "…")[] {
  if (pageCount <= 1) return [1]
  const total = sib * 2 + 5
  if (pageCount <= total) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }
  const left = Math.max(page - sib, 2)
  const right = Math.min(page + sib, pageCount - 1)
  const showLeftDots = left > 2
  const showRightDots = right < pageCount - 1
  const items: (number | "…")[] = [1]
  if (showLeftDots) items.push("…")
  for (let i = left; i <= right; i++) items.push(i)
  if (showRightDots) items.push("…")
  items.push(pageCount)
  return items
}

const Pagination: React.FC<PaginationProps> = ({
  page,
  pageCount,
  onPageChange,
  className,
  siblingCount = 1,
}) => {
  const items = buildRange(page, pageCount, siblingCount)
  const goto = (p: number) => {
    if (p < 1 || p > pageCount || p === page) return
    onPageChange(p)
  }
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <IconButton
        size="sm"
        aria-label="Página anterior"
        disabled={page <= 1}
        onClick={() => goto(page - 1)}
      >
        <ChevronLeft size={14} aria-hidden />
      </IconButton>
      {items.map((it, i) =>
        it === "…" ? (
          <span
            key={`dots-${i}`}
            className="px-1 text-xs text-muted-foreground select-none"
            aria-hidden
          >
            …
          </span>
        ) : (
          <button
            key={it}
            type="button"
            onClick={() => goto(it)}
            aria-current={it === page ? "page" : undefined}
            className={cn(
              "h-7 w-7 rounded-md text-xs font-medium border-0 transition-colors",
              it === page
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-transparent text-foreground hover:bg-[var(--gray-100)]"
            )}
          >
            {it}
          </button>
        )
      )}
      <IconButton
        size="sm"
        aria-label="Próxima página"
        disabled={page >= pageCount}
        onClick={() => goto(page + 1)}
      >
        <ChevronRight size={14} aria-hidden />
      </IconButton>
    </div>
  )
}

export { Pagination }
