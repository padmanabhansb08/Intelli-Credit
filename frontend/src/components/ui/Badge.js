import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default: "border-transparent bg-gray-800 text-gray-200 hover:bg-gray-700",
                secondary: "border-transparent bg-[#1A1A1A] text-gray-400 hover:bg-gray-800",
                destructive: "border-transparent bg-[#111111] text-gray-500 hover:bg-gray-800",
                outline: "text-gray-300 border-gray-700",
                success: "border-transparent bg-white text-black hover:bg-gray-200",
                warning: "border-transparent bg-gray-700 text-white hover:bg-gray-600",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

function Badge({ className, variant, ...props }) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
