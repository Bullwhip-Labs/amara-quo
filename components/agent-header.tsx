// /components/agent-header.tsx
// Amara QUO command center header - NASA mission control style
// Clean white/gray theme with better organization

'use client'

import { useEffect, useState } from 'react'

interface AgentHeaderProps {
  totalIntel: number
  analyzedCount: number
  avgResponseTime: number
  activeProcessing: number
}

export function AgentHeader({ 
  totalIntel, 
  analyzedCount, 
  avgResponseTime,
  activeProcessing
}: AgentHeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between h-14">
        {/* Left: System Name - Fixed to left edge */}
        <div className="flex items-center">
          <div className="px-6 border-r border-gray-200 h-14 flex items-center">
            <h1 className="text-xl font-light tracking-[0.3em] text-gray-900">
              AMARA QUO
            </h1>
          </div>
          
          {/* Processing Indicator */}
          {activeProcessing > 0 && (
            <div className="flex items-center space-x-2 px-4">
              <div className="h-2 w-2 bg-purple-600 rounded-full animate-pulse" />
              <span className="text-xs text-purple-600 font-mono uppercase">
                Processing {activeProcessing}
              </span>
            </div>
          )}
        </div>

        {/* Right: Organized Metrics */}
        <div className="flex items-center h-14">
          {/* Metric Group 1: Activity */}
          <div className="px-6 border-l border-gray-200 h-14 flex items-center">
            <div className="space-y-0.5">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Intelligence</div>
              <div className="font-mono text-lg text-gray-900">{totalIntel}</div>
            </div>
          </div>

          {/* Metric Group 2: Completed */}
          <div className="px-6 border-l border-gray-200 h-14 flex items-center">
            <div className="space-y-0.5">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Analyzed</div>
              <div className="font-mono text-lg text-green-600">{analyzedCount}</div>
            </div>
          </div>

          {/* Metric Group 3: Performance */}
          <div className="px-6 border-l border-gray-200 h-14 flex items-center">
            <div className="space-y-0.5">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Avg Response</div>
              <div className="font-mono text-lg text-gray-900">{avgResponseTime.toFixed(1)}s</div>
            </div>
          </div>

          {/* Clock */}
          <div className="px-6 border-l border-gray-200 h-14 flex items-center bg-gray-50">
            <div className="font-mono text-sm text-gray-600">
              {currentTime.toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
              })} UTC
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}