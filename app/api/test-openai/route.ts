// /app/api/test-openai/route.ts
// Test endpoint to verify OpenAI connection and configuration
// Helps diagnose empty response issues

import { NextResponse } from 'next/server'
import { llmFactory } from '@/lib/services/llm-factory'

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    const maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '500')

    console.log('🧪 Testing OpenAI configuration...')

    // Get the appropriate service
    const llmService = llmFactory.getService()
    const modelType = llmFactory.getModelType()

    // First test basic connection
    const connectionTest = await llmService.testConnection()

    // Try a simple completion
    let completionTest = null
    if (connectionTest.success && apiKey) {
      try {
        console.log('🧪 Testing completion with model:', model)
        
        // Build request body based on model type
        const requestBody: any = {
          model: model,
          temperature: 0.7
        }

        if (modelType === 'gpt-5') {
          // GPT-5 uses Responses API
          requestBody.input = [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Say "Hello, this is a test response from OpenAI!"' }
          ]
          requestBody.max_output_tokens = 50
        } else {
          // GPT-4 uses Chat Completions API
          requestBody.messages = [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Say "Hello, this is a test response from OpenAI!"' }
          ]
          requestBody.max_tokens = 50
        }

        const endpoint = modelType === 'gpt-5' 
          ? 'https://api.openai.com/v1/responses'
          : 'https://api.openai.com/v1/chat/completions'

        const response = await fetch(endpoint, {
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
          hasContent: modelType === 'gpt-5' 
            ? !!data.output_text || !!data.output 
            : !!data.choices,
          usage: data.usage,
          error: data.error
        })

        if (response.ok) {
          let content = ''
          
          if (modelType === 'gpt-5') {
            // GPT-5 response format
            content = data.output_text || data.output?.[0]?.content?.[0]?.text || 'No content'
          } else {
            // GPT-4 response format
            content = data.choices?.[0]?.message?.content || 'No content'
          }

          completionTest = {
            success: true,
            response: content,
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

    // Explicitly type the result object
    const result: {
      configuration: {
        hasApiKey: boolean
        model: string
        modelType: string
        maxTokens: number
        apiKeyPreview: string | null
        useStructuredOutput?: boolean
      }
      tests: {
        connection: typeof connectionTest
        simpleCompletion: typeof completionTest
        emailProcessing: typeof emailTest
      }
      recommendations: string[]
    } = {
      configuration: {
        hasApiKey: !!apiKey,
        model: model,
        modelType: modelType,
        maxTokens: maxTokens,
        apiKeyPreview: apiKey ? `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}` : null,
        useStructuredOutput: process.env.USE_STRUCTURED_OUTPUT === 'true'
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
    if (modelType === 'gpt-4' && model.includes('gpt-4o')) {
      result.recommendations.push('Consider enabling USE_STRUCTURED_OUTPUT=true for richer email metadata')
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
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          modelType: llmFactory.getModelType()
        }
      },
      { status: 500 }
    )
  }
}