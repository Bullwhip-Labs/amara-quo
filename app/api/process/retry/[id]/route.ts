// /app/api/process/retry/[id]/route.ts
// API route to retry failed email processing
// Handles retry requests for emails that failed processing

import { NextRequest, NextResponse } from 'next/server'
import { emailProcessor } from '@/lib/services/email/processor'

// POST /api/process/retry/[id] - Retry processing for a failed email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Email ID is required' },
        { status: 400 }
      )
    }

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

    console.log(`🔄 API: Retrying email ${id}`)
    
    // Retry processing the email
    const result = await emailProcessor.retryEmail(id)

    // Return appropriate status code based on result
    const statusCode = result.status === 'completed' ? 200 : 
                       result.status === 'failed' ? 500 : 
                       202 // Accepted for processing

    return NextResponse.json({
      success: result.status === 'completed',
      ...result
    }, { status: statusCode })

  } catch (error) {
    console.error('Retry API error:', error)
    
    // Check for specific error messages
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const statusCode = errorMessage.includes('not found') ? 404 :
                       errorMessage.includes('Cannot retry') ? 400 : 500
    
    return NextResponse.json(
      { 
        error: 'Failed to retry email processing',
        message: errorMessage
      },
      { status: statusCode }
    )
  }
}