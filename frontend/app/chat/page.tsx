"use client"

import MobileShell from "@/components/mobile-shell"
import BottomNav from "@/components/bottom-nav"
import ChatMessage from "@/components/chat-message"
import { Send } from "lucide-react-native"
import { useState } from "react"

export default function ChatPage() {
  const [messages, setMessages] = useState([
    { name: "Tay", text: "Anyone getting food before?", time: "7:12 PM", me: false },
    { name: "You", text: "Down for tacos near the venue!", time: "7:13 PM", me: true },
  ])
  const [value, setValue] = useState("")

  return (
    <MobileShell header={<h1 className="text-2xl font-extrabold">Event Chat</h1>}>
      <div className="flex min-h-[60vh] flex-col">
        <div className="flex-1 py-1">
          {messages.map((m, i) => (
            <ChatMessage key={i} name={m.name} text={m.text} time={m.time} me={m.me as boolean} />
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!value.trim()) return
            setMessages((prev) => [...prev, { name: "You", text: value.trim(), time: "Now", me: true }])
            setValue("")
          }}
          className="mt-2 flex items-center gap-2 rounded-full border-[3px] border-black bg-white px-3 py-2"
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-transparent text-sm outline-none"
            placeholder="Message the group"
            aria-label="Message input"
          />
          <button
            type="submit"
            className="grid h-10 w-10 place-items-center rounded-full border-[3px] border-black bg-[#FF7A00] text-white"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <BottomNav />
      </div>
    </MobileShell>
  )
}
