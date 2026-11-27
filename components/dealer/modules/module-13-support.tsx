'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Dealer } from '@/lib/types';
import { HelpCircle,Mail,MessageCircle,Phone,ShieldCheck } from 'lucide-react';

export function Module13DealerSupport({ dealer }: { dealer: Dealer }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
          <HelpCircle className="h-7 w-7 text-emerald-600" /> Dealer Help & Platform Support
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Reach platform administrators, get assistance with master catalog assignments, or report technical issues
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Card className="p-5 border-border/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 font-bold mb-3">
              <Phone className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-sm text-foreground">Dealer Helpline</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Direct telephone line for dealer onboarding & live stock queries.
            </p>
            <p className="text-sm font-bold text-foreground mt-3 font-mono">+91 98480 12345</p>
          </div>
          <Button asChild size="sm" variant="outline" className="mt-4 w-full">
            <a href="tel:+919848012345">Call Support</a>
          </Button>
        </Card>

        <Card className="p-5 border-border/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 font-bold mb-3">
              <MessageCircle className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-sm text-foreground">WhatsApp Business Desk</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Chat directly with our operations team for fast product approvals.
            </p>
            <p className="text-sm font-bold text-emerald-600 mt-3 font-mono">+91 98480 12345</p>
          </div>
          <Button asChild size="sm" className="mt-4 w-full bg-emerald-600 text-white hover:bg-emerald-700">
            <a href="https://wa.me/919848012345" target="_blank" rel="noopener noreferrer">
              Open WhatsApp Chat
            </a>
          </Button>
        </Card>

        <Card className="p-5 border-border/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 font-bold mb-3">
              <Mail className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-sm text-foreground">Email Ticketing</h3>
            <p className="text-xs text-muted-foreground mt-1">
              For account changes, GST invoices, or formal inquiries.
            </p>
            <p className="text-xs font-semibold text-foreground mt-3 font-mono">
              dealers@dealerconnect.ai
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="mt-4 w-full">
            <a href="mailto:dealers@dealerconnect.ai">Send Email</a>
          </Button>
        </Card>
      </div>

      {/* Guidelines Card */}
      <Card className="p-6 border-border/80 shadow-sm space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-600" /> Merchant Code of Conduct & Policies
        </h3>
        <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1.5 leading-relaxed">
          <li>Always keep your live showroom stock counts accurate to maintain top buyer ratings.</li>
          <li>All master product additions must be picked from the Admin-approved master catalog.</li>
          <li>Respond promptly to customer leads via Phone or WhatsApp within store working hours.</li>
          <li>DealerConnect AI is a pure product discovery and showroom connection engine; no transaction fee or commission is charged.</li>
        </ul>
      </Card>
    </div>
  );
}
