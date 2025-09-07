"use client"

import { MapPin } from "lucide-react-native"

export default function MapView() {
  // Static, playful map representation with absolute pins
  const pins = [
    { top: "20%", left: "18%" },
    { top: "35%", left: "60%" },
    { top: "62%", left: "30%" },
    { top: "70%", left: "75%" },
  ]
  return (
    <div className="relative aspect-[9/12] w-full overflow-hidden rounded-2xl border-[3px] border-black bg-[#EAF3FF]">
      {/* simplified roads/areas */}
      <div className="absolute left-0 top-10 h-2 w-full bg-white/70" />
      <div className="absolute left-8 top-28 h-2 w-[85%] rotate-12 bg-white/70" />
      <div className="absolute left-0 top-48 h-2 w-full -rotate-6 bg-white/70" />
      <div className="absolute -left-10 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-[#C3E3FF]" />
      {pins.map((p, i) => (
        <div key={i} className="absolute" style={{ top: p.top, left: p.left }}>
          <div className="grid h-10 w-10 place-items-center rounded-full border-[3px] border-black bg-[#FF7A00] text-white shadow-[0_3px_0_rgba(0,0,0,0.25)]">
            <MapPin className="h-5 w-5" />
          </div>
        </div>
      ))}
    </div>
  )
}
