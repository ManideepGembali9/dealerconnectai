'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { aiChatReply, type ChatContext, type ChatMessage } from '@/lib/ai';
import { fetchAllProducts, fetchApprovedDealers, fetchCategories } from '@/lib/data';
import { useApp } from '@/lib/providers';
import type { Category, Dealer, Product } from '@/lib/types';
import { cn } from '@/lib/utils';

type ProfileShoppingChatProps = {
  open: boolean;
  onClose?: () => void;
  embedded?: boolean;
};

/**
 * Customer AI Shopping Chat embedded exclusively within the authenticated Profile experience.
 * Replaces the former global floating chatbot bubble so pages remain uncluttered.
 */
export function ProfileShoppingChat({
  open,
  onClose,
  embedded = false,
}: ProfileShoppingChatProps) {
  const { location } = useApp();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Hello! I am your DealerConnect AI Shopping Assistant. Ask me about nearby shops, live product prices, stock availability, or store directions!',
    },
  ]);
  const [typing, setTyping] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || dataLoaded) return;
    let active = true;
    Promise.all([
      fetchAllProducts(100),
      fetchApprovedDealers(50),
      fetchCategories(),
    ])
      .then(([prods, dls, cats]) => {
        if (!active) return;
        setProducts(prods);
        setDealers(dls);
        setCategories(cats);
        setDataLoaded(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open, dataLoaded]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  if (!open) return null;

  const send = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content) return;
    setMessages((prev) => [...prev, { role: 'user', content }]);
    setInput('');
    setTyping(true);

    setTimeout(() => {
      const ctx: ChatContext = {
        pinCode: location.pinCode,
        locationLabel: location.label,
        products,
        dealers,
        categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
      };
      const reply = aiChatReply(content, ctx);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      setTyping(false);
    }, 300);
  };

  const suggestions = [
    'Top rated local shops',
    'Smartphones in stock',
    'Sony TV offers nearby',
    'Shops near my PIN',
  ];

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm',
        embedded ? 'h-[400px]' : 'h-[460px] max-h-[75vh]'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 bg-primary px-4 py-3 text-primary-foreground">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-foreground/15">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold leading-tight flex items-center gap-1.5">
              AI Shopping Chat <Sparkles className="h-3 w-3" />
            </h3>
            <p className="text-[10px] text-primary-foreground/80">
              {location.pinCode ? `Active PIN ${location.pinCode}` : 'Local Product Assistant'}
            </p>
          </div>
        </div>
        {onClose && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close AI Shopping Chat"
            className="h-7 w-7 rounded-full text-primary-foreground hover:bg-primary-foreground/20"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto bg-muted/15 p-3.5">
        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-xs sm:text-sm leading-relaxed shadow-xs',
                m.role === 'user'
                  ? 'rounded-br-sm bg-primary text-primary-foreground'
                  : 'rounded-bl-sm border border-border bg-card text-foreground'
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex w-fit items-center gap-1 rounded-xl border border-border bg-card px-3 py-2">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0.3s]" />
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="flex gap-1.5 overflow-x-auto border-t border-border/50 bg-card px-3 py-2 scrollbar-hide">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => send(s)}
            className="shrink-0 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 border-t border-border/60 bg-card p-2.5"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about products, stores or prices..."
          className="h-9 flex-1 rounded-xl text-xs"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || typing}
          className="h-9 w-9 shrink-0 rounded-xl"
          aria-label="Send chat message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
