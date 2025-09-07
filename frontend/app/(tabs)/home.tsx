"use client"

import { useEffect, useState } from "react"
import { View, Text, FlatList, RefreshControl, TouchableOpacity, Image } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Calendar, MapPin, Users } from "lucide-react-native"
import { router } from "expo-router"
import api from "../../lib/api"
import { mockEvents } from "../../lib/types"
import type { EventItem } from "../../lib/types"

export default function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    fetchNearbyEvents()
  }, [])

  const fetchNearbyEvents = async () => {
    try {
      const response = await api.get("/events/nearby?lat=40.7600&lng=-73.9776&radius=50&limit=20")
      setEvents(response.data.events || response.data)
      setIsOffline(false)
    } catch (error) {
      console.error("Failed to fetch events:", error)
      setEvents(mockEvents)
      setIsOffline(true)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    })
  }

  const renderEventCard = ({ item }: { item: EventItem }) => (
    <View
      style={{
        backgroundColor: "white",
        borderRadius: 24,
        borderWidth: 4,
        borderColor: "#000",
        marginBottom: 20,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 0,
        elevation: 6,
      }}
    >
      {/* Event Image/Banner */}
      <View
        style={{
          height: 200,
          backgroundColor: "#F5F5F5",
          justifyContent: "center",
          alignItems: "center",
          borderBottomWidth: 4,
          borderBottomColor: "#000",
        }}
      >
        {item.banner_url ? (
          <Image source={{ uri: item.banner_url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <Text style={{ fontSize: 24, fontWeight: "400", color: "#999", letterSpacing: 2 }}>PLACEHOLDER</Text>
        )}
      </View>

      {/* Event Details */}
      <View style={{ padding: 20, position: "relative" }}>
        {/* Yellow accent corner */}
        <View
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            width: 60,
            height: 60,
            backgroundColor: "#FFD733",
            borderRadius: 12,
            borderWidth: 4,
            borderColor: "#000",
          }}
        />

        <Text
          style={{
            fontSize: 24,
            fontWeight: "800",
            color: "#000",
            marginBottom: 8,
            letterSpacing: -0.5,
          }}
        >
          {item.title}
        </Text>

        <Text
          style={{
            fontSize: 16,
            color: "#666",
            marginBottom: 16,
          }}
        >
          Hosted by <Text style={{ fontWeight: "600", color: "#000" }}>{item.organizer}</Text>
        </Text>

        <View style={{ gap: 12, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Calendar size={20} color="#000" />
            <Text style={{ fontSize: 16, fontWeight: "500", color: "#000" }}>
              {formatDate(item.starts_at)} • {formatTime(item.starts_at)}–{formatTime(item.ends_at)}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <MapPin size={20} color="#000" />
            <Text style={{ fontSize: 16, color: "#000" }}>
              {item.location_name}, {item.location_address}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Users size={20} color="#000" />
            <Text style={{ fontSize: 16, color: "#000" }}>Open spots available</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <TouchableOpacity
            style={{
              backgroundColor: "#FF7A00",
              borderRadius: 25,
              borderWidth: 4,
              borderColor: "#000",
              paddingHorizontal: 24,
              paddingVertical: 12,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 0,
              elevation: 4,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "white" }}>Join</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.id } })}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: "#000",
                textDecorationLine: "underline",
              }}
            >
              View details
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F5F5" }}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            backgroundColor: "white",
            borderBottomWidth: 4,
            borderBottomColor: "#000",
            paddingHorizontal: 20,
            paddingVertical: 20,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ fontSize: 28, fontWeight: "800", color: "#000" }}>Nearby events</Text>
              <Text style={{ fontSize: 16, color: "#666" }}>Curated for you</Text>
            </View>
            <View
              style={{
                backgroundColor: "#FFD733",
                borderRadius: 25,
                borderWidth: 4,
                borderColor: "#000",
                paddingHorizontal: 20,
                paddingVertical: 10,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>Today</Text>
            </View>
          </View>
        </View>

        {/* Offline Indicator */}
        {isOffline && (
          <View
            style={{
              backgroundColor: "#FEF3C7",
              borderBottomWidth: 2,
              borderBottomColor: "#F59E0B",
              paddingHorizontal: 20,
              paddingVertical: 12,
            }}
          >
            <Text style={{ textAlign: "center", fontSize: 14, fontWeight: "600", color: "#92400E" }}>
              📱 Offline mode - Showing sample events
            </Text>
          </View>
        )}

        {/* Events List */}
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderEventCard}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: 100, // Space for bottom navigation
          }}
          showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
              refreshing={isLoading}
              onRefresh={fetchNearbyEvents}
              colors={["#FF7A00"]}
            tintColor="#FF7A00"
          />
        }
        />
      </View>
    </SafeAreaView>
  )
}

