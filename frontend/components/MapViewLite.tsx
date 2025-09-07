import { View } from "react-native"
import { MapPin } from "lucide-react-native"
import { useState } from "react"

export default function MapViewLite() {
  const pins = [
    { top: 0.20, left: 0.18 },
    { top: 0.35, left: 0.60 },
    { top: 0.62, left: 0.30 },
    { top: 0.70, left: 0.75 },
  ] as const

  const [size, setSize] = useState({ width: 0, height: 0 })

  return (
    <View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout
        setSize({ width, height })
      }}
      style={{
        position: "relative",
        aspectRatio: 9 / 12,
        width: "100%",
        overflow: "hidden",
        borderRadius: 16,
        borderWidth: 3,
        borderColor: "#000",
        backgroundColor: "#EAF3FF",
      }}
    >
      {/* Simplified roads/areas */}
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 40,
          height: 8,
          width: "100%",
          backgroundColor: "rgba(255, 255, 255, 0.7)",
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 32,
          top: 112,
          height: 8,
          width: "85%",
          transform: [{ rotate: "12deg" }],
          backgroundColor: "rgba(255, 255, 255, 0.7)",
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 192,
          height: 8,
          width: "100%",
          transform: [{ rotate: "-6deg" }],
          backgroundColor: "rgba(255, 255, 255, 0.7)",
        }}
      />
      <View
        style={{
          position: "absolute",
          left: -40,
          top: size.height * 0.5,
          height: 224,
          width: 224,
          transform: [{ translateY: -112 }],
          borderRadius: 999,
          backgroundColor: "#C3E3FF",
        }}
      />

      {pins.map((pin, i) => (
        <View
          key={i}
          style={{ position: "absolute", top: size.height * pin.top, left: size.width * pin.left }}
        >
          <View
            style={{
              height: 40,
              width: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              borderWidth: 3,
              borderColor: "#000",
              backgroundColor: "#FF7A00",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.25,
              shadowRadius: 0,
              elevation: 3,
            }}
          >
            <MapPin size={20} color="white" />
          </View>
        </View>
      ))}
    </View>
  )
}
