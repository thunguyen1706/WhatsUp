// lib/events.ts
import api from './api';
import * as Location from 'expo-location';

export interface Event {
  id: string;
  title: string;
  description: string;
  category: string;
  starts_at: string;
  ends_at: string;
  location_name: string;
  location_address: string;
  location_lat: number;
  location_lng: number;
  price_cents: number;
  capacity: number;
  image_url: string;
  status: string;
  organizer_id: string;
  organizer_name: string;
  attendee_count: number;
  sponsor_count: number;
  crowdfunding_raised: number;
  funding_progress: number;
  funding_goal_cents: number;
  user_role?: string;
  user_attending: boolean;
  distance?: string;
  created_at: string;
  updated_at: string;
}

export interface EventFilters {
  category?: string;
  location?: string;
  date_from?: string;
  date_to?: string;
  price_min?: number;
  price_max?: number;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
  lat?: number;
  lng?: number;
  radius?: number;
}

export interface EventsResponse {
  events: Event[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Get nearby events based on user location
 */
export const getNearbyEvents = async (filters?: EventFilters): Promise<EventsResponse> => {
  try {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }

    const response = await api.get(`/events/nearby?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching nearby events:', error);
    throw error;
  }
};

/**
 * Get all events with filters
 */
export const getEvents = async (filters?: EventFilters): Promise<EventsResponse> => {
  try {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }

    const response = await api.get(`/events?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching events:', error);
    throw error;
  }
};

/**
 * Get popular events
 */
export const getPopularEvents = async (limit: number = 6): Promise<Event[]> => {
  try {
    const response = await api.get(`/events/popular?limit=${limit}`);
    return response.data.events || response.data;
  } catch (error) {
    console.error('Error fetching popular events:', error);
    throw error;
  }
};

/**
 * Get single event by ID
 */
export const getEvent = async (eventId: string): Promise<Event> => {
  try {
    const response = await api.get(`/events/${eventId}`);
    return response.data.event || response.data;
  } catch (error) {
    console.error('Error fetching event:', error);
    throw error;
  }
};

/**
 * Get user's current location using Expo Location
 */
export const getCurrentLocation = async () => {
  try {
    // Request permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission denied');
    }

    // Get current location
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      lat: location.coords.latitude,
      lng: location.coords.longitude
    };
  } catch (error) {
    console.log('Location access denied or not available:', error);
    throw error;
  }
};

/**
 * Format event date for display
 */
export const formatEventDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = eventDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return `Today • ${date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    })}`;
  } else if (diffDays === 1) {
    return `Tomorrow • ${date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    })}`;
  } else if (diffDays < 7) {
    return `${date.toLocaleDateString('en-US', { weekday: 'long' })} • ${date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    })}`;
  } else {
    return `${date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    })} • ${date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    })}`;
  }
};

/**
 * Format event price for display
 */
export const formatEventPrice = (priceCents: number): string => {
  if (priceCents === 0) return 'Free';
  return `$${(priceCents / 100).toFixed(2)}`;
};

/**
 * Get color for event category
 */
export const getEventColor = (category: string): string => {
  const colors: Record<string, string> = {
    'music': '#FF6B6B',
    'sports': '#4ECDC4',
    'food-drink': '#45B7D1',
    'arts-culture': '#96CEB4',
    'business': '#FFEAA7',
    'technology': '#DDA0DD',
    'health-wellness': '#98D8C8',
    'education': '#F7DC6F',
    'community': '#BB8FCE',
    'entertainment': '#85C1E9',
    'outdoor': '#82E0AA',
    'family': '#F8C471'
  };
  return colors[category] || '#EAF3FF';
};