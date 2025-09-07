"use client"

import type React from "react"
import { View, TouchableOpacity, Text } from "react-native"
import { Home, Map, MessageCircle, User, Plus } from "lucide-react-native"
import { router, usePathname } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

const tabs = [
  { href: "/(tabs)/home", label: "Home", icon: Home },
  { href: "/(tabs)/map", label: "Map", icon: Map },
  { href: "/(tabs)/chat", label: "Chat", icon: MessageCircle },
  { href: "/(tabs)/profile", label: "Profile", icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        marginHorizontal: "auto",
        width: "100%",
        maxWidth: 420,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 20,
      }}
    >
      <View
        style={{
          position: "relative",
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          borderRadius: 999,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderWidth: 3,
          borderColor: "#000",
          backgroundColor: "rgba(255, 255, 255, 0.9)",
        }}
      >
        {/* Left pair */}
        {tabs.slice(0, 2).map((tab) => (
          <NavItem key={tab.href} {...tab} active={pathname.startsWith(tab.href)} />
        ))}

        {/* Center Create Button */}
        <TouchableOpacity
          style={{
            height: 56,
            width: 56,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            borderWidth: 3,
            borderColor: "#000",
            backgroundColor: "#FF7A00",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.28,
            shadowRadius: 0,
            elevation: 5,
          }}
          onPress={() => router.push("/(modals)/create")}
          accessibilityLabel="Create Event"
        >
          <Plus size={24} color="white" />
        </TouchableOpacity>

        {/* Right pair */}
        {tabs.slice(2).map((tab) => (
          <NavItem key={tab.href} {...tab} active={pathname.startsWith(tab.href)} />
        ))}
      </View>
    </View>
  )
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; color?: string }>
  active?: boolean
}) {
  return (
    <TouchableOpacity
      style={{
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        paddingVertical: 4,
      }}
      onPress={() => router.push(href as any)}
    >
      <View
        style={{
          height: 36,
          width: 36,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          borderWidth: 3,
          borderColor: "#000",
          backgroundColor: active ? "#FFD733" : "#fff",
        }}
      >
        <Icon size={16} color="black" />
      </View>
      <Text
        style={{
          fontSize: 12,
          fontWeight: "600",
          color: active ? "black" : "#6b7280",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )
}
