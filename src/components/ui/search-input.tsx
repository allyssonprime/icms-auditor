import * as React from "react"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  containerClassName?: string
  size?: "md" | "lg"
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, containerClassName, size = "md", placeholder = "Buscar", ...props }, ref) => (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-[var(--gray-200)] bg-white px-3 h-9 transition-shadow focus-within:ring-2 focus-within:ring-ring/30",
        size === "lg" && "flex-1 min-w-0",
        containerClassName
      )}
    >
      <Search size={16} className="text-[var(--fg3,_#9CA3AF)] shrink-0" aria-hidden />
      <input
        ref={ref}
        type="search"
        placeholder={placeholder}
        className={cn(
          "flex-1 border-0 bg-transparent text-[13px] text-foreground outline-none placeholder:text-[var(--fg3,_#9CA3AF)]",
          className
        )}
        {...props}
      />
    </div>
  )
)
SearchInput.displayName = "SearchInput"

export { SearchInput }
