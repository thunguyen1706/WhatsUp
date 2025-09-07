import { View, Image } from "react-native"

export default function Illustration({
  query,
  alt,
  width = 360,
  height = 200,
  bg = "#EAF3FF",
  border = true,
}: {
  query: string
  alt: string
  width?: number
  height?: number
  bg?: string
  border?: boolean
}) {
  return (
    <View
      style={{
        width,
        height,
        backgroundColor: bg,
        borderRadius: 16,
        borderWidth: border ? 3 : 0,
        borderColor: "#000",
        overflow: "hidden",
      }}
   >
      <Image
        // Using a local placeholder image; query is unused in RN for dynamic URLs here
        source={require("../assets/images/react-logo.png")}
        accessibilityLabel={alt}
        style={{ width: "100%", height: "100%" }}
        resizeMode="contain"
      />
    </View>
  )
}
