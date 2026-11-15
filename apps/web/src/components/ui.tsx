import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:brightness-95",
        ghost: "hover:bg-muted",
        outline: "border border-border bg-card hover:bg-muted",
        danger: "bg-destructive text-white",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Button({
  className,
  variant,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring",
        props.className,
      )}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
        props.className,
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring",
        props.className,
      )}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>{children}</div>;
}

export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 96" className={cn("h-12 w-auto text-foreground", className)} role="img" aria-label="Energym">
      <text x="0" y="54" fill="currentColor" fontFamily="Arial Black, Geist, sans-serif" fontSize="48" fontWeight="800" textLength="100" lengthAdjust="spacingAndGlyphs">
        ENE
      </text>
      <path fill="#2f7cff" d="M128 4h34L140 32h22L110 66l20-28h-22z" />
      <text x="172" y="54" fill="currentColor" fontFamily="Arial Black, Geist, sans-serif" fontSize="48" fontWeight="800" textLength="100" lengthAdjust="spacingAndGlyphs">
        GYM
      </text>
      <text x="140" y="84" fill="var(--muted-foreground)" fontFamily="Arial, Geist, sans-serif" fontSize="11" fontWeight="700" letterSpacing="3.2" textAnchor="middle">
        FITNESS CENTER
      </text>
    </svg>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "bad" }) {
  const tones = {
    neutral: "bg-muted text-foreground",
    good: "bg-accent text-foreground",
    bad: "bg-red-100 text-destructive",
  };
  return <span className={cn("rounded-full px-2 py-1 text-xs font-medium", tones[tone])}>{children}</span>;
}
