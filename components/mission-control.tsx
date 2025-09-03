// /components/mission-control.tsx
// Main mission control panel with proper 50-50 split layout
// Complete version with Process, Retry, and Rerun buttons with Markdown support

'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Maximize2, Minimize2, Send, RefreshCw, AlertTriangle, GripVertical } from 'lucide-react'
import { type ProcessedEmail } from '@/lib/kv-client'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MarkdownRenderer } from '@/components/markdown-renderer'
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
  const [splitRatio, setSplitRatio] = useState(50) // Percentage for left panel

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
        console.log('📧 Processed email response:', {
          emailId: selectedMessage.id,
          response: data.response,
          fullData: data
        })
        onRefresh?.()
      } else {
        toast.error(data.message || 'Failed to process email')
        console.error('Processing failed:', data)
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
        console.log('🔄 Retry email response:', {
          emailId: selectedMessage.id,
          response: data.response,
          fullData: data
        })
        onRefresh?.()
      } else {
        toast.error(data.message || 'Failed to retry')
        console.error('Retry failed:', data)
      }
    } catch (error) {
      console.error('Retry error:', error)
      toast.error('Failed to retry processing')
    } finally {
      setIsRetrying(false)
    }
  }

  // Handle rerunning processing for a completed email
  const handleRerunEmail = async () => {
    if (!selectedMessage) return
    
    setIsProcessing(true)
    try {
      // First reset the email status to pending
      const resetResponse = await fetch(`/api/process/reset/${selectedMessage.id}`, {
        method: 'POST'
      })
      
      if (!resetResponse.ok) {
        const resetData = await resetResponse.json()
        toast.error(resetData.message || 'Failed to reset email')
        return
      }

      // Then process it again
      const response = await fetch(`/api/process/${selectedMessage.id}`, {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success('Email reprocessed successfully!')
        console.log('🔄 Rerun email response:', {
          emailId: selectedMessage.id,
          response: data.response,
          fullData: data
        })
        onRefresh?.()
      } else {
        toast.error(data.message || 'Failed to reprocess email')
        console.error('Reprocessing failed:', data)
      }
    } catch (error) {
      console.error('Rerun error:', error)
      toast.error('Failed to reprocess email')
    } finally {
      setIsProcessing(false)
    }
  }

  const canProcess = selectedMessage && selectedMessage.status === 'pending'
  const canRetry = selectedMessage && (
    selectedMessage.status === 'failed' || 
    selectedMessage.status === 'manual-review'
  )
  const canRerun = selectedMessage && selectedMessage.status === 'completed'

  if (!selectedMessage) {
    return (
      <div className="h-full bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 font-mono text-sm mb-2">NO MESSAGE SELECTED</div>
          <div className="text-gray-400 font-mono text-xs">
            Select a message from the feed to view details
          </div>
        </div>
      </div>
    )
  }

  const renderIncomingPanel = () => (
    <div className="h-full flex flex-col border border-gray-200 rounded-sm bg-white">
      {/* Header */}
      <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <h3 className="text-xs font-mono text-purple-600 tracking-wider uppercase">
          INCOMING TRANSMISSION
        </h3>
        <div className="flex items-center space-x-2">
          {canProcess && (
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
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-3 font-mono text-sm">
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
            
            <div>
              <span className="text-gray-500 text-xs uppercase">Status:</span>
              <div className={`mt-0.5 font-semibold ${
                selectedMessage.status === 'pending' ? 'text-gray-600' :
                selectedMessage.status === 'processing' ? 'text-purple-600' :
                selectedMessage.status === 'completed' ? 'text-green-600' :
                selectedMessage.status === 'failed' ? 'text-red-600' :
                'text-amber-600'
              }`}>
                {selectedMessage.status.toUpperCase()}
              </div>
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

  const renderResponsePanel = () => (
    <div className="h-full flex flex-col border border-gray-200 rounded-sm bg-white">
      {/* Header */}
      <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <h3 className="text-xs font-mono text-green-600 tracking-wider uppercase">
          AMARA RESPONSE
        </h3>
        <div className="flex items-center space-x-2">
          {/* Retry button for failed emails */}
          {canRetry && (
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
          {/* Rerun button for completed emails */}
          {canRerun && (
            <button
              onClick={handleRerunEmail}
              disabled={isProcessing}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              title="Rerun Processing with LLM"
            >
              <RefreshCw className="h-3 w-3" />
              {isProcessing ? 'Reprocessing...' : 'Rerun'}
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
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-3 font-mono text-sm">
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
                  {selectedMessage.processingTime && selectedMessage.processingTime > 5000 && (
                    <span className="ml-2 text-xs text-blue-600">(Reprocessed)</span>
                  )}
                </div>
                
                <div className="pt-3 border-t border-gray-100">
                  <MarkdownRenderer 
                    content={selectedMessage.response || 
                      'Response data is missing. Refreshing the page may help load the response.'}
                    className="text-gray-700"
                  />
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
            ) : selectedMessage.status === 'failed' || selectedMessage.status === 'manual-review' ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="uppercase text-xs tracking-wider font-semibold">
                    {selectedMessage.status === 'failed' ? 'Processing Failed' : 'Manual Review Required'}
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
                Queued for Analysis - Click "Process" to start
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Main Content Area - HORIZONTAL LAYOUT */}
      <div className="flex-1 p-4 min-h-0">
        {viewMode === 'split' ? (
          <div className="h-full flex gap-4">
            {/* Left Panel - Incoming */}
            <div 
              className="h-full"
              style={{ width: `calc(${splitRatio}% - 8px)` }}
            >
              {renderIncomingPanel()}
            </div>
            
            {/* Resize Handle (visual only for now) */}
            <div className="flex items-center">
              <div className="h-16 w-1 bg-gray-300 rounded-full cursor-col-resize hover:bg-gray-400 transition-colors">
                <GripVertical className="h-4 w-4 text-gray-500 -ml-1.5 mt-6" />
              </div>
            </div>
            
            {/* Right Panel - Response */}
            <div 
              className="h-full"
              style={{ width: `calc(${100 - splitRatio}% - 8px)` }}
            >
              {renderResponsePanel()}
            </div>
          </div>
        ) : viewMode === 'incoming' ? (
          <div className="h-full">
            {renderIncomingPanel()}
          </div>
        ) : (
          <div className="h-full">
            {renderResponsePanel()}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 border-t border-gray-200 bg-white">
        <div className="flex items-center justify-between font-mono text-xs">
          <div className="flex items-center space-x-6">
            <span className="text-gray-500 uppercase">
              Pending: <span className="text-gray-700 font-semibold">
                {allMessages.filter(m => m.status === 'pending').length}
              </span>
            </span>
            <span className="text-gray-500 uppercase">
              Analyzing: <span className="text-purple-600 font-semibold">
                {allMessages.filter(m => m.status === 'processing').length}
              </span>
            </span>
            <span className="text-gray-500 uppercase">
              Synthesized: <span className="text-green-600 font-semibold">
                {allMessages.filter(m => m.status === 'completed').length}
              </span>
            </span>
            <span className="text-gray-500 uppercase">
              Failed: <span className="text-amber-600 font-semibold">
                {allMessages.filter(m => m.status === 'failed' || m.status === 'manual-review').length}
              </span>
            </span>
          </div>
          <div className="text-gray-400">
            View: {viewMode === 'split' ? 'SPLIT' : viewMode === 'incoming' ? 'INCOMING' : 'RESPONSE'} 
            {viewMode === 'split' && ` (${splitRatio}/${100-splitRatio})`}
          </div>
        </div>
      </div>
    </div>
  )
}