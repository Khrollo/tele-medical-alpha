import * as React from "react";
import { cn } from "@/app/_lib/utils/cn";

type IconComponent = React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
}>;

interface SectionHeaderProps {
    /** Icon rendered in the leading slot. Sized automatically. */
    icon?: IconComponent;
    /** Serif title text. */
    title: string;
    /** Right-aligned meta text (optional) — appears before the action. */
    meta?: React.ReactNode;
    /** Right-aligned action slot (optional) — usually a `<Btn kind="ghost" />`. */
    action?: React.ReactNode;
    /** Override icon color. Defaults to `var(--brand-ink)`. */
    iconColor?: string;
    /** Disable the bottom divider (for headers at the top of a borderless card). */
    noDivider?: boolean;
    className?: string;
}

/**
 * Section header matching the Vitals-card pattern:
 *   [icon]  [serif title]  [flex-1]  [meta]  [action]
 * With a hairline divider below.
 *
 * Intended to sit at the top of a `ClearingCard` (pass `pad={0}` on the
 * card so the divider aligns with the card edges) or inline inside a
 * padded card.
 */
export function SectionHeader({
    icon: Icon,
    title,
    meta,
    action,
    iconColor = "var(--brand-ink)",
    noDivider,
    className,
}: SectionHeaderProps) {
    return (
        <div
            className={cn(
                "flex flex-wrap items-center gap-2.5 px-5 py-4",
                className
            )}
            style={noDivider ? undefined : { borderBottom: "1px solid var(--line)" }}
        >
            {Icon ? (
                <Icon className="h-4 w-4 shrink-0" style={{ color: iconColor }} />
            ) : null}
            <div
                className="serif min-w-0 truncate"
                style={{
                    fontSize: 18,
                    letterSpacing: "-0.01em",
                    color: "var(--ink)",
                }}
            >
                {title}
            </div>
            <div className="flex-1" />
            {meta ? (
                <div className="text-[12px]" style={{ color: "var(--ink-3)" }}>
                    {meta}
                </div>
            ) : null}
            {action}
        </div>
    );
}
