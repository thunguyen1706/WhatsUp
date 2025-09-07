"use client"

import { useEffect, useState } from "react"
import { View, Text } from "react-native"
import { router } from "expo-router"
import { getToken, getMe } from "../lib/auth"

export default function IndexPage() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = await getToken()
      if (token) {
        const user = await getMe()
        if (user) {
          router.replace("/(tabs)/home")
          return
        }
      }
      router.replace("/(auth)/login")
    } catch (error) {
      console.error("Auth check failed:", error)
      router.replace("/(auth)/login")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFD733" }}>
        <Text style={{ fontSize: 24, fontWeight: "bold" }}>Events App</Text>
      </View>
    )
  }

  return null
}
