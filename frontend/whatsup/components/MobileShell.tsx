import type React from "react"
import { View, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

interface MobileShellProps {
  children: React.ReactNode
  header?: React.ReactNode
  scrollable?: boolean
}

export default function MobileShell({ children, header, scrollable = true }: MobileShellProps) {
  const content = (
    <View style={{ flex: 1, backgroundColor: "#F6F7FB" }}>
      <View
        style={{
          marginHorizontal: "auto",
          width: "100%",
          maxWidth: 420,
          paddingHorizontal: 16,
          paddingTop: 24,
        }}
      >
        <View
          style={{
            borderRadius: 28,
            backgroundColor: "white",
            padding: 16,
            borderWidth: 3,
            borderColor: "#000",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.18,
            shadowRadius: 0,
            elevation: 10,
          }}
        >
          {header && <View style={{ marginBottom: 12 }}>{header}</View>}
          {children}
        </View>
      </View>
    </View>
  )

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F6F7FB" }}>
      {scrollable ? <ScrollView showsVerticalScrollIndicator={false}>{content}</ScrollView> : content}
    </SafeAreaView>
  )
}
