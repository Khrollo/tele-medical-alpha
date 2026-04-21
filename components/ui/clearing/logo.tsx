import * as React from "react";

type LogoProps = {
  size?: number;
  className?: string;
};

export function Logo({ size = 28, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={className}
    >
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="7" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="2.2" fill="var(--brand)" />
    </svg>
  );
}
