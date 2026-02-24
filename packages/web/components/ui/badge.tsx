import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "border-transparent bg-primary/[0.12] text-primary hover:bg-primary/[0.16]",
                secondary:
                    "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
                destructive:
                    "border-destructive/20 bg-destructive/[0.08] text-destructive hover:bg-destructive/[0.12]",
                success:
                    "border-success/20 bg-success/[0.10] text-success hover:bg-success/[0.15]",
                warning:
                    "border-warning/20 bg-warning/[0.15] text-warning-foreground hover:bg-warning/[0.20]",
                info:
                    "border-info/20 bg-info/[0.08] text-info hover:bg-info/[0.12]",
                outline: "text-foreground border-border bg-card hover:bg-muted",
                "outline-primary": "text-primary border-primary/25 bg-primary/5 hover:bg-primary/10",
                "outline-success": "text-success border-success/25 bg-success/5 hover:bg-success/10",
                "outline-destructive": "text-destructive border-destructive/25 bg-destructive/5 hover:bg-destructive/10",
            },
            size: {
                default: "px-2.5 py-0.5 text-xs",
                sm: "px-2 py-0.5 text-[10px]",
                lg: "px-3 py-1 text-sm",
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
