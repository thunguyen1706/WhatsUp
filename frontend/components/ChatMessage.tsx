import { View, Text } from "react-native"
import type { ChatMessage as ChatMessageType } from "../lib/types"

interface ChatMessageProps {
  message: ChatMessageType
}

export default function ChatMessage({ message }: ChatMessageProps) {
  return (
    <View
      style={{
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 8,
        justifyContent: message.is_me ? "flex-end" : "flex-start",
      }}
    >
      {!message.is_me && (
        <View
          style={{
            height: 32,
            width: 32,
            borderRadius: 999,
            borderWidth: 3,
            borderColor: "#000",
            backgroundColor: "#FFD733",
          }}
        />
      )}

      <View
        style={{
          maxWidth: "70%",
          gap: 4,
          borderRadius: 16,
          borderWidth: 3,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderBottomRightRadius: message.is_me ? 4 : 16,
          borderBottomLeftRadius: message.is_me ? 16 : 4,
          borderColor: "#000",
          backgroundColor: message.is_me ? "#FFD733" : "white",
        }}
      >
        {!message.is_me && <Text style={{ fontSize: 11, fontWeight: "600" }}>{message.user_name}</Text>}
        <Text style={{ fontSize: 14 }}>{message.message}</Text>
        <Text style={{ fontSize: 10, color: "#6b7280" }}>{message.timestamp}</Text>
      </View>

      {message.is_me && (
        <View
          style={{
            height: 32,
            width: 32,
            borderRadius: 999,
            borderWidth: 3,
            borderColor: "#000",
            backgroundColor: "#FF7A00",
          }}
        />
      )}
    </View>
  )
}
