"use client"

import type React from "react"

import { Link } from "expo-router"
import { usePathname } from "expo-router"
import { Home, Map, Plus, MessageCircle, UserRound } from "lucide-react-native"

// Minimal className combiner
const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ")

const tabs = [
  { href: "/home" as const, label: "Home", icon: Home },
  { href: "/map" as const, label: "Map", icon: Map },
  // Center create handled separately
  { href: "/chat" as const, label: "Chat", icon: MessageCircle },
  { href: "/profile" as const, label: "Profile", icon: UserRound },
] as const

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[420px] px-4 pb-5">
      <div className="relative grid grid-cols-5 items-end rounded-[999px] border-[3px] border-black bg-white/90 px-3 py-2 backdrop-blur">
        {/* Left pair */}
        {tabs.slice(0, 2).map((t) => (
          <NavItem key={t.href} active={pathname.startsWith(t.href)} {...t} />
        ))}

        {/* Center Create */}
        <div className="grid place-items-center">
          <Link
            href="/create"
            className="grid h-14 w-14 place-items-center rounded-full border-[3px] border-black bg-[#FF7A00] text-white shadow-[0_5px_0_rgba(0,0,0,0.28)]"
            aria-label="Create Event"
          >
            <Plus className="h-6 w-6" />
          </Link>
        </div>

        {/* Right pair */}
        {tabs.slice(2).map((t) => (
          <NavItem key={t.href} active={pathname.startsWith(t.href)} {...t} />
        ))}
      </div>
    </nav>
  )
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: "/home" | "/map" | "/chat" | "/profile"
  label: string
  icon: React.ComponentType<{ className?: string }>
  active?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center gap-1 py-1 text-xs font-semibold",
        active ? "text-black" : "text-neutral-500",
      )}
    >
      <div
        className={cn(
          "grid h-9 w-9 place-items-center rounded-full border-[3px] border-black",
          active ? "bg-[#FFD733]" : "bg-white",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <span>{label}</span>
    </Link>
  )
}