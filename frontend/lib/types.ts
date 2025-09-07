export interface User {
  id: string
  name: string
  email: string
  role?: "USER" | "ORGANIZER" | "SPONSOR" | "ADMIN"
  avatar?: string
}

export interface EventItem {
  id: string
  title: string
  description: string
  organizer: string
  organizerId?: string
  starts_at: string
  ends_at: string
  location_name: string
  location_address: string
  capacity: number
  min_price: number
  banner_url?: string
  category?: string
}

export interface ChatMessage {
  id: string
  user_name: string
  message: string
  timestamp: string
  is_me: boolean
}

export interface CreateEventForm {
  title: string
  description: string
  starts_at: string
  ends_at: string
  capacity: number
  location_name: string
  location_address: string
}

// Mock data for offline demo
export const mockEvents: EventItem[] = [
  {
    id: "1",
    title: "Sunset Rooftop DJ",
    description: "Amazing rooftop party with live DJ",
    organizer: "Vibe Collective",
    organizerId: "org1",
    starts_at: "2024-01-15T20:00:00Z",
    ends_at: "2024-01-15T23:30:00Z",
    location_name: "Beacon Rooftop",
    location_address: "Downtown",
    capacity: 100,
    min_price: 25,
  },
  {
    id: "2",
    title: "Park Picnic & Games",
    description: "Fun outdoor activities and food",
    organizer: "Campus Crew",
    organizerId: "org2",
    starts_at: "2024-01-16T14:00:00Z",
    ends_at: "2024-01-16T17:00:00Z",
    location_name: "Greenwood Park",
    location_address: "123 Park Ave",
    capacity: 50,
    min_price: 0,
  },
]

export const mockChatMessages: ChatMessage[] = [
  {
    id: "1",
    user_name: "Tay",
    message: "Anyone getting food before?",
    timestamp: "7:12 PM",
    is_me: false,
  },
  {
    id: "2",
    user_name: "You",
    message: "Down for tacos near the venue!",
    timestamp: "7:13 PM",
    is_me: true,
  },
]
