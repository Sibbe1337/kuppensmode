"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { NextPage } from 'next';
import { ArrowRight, CheckCircle, ChevronDown, Edit3, Camera, MailCheck, RotateCcw, Shield, Users, Star, X, PlayCircle, Info } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import Marquee from "react-fast-marquee";

interface DemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
}

const DemoModal: React.FC<DemoModalProps> = ({ isOpen, onClose, videoUrl }) => {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="aspect-video">
          <iframe
            width="100%"
            height="100%"
            src={videoUrl}
            title="Product Demo"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          ></iframe>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface PricingCardProps {
  planName: string;
  price: string;
  priceFrequency?: string;
  features: string[];
  ctaText: string;
  ctaVariant: "default" | "outline" | "secondary" | "ghost" | "link";
  isPrimary?: boolean;
  highlightText?: string;
  ctaHref: string;
}

const PricingCard: React.FC<PricingCardProps> = ({
  planName,
  price,
  priceFrequency = "/mo",
  features,
  ctaText,
  ctaVariant,
  isPrimary,
  highlightText,
  ctaHref,
}) => {
  return (
    <div className={`p-6 md:p-8 rounded-lg flex flex-col ${isPrimary ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white' : 'bg-zinc-800 text-zinc-100'} border ${isPrimary ? 'border-blue-500' : 'border-zinc-700'}`}>
      {highlightText && (
        <div className={`text-xs font-semibold mb-2 px-3 py-1 rounded-full self-start ${isPrimary ? 'bg-white/20 text-white' : 'bg-blue-500 text-white'}`}>
          {highlightText}
        </div>
      )}
      <h3 className={`text-2xl font-semibold ${isPrimary ? 'text-white' : 'text-zinc-50'}`}>{planName}</h3>
      <div className="my-4">
        <span className={`text-4xl font-bold ${isPrimary ? 'text-white' : 'text-zinc-50'}`}>{price}</span>
        { price !== "Free" && <span className={`${isPrimary ? 'text-blue-100' : 'text-zinc-400'}`}>{priceFrequency}</span>}
      </div>
      <ul className="space-y-2 mb-6 text-sm flex-grow">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <CheckCircle className={`h-5 w-5 mr-2 flex-shrink-0 ${isPrimary ? 'text-blue-300' : 'text-blue-500'}`} />
            <span className={`${isPrimary ? 'text-blue-50' : 'text-zinc-300'}`}>{feature}</span>
          </li>
        ))}
      </ul>
      <Button asChild variant={ctaVariant} size="lg" className={`w-full ${isPrimary ? 'bg-white text-blue-600 hover:bg-blue-50' : ctaVariant === 'default' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ctaVariant === 'secondary' ? 'bg-zinc-700 text-zinc-100 hover:bg-zinc-600' : 'border-zinc-500 hover:bg-zinc-700' }`}>
        <Link href={ctaHref}>{ctaText}</Link>
      </Button>
    </div>
  );
};


const testimonials = [
  { id: 1, quote: "Notion Lifeline saved my bacon last week. Accidental delete? No problem!", author: "Alex R., Product Manager" },
  { id: 2, quote: "The AI change diffs are a game-changer for team collaboration.", author: "Sarah K., Engineering Lead" },
  { id: 3, quote: "Set it and forget it. Peace of mind for our company\'s knowledge base.", author: "Mike B., Founder" },
  { id: 4, quote: "Restoring a page was surprisingly simple and fast. Highly recommend!", author: "Jessica L., Designer" },
];

const faqItems = [
  { q: "How often are snapshots taken?", a: "Snapshots are taken automatically every hour for Pro users, and daily for Free users. You can also trigger manual snapshots anytime on any plan." },
  { q: "What if Notion changes its API?", a: "Our team actively monitors Notion API changes and updates Notion Lifeline to ensure compatibility and uninterrupted service." },
  { q: "Is my data secure?", a: "Absolutely. We use industry-standard encryption (AES-256) for your data both in transit and at rest. Our infrastructure is ISO-27001 compliant." },
  { q: "Can I restore individual blocks or just entire pages?", a: "Currently, you can restore entire pages or databases. Granular block-level restore is on our roadmap for Pro users." },
  { q: "What happens if I exceed my snapshot limit on the Free plan?", a: "Your oldest snapshot will be replaced with the newest one. You\'ll receive a notification before this happens, with an option to upgrade to Pro for unlimited snapshots." },
  { q: "Do you offer team plans?", a: "Notion Lifeline is currently designed for individual workspaces. Team plans with role-based access and centralized billing are planned for future release." },
];

