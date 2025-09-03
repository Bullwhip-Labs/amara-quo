// /components/feed-stream.tsx
// Fixed feed stream with newest messages at top
// Proper scrolling behavior for new messages

'use client'

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { type ProcessedEmail } from '@/lib/kv-client'
import { ChevronDown } from 'lucide-react'

interface FeedStreamProps {
  messages: ProcessedEmail[]
  selectedId: string | null
  onSelectMessage: (id: string) => void
}

export function FeedStream({ messages, selectedId, onSelectMessage }: FeedStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const prevMessageCount = useRef(messages.length)

  // Messages are already sorted newest first from the API
  // No need to re-sort here

  // Detect new messages and scroll to top if auto-scroll is on
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      setHasNewMessages(true)
      if (autoScroll && scrollRef.current) {
        // Scroll to top for newest messages
        scrollRef.current.scrollTop = 0
      }
      // Auto-hide the new message indicator after 3 seconds
      setTimeout(() => setHasNewMessages(false), 3000)
    }
    prevMessageCount.current = messages.length
  }, [messages.length, autoScroll])

  // Handle manual scrolling
  const handleScroll = () => {
    if (!scrollRef.current) return
    // If user scrolls away from top, disable auto-scroll
    if (scrollRef.current.scrollTop > 50) {
      setAutoScroll(false)
    }
  }

  // Scroll to top and enable auto-scroll
  const scrollToTop = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
      setAutoScroll(true)
      setHasNewMessages(false)
    }
  }

  const extractSenderName = (from: string) => {
    const match = from.match(/^([^<]+)/)
    const name = match ? match[1].trim() : from
    // Get first name/word and convert to uppercase
    return name.split(' ')[0].toUpperCase()
  }

  const truncateSubject = (subject: string, maxLength: number = 20) => {
    if (subject.length <= maxLength) return subject
    return subject.substring(0, maxLength) + '...'
  }

  const getStatusColor = (status: ProcessedEmail['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'processing': return 'bg-purple-600 animate-pulse'
      case 'failed': return 'bg-red-500'
      case 'manual-review': return 'bg-amber-500'
      default: return 'bg-gray-400'
    }
  }

  const getStatusProgress = (status: ProcessedEmail['status']) => {
    switch (status) {
      case 'completed': return 1
      case 'processing': return 0.5
      case 'failed': return 0.3
      case 'manual-review': return 0.3
      default: return 0.1
    }
  }

  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xs font-mono text-gray-600 tracking-wider uppercase">
          INCOMING FEED
        </h2>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center">
            <div className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse mr-2" />
            <span className="text-xs font-mono text-gray-500">LIVE</span>
          </div>
          <span className="text-xs font-mono text-gray-500">
            {messages.length} MSGS
          </span>
        </div>
      </div>

      {/* New Messages Indicator */}
      {hasNewMessages && !autoScroll && (
        <button
          onClick={scrollToTop}
          className="absolute top-14 left-2 right-2 z-10 px-3 py-1.5 bg-purple-600 text-white text-xs font-mono rounded-sm shadow-lg hover:bg-purple-700 transition-all flex items-center justify-center gap-1"
        >
          <ChevronDown className="h-3 w-3" />
          NEW MESSAGES
        </button>
      )}

      {/* Message Stream - Newest at Top */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2 py-2 space-y-1 font-mono text-sm bg-gray-50"
        style={{ scrollBehavior: 'smooth' }}
      >
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 text-xs mt-8">
            NO MESSAGES YET
          </div>
        ) : (
          messages.map((message) => {
            const isSelected = selectedId === message.id
            const isProcessing = message.status === 'processing'
            const isNew = messages.indexOf(message) < 3 && hasNewMessages
            
            return (
              <div
                key={message.id}
                onClick={() => onSelectMessage(message.id)}
                className={`
                  px-2 py-1.5 cursor-pointer transition-all duration-150 rounded
                  ${isSelected 
                    ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-400' 
                    : 'hover:bg-white text-gray-600 hover:text-gray-900 hover:shadow-sm'
                  }
                  ${isProcessing ? 'border-l-2 border-purple-600' : ''}
                  ${isNew && !isSelected ? 'ring-1 ring-purple-300' : ''}
                `}
              >
                {/* Timestamp */}
                <div className={`text-xs ${isSelected ? 'text-purple-200' : 'text-gray-400'} mb-0.5 flex items-center justify-between`}>
                  <span>{format(new Date(message.receivedAt), 'HH:mm:ss')}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-purple-200' : 'text-gray-400'}`}>
                    {format(new Date(message.receivedAt), 'MMM d')}
                  </span>
                </div>
                
                {/* Sender */}
                <div className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                  {extractSenderName(message.from)}
                </div>
                
                {/* Subject Preview */}
                <div className={`text-xs ${isSelected ? 'text-purple-100' : 'text-gray-500'} truncate`}>
                  {truncateSubject(message.subject)}
                </div>
                
                {/* Status Progress Bar */}
                <div className="flex mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`${getStatusColor(message.status)} transition-all duration-300`}
                    style={{ width: `${getStatusProgress(message.status) * 100}%` }}
                  />
                </div>
              </div>
            )
          })
        )}
        
        {/* Bottom padding */}
        <div className="h-4" />
      </div>

      {/* Footer Status */}
      <div className="px-4 py-2 border-t border-gray-200 bg-white text-xs font-mono text-gray-500 flex items-center justify-between">
        <span>[{messages.filter(m => m.status === 'pending').length} PENDING]</span>
        <span className={`${autoScroll ? 'text-green-600' : 'text-gray-400'}`}>
          {autoScroll ? 'AUTO-SCROLL ON' : 'AUTO-SCROLL OFF'}
        </span>
      </div>
    </div>
  )
}