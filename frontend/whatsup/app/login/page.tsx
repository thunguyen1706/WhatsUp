"use client"

import type React from "react"

import { useState } from "react"
import { Link } from "expo-router"
import MobileShell from "@/components/mobile-shell"
import Illustration from "@/components/illustration"
import { Eye, EyeOff } from "lucide-react-native"

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle login logic here
    console.log("Login attempt:", { email, password })
    // Redirect to home on success
    window.location.href = "/home"
  }

  return (
    <MobileShell>
      <div className="space-y-5">
        <div className="text-center">
          <Illustration
            query="flat illustration welcome back login smartphone with heart and stars yellow orange"
            alt="Welcome back illustration"
            width={280}
            height={180}
            bg="#EAF3FF"
          />
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">WhatsUp</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="w-full rounded-2xl border-[3px] border-black bg-white px-4 py-3 text-sm font-medium outline-none placeholder:text-neutral-500 focus:bg-[#FFFBF0]"
            />

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="w-full rounded-2xl border-[3px] border-black bg-white px-4 py-3 pr-12 text-sm font-medium outline-none placeholder:text-neutral-500 focus:bg-[#FFFBF0]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-black"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-[#FF7A00] underline hover:text-[#E66A00]"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className="w-full rounded-full border-[3px] border-black bg-[#FFD733] px-6 py-3 text-lg font-extrabold shadow-[0_5px_0_rgba(0,0,0,0.25)] hover:brightness-105 active:translate-y-1 active:shadow-[0_2px_0_rgba(0,0,0,0.25)]"
          >
            Sign In
          </button>
        </form>

        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <div className="h-[2px] flex-1 bg-neutral-300" />
            <span className="text-sm font-medium text-neutral-600">or</span>
            <div className="h-[2px] flex-1 bg-neutral-300" />
          </div>

          <button className="w-full rounded-full border-[3px] border-black bg-white px-6 py-3 text-sm font-bold hover:bg-neutral-50">
            Continue with Google
          </button>
        </div>

        <div className="text-center pt-2">
          <p className="text-sm text-neutral-700">
            {"Don't have an account? "}
            <Link href="/(auth)/register" className="font-bold text-[#FF7A00] underline hover:text-[#E66A00]">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </MobileShell>
  )
}