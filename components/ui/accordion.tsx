"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/app/_lib/utils/cn";

interface AccordionContextValue {
  openItems: Set<string>;
  onToggle: (value: string) => void;
}

const AccordionContext = React.createContext<AccordionContextValue | undefined>(undefined);

interface AccordionProps {
  children: React.ReactNode;
  type?: "single" | "multiple";
  defaultValue?: string | string[];
  className?: string;
}

export function Accordion({ children, type = "multiple", defaultValue, className }: AccordionProps) {
  const [openItems, setOpenItems] = React.useState<Set<string>>(() => {
    if (defaultValue) {
      return new Set(Array.isArray(defaultValue) ? defaultValue : [defaultValue]);
    }
    return new Set();
  });

  const onToggle = React.useCallback((value: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        if (type === "single") {
          next.clear();
        }
        next.add(value);
      }
      return next;
    });
  }, [type]);

  return (
    <AccordionContext.Provider value={{ openItems, onToggle }}>
      <div className={cn("space-y-2", className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

function AccordionItemBase({ value, children, className }: AccordionItemProps) {
  return (
    <div className={cn("border rounded-md", className)} data-value={value}>
      {children}
    </div>
  );
}

interface AccordionTriggerProps {
  children: React.ReactNode;
  className?: string;
}

export function AccordionTrigger({ children, className }: AccordionTriggerProps) {
  const context = React.useContext(AccordionContext);
  if (!context) throw new Error("AccordionTrigger must be used within Accordion");

  const item = React.useContext(ItemContext);
  if (!item) throw new Error("AccordionTrigger must be used within AccordionItem");

  const isOpen = context.openItems.has(item.value);

  return (
    <button
      onClick={() => context.onToggle(item.value)}
      className={cn(
        "flex w-full items-center justify-between px-4 py-3 text-left font-medium transition-all hover:bg-accent [&[data-state=open]>svg]:rotate-180",
        className
      )}
      data-state={isOpen ? "open" : "closed"}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
    </button>
  );
}

interface AccordionContentProps {
  children: React.ReactNode;
  className?: string;
}

const ItemContext = React.createContext<{ value: string } | undefined>(undefined);

export function AccordionContent({ children, className }: AccordionContentProps) {
  const context = React.useContext(AccordionContext);
  if (!context) throw new Error("AccordionContent must be used within Accordion");

  const item = React.useContext(ItemContext);
  if (!item) throw new Error("AccordionContent must be used within AccordionItem");

  const isOpen = context.openItems.has(item.value);

  if (!isOpen) return null;

  return (
    <div className={cn("px-4 pb-4 pt-0", className)}>{children}</div>
  );
}

// Wrap AccordionItem to provide context
export function AccordionItem({ value, children, className }: AccordionItemProps) {
  return (
    <ItemContext.Provider value={{ value }}>
      <AccordionItemBase value={value} className={className}>
        {children}
      </AccordionItemBase>
    </ItemContext.Provider>
  );
}