const HomePage: NextPage = () => {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isAnnualPricing, setIsAnnualPricing] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(false);

  const loomDemoUrl = "https://www.loom.com/embed/e5b8c04b393042f29a67901541137331"; // Replace with your actual Loom embed ID

  useEffect(() => {
    const handleScroll = () => {
      // Show sticky CTA after scrolling down a bit (e.g., 300px)
      if (window.scrollY > 300) {
        setShowStickyCta(true);
      } else {
        setShowStickyCta(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  return (
    <div className="bg-zinc-950 text-zinc-50 min-h-screen">
      {/* Hero Section */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-4 py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-slate-900 opacity-70 z-0"></div>
        <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_50%_0,_#3b82f6_0%,_transparent_40%)] z-0"></div>
        
        <div className="relative z-10">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400">
            Never lose a Notion doc again.
          </h1>
          <p className="max-w-xl mx-auto text-lg sm:text-xl text-zinc-400 mb-10">
            Automatic hourly snapshots, AI change-diff e-mails, 1-click restore. Your Notion workspace, secured and effortlessly recoverable.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-3 w-full sm:w-auto">
              <Link href="/dashboard">Start free backup</Link>
            </Button>
            <Button variant="link" onClick={() => setIsDemoModalOpen(true)} className="text-blue-400 hover:text-blue-300 text-lg w-full sm:w-auto">
              <PlayCircle className="mr-2 h-5 w-5" />
              Watch 15-sec demo
            </Button>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4 text-sm text-zinc-500">
            <div className="flex items-center">
              <Shield className="h-5 w-5 mr-2 text-green-500" />
              <span>ISO-27001 compliant</span>
            </div>
            <div className="flex items-center">
              <Users className="h-5 w-5 mr-2 text-sky-500" />
              <span>500k+ pages protected</span>
            </div>
            <div className="flex items-center">
              <Star className="h-5 w-5 mr-2 text-yellow-500" />
              <span>Loved by builders</span>
            </div>
          </div>
        </div>
      </section>
      <DemoModal isOpen={isDemoModalOpen} onClose={() => setIsDemoModalOpen(false)} videoUrl={loomDemoUrl} />

      {/* Visual Explainer Section */}
      <section className="py-16 sm:py-24 px-4 bg-zinc-900">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-zinc-100">How It Works in 4 Simple Steps</h2>
          <p className="text-zinc-400 mb-12 sm:mb-16 max-w-2xl mx-auto">Focus on your work, we\'ll handle the safety net.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 items-start relative">
            {/* Gradient line (decorative) */}
            <div className="hidden lg:block absolute top-1/2 left-0 w-full h-px -translate-y-1/2 ">
              <div className="h-full w-3/4 mx-auto bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>
            </div>
            
            {[
              { icon: Edit3, label: "You Edit Notion", description: "Work as usual. We detect changes automatically." },
              { icon: Camera, label: "Auto Snapshot", description: "Hourly backups capture every version seamlessly." },
              { icon: MailCheck, label: "AI Change Diff", description: "Get smart email summaries of what changed." },
              { icon: RotateCcw, label: "1-Click Restore", description: "Easily roll back to any previous snapshot." },
            ].map((step, index) => (
              <div key={index} className="flex flex-col items-center p-6 bg-zinc-800 rounded-lg shadow-lg relative z-10">
                <div className="p-4 bg-blue-600 rounded-full mb-4 inline-block">
                  <step.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-zinc-100">{step.label}</h3>
                <p className="text-zinc-400 text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Teaser Section */}
      <section className="py-16 sm:py-24 px-4">
        <div className="container mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-zinc-100">Simple, Transparent Pricing</h2>
            <p className="text-zinc-400">Choose the plan that\'s right for you. Cancel anytime.</p>
          </div>

          <div className="flex justify-center items-center mb-8">
            <span className={`mr-3 text-sm font-medium ${!isAnnualPricing ? 'text-blue-400' : 'text-zinc-500'}`}>Monthly</span>
            <Switch
              checked={isAnnualPricing}
              onCheckedChange={setIsAnnualPricing}
              id="pricing-toggle"
              aria-label="Toggle annual pricing"
            />
            <span className={`ml-3 text-sm font-medium ${isAnnualPricing ? 'text-blue-400' : 'text-zinc-500'}`}>
              Annual <span className="text-emerald-400">(Save 17%)</span>
            </span>
          </div>

          <div className="bg-zinc-900 rounded-xl p-6 sm:p-10 shadow-2xl">
            <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
              {/* Free Plan */}
              <PricingCard
                planName="Free"
                price="Free"
                features={[
                  "5 Snapshots / Workspace",
                  "Daily Automatic Backups",
                  "Manual Snapshots",
                  "Basic Email Support",
                ]}
                ctaText="Get started"
                ctaVariant="default"
                ctaHref="/dashboard"
              />
              {/* Pro Plan - Updated */}
              <PricingCard
                planName="Pro"
                price={isAnnualPricing ? "$7.50" : "$9"}
                priceFrequency={isAnnualPricing ? "/mo, billed annually ($90)" : "/mo"}
                features={[
                  "Unlimited Snapshots",
                  "Hourly Automatic Backups",
                  "AI Change Diff Emails",
                  "Priority Restore Queue",
                  "Priority Email Support",
                ]}
                ctaText="Upgrade to Pro"
                ctaVariant="secondary"
                isPrimary={false}
                highlightText="Ideal for Power Users"
                ctaHref="/dashboard?plan=pro"
              />
              {/* Teams Plan - New */}
              <PricingCard
                planName="Teams"
                price={isAnnualPricing ? "$24" : "$29"}
                priceFrequency={isAnnualPricing ? "/user/mo, billed annually" : "/user/mo"}
                features={[
                  "Increased Snapshot Quota (500/ws)",
                  "Unlimited Shared Workspaces",
                  "Seat-Based Billing",
                  "Role-Based Permissions",
                  "Optional Backup to own S3/GCS",
                  "Activity/Restore Audit Log (90 days)",
                  "Priority Chat Support (≤2h response)",
                  "Early Access to AI Features",
                ]}
                ctaText="Start 14-day Teams Trial"
                ctaVariant="default"
                isPrimary={true}
                highlightText="Most popular for companies"
                ctaHref="/dashboard?plan=teams"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Marquee Section */}
      <section className="py-16 sm:py-24 overflow-hidden bg-zinc-900">
        <div className="container mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12 sm:mb-16 text-zinc-100">Loved by Notion Users</h2>
          <Marquee gradient={true} gradientColor={'rgb(24, 24, 27)'} gradientWidth={100} speed={40} pauseOnHover={true}>
            {testimonials.map((testimonial) => (
              <div key={testimonial.id} className="bg-zinc-800 p-6 rounded-lg shadow-lg mx-4 w-80 md:w-96">
                <p className="text-zinc-300 mb-4 italic">"{testimonial.quote}"</p>
                <p className="text-sm font-semibold text-blue-400">{testimonial.author}</p>
              </div>
            ))}
          </Marquee>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="py-16 sm:py-24 px-4">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12 sm:mb-16 text-zinc-100">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, index) => (
              <AccordionItem key={index} value={`item-${index + 1}`} className="border-zinc-700">
                <AccordionTrigger className="text-left text-lg hover:no-underline text-zinc-100 hover:text-blue-400 [&[data-state=open]]:text-blue-400">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-zinc-400 pt-2">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Sticky Mobile CTA */}
      {showStickyCta && (
         <div className="fixed bottom-4 inset-x-4 z-50 md:hidden">
            <Button asChild size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 shadow-xl">
                <Link href="/dashboard">Start free backup</Link>
            </Button>
        </div>
      )}

      {/* Footer (simple) */}
      <footer className="py-8 text-center border-t border-zinc-800">
        <p className="text-zinc-500 text-sm">&copy; {new Date().getFullYear()} Notion Lifeline. All rights reserved.</p>
      </footer>

    </div>
  );
};

export default HomePage; 