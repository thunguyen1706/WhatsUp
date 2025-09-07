import { View } from "react-native"
import { Tabs } from "expo-router"
import BottomNav from "../../components/BottomNav"

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: "none" }, // Hide default tab bar
        }}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="map" />
        <Tabs.Screen name="chat" />
        <Tabs.Screen name="profile" />
      </Tabs>
      <BottomNav />
    </View>
  )
}
