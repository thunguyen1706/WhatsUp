import { View, Text } from "react-native"
import MobileShell from "../../components/MobileShell"
import MapViewLite from "../../components/MapViewLite"

export default function MapPage() {
  const header = <Text style={{ fontSize: 24, fontWeight: "800" }}>Nearby Map</Text>

  return (
    <MobileShell header={header}>
      <View style={{ gap: 16 }}>
        <MapViewLite />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View
            style={{
              flex: 1,
              borderRadius: 12,
              borderWidth: 3,
              borderColor: "#000",
              backgroundColor: "#FFD733",
              padding: 12,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700" }}>Live now</Text>
            <Text style={{ fontSize: 12, fontWeight: "400" }}>3 events within 2 mi</Text>
          </View>
          <View
            style={{
              flex: 1,
              borderRadius: 12,
              borderWidth: 3,
              borderColor: "#000",
              backgroundColor: "white",
              padding: 12,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700" }}>Tonight</Text>
            <Text style={{ fontSize: 12, fontWeight: "400" }}>5 events • 8pm+</Text>
          </View>
        </View>
      </View>
    </MobileShell>
  )
}
