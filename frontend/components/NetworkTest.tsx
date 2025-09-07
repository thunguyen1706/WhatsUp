// components/NetworkTest.tsx
import React, { useState } from 'react'
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native'
import api from '../lib/api'
import { login } from '../lib/auth'

export default function NetworkTest() {
  const [results, setResults] = useState<string[]>([])

  const addResult = (message: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const clearResults = () => {
    setResults([])
  }

  const testBasicConnection = async () => {
    try {
      addResult('Testing basic connection...')
      
      // Try a simple GET request to see if we can reach the server
      const response = await api.get('/health') // or any endpoint that exists
      
      addResult(`✅ Connection successful! Status: ${response.status}`)
    } catch (error: any) {
      addResult(`❌ Connection failed`)
      
      if (error.response) {
        addResult(`Server responded with: ${error.response.status} - ${error.response.data?.message || 'No message'}`)
      } else if (error.request) {
        addResult(`No response from server. Check if backend is running at: ${api.defaults.baseURL}`)
      } else {
        addResult(`Error: ${error.message}`)
      }
    }
  }

  const testLoginEndpoint = async () => {
    try {
      addResult('Testing login endpoint...')
      
      // Test with dummy credentials to see if endpoint exists
      const response = await api.post('/auth/login', {
        email: 'test@test.com',
        password: 'wrongpassword'
      })
      
      addResult(`✅ Login endpoint exists and responded: ${response.status}`)
    } catch (error: any) {
      if (error.response?.status === 400 || error.response?.status === 401) {
        addResult(`✅ Login endpoint exists (got expected error: ${error.response.status})`)
        addResult(`Response: ${error.response.data?.message || 'No message'}`)
      } else if (error.response?.status === 404) {
        addResult(`❌ Login endpoint not found (404). Check your backend routes.`)
      } else if (error.request) {
        addResult(`❌ No response from login endpoint`)
      } else {
        addResult(`❌ Login test error: ${error.message}`)
      }
    }
  }

  const testWithRealCredentials = async () => {
    try {
      addResult('Testing with real login...')
      
      // Replace with actual test credentials from your database
      const user = await login('your-test-email@example.com', 'your-test-password')
      
      addResult(`✅ Real login successful! User: ${user.name}`)
    } catch (error: any) {
      addResult(`❌ Real login failed: ${error.message}`)
    }
  }

  const checkNetworkInfo = () => {
    addResult(`API Base URL: ${api.defaults.baseURL}`)
    addResult(`Environment: ${__DEV__ ? 'Development' : 'Production'}`)
    addResult(`Platform: ${require('react-native').Platform.OS}`)
  }

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>
        Network Connection Test
      </Text>
      
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <TouchableOpacity
          style={{ backgroundColor: '#007AFF', padding: 10, borderRadius: 5 }}
          onPress={checkNetworkInfo}
        >
          <Text style={{ color: 'white' }}>Check Config</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={{ backgroundColor: '#28A745', padding: 10, borderRadius: 5 }}
          onPress={testBasicConnection}
        >
          <Text style={{ color: 'white' }}>Test Connection</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={{ backgroundColor: '#FFC107', padding: 10, borderRadius: 5 }}
          onPress={testLoginEndpoint}
        >
          <Text style={{ color: 'white' }}>Test Login Endpoint</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={{ backgroundColor: '#17A2B8', padding: 10, borderRadius: 5 }}
          onPress={testWithRealCredentials}
        >
          <Text style={{ color: 'white' }}>Test Real Login</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={{ backgroundColor: '#DC3545', padding: 10, borderRadius: 5 }}
          onPress={clearResults}
        >
          <Text style={{ color: 'white' }}>Clear</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView style={{ flex: 1, backgroundColor: '#f5f5f5', padding: 10, borderRadius: 5 }}>
        {results.map((result, index) => (
          <Text key={index} style={{ fontSize: 12, marginBottom: 5, fontFamily: 'monospace' }}>
            {result}
          </Text>
        ))}
      </ScrollView>
    </View>
  )
}