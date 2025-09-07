import { View, Image } from "react-native"

interface IllustrationProps {
  query: string
  alt: string
  width?: number
  height?: number
  bg?: string
  border?: boolean
}

export default function Illustration({
  query,
  alt,
  width = 360,
  height = 200,
  bg = "#EAF3FF",
  border = true,
}: IllustrationProps) {
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: border ? 3 : 0,
        borderColor: "#000",
        backgroundColor: bg,
        width,
        height,
      }}
    >
      <Image
        source={require("../assets/images/placeholder.png")}
        style={{ width: "100%", height: "100%", borderRadius: 16 }}
        resizeMode="cover"
        accessibilityLabel={alt}
      />
    </View>
  )
}
