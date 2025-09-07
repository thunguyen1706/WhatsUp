"use client"

import { Link } from "expo-router"
import { CalendarDays, MapPin, Users } from "lucide-react-native"

export default function EventCard({
  id = "1",
  title = "Sample Event",
  organizer = "Organizer",
  date = "Today • 7:00 PM",
  location = "City Venue",
  accent = "#FFD733",
  joinLabel = "Join",
}: {
  id?: string
  title?: string
  organizer?: string
  date?: string
  location?: string
  accent?: string
  joinLabel?: string
}) {
  return (
    <div className="relative overflow-hidden rounded-[22px] border-[3px] border-black bg-white p-3">
      <div
        className="pointer-events-none absolute -right-3 -top-3 h-20 w-20 rounded-[20px]"
        style={{ backgroundColor: accent }}
      />
      <div className="space-y-2">
        <h3 className="text-lg font-extrabold tracking-tight">{title}</h3>
        <p className="text-[13px] text-neutral-700">
          Hosted by <span className="font-semibold">{organizer}</span>
        </p>
        <ul className="space-y-1 text-[13px]">
          <li className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {date}
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {location}
          </li>
          <li className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {"Open spots available"}
          </li>
        </ul>
        <div className="flex items-center justify-between pt-1">
          <Link
            href={`/event/${id}` as any}
            className="rounded-full border-[3px] border-black bg-[#FF7A00] px-4 py-1.5 text-sm font-semibold text-white shadow-[0_4px_0_rgba(0,0,0,0.35)] hover:brightness-110"
          >
            {joinLabel}
          </Link>
          <Link href={`/event/${id}` as any} className="text-sm font-semibold underline">
            View details
          </Link>
        </div>
      </div>
    </div>
  )
}
