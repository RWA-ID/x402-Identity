"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, children, className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          "inline-flex items-center justify-center gap-2 font-mono font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
          {
            "bg-[#f97316] text-black hover:bg-[#fb923c] shadow-[0_0_20px_rgba(249,115,22,0.25)] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)]":
              variant === "primary",
            "border border-[#f97316] text-[#f97316] hover:bg-[rgba(249,115,22,0.1)]":
              variant === "secondary",
            "text-[#f97316] hover:text-[#fb923c]": variant === "ghost",
            "px-3 py-1.5 text-sm rounded": size === "sm",
            "px-5 py-2.5 text-base rounded-md": size === "md",
            "px-8 py-3.5 text-lg rounded-lg": size === "lg",
          },
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
