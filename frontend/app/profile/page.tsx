import MobileShell from "@/components/mobile-shell"
import BottomNav from "@/components/bottom-nav"
import { events } from "@/lib/data"
import { Settings } from "lucide-react-native"

export default function ProfilePage() {
  return (
    <MobileShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full border-[3px] border-black bg-[#FFD733]" />
            <div>
              <h1 className="text-xl font-extrabold">Jordan A.</h1>
              <p className="text-sm text-neutral-700">Community Organizer</p>
            </div>
          </div>
          <button
            className="grid h-10 w-10 place-items-center rounded-full border-[3px] border-black bg-white"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-2xl border-[3px] border-black bg-white p-3">
          <h2 className="text-lg font-extrabold">Past events</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between">
                <span className="font-semibold">{e.title}</span>
                <span className="text-neutral-600">{e.date.split("•")[0]}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className="rounded-2xl border-[3px] border-black bg-[#FFD733] p-3 text-sm font-bold">
            Edit profile
          </button>
          <button className="rounded-2xl border-[3px] border-black bg-white p-3 text-sm font-bold">
            Notifications
          </button>
        </div>

        <BottomNav />
      </div>
    </MobileShell>
  )
}