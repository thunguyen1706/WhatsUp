"use client"

import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from "react-native"
import { router } from "expo-router"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { SafeAreaView } from "react-native-safe-area-context"
import api from "../../lib/api"
import { createEventSchema, type CreateEventForm } from "../../lib/form"

export default function CreateEventModal() {
  const [isLoading, setIsLoading] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateEventForm>({
    resolver: zodResolver(createEventSchema),
  })

  const onSubmit = async (data: CreateEventForm) => {
    setIsLoading(true)
    try {
      await api.post("/events", data)
      Alert.alert("Success", "Event created successfully!", [{ text: "OK", onPress: () => router.back() }])
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Failed to create event")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F6F7FB" }}>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        <View
          style={{
            borderRadius: 28,
            borderWidth: 3,
            borderColor: "#000",
            backgroundColor: "white",
            padding: 16,
          }}
        >
          <View style={{ gap: 16 }}>
            <Controller
              control={control}
              name="title"
              render={({ field: { onChange, onBlur, value } }) => (
                <View>
                  <TextInput
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      borderWidth: 3,
                      borderColor: "#000",
                      backgroundColor: "white",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 14,
                    }}
                    placeholder="Event title"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                  {errors.title && (
                    <Text style={{ marginTop: 4, color: "#ef4444", fontSize: 14 }}>{errors.title.message}</Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <View>
                  <TextInput
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      borderWidth: 3,
                      borderColor: "#000",
                      backgroundColor: "white",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 14,
                      height: 80,
                      textAlignVertical: "top",
                    }}
                    placeholder="Description"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    multiline
                    numberOfLines={3}
                  />
                  {errors.description && (
                    <Text style={{ marginTop: 4, color: "#ef4444", fontSize: 14 }}>{errors.description.message}</Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="starts_at"
              render={({ field: { onChange, onBlur, value } }) => (
                <View>
                  <TextInput
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      borderWidth: 3,
                      borderColor: "#000",
                      backgroundColor: "white",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 14,
                    }}
                    placeholder="Start date & time (YYYY-MM-DD HH:MM)"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                  {errors.starts_at && (
                    <Text style={{ marginTop: 4, color: "#ef4444", fontSize: 14 }}>{errors.starts_at.message}</Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="ends_at"
              render={({ field: { onChange, onBlur, value } }) => (
                <View>
                  <TextInput
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      borderWidth: 3,
                      borderColor: "#000",
                      backgroundColor: "white",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 14,
                    }}
                    placeholder="End date & time (YYYY-MM-DD HH:MM)"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                  {errors.ends_at && (
                    <Text style={{ marginTop: 4, color: "#ef4444", fontSize: 14 }}>{errors.ends_at.message}</Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="capacity"
              render={({ field: { onChange, onBlur, value } }) => (
                <View>
                  <TextInput
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      borderWidth: 3,
                      borderColor: "#000",
                      backgroundColor: "white",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 14,
                    }}
                    placeholder="Capacity"
                    value={value?.toString()}
                    onChangeText={(text) => onChange(Number.parseInt(text) || 0)}
                    onBlur={onBlur}
                    keyboardType="numeric"
                  />
                  {errors.capacity && (
                    <Text style={{ marginTop: 4, color: "#ef4444", fontSize: 14 }}>{errors.capacity.message}</Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="location_name"
              render={({ field: { onChange, onBlur, value } }) => (
                <View>
                  <TextInput
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      borderWidth: 3,
                      borderColor: "#000",
                      backgroundColor: "white",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 14,
                    }}
                    placeholder="Location name"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                  {errors.location_name && (
                    <Text style={{ marginTop: 4, color: "#ef4444", fontSize: 14 }}>{errors.location_name.message}</Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="location_address"
              render={({ field: { onChange, onBlur, value } }) => (
                <View>
                  <TextInput
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      borderWidth: 3,
                      borderColor: "#000",
                      backgroundColor: "white",
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 14,
                    }}
                    placeholder="Location address"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                  {errors.location_address && (
                    <Text style={{ marginTop: 4, color: "#ef4444", fontSize: 14 }}>
                      {errors.location_address.message}
                    </Text>
                  )}
                </View>
              )}
            />

            <TouchableOpacity
              style={{
                width: "100%",
                borderRadius: 999,
                borderWidth: 3,
                borderColor: "#000",
                backgroundColor: "#FF7A00",
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
              onPress={handleSubmit(onSubmit)}
              disabled={isLoading}
            >
              <Text style={{ textAlign: "center", fontSize: 14, fontWeight: "700", color: "white" }}>
                {isLoading ? "Creating..." : "Create Event"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
