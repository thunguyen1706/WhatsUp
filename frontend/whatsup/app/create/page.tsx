import MobileShell from "@/components/mobile-shell"
import BottomNav from "@/components/bottom-nav"

export default function CreatePage() {
  return (
    <MobileShell header={<h1 className="text-2xl font-extrabold">Create Event</h1>}>
      <div className="space-y-3">
        <p className="text-sm text-neutral-700">
          This is a stub screen. Add fields for title, date, location, banner, and ticket tiers.
        </p>
        <div className="grid gap-2">
          {["Event title", "Date & time", "Location", "Description"].map((p) => (
            <input
              key={p}
              placeholder={p}
              className="w-full rounded-xl border-[3px] border-black bg-white px-3 py-2 text-sm outline-none"
            />
          ))}
        </div>
        <button className="w-full rounded-full border-[3px] border-black bg-[#FF7A00] px-4 py-3 text-sm font-bold text-white">
          Save draft
        </button>
        <BottomNav />
      </div>
    </MobileShell>
  )
}
