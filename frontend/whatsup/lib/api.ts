import axios from "axios";
import { Platform } from "react-native";

const trimEnd = (s?: string) => s?.replace(/\/+$/, "") ?? "";

const getApiUrl = () => {
  let env = trimEnd(process.env.EXPO_PUBLIC_API_URL); 

  if (env) {
    try {
      const u = new URL(env);
      if (Platform.OS === "android" && (u.hostname === "localhost" || u.hostname === "127.0.0.1")) {
        u.hostname = "10.0.2.2";
        env = trimEnd(u.toString());
      }
    } catch {}
    const base = trimEnd(env);
    const url = base.endsWith("/api") ? base : `${base}/api`;
    console.log("Using API URL:", url);
    return url;
  }

  // Dev fallback
  const host = Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000";
  const url = `${host}/api`;
  console.log("Using API URL (fallback):", url);
  return url;
};

export const api = axios.create({
  baseURL: getApiUrl(),
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});
export default api;
