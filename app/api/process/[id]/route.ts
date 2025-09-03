// /app/api/process/[id]/route.ts
// API route to trigger email processing with LLM
// Handles individual email processing requests

import { NextRequest, NextResponse } from 'next/server'
import { emailProcessor } from '@/lib/services/processor'

// POST /api/process/[id] - Process a specific email
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

    console.log(`📮 API: Processing email ${id}`)
    
    // Process the email
    const result = await emailProcessor.processEmail(id)

    // Return appropriate status code based on result
    const statusCode = result.status === 'completed' ? 200 : 
                       result.status === 'failed' ? 500 : 
                       202 // Accepted for processing

    return NextResponse.json({
      success: result.status === 'completed',
      ...result
    }, { status: statusCode })

  } catch (error) {
    console.error('Processing API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to process email',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET /api/process/[id] - Get processing status
export async function GET(
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

    const status = await emailProcessor.getStatus(id)
    
    if (!status) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      emailId: id,
      status
    })

  } catch (error) {
    console.error('Status check error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to get status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}