import Link from 'next/link';
import { Store, Mail, Phone, MapPin, Shield, Sparkles } from 'lucide-react';

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-sm">
                <Store className="h-5 w-5" />
              </div>
              <span className="text-base font-bold tracking-tight">DealerConnect</span>
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-sm font-bold text-transparent">AI</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              AI-powered local dealer marketplace. Discover nearby shops, compare prices, and get directions instantly.
            </p>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> support@dealerconnect.ai</p>
              <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> +91 90000 00000</p>
              <p className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Kakinada, Andhra Pradesh, India</p>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">Explore</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/categories" className="hover:text-foreground transition-colors">Categories</Link></li>
              <li><Link href="/search?sort=trending" className="hover:text-foreground transition-colors">Trending</Link></li>
              <li><Link href="/search?filter=offers" className="hover:text-foreground transition-colors">Offers</Link></li>
              <li><Link href="/nearby" className="hover:text-foreground transition-colors">Nearby Shops</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">For Dealers</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/dealer/register" className="hover:text-foreground transition-colors">Become a Dealer</Link></li>
              <li><Link href="/dealer/login" className="hover:text-foreground transition-colors">Dealer Login</Link></li>
              <li><Link href="/dealer" className="hover:text-foreground transition-colors">Dealer Dashboard</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/admin/login" className="hover:text-foreground transition-colors">Admin Login</Link></li>
              <li><Link href="/admin" className="hover:text-foreground transition-colors">Admin Dashboard</Link></li>
              <li className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-accent" /> AI-Powered</li>
              <li className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-success" /> Secure Platform</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} DealerConnect AI. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
