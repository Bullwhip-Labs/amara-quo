// /app/dashboard/page.tsx
// Amara QUO Command Center - NASA Mission Control Layout
// Narrow feed stream on left, main operations view on right

'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { AgentHeader } from '@/components/agent-header'
import { FeedStream } from '@/components/feed-stream'
import { MissionControl } from '@/components/mission-control'
import { type ProcessedEmail } from '@/lib/kv-client'
import { RefreshCw } from 'lucide-react'

async function fetchEmails(): Promise<ProcessedEmail[]> {
  const response = await fetch('/api/emails')
  if (!response.ok) throw new Error('Failed to fetch emails')
  const data = await response.json()
  return data.emails
}

async function pollForNewEmails(): Promise<{ newCount: number; emails: ProcessedEmail[] }> {
  const response = await fetch('/api/emails/poll')
  if (!response.ok) throw new Error('Failed to poll emails')
  return response.json()
}

export default function DashboardPage() {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)

  // Main query for fetching emails
  const { data: emails = [], isLoading, error, refetch } = useQuery({
    queryKey: ['emails'],
    queryFn: fetchEmails,
    refetchInterval: 30000,
  })

  // Polling query for new emails
  const { data: pollData } = useQuery({
    queryKey: ['poll-emails'],
    queryFn: pollForNewEmails,
    refetchInterval: parseInt(process.env.NEXT_PUBLIC_POLLING_INTERVAL || '30000'),
    enabled: !isLoading,
  })

  // Refetch when new messages detected
  useEffect(() => {
    if (pollData?.newCount && pollData.newCount > 0) {
      refetch()
    }
  }, [pollData?.newCount, refetch])

  // Get selected message
  const selectedMessage = emails.find(e => e.id === selectedMessageId) || null

  // Calculate stats
  const stats = {
    total: emails.length,
    analyzed: emails.filter(e => e.status === 'completed').length,
    active: emails.filter(e => e.status === 'processing').length,
  }

  if (error) {
    return (
      <div className="h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-500 font-mono">SYSTEM ERROR: CONNECTION LOST</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--amara-purple)] text-white font-mono text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            RECONNECT
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[#0A0A0B] overflow-hidden">
      {/* Header */}
      <AgentHeader 
        totalIntel={stats.total}
        analyzedCount={stats.analyzed}
        avgResponseTime={2.1}
        activeProcessing={stats.active}
      />

      {/* Main Layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel - Feed Stream (Narrow) */}
        <div className="w-64 flex-shrink-0">
          <FeedStream 
            messages={emails}
            selectedId={selectedMessageId}
            onSelectMessage={setSelectedMessageId}
          />
        </div>

        {/* Right Panel - Mission Control (Main Area) */}
        <div className="flex-1 min-w-0">
          <MissionControl 
            selectedMessage={selectedMessage}
            allMessages={emails}
          />
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <div className="text-center">
            <div className="text-purple-600 font-mono text-sm animate-pulse">
              INITIALIZING AMARA QUO...
            </div>
          </div>
        </div>
      )}
    </div>
  )
}