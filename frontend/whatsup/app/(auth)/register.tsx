"use client"

import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native"
import { router } from "expo-router"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, ArrowLeft } from "lucide-react-native"
import MobileShell from "../../components/MobileShell"
import Illustration from "../../components/Illustrations"
import { register } from "../../lib/auth"
import { registerSchema, type RegisterForm } from "../../lib/form"

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "USER",
    },
  })

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true)
    try {
      await register(data)
      router.replace("/(tabs)/home")
    } catch (error: any) {
      Alert.alert("Signup Failed", error.response?.data?.message || "Something went wrong")
    } finally {
      setIsLoading(false)
    }
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
            query="flat illustration join community people celebrating with confetti yellow orange blue"
            alt="Join the community illustration"
            width={280}
            height={180}
            bg="#EAF3FF"
          />
        </View>

        <View style={{ gap: 8, alignItems: "center" }}>
          <Text style={{ fontSize: 30, fontWeight: "800", letterSpacing: -0.5 }}>Join the fun!</Text>
          <Text style={{ color: "#404040", textAlign: "center" }}>
            Create your account and start discovering events
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          <View style={{ gap: 12 }}>
            <Controller
              control={control}
              name="name"
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
                  placeholder="Full name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
            {errors.name && <Text style={{ color: "#ef4444", fontSize: 14 }}>{errors.name.message}</Text>}

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
                  placeholder="Email address"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              )}
            />
            {errors.email && <Text style={{ color: "#ef4444", fontSize: 14 }}>{errors.email.message}</Text>}

            <View style={{ position: "relative" }}>
              <Controller
                control={control}
                name="password"
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
                      paddingRight: 48,
                      fontSize: 14,
                      fontWeight: "500",
                    }}
                    placeholder="Password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!showPassword}
                  />
                )}
              />
              <TouchableOpacity
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: [{ translateY: -10 }],
                }}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} color="#666" /> : <Eye size={20} color="#666" />}
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={{ color: "#ef4444", fontSize: 14 }}>{errors.password.message}</Text>}

            <Controller
              control={control}
              name="role"
              render={({ field: { onChange, value } }) => (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600" }}>I am a:</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {[
                      { value: "USER", label: "Attendee" },
                      { value: "ORGANIZER", label: "Organizer" },
                      { value: "SPONSOR", label: "Sponsor" },
                    ].map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={{
                          flex: 1,
                          borderRadius: 12,
                          borderWidth: 3,
                          borderColor: "#000",
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          backgroundColor: value === option.value ? "#FFD733" : "white",
                        }}
                        onPress={() => onChange(option.value)}
                      >
                        <Text style={{ textAlign: "center", fontSize: 14, fontWeight: "600" }}>{option.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            />
          </View>

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
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", textAlign: "center" }}>
              {isLoading ? "Creating Account..." : "Create Account"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </MobileShell>
  )
}
