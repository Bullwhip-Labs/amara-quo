// /lib/services/llm-prompts.ts
// Centralized prompts for LLM services
// Separating prompts from code for better maintainability

export interface EmailContext {
  from: string
  subject: string
  receivedAt: string
  body: string
}

export class LLMPrompts {
  /**
   * Get the system prompt for Amara QUO
   */
  static getSystemPrompt(): string {
    return `You are Amara QUO, a savvy and professional sales representative AI assistant.

Your responsibilities:
1. Provide appropriate quotes, responses, or actions based on email intent and urgency
3. Be concise (100 words) unless complexity demands more detail
4. Be a professional while being personable and helpful

Key guidelines:
- Always provide response with bullet points, call out key point in bold
- Create a table if needed
- Use markdown for the above`
  }

  /**
   * Format email content for processing
   */
  static formatEmailForProcessing(email: EmailContext): string {
    return `From: ${email.from}
Subject: ${email.subject}
Received: ${new Date(email.receivedAt).toLocaleString()}

Message:
${email.body}

Please analyze this email and provide an appropriate response.`
  }

  /**
   * Get structured output schema for GPT-4 models
   */
  static getStructuredOutputSchema() {
    return {
      type: "json_schema",
      json_schema: {
        name: "email_response",
        strict: true,
        schema: {
          type: "object",
          properties: {
            response: {
              type: "string",
              description: "The main response content to send back to the email sender"
            },
            category: {
              type: "string",
              enum: ["inquiry", "complaint", "request_quote", "scheduling", "technical_support", "general", "urgent"],
              description: "Category of the email for internal tracking"
            },
            priority: {
              type: "integer",
              minimum: 1,
              maximum: 5,
              description: "Priority level (1=highest, 5=lowest)"
            },
            requires_followup: {
              type: "boolean",
              description: "Whether this email requires manual follow-up"
            },
            sentiment: {
              type: "string",
              enum: ["positive", "neutral", "negative"],
              description: "Detected sentiment of the incoming email"
            },
            suggested_actions: {
              type: "array",
              items: {
                type: "string"
              },
              description: "List of suggested follow-up actions"
            }
          },
          required: ["response", "category", "priority", "requires_followup", "sentiment", "suggested_actions"],
          additionalProperties: false
        }
      }
    }
  }

  /**
   * Get a simplified prompt for testing
   */
  static getTestPrompt(): string {
    return "You are a helpful assistant. Respond briefly and professionally."
  }

  /**
   * Parse response based on model type
   */
  static parseModelResponse(data: any, modelType: 'gpt-4' | 'gpt-5'): string {
    if (modelType === 'gpt-4') {
      // GPT-4 uses choices array
      if (data.choices?.[0]?.message?.content) {
        // Check if it's JSON (structured output)
        try {
          const parsed = JSON.parse(data.choices[0].message.content)
          return parsed.response || data.choices[0].message.content
        } catch {
          return data.choices[0].message.content
        }
      }
    } else if (modelType === 'gpt-5') {
      // GPT-5 uses output_text or output array
      if (data.output_text) {
        return data.output_text
      } else if (data.output?.[0]?.content?.[0]?.text) {
        return data.output[0].content[0].text
      }
    }
    
    throw new Error('Unable to parse model response')
  }
}

export default LLMPrompts