"use client"

import { useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff } from "lucide-react-native"
import { router } from "expo-router"
import { login } from "../../lib/auth"
import { loginSchema, type LoginForm } from "../../lib/form"

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    try {
      await login(data.email, data.password)
      router.replace("/(tabs)/home")
    } catch (error: any) {
      Alert.alert("Login Failed", error.response?.data?.message || "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F5F5" }}>
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
              {/* Logo and People Illustration */}
              <View style={{ alignItems: "center", marginBottom: 40 }}>
                <View
                  style={{
                    borderRadius: 20,
                    borderWidth: 4,
                    borderColor: "#000",
                    overflow: "hidden",
                    marginBottom: 20,
                  }}
                >
                  <Image
                    source={require("../../assets/images/placeholder.png")}
                    style={{ width: 280, height: 200 }}
                    resizeMode="cover"
                  />
                </View>
                
                <Text
                  style={{
                    fontSize: 36,
                    fontWeight: "800",
                    color: "#FF7A00",
                    letterSpacing: -1,
                  }}
                >
                  WhatsUp
                </Text>
              </View>

              {/* Form Fields */}
              <View style={{ gap: 20 }}>
                {/* Email Input */}
                <View>
                  <Controller
                    control={control}
                    name="email"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        style={{
                          backgroundColor: "#F8F8F8",
                          borderRadius: 25,
                          borderWidth: 3,
                          borderColor: "#000",
                          paddingHorizontal: 20,
                          paddingVertical: 16,
                          fontSize: 16,
                          fontWeight: "500",
                        }}
                        placeholder="Email address"
                        placeholderTextColor="#666"
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                      />
                    )}
                  />
                  {errors.email && (
                    <Text style={{ color: "#ef4444", fontSize: 14, marginTop: 8, marginLeft: 20 }}>
                      {errors.email.message}
                    </Text>
                  )}
                </View>

                {/* Password Input */}
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
                          placeholder="Password"
                          placeholderTextColor="#666"
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          secureTextEntry={!showPassword}
                          autoComplete="password"
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

                {/* Forgot Password */}
                <View style={{ alignItems: "flex-end", marginTop: -8 }}>
                  <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: "#FF7A00",
                        textDecorationLine: "underline",
                      }}
                    >
                      Forgot password?
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Sign In Button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: "#FFD733",
                    borderRadius: 25,
                    borderWidth: 3,
                    borderColor: "#000",
                    paddingVertical: 18,
                    marginTop: 12,
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
                      color: "#000",
                    }}
                  >
                    {isLoading ? "Signing In..." : "Sign In"}
                  </Text>
                </TouchableOpacity>

                {/* Sign Up Link */}
                <View style={{ alignItems: "center", marginTop: 16 }}>
                  <Text style={{ fontSize: 16, color: "#666" }}>
                    Don't have an account?{" "}
                    <Text
                      style={{
                        fontWeight: "700",
                        color: "#FF7A00",
                        textDecorationLine: "underline",
                      }}
                      onPress={() => router.push("/(auth)/register")}
                    >
                      Sign up
                    </Text>
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
