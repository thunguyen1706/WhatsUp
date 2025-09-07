"use client"

import { useEffect, useState } from "react"
import { View, Text, TouchableOpacity, Alert } from "react-native"
import { Settings } from "lucide-react-native"
import { router } from "expo-router"
import MobileShell from "../../components/MobileShell"
import { getMe, removeToken } from "../../lib/auth"
import { mockEvents } from "../../lib/types"
import type { User } from "../../lib/types"

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    const userData = await getMe()
    setUser(userData)
  }

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await removeToken()
          router.replace("/(auth)/login")
        },
      },
    ])
  }

  return (
    <MobileShell>
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                height: 56,
                width: 56,
                borderRadius: 999,
                borderWidth: 3,
                borderColor: "#000",
                backgroundColor: "#FFD733",
              }}
            />
            <View>
              <Text style={{ fontSize: 20, fontWeight: "800" }}>{user?.name || "Jordan A."}</Text>
              {/* <Text style={{ fontSize: 14, color: "#404040" }}>
                {user?.role === "ORGANIZER" ? "Event Organizer" : "Community Member"}
              </Text> */}
            </View>
          </View>
          <TouchableOpacity
            style={{
              height: 40,
              width: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              borderWidth: 3,
              borderColor: "#000",
              backgroundColor: "white",
            }}
          >
            <Settings size={20} color="black" />
          </TouchableOpacity>
        </View>

        <View
          style={{
            borderRadius: 16,
            borderWidth: 3,
            borderColor: "#000",
            backgroundColor: "white",
            padding: 12,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "800" }}>Past events</Text>
          <View style={{ marginTop: 8, gap: 8 }}>
            {mockEvents.map((event) => (
              <View
                key={event.id}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600" }}>{event.title}</Text>
                <Text style={{ fontSize: 14, color: "#6b7280" }}>{new Date(event.starts_at).toLocaleDateString()}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={{
              flex: 1,
              borderRadius: 16,
              borderWidth: 3,
              borderColor: "#000",
              backgroundColor: "#FFD733",
              padding: 12,
            }}
          >
            <Text style={{ textAlign: "center", fontSize: 14, fontWeight: "700" }}>Edit profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flex: 1,
              borderRadius: 16,
              borderWidth: 3,
              borderColor: "#000",
              backgroundColor: "white",
              padding: 12,
            }}
            onPress={handleLogout}
          >
            <Text style={{ textAlign: "center", fontSize: 14, fontWeight: "700" }}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </MobileShell>
  )
}
