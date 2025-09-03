// /lib/services/llm-service.ts
// OpenAI GPT integration service for Amara QUO
// Handles API calls, retries, and token tracking

import { ProcessedEmail } from '@/lib/kv-client'

export interface LLMResponse {
  content: string
  tokenUsage: {
    prompt: number
    completion: number
    total: number
  }
  model: string
  processingTime: number
}

export interface LLMError {
  code: 'rate_limit' | 'api_error' | 'invalid_request' | 'timeout'
  message: string
  retryAfter?: number
}

class LLMService {
  private apiKey: string
  private model: string
  private maxTokens: number
  private systemPrompt: string
  private maxRetries: number = 3
  private baseDelay: number = 1000 // 1 second

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || ''
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '500')
    this.systemPrompt = process.env.SYSTEM_PROMPT || this.getDefaultSystemPrompt()

    if (!this.apiKey) {
      console.warn('⚠️ OPENAI_API_KEY not configured')
    }
  }

  private getDefaultSystemPrompt(): string {
    return `You are Amara QUO, an intelligent email assistant. Your role is to:
1. Analyze incoming emails and understand their context and urgency
2. Provide helpful, professional, and concise responses
3. Identify action items and key information
4. Maintain a friendly yet professional tone
5. Keep responses under 150 words unless complexity demands more

Always be respectful, clear, and actionable in your responses.`
  }

  /**
   * Build the prompt for the LLM
   */
  buildPrompt(email: ProcessedEmail): { system: string; user: string } {
    const user = `
From: ${email.from}
Subject: ${email.subject}
Received: ${new Date(email.receivedAt).toLocaleString()}

Message:
${email.body || email.snippet}

Please analyze this email and provide an appropriate response.`

    return {
      system: this.systemPrompt,
      user: user.trim()
    }
  }

  /**
   * Process an email with GPT
   */
  async processEmail(email: ProcessedEmail): Promise<LLMResponse> {
    const startTime = Date.now()
    const prompt = this.buildPrompt(email)

    try {
      const response = await this.callOpenAI(prompt)
      
      return {
        ...response,
        processingTime: Date.now() - startTime
      }
    } catch (error) {
      console.error('LLM processing failed:', error)
      throw this.normalizeError(error)
    }
  }

  /**
   * Make the actual API call to OpenAI with retry logic
   */
  private async callOpenAI(
    prompt: { system: string; user: string },
    attempt: number = 1
  ): Promise<LLMResponse> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user }
          ],
          max_completion_tokens: this.maxTokens
          // Removed temperature and top_p as they're not supported by all models
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '60')
          if (attempt < this.maxRetries) {
            await this.delay(retryAfter * 1000)
            return this.callOpenAI(prompt, attempt + 1)
          }
          throw { code: 'rate_limit', message: 'Rate limit exceeded', retryAfter }
        }

        // Handle other errors with retry
        if (response.status >= 500 && attempt < this.maxRetries) {
          await this.delay(this.baseDelay * Math.pow(2, attempt - 1))
          return this.callOpenAI(prompt, attempt + 1)
        }

        throw {
          code: response.status >= 500 ? 'api_error' : 'invalid_request',
          message: error.error?.message || `API error: ${response.status}`
        }
      }

      const data = await response.json()
      
      return {
        content: data.choices[0]?.message?.content || '',
        tokenUsage: {
          prompt: data.usage?.prompt_tokens || 0,
          completion: data.usage?.completion_tokens || 0,
          total: data.usage?.total_tokens || 0
        },
        model: data.model || this.model,
        processingTime: 0 // Will be set by caller
      }
    } catch (error) {
      // If it's already a structured error, rethrow it
      if ((error as any).code) {
        throw error
      }
      
      // Network or timeout errors
      if (attempt < this.maxRetries) {
        await this.delay(this.baseDelay * Math.pow(2, attempt - 1))
        return this.callOpenAI(prompt, attempt + 1)
      }
      
      throw {
        code: 'timeout',
        message: 'Request timeout or network error'
      }
    }
  }

  /**
   * Normalize errors to LLMError format
   */
  private normalizeError(error: any): LLMError {
    if (error.code) {
      return error as LLMError
    }

    return {
      code: 'api_error',
      message: error.message || 'Unknown error occurred'
    }
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Calculate estimated cost based on token usage
   */
  calculateCost(tokenUsage: LLMResponse['tokenUsage']): number {
    // Rough estimates - adjust based on actual model pricing
    const costPer1kPrompt = 0.0001 // $0.0001 per 1k tokens
    const costPer1kCompletion = 0.0002 // $0.0002 per 1k tokens
    
    const promptCost = (tokenUsage.prompt / 1000) * costPer1kPrompt
    const completionCost = (tokenUsage.completion / 1000) * costPer1kCompletion
    
    return promptCost + completionCost
  }
}

// Export singleton instance
export const llmService = new LLMService()