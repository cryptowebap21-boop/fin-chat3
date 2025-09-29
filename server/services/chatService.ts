import { storage } from '../storage.js';
import { type ChatMessage } from '@shared/schema';

export class ChatService {
  private apiKey: string | null = null;
  private readonly apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly model = 'deepseek/deepseek-chat-v3.1:free';
  private readonly systemPrompt = `You are FinChat, an expert AI financial assistant specializing in cryptocurrency, stock markets, and personal finance.

Your role is to:
- Provide insights about financial markets, investments, and trading strategies
- Analyze market trends and deliver actionable analysis  
- Help users understand financial concepts and calculations
- Offer portfolio management and risk assessment guidance
- Explain tax implications and optimization strategies
- Discuss economic indicators and their market impact

Guidelines:
- Provide clear, confident analysis and recommendations
- Present objective perspectives on investment opportunities  
- Explain both opportunities and risks clearly
- Use current market data to inform your responses
- Give specific, actionable insights when possible

Current market context: You have access to real-time crypto and stock market data, news feeds, and financial calculators. Reference this data to provide accurate and timely insights.`;

  constructor() {
    if (process.env.OPENROUTER_API_KEY) {
      this.apiKey = process.env.OPENROUTER_API_KEY;
    }
  }

  async sendMessage(message: string, conversationId?: string): Promise<{ response: string; conversationId: string }> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured. Please set OPENROUTER_API_KEY environment variable.');
    }

    let conversation;
    let messages: ChatMessage[] = [];

    // Load existing conversation or create new one
    if (conversationId) {
      conversation = await storage.getChatConversation(conversationId);
      if (conversation) {
        messages = Array.isArray(conversation.messages) ? conversation.messages : [];
      }
    }

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    messages.push(userMessage);

    try {
      // Using DeepSeek model via OpenRouter for reliable chat functionality
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://finchat.app',
          'X-Title': 'FinChat'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: this.systemPrompt },
            ...messages.map(msg => ({ role: msg.role, content: msg.content }))
          ],
          max_tokens: 2000,
          stream: false
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const completion = await response.json();
      const assistantResponse = completion.choices?.[0]?.message?.content || 'I apologize, but I was unable to generate a response. Please try again.';

      // Add assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date().toISOString()
      };
      messages.push(assistantMessage);

      // Save conversation
      if (conversation) {
        conversation = await storage.updateChatConversation(conversationId!, messages);
      } else {
        conversation = await storage.saveChatConversation({ messages });
      }

      return {
        response: assistantResponse,
        conversationId: conversation.id
      };

    } catch (error) {
      console.error('OpenRouter API error:', error);
      
      // Provide helpful error message
      let errorMessage = 'I apologize, but I encountered an error while processing your request. ';
      
      if (error instanceof Error) {
        if (error.message.includes('rate limit')) {
          errorMessage += 'I\'m currently experiencing high demand. Please try again in a moment.';
        } else if (error.message.includes('quota')) {
          errorMessage += 'The AI service quota has been exceeded. Please try again later.';
        } else {
          errorMessage += 'Please try again or rephrase your question.';
        }
      }

      // Add error message to conversation
      const errorResponse: ChatMessage = {
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date().toISOString()
      };
      messages.push(errorResponse);

      // Save conversation with error
      if (conversation) {
        conversation = await storage.updateChatConversation(conversationId!, messages);
      } else {
        conversation = await storage.saveChatConversation({ messages });
      }

      return {
        response: errorMessage,
        conversationId: conversation.id
      };
    }
  }

  async streamMessage(message: string, conversationId?: string): Promise<AsyncIterableIterator<string>> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    let conversation;
    let messages: ChatMessage[] = [];

    if (conversationId) {
      conversation = await storage.getChatConversation(conversationId);
      if (conversation) {
        messages = Array.isArray(conversation.messages) ? conversation.messages : [];
      }
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    messages.push(userMessage);

    // Using DeepSeek model via OpenRouter for reliable streaming chat functionality
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://finchat.app',
        'X-Title': 'FinChat'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...messages.map(msg => ({ role: msg.role, content: msg.content }))
        ],
        max_tokens: 2000,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    return this.createStreamIterator(response, messages, conversation?.id);
  }

  private async *createStreamIterator(
    response: Response,
    messages: ChatMessage[],
    conversationId?: string
  ): AsyncIterableIterator<string> {
    let fullResponse = '';

    try {
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullResponse += content;
                yield content;
              }
            } catch (e) {
              // Ignore JSON parsing errors for malformed chunks
            }
          }
        }
      }

      // Save complete response
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date().toISOString()
      };
      messages.push(assistantMessage);

      if (conversationId) {
        await storage.updateChatConversation(conversationId, messages);
      } else {
        await storage.saveChatConversation({ messages });
      }

    } catch (error) {
      console.error('Stream error:', error);
      yield '\n\n[Error: Stream interrupted. Please try again.]';
    }
  }

  async getConversation(conversationId: string): Promise<ChatMessage[]> {
    const conversation = await storage.getChatConversation(conversationId);
    return Array.isArray(conversation?.messages) ? conversation.messages : [];
  }

  isConfigured(): boolean {
    return this.apiKey !== null;
  }

  getServiceHealth() {
    return {
      configured: this.isConfigured(),
      model: this.model,
      systemPromptLength: this.systemPrompt.length
    };
  }
}