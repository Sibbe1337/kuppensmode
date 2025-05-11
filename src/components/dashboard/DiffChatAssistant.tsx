"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Send, Loader2, AlertCircle, User, Bot } from 'lucide-react';
import apiClient from '@/lib/apiClient';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

interface DiffChatAssistantProps {
  snapshotIdFrom: string;
  snapshotIdTo: string;
  jobId?: string; // For context, if needed for display or other actions
}

export default function DiffChatAssistant({ snapshotIdFrom, snapshotIdTo, jobId }: DiffChatAssistantProps) {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null); // For auto-scrolling

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const userQuestion = inputValue.trim();
    if (!userQuestion) return;

    const newUserMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userQuestion,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newUserMessage]);
    setInputValue('');
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
      const errorMessage = err.response?.data?.error || err.message || "Failed to get answer from AI.";
      setError(errorMessage);
      const aiErrorResponse: Message = {
        id: `ai-error-${Date.now()}`,
        sender: 'ai',
        text: `Error: ${errorMessage}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiErrorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-[400px] max-h-[60vh] border rounded-lg shadow-sm bg-background">
      <div className="p-3 border-b bg-slate-50 dark:bg-slate-800/50 rounded-t-lg">
        <h3 className="font-semibold text-sm text-foreground">Ask about this Diff</h3>
      </div>
      <ScrollArea className="flex-grow p-3 space-y-3" ref={scrollAreaRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col gap-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div 
              className={`max-w-[75%] p-2.5 rounded-lg text-sm leading-relaxed ${ 
                msg.sender === 'user' 
                  ? 'bg-primary text-primary-foreground self-end' 
                  : 'bg-muted text-muted-foreground self-start'
              } ${msg.text.startsWith('Error:') ? 'bg-destructive/20 text-destructive' : ''}`}>
              {msg.text}
            </div>
            <div className="text-xs text-muted-foreground/70 px-1">
              {msg.sender === 'user' ? <User className="inline h-3 w-3 mr-1" /> : <Bot className="inline h-3 w-3 mr-1" />} 
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-1">
            <div className="bg-muted text-muted-foreground p-2.5 rounded-lg text-sm self-start flex items-center">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Thinking...
            </div>
          </div>
        )}
      </ScrollArea>
      {error && (
        <div className="p-3 border-t">
          <Alert variant="destructive" className="text-xs">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}
      <form onSubmit={handleSendMessage} className="p-3 border-t flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-b-lg">
        <Input 
          type="text" 
          placeholder="Ask a question about the changes..." 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isLoading}
          className="flex-grow bg-background focus-visible:ring-primary focus-visible:ring-1"
        />
        <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim()}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
} 