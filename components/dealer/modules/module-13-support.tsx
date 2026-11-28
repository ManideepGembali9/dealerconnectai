'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImagePicker } from '@/components/ui/image-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiSync } from '@/lib/api-sync';
import { timeAgo } from '@/lib/format';
import { useRealtimeSync } from '@/lib/realtime-client';
import type {
  Dealer,
  DealerEnquiryCategory,
  DealerEnquiryPriority,
  DealerEnquiryStatus,
  DealerSupportEnquiry,
} from '@/lib/types';
import {
  Clock,
  HelpCircle,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquareText,
  Phone,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const CATEGORY_OPTIONS: { value: DealerEnquiryCategory; label: string }[] = [
  { value: 'product_approval', label: 'Product Approval Query' },
  { value: 'catalog_request', label: 'Catalog Product Request' },
  { value: 'account_issue', label: 'Account / Profile Issue' },
  { value: 'verification', label: 'Verification & Documents' },
  { value: 'technical_support', label: 'Technical Support' },
  { value: 'platform_issue', label: 'Platform Bug / Issue' },
  { value: 'billing_subscription', label: 'Plans & Billing' },
  { value: 'other', label: 'Other Support' },
];

const PRIORITY_BADGE: Record<DealerEnquiryPriority, string> = {
  low: 'bg-muted text-muted-foreground border-border',
  medium: 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300',
  high: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300',
  urgent: 'bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300',
};

const STATUS_BADGE: Record<DealerEnquiryStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300' },
  open: { label: 'Open', className: 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300' },
  in_progress: { label: 'In Progress', className: 'bg-indigo-500/15 text-indigo-700 border-indigo-500/30 dark:text-indigo-300' },
  waiting_for_dealer: { label: 'Needs Your Reply', className: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300' },
  responded: { label: 'Admin Replied', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300' },
  resolved: { label: 'Resolved', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300' },
  closed: { label: 'Closed', className: 'bg-muted text-muted-foreground border-border' },
};

export function Module13DealerSupport({ dealer }: { dealer: Dealer }) {
  const [enquiries, setEnquiries] = useState<DealerSupportEnquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // New submission state
  const [showNewForm, setShowNewForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<DealerEnquiryCategory>('product_approval');
  const [priority, setPriority] = useState<DealerEnquiryPriority>('medium');
  const [description, setDescription] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Selected thread conversation state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadEnquiries = useCallback(async () => {
    try {
      const list = await apiSync.fetchDealerEnquiries({ scope: 'dealer', dealerId: dealer.id });
      setEnquiries(list);
    } catch {
      // Keep current list on transient network retry
    } finally {
      setLoading(false);
    }
  }, [dealer.id]);

  useEffect(() => {
    loadEnquiries();
  }, [loadEnquiries]);

  useRealtimeSync(['dealer_enquiries', 'notifications'], () => loadEnquiries(), {
    enabled: Boolean(dealer.id),
    onReconnect: loadEnquiries,
  });

  const selectedEnquiry = useMemo(
    () => enquiries.find((e) => e.id === selectedId) ?? null,
    [enquiries, selectedId]
  );

  const filtered = useMemo(() => {
    return enquiries.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !e.id.toLowerCase().includes(q) &&
          !e.subject.toLowerCase().includes(q) &&
          !e.description.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [enquiries, statusFilter, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.trim().length < 3 || description.trim().length < 10) {
      toast.error('Please enter a subject and detailed description (min 10 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const created = await apiSync.createDealerEnquiry({
        subject: subject.trim(),
        category,
        priority,
        description: description.trim(),
        attachment_url: attachmentUrl.trim() || null,
      });

      setEnquiries((prev) => [created, ...prev.filter((x) => x.id !== created.id)]);
      setSubject('');
      setDescription('');
      setAttachmentUrl('');
      setShowNewForm(false);
      setSelectedId(created.id);
      const msg = `Support enquiry ${created.id} submitted to Platform Admin.`;
      setFeedback({ type: 'success', text: msg });
      toast.success(msg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit support enquiry';
      setFeedback({ type: 'error', text: msg });
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedEnquiry || !replyText.trim()) return;
    setReplying(true);
    try {
      const updated = await apiSync.updateDealerEnquiry({
        id: selectedEnquiry.id,
        actorRole: 'dealer',
        message: replyText.trim(),
      });
      setEnquiries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setReplyText('');
      toast.success('Follow-up sent to Admin team.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setReplying(false);
    }
  };

  const handleToggleClose = async (target: DealerSupportEnquiry) => {
    const nextStatus = target.status === 'closed' || target.status === 'resolved' ? 'open' : 'closed';
    setReplying(true);
    try {
      const updated = await apiSync.updateDealerEnquiry({
        id: target.id,
        actorRole: 'dealer',
        status: nextStatus,
      });
      setEnquiries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      toast.success(nextStatus === 'closed' ? `Enquiry ${target.id} closed.` : `Enquiry ${target.id} reopened.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update enquiry status');
    } finally {
      setReplying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <HelpCircle className="h-7 w-7 text-emerald-600" /> Enquiry &amp; Lead Management
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Direct Dealer-to-Admin support tickets, product approval questions &amp; verification assistance
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setShowNewForm(true)}
          className="h-10 font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" /> Submit Admin Enquiry
        </Button>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold flex items-center justify-between gap-2 ${
            feedback.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}
        >
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-[11px] opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 h-9 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Tickets ({enquiries.length})</SelectItem>
              <SelectItem value="new" className="text-xs">New</SelectItem>
              <SelectItem value="open" className="text-xs">Open</SelectItem>
              <SelectItem value="in_progress" className="text-xs">In Progress</SelectItem>
              <SelectItem value="responded" className="text-xs">Admin Replied</SelectItem>
              <SelectItem value="resolved" className="text-xs">Resolved</SelectItem>
              <SelectItem value="closed" className="text-xs">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Button type="button" variant="outline" size="sm" onClick={loadEnquiries} className="h-9 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        <Input
          placeholder="Search ticket ID (DENQ-...) or subject..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full sm:w-80 text-xs"
        />
      </div>

      {/* Enquiries List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center space-y-3 border-border/80">
          <MessageSquareText className="mx-auto h-9 w-9 text-muted-foreground opacity-40" />
          <div>
            <p className="font-bold text-sm text-foreground">No Admin Enquiries Yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Need help with product approvals, missing catalogue items, or store settings? Raise a ticket directly with Admin.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setShowNewForm(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Submit First Enquiry
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const st = STATUS_BADGE[item.status] || STATUS_BADGE.open;
            const latestReply = item.conversation?.[item.conversation.length - 1];

            return (
              <Card
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className="p-4 border-border/80 hover:border-emerald-500/40 cursor-pointer transition-all space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                        {item.id}
                      </span>
                      <Badge variant="outline" className={`text-[10px] font-bold capitalize ${PRIORITY_BADGE[item.priority]}`}>
                        {item.priority} priority
                      </Badge>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {item.category.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <h3 className="text-sm font-black text-foreground mt-1">{item.subject}</h3>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={`text-[10px] font-bold ${st.className}`}>
                      {st.label}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">{timeAgo(item.updated_at)}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>

                {latestReply && (
                  <div className="rounded-lg bg-muted/40 px-3 py-2 text-[11px] flex items-center justify-between gap-2">
                    <span className="truncate">
                      <strong className="capitalize">{latestReply.sender_role}:</strong> {latestReply.message}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold shrink-0">
                      Open Conversation →
                    </span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Direct Support Channels Reference */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 pt-2">
        <Card className="p-4 border-border/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Phone className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-xs text-foreground">Dealer Helpline</p>
              <p className="text-[11px] font-mono text-muted-foreground">+91 98480 12345</p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="h-8 text-xs">
            <a href="tel:+919848012345">Call</a>
          </Button>
        </Card>

        <Card className="p-4 border-border/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-xs text-foreground">WhatsApp Desk</p>
              <p className="text-[11px] font-mono text-emerald-600">+91 98480 12345</p>
            </div>
          </div>
          <Button asChild size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
            <a href="https://wa.me/919848012345" target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </Button>
        </Card>

        <Card className="p-4 border-border/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-xs text-foreground">Merchant Desk</p>
              <p className="text-[11px] font-mono text-muted-foreground">dealers@dealerconnect.ai</p>
            </div>
          </div>
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
        </Card>
      </div>

      {/* Submit New Enquiry Modal */}
      <Dialog open={showNewForm} onOpenChange={setShowNewForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" /> New Enquiry to Platform Admin
            </DialogTitle>
            <DialogDescription className="text-xs">
              Your enquiry is logged privately between {dealer.shop_name} and Platform Administrators.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <Label className="font-bold">Subject *</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Approval request for new appliance category / stock issue"
                className="mt-1 h-9 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-bold">Category *</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as DealerEnquiryCategory)}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="font-bold">Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as DealerEnquiryPriority)}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low" className="text-xs">Low</SelectItem>
                    <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                    <SelectItem value="high" className="text-xs">High</SelectItem>
                    <SelectItem value="urgent" className="text-xs">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="font-bold">Detailed Description *</Label>
              <Textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain your request, relevant product names, or issue details clearly..."
                className="mt-1 text-xs"
                required
              />
            </div>

            <div className="p-3 rounded-xl border border-border bg-muted/20">
              <ImagePicker
                value={attachmentUrl}
                onChange={setAttachmentUrl}
                label="Optional Screenshot / Supporting Document"
                description="Attach an image or document link"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setShowNewForm(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 mr-1" /> Submit Enquiry
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Conversation Detail Dialog */}
      <Dialog open={!!selectedEnquiry} onOpenChange={(v) => !v && setSelectedId(null)}>
        {selectedEnquiry && (
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 text-base font-black">
                <span className="font-mono text-emerald-600">{selectedEnquiry.id}</span>
                <span>•</span>
                <span>{selectedEnquiry.subject}</span>
              </DialogTitle>
              <DialogDescription className="text-xs flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="outline" className="text-[10px] capitalize">
                  {selectedEnquiry.category.replace(/_/g, ' ')}
                </Badge>
                <Badge variant="outline" className={`text-[10px] font-bold ${STATUS_BADGE[selectedEnquiry.status]?.className || ''}`}>
                  {STATUS_BADGE[selectedEnquiry.status]?.label || selectedEnquiry.status}
                </Badge>
                {selectedEnquiry.assigned_to && (
                  <span className="text-[11px] text-muted-foreground">
                    Assigned: <strong>{selectedEnquiry.assigned_to}</strong>
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {selectedEnquiry.attachment_url && (
                <div className="relative h-40 w-full overflow-hidden rounded-xl border border-border bg-muted">
                  <Image
                    src={selectedEnquiry.attachment_url}
                    alt="Enquiry attachment"
                    fill
                    sizes="500px"
                    className="object-contain p-2"
                  />
                </div>
              )}

              {/* Conversation Thread */}
              <div className="space-y-2.5 max-h-72 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3">
                {selectedEnquiry.conversation.map((msg) => {
                  const isDealerMsg = msg.sender_role === 'dealer';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isDealerMsg ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs ${
                          isDealerMsg
                            ? 'bg-emerald-600 text-white'
                            : 'bg-card border border-border text-foreground'
                        }`}
                      >
                        <div className="text-[10px] font-bold opacity-80 mb-0.5">
                          {isDealerMsg ? dealer.shop_name : `Platform Admin (${msg.sender_name})`}
                        </div>
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                        <div className="text-[9px] opacity-70 mt-1 text-right">
                          {timeAgo(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Input */}
              {selectedEnquiry.status !== 'closed' ? (
                <div className="space-y-2">
                  <Label className="font-bold">Send Follow-up Message to Admin</Label>
                  <div className="flex gap-2">
                    <Textarea
                      rows={2}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write your reply or additional context..."
                      className="text-xs flex-1"
                    />
                    <Button
                      type="button"
                      disabled={replying || !replyText.trim()}
                      onClick={handleSendReply}
                      className="h-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4"
                    >
                      {replying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted/40 p-3 text-center text-muted-foreground flex items-center justify-center gap-2">
                  <Clock className="h-4 w-4" /> This enquiry is closed. Reopen it to send additional updates.
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={replying}
                onClick={() => handleToggleClose(selectedEnquiry)}
              >
                {selectedEnquiry.status === 'closed' || selectedEnquiry.status === 'resolved'
                  ? 'Reopen Enquiry'
                  : 'Close Enquiry'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setSelectedId(null)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
