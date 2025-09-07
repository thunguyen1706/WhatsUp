import "../global.css"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" options={{ presentation: "card" }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="(modals)/create"
            options={{
              presentation: "modal",
              headerShown: true,
              headerTitle: "Create Event",
              headerStyle: { backgroundColor: "#FFD733" },
            }}
          />
        </Stack>
        <StatusBar style="dark" backgroundColor="#FFD733" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
