import api from "./api"
import type { User } from "./types"
import { Platform } from 'react-native'

// Import storage based on platform
let SecureStore: any = null
let AsyncStorage: any = null

if (Platform.OS === 'web') {
  AsyncStorage = {
    setItem: (key: string, value: string) => {
      localStorage.setItem(key, value)
      return Promise.resolve()
    },
    getItem: (key: string) => {
      return Promise.resolve(localStorage.getItem(key))
    },
    removeItem: (key: string) => {
      localStorage.removeItem(key)
      return Promise.resolve()
    }
  }
} else {
  // For mobile, use SecureStore
  SecureStore = require('expo-secure-store')
}

const TOKEN_KEY = "auth_token"

// Platform-aware storage functions
export const saveToken = async (token: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(TOKEN_KEY, token)
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token)
    }
  } catch (error) {
    console.error('Error saving token:', error)
    throw error
  }
}

export const getToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(TOKEN_KEY)
    } else {
      return await SecureStore.getItemAsync(TOKEN_KEY)
    }
  } catch (error) {
    console.error('Error getting token:', error)
    return null
  }
}

export const removeToken = async (): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(TOKEN_KEY)
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY)
    }
  } catch (error) {
    console.error('Error removing token:', error)
  }
}

export const getMe = async (): Promise<User | null> => {
  try {
    const response = await api.get("/auth/profile")
    return response.data
  } catch (error) {
    console.error("Failed to get user profile:", error)
    return null
  }
}

export const login = async (email: string, password: string): Promise<User> => {
  try {
    console.log('Attempting login for:', email)
    console.log('Platform:', Platform.OS)
    
    const response = await api.post('/auth/login', { 
      email: email.trim().toLowerCase(), 
      password 
    })
    
    console.log('Login response received:', {
      status: response.status,
      hasToken: !!response.data.token,
      hasUser: !!response.data.user
    })
    
    const { user, token } = response.data
    
    if (!token) {
      throw new Error('No token received from server')
    }
    
    if (!user) {
      throw new Error('No user data received from server')
    }
    
    await saveToken(token)
    console.log('Token saved successfully on platform:', Platform.OS)
    
    return user
  } catch (error: any) {
    console.error('Login error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url
    })
    
    // Enhanced error handling
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.message || `Server error: ${error.response.status}`
      throw new Error(message)
    } else if (error.request) {
      // Request was made but no response received
      console.error('No response received. Request details:', {
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL
      })
      throw new Error('Unable to connect to server. Please check your internet connection and try again.')
    } else {
      // Something else happened
      throw new Error(error.message || 'An unexpected error occurred during login')
    }
  }
}

export const register = async (data: {
  name: string
  email: string
  password: string
  role: string
}): Promise<{ user: User; token: string }> => {
  try {
    console.log('Attempting registration for:', data.email)
    console.log('Platform:', Platform.OS)
    
    const registrationData = {
      ...data,
      email: data.email.trim().toLowerCase()
    }
    
    const response = await api.post("/auth/register", registrationData)
    
    console.log('Registration response received:', {
      status: response.status,
      hasToken: !!response.data.token,
      hasUser: !!response.data.user
    })
    
    const { user, token } = response.data
    
    if (!token) {
      throw new Error('No token received from server')
    }
    
    if (!user) {
      throw new Error('No user data received from server')
    }
    
    await saveToken(token)
    console.log('Token saved successfully after registration')
    
    return { user, token }
  } catch (error: any) {
    console.error('Registration error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    })
    
    if (error.response) {
      const message = error.response.data?.message || `Registration failed: ${error.response.status}`
      throw new Error(message)
    } else if (error.request) {
      throw new Error('Unable to connect to server. Please check your internet connection and try again.')
    } else {
      throw new Error(error.message || 'An unexpected error occurred during registration')
    }
  }
}

export const forgotPassword = async (email: string): Promise<void> => {
  try {
    console.log('Requesting password reset for:', email)
    
    await api.post("/auth/forgot-password", { 
      email: email.trim().toLowerCase() 
    })
    
    console.log('Password reset request sent successfully')
  } catch (error: any) {
    console.error('Forgot password error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    })
    
    if (error.response) {
      const message = error.response.data?.message || 'Failed to send password reset email'
      throw new Error(message)
    } else if (error.request) {
      throw new Error('Unable to connect to server. Please check your internet connection and try again.')
    } else {
      throw new Error(error.message || 'An unexpected error occurred')
    }
  }
}

export const logout = async (): Promise<void> => {
  try {
    await removeToken()
    console.log('Logged out successfully')
  } catch (error) {
    console.error('Logout error:', error)
  }
}