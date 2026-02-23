import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/* Polaris-aligned: default height 36px, border-radius 8px, 14px font, font-semibold */
const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-[length:var(--polaris-body-md)] font-semibold ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm border border-transparent",
                destructive:
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm border border-transparent",
                outline:
                    "border border-input bg-background hover:bg-accent/50 hover:text-accent-foreground",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent",
                ghost: "hover:bg-accent/50 hover:text-accent-foreground",
                link: "text-primary underline-offset-4 hover:underline",
                success: "bg-success text-success-foreground hover:bg-success/90 shadow-sm border border-transparent",
                warning: "bg-warning text-warning-foreground hover:bg-warning/90 shadow-sm border border-transparent",
                info: "bg-info text-info-foreground hover:bg-info/90 shadow-sm border border-transparent",
            },
            size: {
                default: "h-9 min-h-9 px-4 py-2",
                sm: "h-8 min-h-8 rounded-md px-3 text-[length:var(--polaris-body-sm)]",
                lg: "h-10 min-h-10 rounded-lg px-5 text-[length:var(--polaris-body-md)]",
                xl: "h-11 min-h-11 rounded-lg px-6 text-[length:var(--polaris-body-md)]",
                icon: "h-9 w-9",
                "icon-sm": "h-8 w-8",
                "icon-lg": "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
