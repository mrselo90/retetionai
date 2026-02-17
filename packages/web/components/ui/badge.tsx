import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
                secondary:
                    "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
                destructive:
                    "border-transparent bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
                success:
                    "border-transparent bg-success text-success-foreground shadow-sm hover:bg-success/90",
                warning:
                    "border-transparent bg-warning text-warning-foreground shadow-sm hover:bg-warning/90",
                info:
                    "border-transparent bg-info text-info-foreground shadow-sm hover:bg-info/90",
                outline: "text-foreground border-border hover:bg-muted",
                "outline-primary": "text-primary border-primary/50 hover:bg-primary/10",
                "outline-success": "text-success border-success/50 hover:bg-success/10",
                "outline-destructive": "text-destructive border-destructive/50 hover:bg-destructive/10",
            },
            size: {
                default: "px-3 py-1 text-xs",
                sm: "px-2 py-0.5 text-[10px]",
                lg: "px-4 py-1.5 text-sm",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, size, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
