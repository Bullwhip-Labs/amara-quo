// /app/api/process/reset/[id]/route.ts
// API route to reset an email status back to pending
// Allows reprocessing of completed emails

import { NextRequest, NextResponse } from 'next/server'
import { emailStore } from '@/lib/kv-client'

// POST /api/process/reset/[id] - Reset email to pending status
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

    console.log(`🔄 Resetting email ${id} to pending status`)

    // Get the email to check it exists
    const email = await emailStore.getEmail(id)
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      )
    }

    const previousStatus = email.status
    const previousResponse = email.response

    // Reset the email status to pending, clearing previous processing data
    await emailStore.updateEmailStatus(id, 'pending', {
      error: undefined,
      response: undefined,
      processedAt: undefined,
      tokenUsage: undefined,
      processingTime: undefined
    })

    console.log(`✅ Email reset from ${previousStatus} to pending`)
    
    if (previousResponse) {
      console.log(`   Previous response cleared (was ${previousResponse.length} chars)`)
    }

    return NextResponse.json({
      success: true,
      emailId: id,
      previousStatus,
      newStatus: 'pending',
      message: `Email reset to pending status for reprocessing`
    })

  } catch (error) {
    console.error('Reset API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to reset email',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET /api/process/reset/[id] - Check if email can be reset
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

    const email = await emailStore.getEmail(id)
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      )
    }

    const canReset = email.status === 'completed' || 
                     email.status === 'failed' || 
                     email.status === 'manual-review'

    return NextResponse.json({
      emailId: id,
      currentStatus: email.status,
      canReset,
      hasResponse: !!email.response,
      responseLength: email.response?.length || 0,
      tokenUsage: email.tokenUsage
    })

  } catch (error) {
    console.error('Reset check error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to check reset status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}