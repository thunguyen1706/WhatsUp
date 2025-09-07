import { View, Text, Image } from "react-native"

export default function ChatMessage({
  name,
  text,
  time,
  me = false,
}: {
  name: string
  text: string
  time: string
  me?: boolean
}) {
  const Avatar = (
    <View
      style={{
        height: 32,
        width: 32,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 3,
        borderColor: "#000",
      }}
    >
      <Image
        source={require("../assets/images/placeholder.png")}
        style={{ height: "100%", width: "100%" }}
        resizeMode="cover"
      />
    </View>
  )

  return (
    <View
      style={{
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: me ? "flex-end" : "flex-start",
        gap: 8,
      }}
    >
      {!me && Avatar}

      <View
        style={{
          maxWidth: "70%",
          borderWidth: 3,
          borderColor: "#000",
          borderRadius: 16,
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: me ? "#FFD733" : "#fff",
          ...(me ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: 4 }),
          gap: 4,
        }}
      >
        {!me && <Text style={{ fontSize: 11, fontWeight: "600" }}>{name}</Text>}
        <Text>{text}</Text>
        <Text style={{ fontSize: 10, color: "#525252" }}>{time}</Text>
      </View>

      {me && Avatar}
    </View>
  )
}