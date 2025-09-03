// /components/feed-stream.tsx
// Narrow left panel showing continuous stream of incoming messages
// Clean white/gray theme with NASA mission control feel

'use client'

import { useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { type ProcessedEmail } from '@/lib/kv-client'

interface FeedStreamProps {
  messages: ProcessedEmail[]
  selectedId: string | null
  onSelectMessage: (id: string) => void
}

export function FeedStream({ messages, selectedId, onSelectMessage }: FeedStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  const extractSenderName = (from: string) => {
    const match = from.match(/^([^<]+)/)
    const name = match ? match[1].trim() : from
    // Convert to uppercase and truncate for terminal feel
    return name.split(' ')[0].toUpperCase()
  }

  const truncateSubject = (subject: string, maxLength: number = 20) => {
    if (subject.length <= maxLength) return subject
    return subject.substring(0, maxLength) + '...'
  }

  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xs font-mono text-gray-600 tracking-wider uppercase">
          INCOMING FEED
        </h2>
        <div className="flex items-center mt-1">
          <div className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse mr-2" />
          <span className="text-xs font-mono text-gray-500">LIVE</span>
        </div>
      </div>

      {/* Stream */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-2 py-2 space-y-1 font-mono text-sm bg-gray-50"
        style={{ scrollBehavior: 'smooth' }}
      >
        {messages.map((message) => {
          const isSelected = selectedId === message.id
          const isProcessing = message.status === 'processing'
          
          return (
            <div
              key={message.id}
              onClick={() => onSelectMessage(message.id)}
              className={`
                px-2 py-1.5 cursor-pointer transition-all duration-150 rounded
                ${isSelected 
                  ? 'bg-purple-600 text-white shadow-sm' 
                  : 'hover:bg-white text-gray-600 hover:text-gray-900 hover:shadow-sm'
                }
                ${isProcessing ? 'border-l-2 border-purple-600' : ''}
              `}
            >
              {/* Timestamp */}
              <div className={`text-xs ${isSelected ? 'text-purple-200' : 'text-gray-400'} mb-0.5`}>
                {format(new Date(message.receivedAt), 'HH:mm:ss')}
              </div>
              
              {/* Sender */}
              <div className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                {extractSenderName(message.from)}
              </div>
              
              {/* Subject Preview */}
              <div className={`text-xs ${isSelected ? 'text-purple-100' : 'text-gray-500'} truncate`}>
                {truncateSubject(message.subject)}
              </div>
              
              {/* Status Dots */}
              <div className="flex mt-1">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    className={`
                      h-0.5 w-1 mr-0.5 rounded-full
                      ${i < 16 * (message.status === 'completed' ? 1 : 
                                 message.status === 'processing' ? 0.5 : 
                                 message.status === 'failed' ? 0.3 : 0.1)
                        ? (message.status === 'completed' ? 'bg-green-500' :
                           message.status === 'processing' ? 'bg-purple-600' :
                           message.status === 'failed' ? 'bg-amber-500' : 'bg-gray-400')
                        : 'bg-gray-300'
                      }
                    `}
                  />
                ))}
              </div>
            </div>
          )
        })}
        
        {/* Auto-scroll anchor */}
        <div className="h-4" />
      </div>

      {/* Footer Status */}
      <div className="px-4 py-2 border-t border-gray-200 bg-white text-xs font-mono text-gray-500">
        [{messages.length} MESSAGES] [AUTO-SCROLL]
      </div>
    </div>
  )
}