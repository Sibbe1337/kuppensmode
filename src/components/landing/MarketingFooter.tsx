"use client";

import React from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/layout/StatusBadge';
import { Github, Twitter, Linkedin, Mail } from 'lucide-react'; // Example social icons

const FooterLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <li><Link href={href} className="text-slate-400 hover:text-indigo-400 transition-colors text-sm">{children}</Link></li>
);

const SocialLink: React.FC<{ href: string; icon: React.ElementType; label: string }> = ({ href, icon: Icon, label }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="text-slate-500 hover:text-indigo-400 transition-colors">
    <Icon className="h-5 w-5" />
  </a>
);

const MarketingFooter: React.FC = () => {
  return (
    <footer className="py-16 bg-slate-900 border-t border-slate-800">
      <div className="container mx-auto px-4">
        {/* Top section with links */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-4 lg:col-span-2 pr-8">
            <Link href="/" className="inline-block mb-4">
              {/* Replace with actual Logo component or SVG */}
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold">P</div>
                <span className="text-xl font-semibold text-slate-100">PageLifeline</span>
              </div>
            </Link>
            <p className="text-sm text-slate-400 max-w-xs">
              The ultimate safeguard for your Notion workspace.
            </p>
          </div>

          <div>
            <h5 className="font-semibold text-slate-200 mb-4">Product</h5>
            <ul className="space-y-2.5">
              <FooterLink href="/#features">Features</FooterLink>
              <FooterLink href="/#pricing">Pricing</FooterLink>
              <FooterLink href="/changelog">Changelog</FooterLink>
              <FooterLink href="/integrations">Integrations</FooterLink>
              <FooterLink href="/api-docs">API</FooterLink>
            </ul>
          </div>

          <div>
            <h5 className="font-semibold text-slate-200 mb-4">Resources</h5>
            <ul className="space-y-2.5">
              <FooterLink href="/docs">Documentation</FooterLink>
              <FooterLink href="/guides">Guides</FooterLink>
              <FooterLink href="/blog">Blog</FooterLink>
              <FooterLink href="/support">Support</FooterLink>
              <FooterLink href="/community">Community</FooterLink>
            </ul>
          </div>

          <div>
            <h5 className="font-semibold text-slate-200 mb-4">Company</h5>
            <ul className="space-y-2.5">
              <FooterLink href="/about">About</FooterLink>
              <FooterLink href="/careers">Careers</FooterLink>
              <FooterLink href="/press">Press</FooterLink>
              <FooterLink href="/terms">Terms of Service</FooterLink>
              <FooterLink href="/privacy">Privacy Policy</FooterLink>
              <FooterLink href="/contact">Contact</FooterLink>
            </ul>
          </div>
        </div>

        {/* Bottom section with copyright, status, and socials */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center text-sm">
          <p className="text-slate-500 mb-4 md:mb-0">&copy; {new Date().getFullYear()} PageLifeline.app. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <StatusBadge />
            <div className="flex items-center space-x-4">
              <SocialLink href="https://twitter.com/pagelifeline" icon={Twitter} label="Twitter" />
              <SocialLink href="https://github.com/pagelifeline" icon={Github} label="GitHub" />
              <SocialLink href="https://linkedin.com/company/pagelifeline" icon={Linkedin} label="LinkedIn" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default MarketingFooter; 