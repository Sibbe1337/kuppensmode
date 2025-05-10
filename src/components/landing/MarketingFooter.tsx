"use client";

import React from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/layout/StatusBadge'; // Using the existing status badge

const MarketingFooter: React.FC = () => {
  return (
    <footer className="py-12 border-t border-border/20 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h5 className="font-semibold text-foreground mb-3">Notion Lifeline</h5>
            <p className="text-sm text-muted-foreground">
              Automated backups and peace of mind for your Notion workspace.
            </p>
          </div>
          <div>
            <h5 className="font-semibold text-foreground mb-3">Quick Links</h5>
            <ul className="space-y-2 text-sm">
              <li><Link href="/#features" className="text-muted-foreground hover:text-primary">Features</Link></li>
              <li><Link href="/#pricing" className="text-muted-foreground hover:text-primary">Pricing</Link></li>
              <li><Link href="/blog" className="text-muted-foreground hover:text-primary">Blog</Link></li> 
              <li><Link href="/contact" className="text-muted-foreground hover:text-primary">Contact Us</Link></li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold text-foreground mb-3">Legal</h5>
            <ul className="space-y-2 text-sm">
              <li><Link href="/terms" className="text-muted-foreground hover:text-primary">Terms of Service</Link></li>
              <li><Link href="/privacy" className="text-muted-foreground hover:text-primary">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-border/20 flex flex-col sm:flex-row justify-between items-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Pagelifeline.app. All rights reserved.</p>
          <div className="mt-4 sm:mt-0">
            <StatusBadge />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default MarketingFooter; 