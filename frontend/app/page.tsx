import { Redirect } from "expo-router"

export default function Page() {
  // Start at login
  return <Redirect href="/(auth)/login" />
}