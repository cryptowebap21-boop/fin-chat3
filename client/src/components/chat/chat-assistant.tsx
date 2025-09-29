import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { formatPrice, formatPercentage } from '@/lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change24h?: number;
  changePercent24h?: number;
}

interface ChatAssistantProps {
  onNavigateToCharts?: () => void;
}

export default function ChatAssistant({ onNavigateToCharts }: ChatAssistantProps = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch market data for chat display  
  const { data: cryptoData } = useQuery<MarketData[]>({
    queryKey: [`/api/markets/snapshot?kind=crypto&symbols=BTC,ETH`],
    refetchInterval: 15000, // Update every 15 seconds
  });

  const { data: stockData } = useQuery<MarketData[]>({
    queryKey: [`/api/markets/snapshot?kind=stock&symbols=SPY,AAPL`],
    refetchInterval: 30000, // Update every 30 seconds
  });

  // Combine and limit to 4 results
  const marketDisplayData = [...(cryptoData || []), ...(stockData || [])].slice(0, 4);

  const chatMutation = useMutation({
    mutationFn: async ({ message, conversationId }: { message: string; conversationId?: string }) => {
      const response = await apiRequest('POST', '/api/chat', { message, conversationId });
      return response.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString()
        }
      ]);
      setConversationId(data.conversationId);
    },
    onError: (error) => {
      // Add error message to chat history
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `I apologize, but I'm currently experiencing technical difficulties. ${error instanceof Error ? error.message : 'Please try again later.'}`,
          timestamp: new Date().toISOString()
        }
      ]);
      
      toast({
        title: 'Chat Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    // Add user message immediately to chat history
    const userMessage = {
      role: 'user' as const,
      content: input,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Store the current input and clear it
    const currentInput = input;
    setInput('');
    
    // Submit to API
    chatMutation.mutate({ message: currentInput, conversationId });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied to clipboard',
        description: 'Message copied successfully',
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Unable to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: 'Hi! I can help with crypto, stocks, and financial advice. What do you need?',
        timestamp: new Date().toISOString()
      }]);
    }
  }, [messages.length]);


  return (
    <div className="h-full flex flex-col">
      {/* Chat Interface */}
      <div className="glass-panel rounded-xl p-6 flex flex-col h-full shadow-2xl border border-primary/20 backdrop-blur-lg bg-gradient-to-br from-background/95 to-background/80">
        <div className="flex items-center justify-between mb-6 border-b border-primary/10 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full overflow-hidden relative shadow-lg border-2 border-primary/30">
              <svg 
                width="100%" 
                height="100%" 
                viewBox="0 0 32 32" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full"
              >
                <rect x="4" y="18" width="3" height="10" fill="#1e293b" rx="1"/>
                <rect x="9" y="16" width="3" height="12" fill="#334155" rx="1"/>
                <rect x="14" y="14" width="3" height="14" fill="#1e293b" rx="1"/>
                <rect x="19" y="12" width="3" height="16" fill="#334155" rx="1"/>
                <rect x="24" y="10" width="3" height="18" fill="#1e293b" rx="1"/>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">FinChat Assistant</h2>
              <p className="text-sm text-muted-foreground font-medium">AI-powered financial insights</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 bg-green-500/20 px-3 py-1.5 rounded-full border border-green-400/30 shadow-md">
              <div className="w-2 h-2 bg-green-400 rounded-full pulse-dot"></div>
              <span className="text-xs text-green-400 font-semibold">Online</span>
            </div>
          </div>
        </div>


        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto mb-24 sm:mb-16 space-y-4 pr-2" data-testid="chat-messages" style={{scrollbarWidth: 'thin'}}>
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex space-x-2 sm:space-x-3 ${message.role === 'user' ? 'justify-end' : ''} chat-message`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 neon-glow">
                  <svg 
                    width="100%" 
                    height="100%" 
                    viewBox="0 0 32 32" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-full"
                  >
                    <rect x="4" y="18" width="3" height="10" fill="#1e293b" rx="1"/>
                    <rect x="9" y="16" width="3" height="12" fill="#334155" rx="1"/>
                    <rect x="14" y="14" width="3" height="14" fill="#1e293b" rx="1"/>
                    <rect x="19" y="12" width="3" height="16" fill="#334155" rx="1"/>
                    <rect x="24" y="10" width="3" height="18" fill="#1e293b" rx="1"/>
                  </svg>
                </div>
              )}
              
              <div className={`max-w-full sm:max-w-2xl shadow-lg ${
                message.role === 'user' 
                  ? 'bg-gradient-to-br from-primary/25 to-primary/15 border border-primary/40 text-foreground' 
                  : 'glass-panel border border-white/10 bg-gradient-to-br from-background/90 to-background/70'
              } rounded-2xl p-3 sm:p-5`}>
                <p className="text-foreground whitespace-pre-wrap leading-relaxed font-medium text-sm sm:text-base">{message.content}</p>
              </div>

              {message.role === 'user' && (
                <div className="w-8 h-8 bg-gradient-to-r from-accent to-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-user text-white text-sm"></i>
                </div>
              )}
            </div>
          ))}
          
          {chatMutation.isPending && (
            <div className="flex space-x-3 chat-message">
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 neon-glow">
                <svg 
                  width="100%" 
                  height="100%" 
                  viewBox="0 0 32 32" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-full animate-pulse"
                >
                  <rect x="4" y="18" width="3" height="10" fill="#1e293b" rx="1"/>
                  <rect x="9" y="16" width="3" height="12" fill="#334155" rx="1"/>
                  <rect x="14" y="14" width="3" height="14" fill="#1e293b" rx="1"/>
                  <rect x="19" y="12" width="3" height="16" fill="#334155" rx="1"/>
                  <rect x="24" y="10" width="3" height="18" fill="#1e293b" rx="1"/>
                </svg>
              </div>
              <div className="glass-panel rounded-2xl p-5 border border-primary/20 shadow-lg bg-gradient-to-br from-background/90 to-background/70">
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    <div className="w-3 h-3 bg-gradient-to-r from-primary to-accent rounded-full animate-bounce"></div>
                    <div className="w-3 h-3 bg-gradient-to-r from-accent to-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-3 h-3 bg-gradient-to-r from-primary to-accent rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                  <div className="text-sm text-foreground font-semibold">
                    <span className="animate-pulse">Analyzing your question...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4 sm:pt-6 border-t border-primary/20 bg-gradient-to-r from-background/50 to-background/30 rounded-t-xl p-3 sm:p-4 -mx-6 -mb-6">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about markets..."
            className="flex-1 h-12 sm:h-14 text-sm sm:text-base rounded-2xl border-2 border-primary/20 bg-gradient-to-r from-background/95 to-background/85 backdrop-blur-sm shadow-xl transition-all duration-300 ease-in-out focus:border-primary focus:shadow-primary/30 focus:shadow-2xl focus:bg-gradient-to-r focus:from-background focus:to-background/90 hover:border-primary/40 hover:shadow-lg placeholder:text-muted-foreground/30 text-foreground font-medium px-4 sm:px-6"
            disabled={chatMutation.isPending}
            data-testid="chat-input"
          />
          <Button
            type="submit"
            disabled={!input.trim() || chatMutation.isPending}
            className="bg-black hover:bg-gray-800 text-white px-4 sm:px-6 py-3 sm:py-3 rounded-xl font-semibold transition-all shadow-lg min-w-[48px] sm:min-w-auto"
            data-testid="chat-send"
          >
            <i className="fas fa-paper-plane text-sm sm:text-base"></i>
          </Button>
        </form>
      </div>

    </div>
  );
}
