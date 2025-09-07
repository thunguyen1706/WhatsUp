import { View, Text } from "react-native"
import { useLocalSearchParams, Link } from "expo-router"
import MobileShell from "../../../components/mobile-shell"
import BottomNav from "../../../components/bottom-nav"

export default function EventDetails() {
  const { id } = useLocalSearchParams<{ id: string }>()

  return (
    <MobileShell>
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "800" }}>Event {String(id)}</Text>
        <Text style={{ color: "#404040" }}>Details coming soon.</Text>

        <Link href="/(tabs)/chat">Go to Chat</Link>
        <Link href="/(tabs)/map">View Map</Link>

        <BottomNav />
      </View>
    </MobileShell>
  )
}