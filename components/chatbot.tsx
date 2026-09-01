'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useApp } from '@/lib/providers';
import { aiChatReply, type ChatMessage, type ChatContext } from '@/lib/ai';
import type { Product, Dealer, Category } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type Props = {
  products?: Product[];
  dealers?: Dealer[];
  categories?: Category[];
};

export function Chatbot({ products = [], dealers = [], categories = [] }: Props) {
  const { t, location } = useApp();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'assistant', content: t('chatbotGreeting') }]);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const send = (text?: string) => {
    const content = (text ?? input).trim();
    if (!content) return;
    const userMsg: ChatMessage = { role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);
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
    }, 500 + Math.random() * 400);
  };

  const suggestions = ['Show nearby medical stores', 'I need a blue phone under 20000', 'Nike shoes near me', 'Find Paracetamol'];

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg transition-transform hover:scale-105 animate-pulse-ring"
        aria-label="Open AI assistant"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[520px] max-h-[calc(100vh-8rem)] w-[calc(100vw-3rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-slide-up">
          <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-primary to-accent p-4 text-primary-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">{t('chatbotTitle')}</h3>
              <p className="flex items-center gap-1 text-xs text-primary-foreground/80">
                <span className="h-1.5 w-1.5 rounded-full bg-green-300" /> Online 24×7
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-white/20" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm',
                    m.role === 'user'
                      ? 'rounded-br-md bg-primary text-primary-foreground'
                      : 'rounded-bl-md bg-muted text-foreground'
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="flex gap-1 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
                </div>
              </div>
            )}
            {messages.length <= 1 && (
              <div className="space-y-1.5 pt-2">
                <p className="flex items-center gap-1 px-1 text-xs text-muted-foreground"><Sparkles className="h-3 w-3" /> Try asking:</p>
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-primary hover:bg-accent/10">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border p-3">
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              className="flex items-center gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('chatbotInput')}
                className="h-10"
              />
              <Button type="submit" size="icon" className="h-10 w-10 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
