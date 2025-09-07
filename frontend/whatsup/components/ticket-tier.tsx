"use client"
import { useState } from "react"
import { cn } from "@/lib/utils"

export default function TicketTier({
  name,
  price,
  perks,
  defaultSelected = false,
}: {
  name: string
  price: string
  perks: string[]
  defaultSelected?: boolean
}) {
  const [selected, setSelected] = useState(defaultSelected)
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => setSelected((s) => !s)}
      className={cn(
        "w-full rounded-[18px] border-[3px] p-3 text-left",
        selected ? "border-black bg-[#FFD733]" : "border-black bg-white",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-lg font-extrabold">{name}</div>
        <div className="rounded-full border-[3px] border-black bg-[#FF7A00] px-3 py-1 text-sm font-bold text-white">
          {price}
        </div>
      </div>
      <ul className="mt-2 list-disc pl-5 text-sm text-neutral-700">
        {perks.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </button>
  )
}
