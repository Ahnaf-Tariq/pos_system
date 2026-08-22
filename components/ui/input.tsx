"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

function Input({
  className,
  type,
  onChange,
  maxLength,
  inputMode,
  autoComplete,
  ...props
}: InputProps) {
  const isTel = type === "tel";

  return (
    <input
      {...props}
      type={type}
      inputMode={isTel ? "numeric" : inputMode}
      autoComplete={isTel ? (autoComplete ?? "tel") : autoComplete}
      maxLength={isTel ? 13 : maxLength}
      onChange={
        isTel
          ? (event) => {
              event.target.value = event.target.value
                .replace(/\D/g, "")
                .slice(0, 13);
              onChange?.(event);
            }
          : onChange
      }
      className={cn(
        "flex h-8 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    />
  );
}

export { Input };
