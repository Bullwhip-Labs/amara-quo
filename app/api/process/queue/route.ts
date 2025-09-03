// /app/api/process/queue/route.ts
// API route for batch processing of pending emails
// Processes all pending emails in the queue

import { NextRequest, NextResponse } from 'next/server'
import { emailProcessor } from '@/lib/services/processor'

export async function POST(request: NextRequest) {
  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { 
          error: 'OpenAI API not configured',
          message: 'Please add OPENAI_API_KEY to your environment variables'
        },
        { status: 503 }
      )
    }

    console.log('📮 API: Starting batch processing of email queue')
    
    // Get queue stats before processing
    const beforeStats = await emailProcessor.getQueueStats()
    console.log('📊 Queue stats before processing:', beforeStats)

    // Process the queue
    const results = await emailProcessor.processQueue()

    // Get queue stats after processing
    const afterStats = await emailProcessor.getQueueStats()
    console.log('📊 Queue stats after processing:', afterStats)

    // Calculate summary
    const summary = {
      processed: results.length,
      successful: results.filter(r => r.status === 'completed').length,
      failed: results.filter(r => r.status === 'failed').length,
      manualReview: results.filter(r => r.status === 'manual-review').length,
      remainingPending: afterStats.pending,
      totalCompleted: afterStats.completed
    }

    console.log('✅ Batch processing complete:', summary)

    // Return detailed results
    return NextResponse.json({
      success: true,
      summary,
      results: results.map(r => ({
        emailId: r.emailId,
        status: r.status,
        hasResponse: !!r.response,
        tokenUsage: r.tokenUsage,
        processingTime: r.processingTime,
        error: r.error
      })),
      stats: {
        before: beforeStats,
        after: afterStats
      }
    })

  } catch (error) {
    console.error('Batch processing API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to process email queue',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check queue status
export async function GET() {
  try {
    const stats = await emailProcessor.getQueueStats()
    const tokenUsage = await emailProcessor.getTotalTokenUsage()

    return NextResponse.json({
      queue: stats,
      tokenUsage,
      openAIConfigured: !!process.env.OPENAI_API_KEY
    })

  } catch (error) {
    console.error('Queue status error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to get queue status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}