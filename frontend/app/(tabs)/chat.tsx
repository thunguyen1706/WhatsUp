"use client"

import { useState, useEffect, useRef } from 'react'
import { 
  View, 
  Text, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Send, Users, Circle } from 'lucide-react-native'
import { useSocket, type ChatMessage } from '@/lib/useSocket'
import api from '@/lib/api'

interface Conversation {
  conversation_id: string;
  type: 'event' | 'private';
  conversation_name: string;
  conversation_image?: string;
  content: string;
  sender_name: string;
  created_at: string;
  unread_count: number;
  event_id?: string;
  other_user_id?: string;
}

export default function ChatScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null)
  const [messageText, setMessageText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  
  const {
    connected,
    joinEvent,
    leaveEvent,
    sendMessage,
    startTyping,
    stopTyping,
    getChatHistory,
    getOnlineUsers,
    messages,
    typingUsers,
    onlineUsers,
    error
  } = useSocket()

  const flatListRef = useRef<FlatList>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }, [messages])

  // Join event chat when selecting an event conversation
  useEffect(() => {
    if (selectedChat && selectedChat.type === 'event' && selectedChat.event_id && connected) {
      joinEvent(selectedChat.event_id)
      getChatHistory({
        type: 'event',
        eventId: selectedChat.event_id,
        limit: 50
      })
      getOnlineUsers(selectedChat.event_id)
    } else if (selectedChat && selectedChat.type === 'private' && selectedChat.other_user_id && connected) {
      getChatHistory({
        type: 'private',
        receiverId: selectedChat.other_user_id,
        limit: 50
      })
    }

    // Cleanup: leave event chat when switching
    return () => {
      if (selectedChat?.type === 'event' && selectedChat.event_id) {
        leaveEvent(selectedChat.event_id)
      }
    }
  }, [selectedChat, connected])

  const loadConversations = async () => {
    try {
      setLoading(true)
      const response = await api.get('/chat/conversations')
      setConversations(response.data.conversations)
    } catch (error: any) {
      console.error('Error loading conversations:', error)
      Alert.alert('Error', 'Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat || sending) return

    setSending(true)
    try {
      sendMessage({
        content: messageText.trim(),
        type: selectedChat.type,
        eventId: selectedChat.event_id,
        receiverId: selectedChat.other_user_id
      })

      setMessageText('')
      stopTyping({
        eventId: selectedChat.event_id,
        receiverId: selectedChat.other_user_id
      })
    } catch (error) {
      console.error('Error sending message:', error)
      Alert.alert('Error', 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleTyping = (text: string) => {
    setMessageText(text)

    if (!selectedChat) return

    // Start typing indicator
    if (text.length > 0) {
      startTyping({
        eventId: selectedChat.event_id,
        receiverId: selectedChat.other_user_id
      })

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping({
          eventId: selectedChat.event_id,
          receiverId: selectedChat.other_user_id
        })
      }, 2000)
    } else {
      stopTyping({
        eventId: selectedChat.event_id,
        receiverId: selectedChat.other_user_id
      })
    }
  }

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    })
  }

  const formatConversationTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      className={`flex-row items-center p-4 border-b border-gray-200 ${
        selectedChat?.conversation_id === item.conversation_id ? 'bg-blue-50' : 'bg-white'
      }`}
      onPress={() => setSelectedChat(item)}
    >
      <View className="flex-1">
        <View className="flex-row justify-between items-start mb-1">
          <Text className="font-bold text-lg text-black truncate flex-1 mr-2">
            {item.conversation_name}
          </Text>
          <Text className="text-xs text-gray-500">
            {formatConversationTime(item.created_at)}
          </Text>
        </View>
        
        <Text className="text-sm text-gray-600 mb-1">
          {item.sender_name}: {item.content}
        </Text>
        
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            <Circle 
              size={8} 
              className={`mr-2 ${item.type === 'event' ? 'text-green-500' : 'text-blue-500'}`}
              fill="currentColor"
            />
            <Text className="text-xs text-gray-400 capitalize">
              {item.type} chat
            </Text>
          </View>
          
          {item.unread_count > 0 && (
            <View className="bg-red-500 rounded-full min-w-[20px] h-5 items-center justify-center px-1">
              <Text className="text-white text-xs font-bold">
                {item.unread_count > 99 ? '99+' : item.unread_count}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwnMessage = item.sender_id === 'current_user_id' // Replace with actual user ID logic
    
    return (
      <View className={`mb-4 ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        <View className={`max-w-[80%] p-3 rounded-2xl ${
          isOwnMessage 
            ? 'bg-blue-500 rounded-br-sm' 
            : 'bg-gray-200 rounded-bl-sm'
        }`}>
          {!isOwnMessage && (
            <Text className="text-xs text-gray-600 mb-1 font-semibold">
              {item.sender_name}
            </Text>
          )}
          <Text className={`text-base ${isOwnMessage ? 'text-white' : 'text-black'}`}>
            {item.content}
          </Text>
          <Text className={`text-xs mt-1 ${
            isOwnMessage ? 'text-blue-100' : 'text-gray-500'
          }`}>
            {formatMessageTime(item.created_at)}
          </Text>
        </View>
      </View>
    )
  }

  if (!selectedChat) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-white border-b border-gray-200 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-xl font-extrabold">Chats</Text>
            <View className="flex-row items-center">
              <Circle 
                size={8} 
                className={connected ? 'text-green-500' : 'text-red-500'} 
                fill="currentColor"
              />
              <Text className="text-xs text-gray-600 ml-1">
                {connected ? 'Connected' : 'Disconnected'}
              </Text>
            </View>
          </View>
          {error && (
            <Text className="text-red-500 text-sm mt-1">{error}</Text>
          )}
        </View>

        {/* Conversations List */}
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.conversation_id}
          className="flex-1"
          refreshing={loading}
          onRefresh={loadConversations}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center p-8">
              <Text className="text-gray-500 text-center">
                {loading ? 'Loading conversations...' : 'No conversations yet'}
              </Text>
              {!loading && (
                <Text className="text-gray-400 text-center mt-2">
                  Join an event to start chatting!
                </Text>
              )}
            </View>
          }
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView 
        className="flex-1" 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Chat Header */}
        <View className="bg-white border-b border-gray-200 p-4">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => setSelectedChat(null)}
              className="mr-3"
            >
              <Text className="text-blue-500 font-semibold">← Back</Text>
            </TouchableOpacity>
            
            <View className="flex-1">
              <Text className="font-bold text-lg text-center">
                {selectedChat.conversation_name}
              </Text>
              {selectedChat.type === 'event' && onlineUsers.length > 0 && (
                <View className="flex-row items-center justify-center mt-1">
                  <Users size={12} className="text-gray-500 mr-1" />
                  <Text className="text-xs text-gray-500">
                    {onlineUsers.length} online
                  </Text>
                </View>
              )}
            </View>
            
            <View className="w-12" />
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <View className="px-4 py-2">
            <Text className="text-gray-500 text-sm italic">
              {typingUsers.map(user => user.userName).join(', ')} 
              {typingUsers.length === 1 ? ' is' : ' are'} typing...
            </Text>
          </View>
        )}

        {/* Message Input */}
        <View className="border-t border-gray-200 p-4">
          <View className="flex-row items-center space-x-3">
            <TextInput
              className="flex-1 border border-gray-300 rounded-full px-4 py-3 bg-gray-50"
              placeholder="Type a message..."
              value={messageText}
              onChangeText={handleTyping}
              multiline
              maxLength={1000}
              editable={connected}
            />
            <TouchableOpacity
              onPress={handleSendMessage}
              disabled={!messageText.trim() || !connected || sending}
              className={`p-3 rounded-full ${
                messageText.trim() && connected && !sending
                  ? 'bg-blue-500' 
                  : 'bg-gray-300'
              }`}
            >
              <Send 
                size={20} 
                color={messageText.trim() && connected && !sending ? 'white' : 'gray'} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}