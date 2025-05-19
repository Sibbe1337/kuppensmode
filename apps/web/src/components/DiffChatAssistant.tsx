"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Send, Loader2, AlertCircle, User, Bot, X, ClipboardCopy, MessageCircleQuestionIcon } from 'lucide-react'; // Changed to MessageCircleQuestionIcon
import apiClient from '@/lib/apiClient';
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

interface DiffChatAssistantProps {
  snapshotIdFrom: string;
  snapshotIdTo: string;
  jobId?: string;
  isOpen?: boolean; // Controlled by parent
  onClose?: () => void; // Callback to parent to close
}

const suggestionPrompts = [
  "Summarize the key changes.",
  "Were any databases modified?",
  // "What changed on page X?", // This would need dynamic page names, more complex
  "Tell me more about the semantic diffs."
];

export default function DiffChatAssistant({
  snapshotIdFrom,
  snapshotIdTo,
  jobId,
  isOpen, // Prop to control visibility, parent handles animation
  onClose  // Prop for close button action
}: DiffChatAssistantProps) {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null); // Changed ref name for clarity
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);


  const handleSendMessage = async (userQuestionText: string) => {
    const userQuestion = userQuestionText.trim();
    if (!userQuestion) return;

    const newUserMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userQuestion,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newUserMessage]);
    // Clear input only if the message sent was from the text input field
    if (inputValue === userQuestionText) {
        setInputValue('');
    }
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient<{ answer: string }>('/api/ai/ask-diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshotIdFrom,
          snapshotIdTo,
          question: userQuestion
        }),
      });

      const aiResponse: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: response.answer || "Sorry, I couldn't get a response.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);

    } catch (err: any) {
      console.error("[DiffChatAssistant] API Error:", err);
      const errorMessageText = err.response?.data?.error || err.message || "Failed to get answer from AI.";
      setError(errorMessageText);
      // Optionally, add the error as an AI message too, or handle differently
      const aiErrorResponse: Message = {
        id: `ai-error-${Date.now()}`,
        sender: 'ai',
        text: `Error: ${errorMessageText}`, // Prefixing with "Error:" to allow specific styling if needed
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiErrorResponse]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  };

  // Auto-scroll to bottom when new messages are added or loading state changes
  useEffect(() => {
    if (scrollAreaRef.current) {
      // Try to find the viewport element within the ScrollArea
      // This selector might depend on the exact rendered structure of shadcn's ScrollArea
      // Common structure is a direct child div that handles scrolling.
      const viewport = scrollAreaRef.current.firstChild as HTMLDivElement;
      if (viewport && typeof viewport.scrollTo === 'function') {
        setTimeout(() => {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
        }, 0);
      } else {
         // Fallback to scrolling the main ScrollArea element if the direct child isn't the viewport or doesn't have scrollTo
        setTimeout(() => {
            if(scrollAreaRef.current) {
                scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
            }
        },0);
      }
    }
  }, [messages, isLoading]);

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Consider adding a toast notification for feedback
      console.log("Copied to clipboard");
    }).catch(err => {
      console.error("Failed to copy text: ", err);
      // Add error toast if needed
    });
  };

  // The root div of this component represents the *content* of the slide-over panel.
  // The actual slide-over mechanism (fixed positioning, transform for animation, outer shadow, border-l)
  // would be handled by a parent component that wraps this one and controls `isOpen`.
  // Example parent wrapper style:
  // className={cn(
  //   "fixed top-0 right-0 h-full w-80 sm:w-96 z-50 transform transition-transform duration-300 ease-in-out",
  //   "bg-slate-100/70 dark:bg-gray-800/80 backdrop-blur-xl shadow-2xl border-l border-slate-300/50 dark:border-slate-700/50",
  //   isOpen ? "translate-x-0" : "translate-x-full"
  // )}

  return (
    <div className="flex flex-col h-full w-full bg-transparent text-sm"> {/* bg-transparent as panel background is on parent */}
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-200/60 dark:border-slate-700/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircleQuestionIcon className="h-5 w-5 text-primary" /> {/* Changed Icon */}
          <h3 className="font-semibold text-md text-slate-800 dark:text-slate-100">AI Assistant</h3>
        </div>
        {onClose && ( // Render close button only if onClose prop is provided
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose} 
            className="text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 rounded-full h-7 w-7"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Chat Messages Area */}
      <ScrollArea className="flex-grow" ref={scrollAreaRef}> {/* Assign ref to ScrollArea itself */}
        <div className="p-4 space-y-4"> {/* Added more padding to message area */}
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex flex-col gap-1.5", msg.sender === 'user' ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  "max-w-[80%] py-2 px-3.5 rounded-2xl leading-normal group relative shadow-sm", // Softer shadow on bubbles
                  msg.sender === 'user' 
                    ? 'bg-blue-500 dark:bg-blue-600 text-white self-end' 
                    : 'bg-slate-200 dark:bg-slate-600 text-slate-900 dark:text-slate-50 self-start',
                  msg.text.startsWith('Error:') && 'bg-red-100 dark:bg-red-800/60 text-red-700 dark:text-red-100'
                )}
              >
                {msg.text}
                {msg.sender === 'ai' && !msg.text.startsWith('Error:') && (
                  <Button variant="ghost" size="icon"
                          className="absolute top-0.5 right-0.5 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-slate-500 dark:text-slate-400 hover:bg-slate-300/50 dark:hover:bg-slate-500/50 rounded-full p-1"
                          title="Copy response"
                          onClick={() => handleCopyText(msg.text)} >
                    <ClipboardCopy className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="text-xs text-muted-foreground/80 px-1 flex items-center gap-1">
                {msg.sender === 'user' ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />} 
                <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))}
          {isLoading && ( // AI Thinking Indicator
            <div className="flex items-start gap-2 self-start">
              <Bot className="h-3 w-3 mt-2.5 ml-1 text-muted-foreground/80 flex-shrink-0" />
              <div className={cn(
                  "bg-slate-200 dark:bg-slate-600 text-slate-900 dark:text-slate-50",
                  "py-2 px-3.5 rounded-2xl text-sm self-start flex items-center shadow-sm"
                )}
              >
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Thinking...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Error Display Area - persistent error if any */}
      {error && !isLoading && ( // Show general error if not loading and error exists
        <div className="p-3 border-t border-slate-200/60 dark:border-slate-700/60 flex-shrink-0">
          <Alert variant="destructive" className="text-xs rounded-lg shadow">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-medium">Assistant Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Prompt Suggestions Area */}
      <div className="px-3 pt-2 pb-1.5 flex flex-wrap gap-1.5 border-t border-slate-200/60 dark:border-slate-700/60 flex-shrink-0">
        {suggestionPrompts.slice(0, 2).map(prompt => ( // Show only first 2 for brevity
          <Button 
            key={prompt} 
            variant="outline" 
            size="sm" // Changed from 'xs' to 'sm'
            className="text-xs rounded-full h-auto py-0.5 px-2 font-normal text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600/80 shadow-sm" // Adjusted padding
            onClick={() => handleSendMessage(prompt)} 
            disabled={isLoading}
          >
            {prompt}
          </Button>
        ))}
      </div>

      {/* Input Form Area */}
      <form onSubmit={handleFormSubmit} className="p-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center gap-2.5 flex-shrink-0">
        <Input
          ref={inputRef}
          type="text"
          placeholder="Ask about the changes..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isLoading}
          className={cn(
            "flex-grow h-10 rounded-lg px-3.5 text-sm", // macOS input style
            "bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 shadow-sm", // Subtle shadow
            "focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-500 focus-visible:ring-offset-0 focus-visible:border-transparent dark:focus-visible:border-transparent"
          )}
        />
        <Button 
          type="submit" 
          size="icon" 
          disabled={isLoading || !inputValue.trim()}
          className="h-10 w-10 rounded-lg bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white shrink-0 shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Send message"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>

      {/* Disclaimer */}
      <div className="px-3 py-2 text-center border-t border-slate-200/60 dark:border-slate-700/60 flex-shrink-0">
        <p className="text-[11px] text-muted-foreground/70"> {/* Extra small text for disclaimer */}
          AI responses may occasionally be incomplete or inaccurate. Always verify critical information.
        </p>
      </div>
    </div>
  );
}