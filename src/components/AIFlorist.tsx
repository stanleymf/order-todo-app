import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, Loader2, CheckCircle, Image, Download, Star } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { DesignRatingModal } from './DesignRatingModal';
import { updateAIGeneratedDesign } from '../services/api';
import { toast } from 'sonner';

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
  colorPalette?: string[];
  flowerTypes?: string[];
  arrangement?: string;
  size?: string;
};

type GeneratedImage = {
  id: string;
  prompt: string;
  generatedImage: string;
  confidence: number;
  designSpecs: DesignDetails;
  generationTime: number;
  modelVersion: string;
  cost: number;
  status: string;
  conversationSummary?: string;
  quality_rating?: number;
  feedback?: string;
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

// Main component for the AI Florist Widget - v3 with Image Generation
const AIFlorist = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [stage, setStage] = useState<ConversationStage>('occasion');
  const [designDetails, setDesignDetails] = useState<Partial<DesignDetails>>({});
  const [knowledgeBase, setKnowledgeBase] = useState<Partial<KnowledgeBase>>({});
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
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
          tenantId: "84caf0bf-b8a7-448f-9a33-8697cb8d6918",
        }),
      });

      if (!response.ok) {
        throw new Error('AI chat request failed.');
      }

      const aiResponseData = await response.json();
      
      const aiMessage: Message = {
        sender: 'ai',
        text: aiResponseData.response,
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

  const handleGenerateImage = async () => {
    if (messages.length < 2) {
      addMessage({
        sender: 'ai',
        text: "Let's chat a bit more about your bouquet preferences before I generate an image for you!",
      });
      return;
    }

    setIsGeneratingImage(true);

    try {
      // Extract design details from conversation
      const userMessages = messages.filter(msg => msg.sender === 'user');
      const extractedSpecs = extractDesignSpecs(userMessages, designDetails);

      const response = await fetch('/api/ai/generate-bouquet-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          knowledgeBase,
          tenantId: "84caf0bf-b8a7-448f-9a33-8697cb8d6918",
          designSpecs: extractedSpecs,
        }),
      });

      if (!response.ok) {
        throw new Error('Image generation request failed.');
      }

      const imageData: GeneratedImage = await response.json();
      
      console.log("Full response from /api/ai/generate-bouquet-image:", imageData);
      
      setGeneratedImages(prev => [...prev, imageData]);
      setCurrentImage(imageData);
      
      addMessage({
        sender: 'ai',
        text: `Perfect! I've generated a beautiful bouquet image based on our conversation. Take a look at the image below! 💐`,
      });

    } catch (error) {
      console.error("Error generating image:", error);
      addMessage({
        sender: 'ai',
        text: "I'm having trouble generating an image right now. Let's continue our conversation and try again later!",
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const extractDesignSpecs = (userMessages: Message[], currentDetails: Partial<DesignDetails>): DesignDetails => {
    // Simple extraction logic - in a real app, you'd use NLP to extract more details
    const text = userMessages.map(msg => msg.text.toLowerCase()).join(' ');
    
    return {
      occasion: currentDetails.occasion || (text.includes('wedding') ? 'wedding' : 
                                          text.includes('anniversary') ? 'anniversary' : 
                                          text.includes('birthday') ? 'birthday' : 'general'),
      style: currentDetails.style || (text.includes('romantic') ? 'romantic' : 
                                    text.includes('modern') ? 'modern' : 
                                    text.includes('rustic') ? 'rustic' : 'romantic'),
      budget: currentDetails.budget || (text.includes('premium') ? 'premium' : 
                                      text.includes('budget') ? 'budget' : 'mid-range'),
      colorPalette: currentDetails.colorPalette || (text.includes('pink') ? ['pink', 'white'] : 
                                                  text.includes('red') ? ['red', 'white'] : 
                                                  text.includes('white') ? ['white', 'green'] : ['pink', 'white']),
      flowerTypes: currentDetails.flowerTypes || (text.includes('rose') ? ['roses'] : 
                                                text.includes('lily') ? ['lilies'] : 
                                                text.includes('tulip') ? ['tulips'] : ['roses']),
      arrangement: currentDetails.arrangement || 'round',
      size: currentDetails.size || 'medium',
    };
  };

  const downloadImage = (imageUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRatingSubmit = async (rating: number, feedback: string) => {
    if (!currentImage?.id) {
      toast.error("No image selected for rating.");
      return;
    }
    
    const tenantId = "84caf0bf-b8a7-448f-9a33-8697cb8d6918";

    try {
      await updateAIGeneratedDesign(tenantId, currentImage.id, {
        rating,
        feedback,
      });
      
      if (currentImage) {
        setCurrentImage({
          ...currentImage,
          quality_rating: rating,
          feedback: feedback
        });
      }
      
      addMessage({
        sender: 'ai',
        text: `Thank you for your feedback! Your rating of ${rating}/5 stars helps us improve our AI.`,
      });
      
      toast.success("Rating submitted successfully!");
      setShowRatingModal(false);

    } catch (error) {
      console.error('Error submitting rating:', error);
      toast.error("Sorry, there was an issue saving your rating. Please try again.");
      addMessage({
        sender: 'ai',
        text: "Sorry, there was an issue saving your rating. Please try again.",
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen bg-[#E2E5DA] p-4 font-sans">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b rounded-t-2xl bg-[#616B53] text-white">
          <div className="flex items-center gap-4">
            <Sparkles className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">AI Florist</h1>
              <p className="text-sm opacity-90">Design your perfect bouquet with AI</p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
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
              <div className="flex items-center gap-4">
                <InputBar onSend={handleSendMessage} isLoading={isLoading} />
                <Button 
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage || isLoading || messages.length < 2}
                  className="bg-[#616B53] hover:bg-[#495140] text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  {isGeneratingImage ? (
                    <Loader2 className="animate-spin h-4 w-4" />
                  ) : (
                    <Image className="h-4 w-4" />
                  )}
                  {isGeneratingImage ? 'Generating...' : 'Generate Image'}
                </Button>
              </div>
            </div>
          </div>

          {/* Image Display Area */}
          {currentImage && (
            <div className="w-80 border-l border-gray-200 bg-gray-50 p-4 overflow-y-auto">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg text-gray-800">Generated Bouquet</h3>
                
                {/* Current Image */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <img 
                    src={currentImage.generatedImage} 
                    alt="Generated bouquet"
                    className="w-full h-64 object-cover rounded-lg mb-3"
                  />
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Style:</span>
                      <span className="text-sm font-medium">{currentImage.designSpecs.style}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Occasion:</span>
                      <span className="text-sm font-medium">{currentImage.designSpecs.occasion}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Cost:</span>
                      <span className="text-sm font-medium">${currentImage.cost}</span>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={() => downloadImage(currentImage.generatedImage, `bouquet-${currentImage.id}.png`)}
                    className="w-full mt-3 bg-[#616B53] hover:bg-[#495140] text-white"
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  
                  <Button 
                    onClick={() => setShowRatingModal(true)}
                    className="w-full mt-2 bg-[#FFD700] hover:bg-[#FFC000] text-gray-800"
                    size="sm"
                  >
                    <Star className="h-4 w-4 mr-2" />
                    Rate This Design
                  </Button>
                </div>

                {/* Previous Images */}
                {generatedImages.length > 1 && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Previous Designs</h4>
                    <div className="space-y-2">
                      {generatedImages.slice(0, -1).reverse().map((image, index) => (
                        <div 
                          key={image.id}
                          className="bg-white rounded-lg p-2 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => setCurrentImage(image)}
                        >
                          <img 
                            src={image.generatedImage} 
                            alt={`Previous design ${index + 1}`}
                            className="w-full h-20 object-cover rounded"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Rating Modal */}
      {showRatingModal && currentImage && (
        <DesignRatingModal
          isOpen={showRatingModal}
          onClose={() => setShowRatingModal(false)}
          designId={currentImage.id}
          designImage={currentImage.generatedImage}
          prompt={currentImage.prompt}
          onRatingSubmit={handleRatingSubmit}
        />
      )}
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
    <form onSubmit={handleSubmit} className="flex items-center gap-4 flex-1">
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