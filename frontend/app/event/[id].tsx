"use client"

import { useEffect, useState } from "react"
import { View, Text, TouchableOpacity, Image, ScrollView, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { ArrowLeft } from "lucide-react-native"
import { router, useLocalSearchParams } from "expo-router"
import api from "../../lib/api"
import { mockEvents } from "../../lib/types"
import type { EventItem } from "../../lib/types"

interface TicketTier {
  id: string
  name: string
  price: number
  description: string[]
  selected?: boolean
}

export default function EventDetailsPage() {
  const { id } = useLocalSearchParams()
  const [event, setEvent] = useState<EventItem | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const ticketTiers: TicketTier[] = [
    {
      id: "general",
      name: "General",
      price: 15,
      description: ["Entry", "Group chat access"],
    },
    {
      id: "vip",
      name: "VIP",
      price: 35,
      description: ["Priority entry", "Exclusive area", "1 drink ticket"],
    },
    {
      id: "student",
      name: "Student",
      price: 10,
      description: ["Discounted entry (ID)"],
    },
  ]

  useEffect(() => {
    fetchEventDetails()
  }, [id])

  const fetchEventDetails = async () => {
    try {
      const response = await api.get(`/events/${id}`)
      setEvent(response.data)
    } catch (error) {
      console.error("Failed to fetch event details:", error)
      // Fallback to mock data
      const mockEvent = mockEvents.find((e) => e.id === id)
      if (mockEvent) {
        setEvent(mockEvent)
      } else {
        Alert.alert("Error", "Event not found")
        router.back()
      }
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

  if (isLoading || !event) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F5F5" }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: "#666" }}>Loading...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F5F5F5" }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: "white",
          borderBottomWidth: 4,
          borderBottomColor: "#000",
          paddingHorizontal: 20,
          paddingVertical: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#000" }}>Event Details</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {/* Main Event Card */}
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 24,
            borderWidth: 4,
            borderColor: "#000",
            overflow: "hidden",
            marginBottom: 20,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.15,
            shadowRadius: 0,
            elevation: 6,
          }}
        >
          {/* Event Image */}
          <View
            style={{
              height: 250,
              backgroundColor: "#F5F5F5",
              justifyContent: "center",
              alignItems: "center",
              borderBottomWidth: 4,
              borderBottomColor: "#000",
            }}
          >
            {event.banner_url ? (
              <Image source={{ uri: event.banner_url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            ) : (
              <Text style={{ fontSize: 24, fontWeight: "400", color: "#999", letterSpacing: 2 }}>PLACEHOLDER</Text>
            )}
          </View>

          {/* Event Info */}
          <View style={{ padding: 20 }}>
            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: "#000",
                marginBottom: 8,
                letterSpacing: -0.5,
              }}
            >
              {event.title}
            </Text>

            <Text
              style={{
                fontSize: 16,
                color: "#666",
                marginBottom: 20,
              }}
            >
              Hosted by <Text style={{ fontWeight: "600", color: "#000" }}>{event.organizer}</Text>
            </Text>

            <Text
              style={{
                fontSize: 16,
                color: "#000",
                marginBottom: 20,
              }}
            >
              {formatDate(event.starts_at)} • {formatTime(event.starts_at)}–{formatTime(event.ends_at)} •{" "}
              {event.location_name}, {event.location_address}
            </Text>

            {/* Tickets Section */}
            <Text
              style={{
                fontSize: 24,
                fontWeight: "800",
                color: "#000",
                marginBottom: 16,
              }}
            >
              Tickets
            </Text>

            <View style={{ gap: 12, marginBottom: 24 }}>
              {ticketTiers.map((tier) => (
                <TouchableOpacity
                  key={tier.id}
                  style={{
                    backgroundColor: tier.id === "general" ? "#FFD733" : "white",
                    borderRadius: 20,
                    borderWidth: 4,
                    borderColor: "#000",
                    padding: 16,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 0,
                    elevation: 2,
                  }}
                  onPress={() => setSelectedTicket(tier.id)}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ fontSize: 20, fontWeight: "800", color: "#000" }}>{tier.name}</Text>
                    <View
                      style={{
                        backgroundColor: "#FF7A00",
                        borderRadius: 20,
                        borderWidth: 3,
                        borderColor: "#000",
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: "700", color: "white" }}>${tier.price}</Text>
                    </View>
                  </View>
                  <View style={{ gap: 4 }}>
                    {tier.description.map((desc, index) => (
                      <Text key={index} style={{ fontSize: 14, color: "#000" }}>
                        • {desc}
                      </Text>
                    ))}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: "#3B82F6",
                  borderRadius: 25,
                  borderWidth: 4,
                  borderColor: "#000",
                  paddingVertical: 16,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 0,
                  elevation: 4,
                }}
                onPress={() => router.push("/(tabs)/chat")}
              >
                <Text style={{ fontSize: 18, fontWeight: "700", color: "white", textAlign: "center" }}>Join Chat</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  backgroundColor: "white",
                  borderRadius: 25,
                  borderWidth: 4,
                  borderColor: "#000",
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 0,
                  elevation: 4,
                }}
                onPress={() => router.push("/(tabs)/map")}
              >
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#000", textAlign: "center" }}>
                  View{"\n"}Map
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
