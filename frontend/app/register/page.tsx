"use client"

import type React from "react"

import { useState } from "react"
import { Link } from "expo-router"
import MobileShell from "@/components/mobile-shell"
import Illustration from "@/components/illustration"
import { Eye, EyeOff, ArrowLeft } from "lucide-react-native"

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      alert("Passwords don't match!")
      return
    }

    // Handle signup logic here
    console.log("Signup attempt:", formData)
    // Redirect to home on success
    window.location.href = "/home"
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <MobileShell>
      <div className="space-y-5">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-[#FF7A00]">
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>

        <div className="text-center">
          <Illustration
            query="flat illustration join community people celebrating with confetti yellow orange blue"
            alt="Join the community illustration"
            width={280}
            height={180}
            bg="#EAF3FF"
          />
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">Join the fun!</h1>
          <p className="text-neutral-700">Create your account and start discovering events</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Full name"
              required
              className="w-full rounded-2xl border-[3px] border-black bg-white px-4 py-3 text-sm font-medium outline-none placeholder:text-neutral-500 focus:bg-[#FFFBF0]"
            />

            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="Email address"
              required
              className="w-full rounded-2xl border-[3px] border-black bg-white px-4 py-3 text-sm font-medium outline-none placeholder:text-neutral-500 focus:bg-[#FFFBF0]"
            />

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
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

            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => handleChange("confirmPassword", e.target.value)}
              placeholder="Confirm password"
              required
              className="w-full rounded-2xl border-[3px] border-black bg-white px-4 py-3 text-sm font-medium outline-none placeholder:text-neutral-500 focus:bg-[#FFFBF0]"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-full border-[3px] border-black bg-[#FFD733] px-6 py-3 text-lg font-extrabold shadow-[0_5px_0_rgba(0,0,0,0.25)] hover:brightness-105 active:translate-y-1 active:shadow-[0_2px_0_rgba(0,0,0,0.25)]"
          >
            Create Account
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
          <p className="text-xs text-neutral-600">By signing up, you agree to our Terms and Privacy Policy</p>
        </div>
      </div>
    </MobileShell>
  )
}