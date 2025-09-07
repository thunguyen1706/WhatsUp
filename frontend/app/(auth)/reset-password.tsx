"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Image,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, ArrowLeft } from "lucide-react-native"
import { router, useLocalSearchParams } from "expo-router"
import { z } from "zod"
import api from "../../lib/api"

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>

export default function ResetPasswordPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const params = useLocalSearchParams<{ token: string }>()

  useEffect(() => {
    // Handle both mobile deep links and web URLs
    if (params.token) {
      setToken(params.token)
      console.log('Token from params:', params.token)
    } else {
      // For web URLs, try to get token from URL
      if (typeof window !== 'undefined') {
        const url = window.location.href
        if (url) {
          const urlParams = new URLSearchParams(url.split('?')[1])
          const tokenFromUrl = urlParams.get('token')
          if (tokenFromUrl) {
            setToken(tokenFromUrl)
            console.log('Token from URL:', tokenFromUrl)
          }
        }
      }
    }
  }, [params.token])

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) {
      Alert.alert("Error", "Reset token is missing")
      return
    }

    setIsLoading(true)
    try {
      await api.post("/auth/reset-password", {
        token,
        newPassword: data.password
      })
      
      Alert.alert(
        "Success", 
        "Password reset successfully! You can now login with your new password.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
      )
    } catch (error: any) {
      Alert.alert(
        "Error", 
        error.response?.data?.error || "Failed to reset password"
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFD733" }}>
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 20 }}>
          <View style={{ backgroundColor: "white", borderRadius: 32, padding: 24, borderWidth: 4, borderColor: "#000" }}>
            <Text style={{ fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 16 }}>
              Invalid Reset Link
            </Text>
            <Text style={{ fontSize: 16, color: "#666", textAlign: "center", marginBottom: 24 }}>
              This reset link is invalid or has expired. Please request a new password reset.
            </Text>
            
            <TouchableOpacity
              style={{
                backgroundColor: "#FF7A00",
                borderRadius: 25,
                borderWidth: 3,
                borderColor: "#000",
                paddingVertical: 18,
                marginTop: 20,
              }}
              onPress={() => router.replace("/(auth)/forgot-password")}
            >
              <Text style={{ fontSize: 18, fontWeight: "800", textAlign: "center", color: "white" }}>
                Request New Reset
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFD733" }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 16,
          gap: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            padding: 8,
          }}
        >
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text
          style={{
            fontSize: 20,
            fontWeight: "800",
            color: "#000",
          }}
        >
          Reset Password
        </Text>
      </View>

      {/* Main Content */}
      <View style={{ flex: 1, backgroundColor: "#F5F5F5" }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 40 }}>
              {/* Main Container */}
              <View
                style={{
                  backgroundColor: "white",
                  borderRadius: 32,
                  padding: 24,
                  borderWidth: 4,
                  borderColor: "#000",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.15,
                  shadowRadius: 0,
                  elevation: 8,
                }}
              >
                {/* Logo and Illustration */}
                <View style={{ alignItems: "center", marginBottom: 40 }}>
                  {/* WhatsUp Logo */}
                  <Image
                    source={{
                      uri: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/logo-qvC6C3pguPL5fEjhRHmfBFkbFcHU6u.png",
                    }}
                    style={{ width: 100, height: 100, marginBottom: 16 }}
                    resizeMode="contain"
                  />
                  <Text
                    style={{
                      fontSize: 32,
                      fontWeight: "800",
                      color: "#FF7A00",
                      letterSpacing: -1,
                      marginBottom: 8,
                    }}
                  >
                    WhatsUp
                  </Text>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "600",
                      color: "#000",
                      textAlign: "center",
                      marginBottom: 8,
                    }}
                  >
                    Create New Password
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: "#666",
                      textAlign: "center",
                      lineHeight: 20,
                    }}
                  >
                    Enter your new password below. Make sure it's secure and easy for you to remember.
                  </Text>
                </View>

                {/* Form Fields */}
                <View style={{ gap: 20 }}>
                  {/* New Password Input */}
                  <View>
                    <View style={{ position: "relative" }}>
                      <Controller
                        control={control}
                        name="password"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <TextInput
                            style={{
                              backgroundColor: "#F8F8F8",
                              borderRadius: 25,
                              borderWidth: 3,
                              borderColor: "#000",
                              paddingHorizontal: 20,
                              paddingVertical: 16,
                              paddingRight: 60,
                              fontSize: 16,
                              fontWeight: "500",
                            }}
                            placeholder="New Password"
                            placeholderTextColor="#666"
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            secureTextEntry={!showPassword}
                            autoComplete="new-password"
                          />
                        )}
                      />
                      <TouchableOpacity
                        style={{
                          position: "absolute",
                          right: 20,
                          top: "50%",
                          transform: [{ translateY: -12 }],
                        }}
                        onPress={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={24} color="#666" /> : <Eye size={24} color="#666" />}
                      </TouchableOpacity>
                    </View>
                    {errors.password && (
                      <Text style={{ color: "#ef4444", fontSize: 14, marginTop: 8, marginLeft: 20 }}>
                        {errors.password.message}
                      </Text>
                    )}
                  </View>

                  {/* Confirm Password Input */}
                  <View>
                    <View style={{ position: "relative" }}>
                      <Controller
                        control={control}
                        name="confirmPassword"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <TextInput
                            style={{
                              backgroundColor: "#F8F8F8",
                              borderRadius: 25,
                              borderWidth: 3,
                              borderColor: "#000",
                              paddingHorizontal: 20,
                              paddingVertical: 16,
                              paddingRight: 60,
                              fontSize: 16,
                              fontWeight: "500",
                            }}
                            placeholder="Confirm New Password"
                            placeholderTextColor="#666"
                            value={value}
                            onChangeText={onChange}
                            onBlur={onBlur}
                            secureTextEntry={!showConfirmPassword}
                            autoComplete="new-password"
                          />
                        )}
                      />
                      <TouchableOpacity
                        style={{
                          position: "absolute",
                          right: 20,
                          top: "50%",
                          transform: [{ translateY: -12 }],
                        }}
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff size={24} color="#666" /> : <Eye size={24} color="#666" />}
                      </TouchableOpacity>
                    </View>
                    {errors.confirmPassword && (
                      <Text style={{ color: "#ef4444", fontSize: 14, marginTop: 8, marginLeft: 20 }}>
                        {errors.confirmPassword.message}
                      </Text>
                    )}
                  </View>

                  {/* Password Requirements */}
                  <View
                    style={{
                      backgroundColor: "#F0F9FF",
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: "#3B82F6",
                      padding: 16,
                      marginTop: 8,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#1E40AF", marginBottom: 8 }}>
                      Password Requirements:
                    </Text>
                    <Text style={{ fontSize: 13, color: "#1E40AF", lineHeight: 18 }}>
                      • At least 6 characters long{"\n"}• Include both letters and numbers{"\n"}• Avoid common passwords
                    </Text>
                  </View>

                  {/* Reset Password Button */}
                  <TouchableOpacity
                    style={{
                      backgroundColor: "#FF7A00",
                      borderRadius: 25,
                      borderWidth: 3,
                      borderColor: "#000",
                      paddingVertical: 18,
                      marginTop: 20,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 0,
                      elevation: 4,
                    }}
                    onPress={handleSubmit(onSubmit)}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: "800",
                        textAlign: "center",
                        color: "white",
                      }}
                    >
                      {isLoading ? "Resetting..." : "Reset Password"}
                    </Text>
                  </TouchableOpacity>

                  {/* Back to Login */}
                  <View style={{ alignItems: "center", marginTop: 16 }}>
                    <Text style={{ fontSize: 16, color: "#666" }}>
                      Remember your password?{" "}
                      <Text
                        style={{
                          fontWeight: "700",
                          color: "#FF7A00",
                          textDecorationLine: "underline",
                        }}
                        onPress={() => router.replace("/(auth)/login")}
                      >
                        Sign in
                      </Text>
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  )
}
