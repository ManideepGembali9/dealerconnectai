'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, MessageCircle, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  // DRAGGABLE POSITION STATE
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });
  const hasMovedRef = useRef(false);

  useEffect(() => {
    // Initial position bottom-right on client mount
    if (typeof window !== 'undefined') {
      const defaultX = Math.max(16, window.innerWidth - 76);
      const defaultY = Math.max(80, window.innerHeight - 150);
      setPos({ x: defaultX, y: defaultY });
    }
  }, []);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: 'Hello! I am your DealerConnect shopping assistant. Ask me about local shops, products, prices, or store directions!',
        },
      ]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: pos?.x ?? (window.innerWidth - 76),
      initY: pos?.y ?? (window.innerHeight - 150),
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      hasMovedRef.current = true;
    }

    const nextX = Math.min(Math.max(10, dragStartRef.current.initX + dx), window.innerWidth - 65);
    const nextY = Math.min(Math.max(70, dragStartRef.current.initY + dy), window.innerHeight - 80);

    setPos({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    // If it wasn't a drag motion, treat as a click to open/close
    if (!hasMovedRef.current) {
      setOpen((prev) => !prev);
    }
  };

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
    }, 400 + Math.random() * 300);
  };

  const suggestions = [
    'Show nearby medical shops',
    'Best smartphones in Amalapuram',
    'Sony 55 inch TV offers',
    'Top rated local dealers',
  ];

  return (
    <>
      {/* DRAGGABLE FLOATING CHATBOT BUTTON */}
      {pos && (
        <div
          style={{
            position: 'fixed',
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            zIndex: 50,
            touchAction: 'none',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { isDraggingRef.current = false; }}
          className="cursor-grab active:cursor-grabbing select-none group"
        >
          <div className="relative">
            <button
              type="button"
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition-transform hover:scale-105 active:scale-95',
                'border-2 border-primary-foreground/30 ring-4 ring-primary/20'
              )}
              aria-label="Toggle moveable shopping chatbot"
            >
              {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
            </button>
            {/* Small drag hint indicator */}
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-background border border-border text-[9px] text-muted-foreground shadow-sm">
              <Move className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>
      )}

      {/* CHATBOT DIALOG / DRAWER */}
      {open && (
        <div className="fixed inset-x-4 bottom-24 sm:inset-x-auto sm:right-6 sm:bottom-24 z-50 flex h-[480px] max-h-[calc(100vh-9rem)] sm:w-[380px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 bg-primary p-3.5 text-primary-foreground">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/20 backdrop-blur">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-tight">DealerConnect Assistant</h3>
                <p className="flex items-center gap-1.5 text-[11px] text-primary-foreground/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" /> Live Shopping Helper
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20 rounded-full"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3.5 bg-muted/10">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-xs sm:text-sm leading-relaxed shadow-sm',
                    m.role === 'user'
                      ? 'rounded-br-sm bg-primary text-primary-foreground'
                      : 'rounded-bl-sm border border-border/60 bg-card text-foreground'
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card px-3 py-2 text-xs text-muted-foreground w-fit">
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
                <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
              </div>
            )}
          </div>

          {/* Quick Suggestions */}
          <div className="border-t border-border/40 bg-card/60 p-2 overflow-x-auto scrollbar-hide flex gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="shrink-0 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-1.5 border-t border-border/60 bg-card p-2.5"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about local shops or products..."
              className="h-9 text-xs sm:text-sm rounded-xl"
            />
            <Button type="submit" size="sm" className="h-9 px-3 rounded-xl" disabled={!input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
