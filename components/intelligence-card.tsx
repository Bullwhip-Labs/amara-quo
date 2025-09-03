// /components/intelligence-card.tsx
// Card component for displaying incoming intelligence/messages
// Shows message preview with Amara QUO agent theming

import { format } from 'date-fns'
import { Mail, User, ChevronRight, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { AgentStateBadge, type AgentState } from '@/components/ui/agent-state-badge'
import { type ProcessedEmail } from '@/lib/kv-client'

interface IntelligenceCardProps {
  message: ProcessedEmail
  onClick?: () => void
  isNew?: boolean
}

export function IntelligenceCard({ message, onClick, isNew = false }: IntelligenceCardProps) {
  // Map old status to new agent states
  const getAgentState = (status: ProcessedEmail['status']): AgentState => {
    const stateMap: Record<ProcessedEmail['status'], AgentState> = {
      'pending': 'queued',
      'processing': 'analyzing',
      'completed': 'synthesized',
      'failed': 'needs-review'
    }
    return stateMap[status]
  }

  const extractSenderName = (from: string) => {
    const match = from.match(/^([^<]+)/)
    return match ? match[1].trim() : from
  }

  const extractSenderEmail = (from: string) => {
    const match = from.match(/<([^>]+)>/)
    return match ? match[1] : from
  }

  return (
    <Card 
      className={`
        group cursor-pointer transition-all duration-200
        hover:shadow-md hover:border-[var(--amara-purple-soft)]
        ${isNew ? 'border-[var(--neural-blue)] shadow-md' : ''}
      `}
      onClick={onClick}
    >
      <div className="p-4 space-y-3">
        {/* Header with sender and state */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isNew && (
                <Sparkles className="h-3 w-3 text-[var(--neural-blue)] flex-shrink-0" />
              )}
              <p className="text-sm font-medium truncate">
                {extractSenderName(message.from)}
              </p>
            </div>
            <p className="text-xs text-[var(--color-muted)] truncate">
              {extractSenderEmail(message.from)}
            </p>
          </div>
          <AgentStateBadge state={getAgentState(message.status)} />
        </div>

        {/* Subject */}
        <h4 className="font-medium text-sm line-clamp-1 group-hover:text-[var(--amara-purple)] transition-colors">
          {message.subject}
        </h4>

        {/* Preview */}
        <p className="text-xs text-[var(--color-muted)] line-clamp-2">
          {message.snippet}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[var(--color-muted)]">
            {format(new Date(message.receivedAt), 'MMM d, h:mm a')}
          </span>
          <ChevronRight className="h-3 w-3 text-[var(--color-muted)] group-hover:text-[var(--amara-purple)] transition-colors" />
        </div>

        {/* Neural indicator for active processing */}
        {message.status === 'processing' && (
          <div className="h-[1px] w-full overflow-hidden rounded-full">
            <div className="h-full neural-border" />
          </div>
        )}
      </div>
    </Card>
  )
}