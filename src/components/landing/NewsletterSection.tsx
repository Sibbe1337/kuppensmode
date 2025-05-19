"use client";

import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Send } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"; // For success/error messages

const NewsletterSection: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) {
        toast({ title: "Email Required", description: "Please enter your email address.", variant: "default" });
        return;
    }
    setIsLoading(true);
    // TODO: Integrate with actual newsletter service API (e.g., Mailchimp, ConvertKit, Resend audiences)
    console.log("Newsletter signup attempt for:", email);
    await new Promise(resolve => setTimeout(resolve, 1200)); // Simulate API call
    
    const isSuccess = Math.random() > 0.2; 
    if (isSuccess) {
      toast({
        title: "Subscribed!",
        description: "Thanks for subscribing! Check your inbox for a confirmation.",
      });
      setEmail(''); // Clear input
    } else {
      toast({
        title: "Subscription Failed",
        description: "Oops! Something went wrong. Please try again later.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  return (
    <section className="py-16 sm:py-24 bg-slate-900 border-y border-slate-800/70">
      <div className="container mx-auto px-4">
        <div className="max-w-xl mx-auto text-center">
          <Mail className="h-10 w-10 text-sky-400 mx-auto mb-5" strokeWidth={1.5} />
          <h2 className="text-3xl md:text-4xl font-semibold text-slate-50 mb-3 tracking-tight">
            Stay Updated With PageLifeline
          </h2>
          <p className="text-slate-300 mb-8 max-w-lg mx-auto leading-relaxed">
            Get the latest product updates, new features, and tips for managing your Notion workspace delivered straight to your inbox.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <Input 
              type="email" 
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-grow bg-slate-800/70 backdrop-blur-md border-slate-700/50 text-slate-100 placeholder:text-slate-400 focus:ring-sky-500/70 focus:border-sky-500/70 h-11 text-base rounded-lg shadow-sm"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              className="bg-sky-500 hover:bg-sky-400 text-white font-semibold h-11 text-base px-5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-in-out flex items-center justify-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Subscribe</>
              )}
            </Button>
          </form>
          <p className="text-xs text-slate-400 mt-4">We respect your privacy. Unsubscribe at any time.</p>
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection; 