// /components/mission-control.tsx
// Main mission control panel with processing controls
// Clean white/gray theme with LLM response display

'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Maximize2, Minimize2, Send, RefreshCw, AlertTriangle } from 'lucide-react'
import { type ProcessedEmail } from '@/lib/kv-client'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

interface MissionControlProps {
  selectedMessage: ProcessedEmail | null
  allMessages: ProcessedEmail[]
  onRefresh?: () => void
}

type ViewMode = 'split' | 'incoming' | 'response'

export function MissionControl({ selectedMessage, allMessages, onRefresh }: MissionControlProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  // Handle processing a single email
  const handleProcessEmail = async () => {
    if (!selectedMessage) return
    
    setIsProcessing(true)
    try {
      const response = await fetch(`/api/process/${selectedMessage.id}`, {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success('Email processed successfully!')
        onRefresh?.()
      } else {
        toast.error(data.message || 'Failed to process email')
      }
    } catch (error) {
      console.error('Processing error:', error)
      toast.error('Failed to connect to processing service')
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle retrying a failed email
  const handleRetryEmail = async () => {
    if (!selectedMessage) return
    
    setIsRetrying(true)
    try {
      const response = await fetch(`/api/process/retry/${selectedMessage.id}`, {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success('Retry successful!')
        onRefresh?.()
      } else {
        toast.error(data.message || 'Failed to retry')
      }
    } catch (error) {
      console.error('Retry error:', error)
      toast.error('Failed to retry processing')
    } finally {
      setIsRetrying(false)
    }
  }

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
            {/* Process button for pending emails */}
            {selectedMessage.status === 'pending' && (
              <button
                onClick={handleProcessEmail}
                disabled={isProcessing}
                className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                title="Process with AI"
              >
                <Send className="h-3 w-3" />
                {isProcessing ? 'Processing...' : 'Process'}
              </button>
            )}
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
            {/* Retry button for failed emails */}
            {selectedMessage.status === 'failed' && (
              <button
                onClick={handleRetryEmail}
                disabled={isRetrying}
                className="px-3 py-1 bg-amber-600 text-white text-xs rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                title="Retry Processing"
              >
                <RefreshCw className="h-3 w-3" />
                {isRetrying ? 'Retrying...' : 'Retry'}
              </button>
            )}
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
                      {selectedMessage.processingTime 
                        ? `${(selectedMessage.processingTime / 1000).toFixed(1)}s`
                        : 'N/A'
                      }
                    </div>
                  </div>
                </div>
                
                {/* Token Usage Display */}
                {selectedMessage.tokenUsage && (
                  <div className="grid grid-cols-3 gap-2 p-2 bg-gray-50 rounded">
                    <div>
                      <span className="text-gray-500 text-xs uppercase">Prompt:</span>
                      <div className="text-gray-700 text-xs font-semibold">
                        {selectedMessage.tokenUsage.prompt}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs uppercase">Response:</span>
                      <div className="text-gray-700 text-xs font-semibold">
                        {selectedMessage.tokenUsage.completion}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs uppercase">Total:</span>
                      <div className="text-purple-600 text-xs font-semibold">
                        {selectedMessage.tokenUsage.total}
                      </div>
                    </div>
                  </div>
                )}
                
                <div>
                  <span className="text-gray-500 text-xs uppercase">Status:</span>
                  <span className="ml-2 text-green-600 font-semibold">SYNTHESIZED ✓</span>
                </div>
                
                <div className="pt-3 border-t border-gray-100">
                  <div className="text-gray-700 font-sans text-base leading-relaxed">
                    {selectedMessage.response || 
                      'Response data is missing. This email may have been processed before the response storage was implemented.'
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
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="uppercase text-xs tracking-wider font-semibold">
                    Processing Failed
                  </span>
                </div>
                {selectedMessage.error && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                    <span className="text-gray-500 text-xs uppercase">Error Details:</span>
                    <div className="text-amber-800 text-sm mt-1">{selectedMessage.error}</div>
                  </div>
                )}
                <div className="text-gray-600 text-xs">
                  Click "Retry" above to attempt processing again.
                </div>
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
            <span className="text-gray-500 uppercase">
              Failed: <span className="text-amber-600 font-semibold">
                {allMessages.filter(m => m.status === 'failed').length}
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