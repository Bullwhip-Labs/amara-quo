// /app/test/processing/page.tsx
// Test page for LLM processing functionality
// Allows testing of email processing with OpenAI

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Send, Zap, AlertTriangle, Info } from 'lucide-react'

export default function ProcessingTestPage() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')

  // Fetch current statistics on mount
  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/process/stats')
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const testSingleEmail = async () => {
    setIsProcessing(true)
    setMessage('')

    try {
      // First, add a test email
      const testEmail = {
        id: `test-llm-${Date.now()}`,
        threadId: `test-llm-${Date.now()}`,
        subject: "Test: Quarterly budget review meeting",
        from: "Sarah Johnson <sarah@company.com>",
        to: "team@company.com",
        date: new Date().toISOString(),
        snippet: "Hi team, I wanted to schedule our quarterly budget review meeting...",
        body: `Hi team,

I wanted to schedule our quarterly budget review meeting for next week. We need to discuss:

1. Current quarter spending vs. budget
2. Upcoming projects and their budget requirements
3. Cost optimization opportunities
4. Next quarter's budget allocation

Please let me know your availability for a 90-minute meeting between Tuesday and Thursday.

Also, please prepare a brief summary of your department's spending and any concerns you'd like to address.

Best regards,
Sarah`,
        receivedAt: new Date().toISOString(),
        historyId: Math.floor(Math.random() * 10000),
      }

      // Add the email
      const addResponse = await fetch('/api/emails/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testEmail),
      })

      if (!addResponse.ok) throw new Error('Failed to add test email')

      // Process the email
      const processResponse = await fetch(`/api/process/${testEmail.id}`, {
        method: 'POST'
      })

      const processData = await processResponse.json()

      if (processResponse.ok) {
        setMessage(`✅ Email processed successfully!\n\nResponse:\n${processData.response}\n\nTokens used: ${processData.tokenUsage?.total || 'N/A'}`)
        setMessageType('success')
      } else {
        setMessage(`Failed to process: ${processData.message}`)
        setMessageType('error')
      }

      // Refresh stats
      await fetchStats()

    } catch (error) {
      console.error('Error in test:', error)
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setMessageType('error')
    } finally {
      setIsProcessing(false)
    }
  }

  const processAllPending = async () => {
    setIsProcessing(true)
    setMessage('')

    try {
      const response = await fetch('/api/process/queue', {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        if (data.stats.total > 0) {
          setMessage(`Processed ${data.stats.total} emails:\n✅ Successful: ${data.stats.successful}\n❌ Failed: ${data.stats.failed}`)
          setMessageType('success')
        } else {
          setMessage('No pending emails to process')
          setMessageType('info')
        }
      } else {
        setMessage(`Failed: ${data.message}`)
        setMessageType('error')
      }

      // Refresh stats
      await fetchStats()

    } catch (error) {
      console.error('Error processing queue:', error)
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setMessageType('error')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">LLM Processing Test</h1>
        <p className="text-[var(--color-muted)]">
          Test the OpenAI integration and email processing pipeline
        </p>
      </div>

      {/* Configuration Status */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Status</CardTitle>
          <CardDescription>
            Check your OpenAI setup and processing statistics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="font-semibold">System Status</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    {stats.status.openAIConfigured ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    )}
                    <span>OpenAI API: {stats.status.openAIConfigured ? 'Configured' : 'Not Configured'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-600" />
                    <span>Model: {stats.status.model}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Processing Stats</h3>
                <div className="space-y-1 text-sm">
                  <div>Pending: {stats.processing.pending}</div>
                  <div>Completed: {stats.processing.completed}</div>
                  <div>Failed: {stats.processing.failed}</div>
                  <div>Success Rate: {stats.processing.successRate}%</div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Token Usage</h3>
                <div className="space-y-1 text-sm">
                  <div>Total Tokens: {stats.tokenUsage.totalTokens}</div>
                  <div>Emails Processed: {stats.tokenUsage.emailsProcessed}</div>
                  <div>Avg Tokens/Email: {stats.tokenUsage.averageTokensPerEmail}</div>
                  <div>Est. Cost: ${stats.tokenUsage.estimatedCost}</div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Cost Analysis</h3>
                <div className="space-y-1 text-sm">
                  <div>Cost per Email: ${stats.tokenUsage.costPerEmail}</div>
                  <div>Total Cost: ${stats.tokenUsage.estimatedCost}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              Loading statistics...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Test Processing</CardTitle>
          <CardDescription>
            Test the LLM processing pipeline with sample emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!stats?.status.openAIConfigured && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">OpenAI API Not Configured</p>
                  <p className="text-sm text-amber-800 mt-1">
                    Add your OpenAI API key to .env.local:
                  </p>
                  <code className="block mt-2 p-2 bg-white rounded text-xs">
                    OPENAI_API_KEY=sk-...
                  </code>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <button
              onClick={testSingleEmail}
              disabled={isProcessing || !stats?.status.openAIConfigured}
              className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-purple-600 px-4 py-3 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
              {isProcessing ? 'Processing...' : 'Test Single Email'}
            </button>

            <button
              onClick={processAllPending}
              disabled={isProcessing || !stats?.status.openAIConfigured || stats?.processing.pending === 0}
              className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-zinc-900 px-4 py-3 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Zap className="h-4 w-4" />
              {isProcessing ? 'Processing...' : `Process All (${stats?.processing.pending || 0})`}
            </button>
          </div>

          {message && (
            <div className={`rounded-[var(--radius-md)] p-4 whitespace-pre-wrap ${
              messageType === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 
              messageType === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 
              'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              <p className="text-sm font-mono">{message}</p>
            </div>
          )}

          <button
            onClick={fetchStats}
            className="text-sm text-purple-600 hover:text-purple-700"
          >
            Refresh Statistics
          </button>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-semibold">1. Get OpenAI API Key</p>
            <p className="text-gray-600">Visit <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">platform.openai.com/api-keys</a> to create an API key</p>
          </div>
          
          <div>
            <p className="font-semibold">2. Configure Environment</p>
            <p className="text-gray-600">Add to your <code className="bg-gray-100 px-1 rounded">.env.local</code>:</p>
            <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
{`OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=500`}
            </pre>
          </div>

          <div>
            <p className="font-semibold">3. Test Processing</p>
            <p className="text-gray-600">Click "Test Single Email" to process a sample email with the LLM</p>
          </div>

          <div>
            <p className="font-semibold">4. Monitor Dashboard</p>
            <p className="text-gray-600">Return to the main dashboard to see processed emails and responses</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}