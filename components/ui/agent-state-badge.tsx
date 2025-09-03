// /components/ui/agent-state-badge.tsx
// Agent state indicators with AI-themed animations
// Shows the current processing state of Amara QUO

import * as React from "react"

export type AgentState = 'queued' | 'analyzing' | 'synthesized' | 'needs-review'

interface AgentStateBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  state: AgentState
  showAnimation?: boolean
}

export function AgentStateBadge({ 
  state, 
  showAnimation = true,
  className = '', 
  ...props 
}: AgentStateBadgeProps) {
  const states: Record<AgentState, { 
    label: string
    color: string
    bgColor: string
    borderColor: string
    icon?: React.ReactNode
  }> = {
    'queued': {
      label: 'Queued',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
    },
    'analyzing': {
      label: 'Analyzing',
      color: 'text-[var(--amara-purple)]',
      bgColor: 'bg-[var(--amara-purple-faint)]',
      borderColor: 'border-[var(--amara-purple-soft)]',
      icon: (
        <span className="flex space-x-0.5">
          <span className="dot-1 h-1 w-1 bg-[var(--amara-purple)] rounded-full" />
          <span className="dot-2 h-1 w-1 bg-[var(--amara-purple)] rounded-full" />
          <span className="dot-3 h-1 w-1 bg-[var(--amara-purple)] rounded-full" />
        </span>
      )
    },
    'synthesized': {
      label: 'Synthesized',
      color: 'text-[var(--synthesis-green)]',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      icon: <span className="text-xs">✓</span>
    },
    'needs-review': {
      label: 'Needs Review',
      color: 'text-[var(--review-amber)]',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      icon: <span className="text-xs">!</span>
    }
  }

  const stateConfig = states[state]

  return (
    <div 
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        border ${stateConfig.borderColor} ${stateConfig.bgColor} ${stateConfig.color}
        ${showAnimation && state === 'analyzing' ? 'agent-thinking' : ''}
        ${showAnimation && state === 'queued' ? 'opacity-60' : ''}
        transition-all duration-200
        ${className}
      `}
      {...props}
    >
      {stateConfig.icon}
      <span>{stateConfig.label}</span>
    </div>
  )
}