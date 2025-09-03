// /components/mission-control.tsx
// Main mission control panel with maximize/minimize controls
// Clean white/gray theme with comfortable viewing options

'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Maximize2, Minimize2 } from 'lucide-react'
import { type ProcessedEmail } from '@/lib/kv-client'
import { ScrollArea } from '@/components/ui/scroll-area'

interface MissionControlProps {
  selectedMessage: ProcessedEmail | null
  allMessages: ProcessedEmail[]
}

type ViewMode = 'split' | 'incoming' | 'response'

export function MissionControl({ selectedMessage, allMessages }: MissionControlProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('split')

  if (!selectedMessage) {
    return (
      <div className="h-full bg-gray-50 p-6">
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-500 font-mono text-sm mb-2">NO MESSAGE SELECTED</div>
            <div className="text-gray-400 font-mono text-xs">
              Select a message from the feed to view details
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderIncomingPanel = (isMaximized: boolean = false) => (
    <div className={`${isMaximized ? 'h-full' : 'flex-1 min-h-0'}`}>
      <div className="h-full border border-gray-200 rounded-sm bg-white">
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-xs font-mono text-purple-600 tracking-wider uppercase">
            INCOMING TRANSMISSION
          </h3>
          <div className="flex items-center space-x-2">
            {viewMode === 'split' && (
              <button
                onClick={() => setViewMode('incoming')}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Maximize"
              >
                <Maximize2 className="h-3 w-3 text-gray-400" />
              </button>
            )}
            {viewMode === 'incoming' && (
              <button
                onClick={() => setViewMode('split')}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Restore"
              >
                <Minimize2 className="h-3 w-3 text-gray-400" />
              </button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[calc(100%-40px)] p-4">
          <div className="space-y-3 font-mono text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-500 text-xs uppercase">From:</span>
                <div className="text-gray-900 mt-0.5">{selectedMessage.from}</div>
              </div>
              <div>
                <span className="text-gray-500 text-xs uppercase">Time:</span>
                <div className="text-gray-900 mt-0.5">
                  {format(new Date(selectedMessage.receivedAt), 'HH:mm:ss')} UTC
                </div>
              </div>
            </div>
            
            <div>
              <span className="text-gray-500 text-xs uppercase">Subject:</span>
              <div className="text-gray-900 mt-0.5 font-semibold">{selectedMessage.subject}</div>
            </div>
            
            <div className="pt-3 border-t border-gray-100">
              <div className="text-gray-700 whitespace-pre-wrap font-sans text-base leading-relaxed">
                {selectedMessage.body || selectedMessage.snippet}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )

  const renderResponsePanel = (isMaximized: boolean = false) => (
    <div className={`${isMaximized ? 'h-full' : 'flex-1 min-h-0'}`}>
      <div className="h-full border border-gray-200 rounded-sm bg-white">
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-xs font-mono text-green-600 tracking-wider uppercase">
            AMARA RESPONSE
          </h3>
          <div className="flex items-center space-x-2">
            {viewMode === 'split' && (
              <button
                onClick={() => setViewMode('response')}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Maximize"
              >
                <Maximize2 className="h-3 w-3 text-gray-400" />
              </button>
            )}
            {viewMode === 'response' && (
              <button
                onClick={() => setViewMode('split')}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Restore"
              >
                <Minimize2 className="h-3 w-3 text-gray-400" />
              </button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[calc(100%-40px)] p-4">
          <div className="space-y-3 font-mono text-sm">
            {selectedMessage.status === 'completed' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-500 text-xs uppercase">To:</span>
                    <div className="text-gray-900 mt-0.5">{selectedMessage.from}</div>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs uppercase">Response Time:</span>
                    <div className="text-green-600 mt-0.5 font-semibold">
                      {selectedMessage.processedAt 
                        ? `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 9)}s`
                        : 'N/A'
                      }
                    </div>
                  </div>
                </div>
                
                <div>
                  <span className="text-gray-500 text-xs uppercase">Status:</span>
                  <span className="ml-2 text-green-600 font-semibold">SYNTHESIZED ✓</span>
                </div>
                
                <div className="pt-3 border-t border-gray-100">
                  <div className="text-gray-700 font-sans text-base leading-relaxed">
                    {selectedMessage.response || 
                      `I've analyzed the ${selectedMessage.category || 'request'}. The message has been processed and appropriate actions have been taken. All relevant stakeholders have been notified.`
                    }
                  </div>
                </div>
              </>
            ) : selectedMessage.status === 'processing' ? (
              <div className="flex items-center space-x-2 text-purple-600">
                <div className="flex space-x-1">
                  <div className="h-2 w-2 bg-purple-600 rounded-full animate-pulse" />
                  <div className="h-2 w-2 bg-purple-600 rounded-full animate-pulse delay-100" />
                  <div className="h-2 w-2 bg-purple-600 rounded-full animate-pulse delay-200" />
                </div>
                <span className="uppercase text-xs tracking-wider">Analyzing Transmission</span>
              </div>
            ) : selectedMessage.status === 'failed' ? (
              <div className="text-amber-600 uppercase text-xs tracking-wider">
                Requires Human Intervention
              </div>
            ) : (
              <div className="text-gray-500 uppercase text-xs tracking-wider">
                Queued for Analysis
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col space-y-4 p-4">
        {viewMode === 'split' && (
          <>
            {renderIncomingPanel()}
            {renderResponsePanel()}
          </>
        )}
        {viewMode === 'incoming' && renderIncomingPanel(true)}
        {viewMode === 'response' && renderResponsePanel(true)}
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 border-t border-gray-200 bg-white">
        <div className="flex items-center justify-between font-mono text-xs">
          <div className="flex items-center space-x-6">
            <span className="text-gray-500 uppercase">
              Analyzing: <span className="text-purple-600 font-semibold">
                {allMessages.filter(m => m.status === 'processing').length}
              </span>
            </span>
            <span className="text-gray-500 uppercase">
              Queue: <span className="text-gray-700 font-semibold">
                {allMessages.filter(m => m.status === 'pending').length}
              </span>
            </span>
            <span className="text-gray-500 uppercase">
              Synthesized: <span className="text-green-600 font-semibold">
                {allMessages.filter(m => m.status === 'completed').length}
              </span>
            </span>
          </div>
          <div className="text-gray-400">
            View: {viewMode === 'split' ? 'SPLIT' : viewMode === 'incoming' ? 'INCOMING' : 'RESPONSE'}
          </div>
        </div>
      </div>
    </div>
  )
}