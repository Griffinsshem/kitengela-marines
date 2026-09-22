"use client";

import { CaretDown } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { type NavItem, isActiveItem, isActivePath, isNavGroup } from "@/config/navigation";
import { cn } from "@/lib/cn";

/**
 * Desktop navigation with disclosure menus.
 *
 * Menus open on click or Enter, not hover: hover menus are unreachable on
 * touch laptops and snap shut when the pointer slips diagonally. Each trigger
 * is a real button with aria-expanded, and the panel closes on Escape (focus
 * returns to its button), on an outside click, when focus leaves it, and on
 * navigation.
 */
export function DesktopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const [lastPathname, setLastPathname] = useState(pathname);
  const navRef = useRef<HTMLElement>(null);

  // Close on navigation. Adjusting state during render when an input changes
  // is React's documented alternative to calling setState inside an effect.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpenLabel(null);
  }

  useEffect(() => {
    if (openLabel === null) return;

    function onPointerDown(event: PointerEvent) {
      if (!navRef.current?.contains(event.target as Node)) setOpenLabel(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || openLabel === null) return;
      const trigger = navRef.current?.querySelector<HTMLButtonElement>(
        `[data-menu="${CSS.escape(openLabel)}"]`,
      );
      setOpenLabel(null);
      trigger?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openLabel]);

  return (
    <nav ref={navRef} aria-label="Main" className="hidden xl:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = isActiveItem(pathname, item);

          if (!isNavGroup(item)) {
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
                  className={topLevelClass(active)}
                >
                  {item.label}
                </Link>
              </li>
            );
          }

          const open = openLabel === item.label;
          const panelId = `nav-panel-${item.label.toLowerCase()}`;

          return (
            <li
              key={item.label}
              className="relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setOpenLabel((current) => (current === item.label ? null : current));
                }
              }}
            >
              <button
                type="button"
                data-menu={item.label}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenLabel(open ? null : item.label)}
                className={cn(topLevelClass(active), "inline-flex items-center gap-1.5")}
              >
                {item.label}
                <CaretDown
                  aria-hidden="true"
                  weight="bold"
                  className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")}
                />
              </button>

              <div
                id={panelId}
                hidden={!open}
                className="absolute left-0 top-full z-50 mt-3 min-w-56 border-t-4 border-accent bg-chalk py-2 text-pitch shadow-lg"
              >
                <ul>
                  {item.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={isActivePath(pathname, link.href) ? "page" : undefined}
                        onClick={() => setOpenLabel(null)}
                        className="block px-4 py-2.5 font-medium hover:bg-turf aria-[current=page]:font-semibold aria-[current=page]:text-accent-ink"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function topLevelClass(active: boolean): string {
  // The active item is underlined, not just recoloured, so the current section
  // is identifiable without relying on colour.
  return cn(
    "rounded-control px-3 py-2 font-semibold text-chalk transition-colors duration-150",
    "decoration-2 underline-offset-[6px] hover:text-accent-glow",
    active && "underline decoration-accent-glow",
  );
}
