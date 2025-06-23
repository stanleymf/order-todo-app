import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, Loader2, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';

// Define the types for our chat messages and conversation state
type Message = {
  sender: 'ai' | 'user';
  text: string;
  options?: string[];
  isConfirmation?: boolean;
};

type ConversationStage = 'occasion' | 'style' | 'budget' | 'confirmation' | 'creating' | 'done';

type DesignDetails = {
  occasion: string;
  style: string;
  budget: string;
};

// Define the type for the product data we'll fetch
type SavedProduct = {
  id: string;
  title: string;
  variant_title: string | null;
  description: string | null;
  price: number;
  tags: string | null; // It's a JSON string
  product_type: string | null;
};

// Define a type for the whole knowledge base
type KnowledgeBase = {
  products: SavedProduct[];
  styles: any[]; // Define more specific types if needed
  occasions: any[];
  arrangementTypes: any[];
  budgetTiers: any[];
  flowers: any[];
  aiConfig: any;
  promptTemplates: any[];
};

// Main component for the AI Florist Widget - v2
const AIFlorist = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stage, setStage] = useState<ConversationStage>('occasion');
  const [designDetails, setDesignDetails] = useState<Partial<DesignDetails>>({});
  const [knowledgeBase, setKnowledgeBase] = useState<Partial<KnowledgeBase>>({});
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);

  // Initial welcome message & Fetch knowledge base
  useEffect(() => {
    // We can use a prompt template for the initial message in the future
    const initialMessage = {
      sender: 'ai' as const,
      text: "Welcome! I'm your personal AI florist. Let's create the perfect bouquet. What are you looking for today?",
    };
    setMessages([initialMessage]);

    const fetchKnowledgeBase = async () => {
      try {
        // NOTE: The tenantId is hardcoded for now. In a real multi-tenant app,
        // this would come from the URL or session.
        const tenantId = "84caf0bf-b8a7-448f-9a33-8697cb8d6918";
        const response = await fetch(`/api/tenants/${tenantId}/ai/knowledge-base`);
        if (!response.ok) {
          throw new Error('Failed to fetch AI knowledge base');
        }
        const data = await response.json();
        setKnowledgeBase(data);
        console.log("Successfully fetched AI knowledge base for grounding:", data);
      } catch (error) {
        console.error("Error fetching AI knowledge base:", error);
      }
    };

    fetchKnowledgeBase();
  }, []);

  // Auto-scroll to the latest message
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };

  const handleSendMessage = async (text: string) => {
    const userMessage: Message = { sender: 'user', text };
    const newMessages: Message[] = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          knowledgeBase,
        }),
      });

      if (!response.ok) {
        throw new Error('AI chat request failed.');
      }

      const aiResponseData = await response.json();
      
      const aiMessage: Message = {
        sender: 'ai',
        text: aiResponseData.content,
      };
      
      addMessage(aiMessage);

    } catch (error) {
      console.error("Error communicating with AI:", error);
      addMessage({
        sender: 'ai',
        text: "Sorry, I'm having a little trouble connecting. Please try again in a moment.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen bg-[#E2E5DA] p-4 font-sans">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col h-[80vh]">
        {/* Header */}
        <div className="p-6 border-b rounded-t-2xl bg-[#616B53] text-white">
          <div className="flex items-center gap-4">
            <Sparkles className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">AI Florist</h1>
              <p className="text-sm opacity-90">Design your perfect bouquet</p>
            </div>
          </div>
        </div>

        {/* Message Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {messages.map((msg, index) => (
              <div key={index} className={cn('flex items-end gap-3', msg.sender === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.sender === 'ai' && <div className="w-10 h-10 rounded-full bg-[#616B53] flex items-center justify-center text-white flex-shrink-0"><Sparkles size={20}/></div>}
                
                <div className={cn('p-4 rounded-2xl max-w-md break-words', msg.sender === 'user' ? 'bg-[#E2E5DA] text-gray-800 rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none')}>
                  <p dangerouslySetInnerHTML={{ __html: msg.text }} />
                </div>

                 {msg.sender === 'user' && <div className="w-10 h-10 rounded-full bg-[#E2E5DA] flex items-center justify-center text-gray-600 font-bold flex-shrink-0">You</div>}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-end gap-3 justify-start">
                 <div className="w-10 h-10 rounded-full bg-[#616B53] flex items-center justify-center text-white flex-shrink-0"><Sparkles size={20}/></div>
                 <div className="p-4 rounded-2xl max-w-md bg-white border border-gray-200 rounded-bl-none">
                    <Loader2 className="animate-spin text-gray-500" />
                 </div>
              </div>
            )}
            <div ref={endOfMessagesRef} />
          </div>
        </div>
        
        {/* Input Area */}
        <div className="p-4 border-t bg-white rounded-b-2xl">
          <InputBar onSend={handleSendMessage} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
};

// Input bar component
type InputBarProps = {
  onSend: (text: string) => void;
  isLoading: boolean;
};

const InputBar: React.FC<InputBarProps> = ({ onSend, isLoading }) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSend(text.trim());
      setText('');
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-4">
      <Input
        placeholder="Describe your ideal bouquet..."
        className="flex-1"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={isLoading}
      />
      <Button size="icon" className="bg-[#616B53] hover:bg-[#495140]" disabled={isLoading || !text.trim()}>
        {isLoading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
      </Button>
    </form>
  )
}

export default AIFlorist; 