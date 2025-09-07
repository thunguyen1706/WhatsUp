import MobileShell from "@/components/mobile-shell"
import BottomNav from "@/components/bottom-nav"
import MapView from "@/components/map-view"

export default function MapPage() {
  return (
    <MobileShell header={<h1 className="text-2xl font-extrabold">Nearby Map</h1>}>
      <div className="space-y-4">
        <MapView />
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border-[3px] border-black bg-[#FFD733] p-3 text-sm font-bold">
            Live now
            <div className="text-xs font-normal">3 events within 2 mi</div>
          </div>
          <div className="rounded-xl border-[3px] border-black bg-white p-3 text-sm font-bold">
            Tonight
            <div className="text-xs font-normal">5 events · 8pm+</div>
          </div>
        </div>
        <BottomNav />
      </div>
    </MobileShell>
  )
}