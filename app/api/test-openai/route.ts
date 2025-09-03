// /app/api/test-openai/route.ts
// Test endpoint to verify OpenAI connection and configuration
// Helps diagnose empty response issues

import { NextResponse } from 'next/server'
import { llmService } from '@/lib/services/llm-service'

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    const maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '500')

    console.log('🧪 Testing OpenAI configuration...')

    // First test basic connection
    const connectionTest = await llmService.testConnection()

    // Try a simple completion
    let completionTest = null
    if (connectionTest.success && apiKey) {
      try {
        console.log('🧪 Testing completion with model:', model)
        
        // Build request body - handle different parameter names
        const requestBody: any = {
          model: model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Say "Hello, this is a test response from OpenAI!"' }
          ],
          temperature: 0.7
        }

        // Use the right parameter based on model
        if (model.includes('gpt-4o')) {
          requestBody.max_completion_tokens = 50
        } else {
          requestBody.max_tokens = 50
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestBody)
        })

        const data = await response.json()

        console.log('🧪 Test completion response:', {
          status: response.status,
          ok: response.ok,
          model: data.model,
          hasChoices: !!data.choices,
          contentLength: data.choices?.[0]?.message?.content?.length || 0,
          usage: data.usage,
          error: data.error
        })

        if (response.ok) {
          completionTest = {
            success: true,
            response: data.choices?.[0]?.message?.content || 'No content',
            usage: data.usage,
            model: data.model
          }
        } else {
          completionTest = {
            success: false,
            error: data.error?.message || 'Unknown error',
            status: response.status
          }
        }
      } catch (error) {
        completionTest = {
          success: false,
          error: (error as Error).message
        }
      }
    }

    // Test with a sample email
    let emailTest = null
    if (connectionTest.success && completionTest?.success) {
      try {
        const testEmail = {
          id: 'test-email',
          threadId: 'test-thread',
          subject: 'Test Email',
          from: 'test@example.com',
          to: 'user@example.com',
          date: new Date().toISOString(),
          snippet: 'This is a test email for OpenAI processing.',
          body: 'Hello, this is a test email to verify that the OpenAI integration is working correctly. Please provide a brief response.',
          receivedAt: new Date().toISOString(),
          historyId: 1,
          status: 'pending' as const
        }

        const llmResponse = await llmService.processEmail(testEmail)
        
        emailTest = {
          success: true,
          response: llmResponse.content,
          tokenUsage: llmResponse.tokenUsage,
          processingTime: llmResponse.processingTime
        }
      } catch (error) {
        emailTest = {
          success: false,
          error: (error as Error).message
        }
      }
    }

    const result = {
      configuration: {
        hasApiKey: !!apiKey,
        model: model,
        maxTokens: maxTokens,
        apiKeyPreview: apiKey ? `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}` : null
      },
      tests: {
        connection: connectionTest,
        simpleCompletion: completionTest,
        emailProcessing: emailTest
      },
      recommendations: []
    }

    // Add recommendations based on test results
    if (!apiKey) {
      result.recommendations.push('Add OPENAI_API_KEY to your .env.local file')
    }
    if (!connectionTest.success) {
      result.recommendations.push('Check your API key is valid and has permissions')
    }
    if (completionTest && !completionTest.success) {
      result.recommendations.push('Check your model name and API quotas')
    }
    if (emailTest && !emailTest.success) {
      result.recommendations.push('Check the email processing pipeline')
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Test API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Test failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        configuration: {
          hasApiKey: !!process.env.OPENAI_API_KEY,
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
        }
      },
      { status: 500 }
    )
  }
}