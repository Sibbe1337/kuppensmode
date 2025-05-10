"use client";

import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"; // For success/error messages

const NewsletterSection: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    // TODO: Integrate with actual newsletter service API (e.g., Mailchimp, ConvertKit, Resend audiences)
    console.log("Newsletter signup attempt for:", email);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Example response handling
    const isSuccess = Math.random() > 0.2; // Simulate success/failure
    if (isSuccess) {
      toast({
        title: "Subscribed!",
        description: "Thanks for signing up! You'll get the latest updates and tips.",
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
    <section className="py-16 sm:py-24 bg-slate-900">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          <Mail className="h-12 w-12 text-indigo-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-slate-50 mb-3 tracking-tight">
            Stay Updated
          </h2>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">
            Get the latest updates, new features and tips for managing your Notion workspace delivered to your inbox.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <Input 
              type="email" 
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-grow bg-slate-800 border-slate-700 text-slate-50 placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500 h-12 text-base"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              className="bg-indigo-600 hover:bg-indigo-500 text-white h-12 text-base px-6"
              disabled={isLoading}
            >
              {isLoading ? "Subscribing..." : "Subscribe"}
            </Button>
          </form>
          <p className="text-xs text-slate-500 mt-3">We respect your privacy. Unsubscribe at any time.</p>
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection; 