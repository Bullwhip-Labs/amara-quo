// /app/test/page.tsx
// Test page for adding sample emails to the system
// Useful for development and testing the dashboard

'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Send } from 'lucide-react'

// Static sample email for display purposes
const displaySampleEmail = {
  id: "sample-email-id",
  threadId: "sample-thread-id",
  subject: "Fwd: Important: Platform maintenance on September 6, 5:30-7:30 a.m. UTC 🔧",
  from: "Rahul Singh <rahul@thinkqai.com>",
  to: "\"amarathinkq@gmail.com\" <amarathinkq@gmail.com>",
  date: "Tue, 2 Sep 2025 19:37:03 -0500",
  snippet: "Check this out ---------- Forwarded message --------- From: Remote &lt;no-reply@remote.com&gt; Date: Thu, Aug 28, 2025 at 8:19 AM Subject: Important: Platform maintenance on September 6, 5:30-7:30 am",
  body: "Check this out\r\n\r\n---------- Forwarded message ---------\r\nFrom: Remote <no-reply@remote.com>\r\nDate: Thu, Aug 28, 2025 at 8:19 AM\r\nSubject: Important: Platform maintenance on September 6, 5:30-7:30 a.m. UTC\r\n🔧\r\nTo: Rahul Singh <rahul@thinkqai.com>\r\n\r\n\r\n[image: Remote.com] <https://remote.com>\r\nImportant: Platform maintenance on September 6, 5:30-7:30 a.m. UTC 🔧\r\n\r\n*Summary:* 📝 Remote will be unavailable for 2 hours during our database\r\nupgrade on Saturday, September 6 at 5:30 a.m. UTC. No actions can be\r\nperformed during this time.\r\n\r\nHello 👋\r\n\r\nOn Saturday, September 6, 2025 at 5:30 a.m. UTC, we are upgrading our\r\ndatabase engine to improve the performance, security, and reliability of\r\nour platform.",
  receivedAt: "2025-09-03T00:37:18.839Z",
  historyId: 2869
}

export default function TestPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const addTestEmail = async () => {
    setIsSubmitting(true)
    setMessage('')

    try {
      // Generate a unique email with current timestamp (on client side only)
      const testEmail = {
        ...displaySampleEmail,
        id: `test-${Date.now()}`,
        threadId: `test-${Date.now()}`,
        receivedAt: new Date().toISOString(),
        historyId: Math.floor(Math.random() * 10000),
      }

      const response = await fetch('/api/emails/poll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testEmail),
      })

      if (!response.ok) throw new Error('Failed to add email')

      setMessage('Test email added successfully! Check the dashboard.')
    } catch (error) {
      console.error('Error adding test email:', error)
      setMessage('Failed to add test email. Please check the console.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const addMultipleEmails = async () => {
    setIsSubmitting(true)
    setMessage('')

    try {
      const emails = [
        {
          subject: "Weekly team sync meeting notes",
          from: "Jane Doe <jane@example.com>",
          snippet: "Here are the key points from today's meeting...",
        },
        {
          subject: "Alert: Server CPU usage at 95%",
          from: "Monitoring System <alerts@monitoring.com>",
          snippet: "Warning: Server prod-01 CPU usage has exceeded threshold...",
        },
        {
          subject: "Invoice #INV-2025-001 is ready",
          from: "Billing Department <billing@company.com>",
          snippet: "Your monthly invoice for August 2025 is now available...",
        },
      ]

      for (const emailData of emails) {
        const testEmail = {
          ...displaySampleEmail,
          ...emailData,
          id: `test-${Date.now()}-${Math.random()}`,
          threadId: `test-${Date.now()}-${Math.random()}`,
          to: "test@example.com",
          date: new Date().toISOString(),
          body: emailData.snippet + "\n\nFull email content here...",
          receivedAt: new Date().toISOString(),
          historyId: Math.floor(Math.random() * 10000),
        }

        await fetch('/api/emails/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testEmail),
        })

        // Small delay between emails
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      setMessage('3 test emails added successfully! Check the dashboard.')
    } catch (error) {
      console.error('Error adding test emails:', error)
      setMessage('Failed to add test emails. Please check the console.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Test Email Generator</h1>
        <p className="text-[var(--color-muted)]">
          Add sample emails to test the dashboard functionality
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Test Emails</CardTitle>
          <CardDescription>
            Click the buttons below to add sample emails to your Upstash store
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <button
              onClick={addTestEmail}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-zinc-900 px-4 py-3 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
              {isSubmitting ? 'Adding...' : 'Add Single Test Email'}
            </button>

            <button
              onClick={addMultipleEmails}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-zinc-100 px-4 py-3 text-zinc-900 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
              {isSubmitting ? 'Adding...' : 'Add 3 Different Emails'}
            </button>
          </div>

          {message && (
            <div className={`flex items-center gap-2 rounded-[var(--radius-md)] p-3 ${
              message.includes('successfully') 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {message.includes('successfully') && <CheckCircle className="h-4 w-4" />}
              <p className="text-sm font-medium">{message}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sample Email Structure</CardTitle>
          <CardDescription>
            This is the structure of emails being added to the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-[var(--radius-md)] bg-zinc-100 p-4 text-xs">
            {JSON.stringify(displaySampleEmail, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>1. Make sure your Upstash/Vercel KV credentials are configured in <code className="rounded bg-zinc-100 px-1 py-0.5">.env.local</code></p>
          <p>2. Click one of the buttons above to add test emails</p>
          <p>3. Navigate to the Dashboard to see the emails appear</p>
          <p>4. The dashboard will automatically poll for new emails every 30 seconds</p>
        </CardContent>
      </Card>
    </div>
  )
}