import { View, Text, TouchableOpacity } from "react-native"
import { Calendar, MapPin, Users } from "lucide-react-native"
import { router } from "expo-router"
import type { EventItem } from "../lib/types"

interface EventCardProps {
  event: EventItem
  accent?: string
}

export default function EventCard({ event, accent = "#FFD733" }: EventCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  return (
    <View
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 22,
        backgroundColor: "white",
        padding: 12,
        borderWidth: 3,
        borderColor: "#000",
      }}
    >
      <View
        style={{
          position: "absolute",
          right: -12,
          top: -12,
          height: 80,
          width: 80,
          borderRadius: 20,
          backgroundColor: accent,
        }}
      />
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", letterSpacing: -0.5 }}>{event.title}</Text>
        <Text style={{ fontSize: 13, color: "#404040" }}>
          Hosted by <Text style={{ fontWeight: "600" }}>{event.organizer}</Text>
        </Text>

        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Calendar size={16} color="#000" />
            <Text style={{ fontSize: 13 }}>{formatDate(event.starts_at)}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MapPin size={16} color="#000" />
            <Text style={{ fontSize: 13 }}>{event.location_name}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Users size={16} color="#000" />
            <Text style={{ fontSize: 13 }}>{event.capacity} spots available</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
          <TouchableOpacity
            style={{
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 6,
              borderWidth: 3,
              borderColor: "#000",
              backgroundColor: "#FF7A00",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 0,
              elevation: 4,
            }}
            onPress={() => router.push(`/event/${event.id}` as any)}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "white" }}>
              {event.min_price > 0 ? `$${event.min_price}` : "Free"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push(`/event/${event.id}` as any)}>
            <Text style={{ fontSize: 14, fontWeight: "600", textDecorationLine: "underline" }}>View details</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}
