// /app/api/process/stats/route.ts
// API route for processing statistics and diagnostics
// Provides detailed information about email processing status

import { NextResponse } from 'next/server'
import { emailStore } from '@/lib/kv-client'
import { emailProcessor } from '@/lib/services/processor'

export async function GET() {
  try {
    // Check if OpenAI API is configured
    const openAIConfigured = !!process.env.OPENAI_API_KEY
    
    // Get processing statistics
    const processingStats = await emailStore.getProcessingStats()
    
    // Get token usage statistics
    const tokenStats = await emailStore.getTokenUsageStats()
    
    // Calculate costs
    const costPerToken = 0.0001 / 1000 // Rough estimate
    const estimatedCost = tokenStats.totalTokens * costPerToken
    const costPerEmail = tokenStats.emailsProcessed > 0 
      ? estimatedCost / tokenStats.emailsProcessed 
      : 0

    // Get a sample of recent emails for debugging
    const allEmails = await emailStore.getAllEmails()
    const recentEmails = allEmails.slice(0, 5).map(email => ({
      id: email.id,
      subject: email.subject,
      status: email.status,
      hasResponse: !!email.response,
      responsePreview: email.response ? email.response.substring(0, 50) + '...' : null,
      tokenUsage: email.tokenUsage,
      processingTime: email.processingTime,
      error: email.error
    }))

    const response = {
      status: {
        openAIConfigured,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        maxTokens: process.env.OPENAI_MAX_TOKENS || '500'
      },
      processing: processingStats,
      tokenUsage: {
        ...tokenStats,
        estimatedCost: estimatedCost.toFixed(4),
        costPerEmail: costPerEmail.toFixed(4)
      },
      recentEmails,
      debug: {
        totalEmails: allEmails.length,
        withResponses: allEmails.filter(e => !!e.response).length,
        withoutResponses: allEmails.filter(e => !e.response && e.status === 'completed').length
      }
    }

    console.log('📊 Processing Stats:', response)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Stats API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to get processing stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST endpoint to process all pending emails
export async function POST() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { 
          error: 'OpenAI API not configured',
          message: 'Please add OPENAI_API_KEY to your environment variables'
        },
        { status: 503 }
      )
    }

    console.log('🚀 Starting queue processing...')
    const results = await emailProcessor.processQueue()

    const stats = {
      total: results.length,
      successful: results.filter(r => r.status === 'completed').length,
      failed: results.filter(r => r.status === 'failed' || r.status === 'manual-review').length
    }

    console.log('✅ Queue processing complete:', stats)

    return NextResponse.json({
      success: true,
      results,
      stats
    })

  } catch (error) {
    console.error('Queue processing error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to process queue',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}