import MobileShell from "@/components/mobile-shell"
import BottomNav from "@/components/bottom-nav"
import EventCard from "@/components/event-card"
import Illustration from "@/components/illustration"
import { events } from "@/lib/data"

export default function HomePage() {
  return (
    <MobileShell
      header={
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold">Nearby events</h2>
            <p className="text-xs text-neutral-600">Curated for you</p>
          </div>
          <div className="rounded-full border-[3px] border-black bg-[#FFD733] px-3 py-1 text-xs font-bold">Today</div>
        </div>
      }
    >
      <div className="space-y-3">
        {events.map((e) => (
          <div key={e.id} className="space-y-2">
            <Illustration query={e.bannerQuery} alt={e.title} height={160} width={360} bg={e.color ?? "#EAF3FF"} />
            <EventCard
              id={e.id}
              title={e.title}
              organizer={e.organizer}
              date={e.date}
              location={e.location}
              accent="#FFD733"
              joinLabel="Join"
            />
          </div>
        ))}
        <BottomNav />
      </div>
    </MobileShell>
  )
}

