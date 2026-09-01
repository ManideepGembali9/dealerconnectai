'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, Send, MessageSquare, Store, Phone, Navigation,
  Star, MapPin, ImageIcon, Paperclip, Loader2, Circle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/lib/providers';
import { fetchApprovedDealers, fetchDealerById } from '@/lib/data';
import { fetchConversations, fetchMessages, sendMessage, markMessagesRead, getCustomerId } from '@/lib/messaging';
import { supabase } from '@/lib/supabase';
import { haversineKm, formatDistance } from '@/lib/geo';
import { timeAgo } from '@/lib/format';
import type { Dealer, Message } from '@/lib/supabase';
import { EmptyState } from '@/components/ui/states';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function MessagesClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { location } = useApp();
  const dealerParam = searchParams.get('dealer');

  const [conversations, setConversations] = useState<{ dealer: Dealer; lastMessage: Message; unreadCount: number }[]>([]);
  const [activeDealer, setActiveDealer] = useState<Dealer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        if (dealerParam) {
          const dealer = await fetchDealerById(dealerParam);
          if (dealer) {
            setActiveDealer(dealer);
            const msgs = await fetchMessages(dealer.id);
            setMessages(msgs);
            await markMessagesRead(dealer.id);
          }
        }
        const convos = await fetchConversations();
        setConversations(convos);
      } catch (e) {
        toast.error('Failed to load messages');
      } finally {
        setLoading(false);
      }
    })();
  }, [dealerParam]);

  useEffect(() => {
    if (activeDealer) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeDealer]);

  useEffect(() => {
    if (!activeDealer) return;
    const interval = setInterval(async () => {
      try {
        const msgs = await fetchMessages(activeDealer.id);
        if (msgs.length > messages.length) {
          setMessages(msgs);
          await markMessagesRead(activeDealer.id);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [activeDealer, messages.length]);

  const handleSelectDealer = async (dealer: Dealer) => {
    setActiveDealer(dealer);
    router.replace(`/messages?dealer=${dealer.id}`);
    try {
      const msgs = await fetchMessages(dealer.id);
      setMessages(msgs);
      await markMessagesRead(dealer.id);
      setConversations((prev) => prev.map((c) => c.dealer.id === dealer.id ? { ...c, unreadCount: 0 } : c));
    } catch {
      toast.error('Failed to load conversation');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !activeDealer) return;
    setSending(true);
    try {
      const msg = await sendMessage(activeDealer.id, input.trim());
      if (msg) {
        setMessages((prev) => [...prev, msg]);
        setInput('');
      }
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDealer) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);
      const msg = await sendMessage(activeDealer.id, 'Shared an image', null, urlData.publicUrl);
      if (msg) {
        setMessages((prev) => [...prev, msg]);
      }
    } catch {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <h1 className="mb-4 flex items-center gap-2 text-xl font-bold md:text-2xl">
        <MessageSquare className="h-6 w-6" /> Messages
      </h1>

      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <div className={cn('space-y-2', activeDealer && 'hidden md:block')}>
          {conversations.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No conversations yet"
              description="Start chatting with a dealer from their profile page or product listings."
              action={
                <Link href="/nearby">
                  <Button size="sm" variant="outline">Find Dealers</Button>
                </Link>
              }
            />
          ) : (
            conversations.map(({ dealer, lastMessage, unreadCount }) => (
              <button
                key={dealer.id}
                onClick={() => handleSelectDealer(dealer)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all hover:shadow-sm',
                  activeDealer?.id === dealer.id ? 'border-primary bg-primary/5' : 'border-border/60',
                )}
              >
                {dealer.logo_url ? (
                  <Image src={dealer.logo_url} alt={dealer.shop_name} width={40} height={40} className="rounded-lg object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Store className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium text-sm">{dealer.shop_name}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(lastMessage.created_at)}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{lastMessage.body}</p>
                </div>
                {unreadCount > 0 && (
                  <Badge className="shrink-0 bg-primary text-primary-foreground">{unreadCount}</Badge>
                )}
              </button>
            ))
          )}

          {/* Suggested dealers to message */}
          {conversations.length === 0 && (
            <div className="mt-4">
              <SuggestedDealers location={location} onSelect={handleSelectDealer} />
            </div>
          )}
        </div>

        {/* Chat panel */}
        <div className={cn('flex flex-col rounded-xl border border-border/60', !activeDealer && 'hidden md:flex')}>
          {activeDealer ? (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 border-b border-border/60 p-3">
                <button onClick={() => { setActiveDealer(null); router.replace('/messages'); }} className="rounded-lg p-1.5 hover:bg-muted md:hidden">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                {activeDealer.logo_url ? (
                  <Image src={activeDealer.logo_url} alt={activeDealer.shop_name} width={40} height={40} className="rounded-lg object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Store className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <Link href={`/dealer/${activeDealer.id}`} className="font-semibold hover:text-primary">
                    {activeDealer.shop_name}
                  </Link>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Circle className="h-2 w-2 fill-success text-success" /> Online
                  </div>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <a href={`tel:${activeDealer.phone}`}><Phone className="h-3.5 w-3.5" /></a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${activeDealer.map_lat},${activeDealer.map_lng}`} target="_blank" rel="noopener noreferrer">
                    <Navigation className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: '60vh' }}>
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                    <MessageSquare className="mb-2 h-8 w-8" />
                    <p className="text-sm">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn('flex', msg.sender_type === 'customer' ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                          msg.sender_type === 'customer'
                            ? 'blue-gradient text-white'
                            : 'bg-muted text-foreground',
                        )}
                      >
                        {msg.image_url && (
                          <img src={msg.image_url} alt="Attachment" className="mb-2 max-h-40 rounded-lg" />
                        )}
                        <p>{msg.body}</p>
                        <p className={cn('mt-1 text-[10px]', msg.sender_type === 'customer' ? 'text-white/60' : 'text-muted-foreground')}>
                          {new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border/60 p-3">
                <div className="flex items-end gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImageUpload} />
                  <Button size="icon" variant="outline" className="shrink-0" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                  </Button>
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                    }}
                    placeholder="Type a message..."
                    className="min-h-[40px] max-h-24 flex-1 resize-none text-sm"
                    rows={1}
                  />
                  <Button onClick={handleSend} disabled={sending || !input.trim()} className="shrink-0 blue-gradient text-white hover:opacity-90">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-12">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="mx-auto mb-3 h-12 w-12" />
                <p>Select a conversation to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SuggestedDealers({ location, onSelect }: { location: { lat: number | null; lng: number | null; pinCode: string | null; label: string | null }; onSelect: (d: Dealer) => void }) {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApprovedDealers(6).then(setDealers).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-4 text-center text-sm text-muted-foreground">Loading dealers...</div>;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Start a conversation:</p>
      {dealers.map((d) => (
        <button
          key={d.id}
          onClick={() => onSelect(d)}
          className="flex w-full items-center gap-3 rounded-lg border border-border/60 p-3 text-left transition-all hover:border-primary hover:shadow-sm"
        >
          {d.logo_url ? (
            <Image src={d.logo_url} alt={d.shop_name} width={36} height={36} className="rounded-lg object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Store className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{d.shop_name}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-warning text-warning" />
              {d.rating.toFixed(1)} · {d.city}
            </div>
          </div>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}
