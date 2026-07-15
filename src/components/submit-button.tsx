"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ai";

const STYLES: Record<Variant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-500",
  secondary: "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50",
  danger: "bg-red-600 text-white hover:bg-red-500",
  ai: "bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100",
};

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingText?: string;
  variant?: Variant;
  size?: "sm" | "md";
}) {
  const { pending } = useFormStatus();
  const sizeClass = size === "sm" ? "px-2 py-1 text-xs" : "px-4 py-2 text-sm";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${sizeClass} ${STYLES[variant]} ${className}`}
      {...props}
    >
      {pending && <Loader2 className={`animate-spin ${size === "sm" ? "size-3" : "size-3.5"}`} />}
      {pending ? (pendingText ?? "処理中...") : children}
    </button>
  );
}
