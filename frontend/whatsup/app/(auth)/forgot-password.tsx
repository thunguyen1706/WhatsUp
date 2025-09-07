"use client"

import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native"
import { router } from "expo-router"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft } from "lucide-react-native"
import MobileShell from "../../components/MobileShell"
import Illustration from "../../components/Illustrations"
import { forgotPassword } from "../../lib/auth"
import { forgotPasswordSchema, type ForgotPasswordForm } from "../../lib/form"

export default function ForgotPasswordPage() {
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState("")

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true)
    try {
      await forgotPassword(data.email)
      setSubmittedEmail(data.email)
      setIsSubmitted(true)
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  const handleTryAgain = () => {
    setIsSubmitted(false)
    setSubmittedEmail("")
    reset() // Clear the form
  }

  if (isSubmitted) {
    return (
      <MobileShell>
        <View style={{ gap: 20 }}>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            onPress={() => router.push("/(auth)/login")}
          >
            <ArrowLeft size={16} color="#FF7A00" />
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#FF7A00" }}>Back to login</Text>
          </TouchableOpacity>

          <View style={{ alignItems: "center" }}>
            <Illustration
              query="flat illustration email sent envelope with checkmark and sparkles green yellow"
              alt="Email sent illustration"
              width={280}
              height={180}
              bg="#F0FDF4"
            />
          </View>

          <View style={{ gap: 8, alignItems: "center" }}>
            <Text style={{ fontSize: 30, fontWeight: "800", letterSpacing: -0.5 }}>Check your email!</Text>
            <Text style={{ color: "#404040", textAlign: "center" }}>
              We've sent password reset instructions to <Text style={{ fontWeight: "600" }}>{submittedEmail}</Text>
            </Text>
          </View>

          <View style={{ gap: 12 }}>
            <TouchableOpacity
              style={{
                width: "100%",
                borderRadius: 999,
                borderWidth: 3,
                borderColor: "#000",
                backgroundColor: "#FFD733",
                paddingHorizontal: 24,
                paddingVertical: 12,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 5 },
                shadowOpacity: 0.25,
                shadowRadius: 0,
                elevation: 5,
              }}
              onPress={() => router.push("/(auth)/login")}
            >
              <Text style={{ fontSize: 18, fontWeight: "800", textAlign: "center" }}>Back to Sign In</Text>
            </TouchableOpacity>

            <Text style={{ textAlign: "center", fontSize: 14, color: "#6b7280" }}>
              Didn't receive the email?{" "}
              <Text
                style={{ fontWeight: "600", color: "#FF7A00", textDecorationLine: "underline" }}
                onPress={handleTryAgain}
              >
                Try again
              </Text>
            </Text>
          </View>
        </View>
      </MobileShell>
    )
  }

  return (
    <MobileShell>
      <View style={{ gap: 20 }}>
        <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 8 }} onPress={() => router.back()}>
          <ArrowLeft size={16} color="#FF7A00" />
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#FF7A00" }}>Back to login</Text>
        </TouchableOpacity>

        <View style={{ alignItems: "center" }}>
          <Illustration
            query="flat illustration forgot password key with question mark orange yellow blue"
            alt="Forgot password illustration"
            width={280}
            height={180}
            bg="#EAF3FF"
          />
        </View>

        <View style={{ gap: 8, alignItems: "center" }}>
          <Text style={{ fontSize: 30, fontWeight: "800", letterSpacing: -0.5 }}>Forgot password?</Text>
          <Text style={{ color: "#404040", textAlign: "center" }}>
            No worries! Enter your email and we'll send you reset instructions.
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={{
                  width: "100%",
                  borderRadius: 16,
                  borderWidth: 3,
                  borderColor: "#000",
                  backgroundColor: "white",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  fontSize: 14,
                  fontWeight: "500",
                }}
                placeholder="Enter your email address"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            )}
          />
          {errors.email && <Text style={{ color: "#ef4444", fontSize: 14 }}>{errors.email.message}</Text>}

          <TouchableOpacity
            style={{
              width: "100%",
              borderRadius: 999,
              borderWidth: 3,
              borderColor: "#000",
              backgroundColor: "#FF7A00",
              paddingHorizontal: 24,
              paddingVertical: 12,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 5 },
              shadowOpacity: 0.25,
              shadowRadius: 0,
              elevation: 5,
            }}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: "white", textAlign: "center" }}>
              {isLoading ? "Sending..." : "Send Reset Link"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </MobileShell>
  )
}

