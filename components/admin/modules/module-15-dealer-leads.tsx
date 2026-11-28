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
  CheckCircle2,
  Clock,
  Eye,
  Headphones,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Store,
  UserCheck,
} from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const STATUS_META: Record<DealerEnquiryStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300' },
  open: { label: 'Open', className: 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300' },
  in_progress: { label: 'In Progress', className: 'bg-indigo-500/15 text-indigo-700 border-indigo-500/30 dark:text-indigo-300' },
  waiting_for_dealer: { label: 'Waiting on Dealer', className: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300' },
  responded: { label: 'Responded', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300' },
  resolved: { label: 'Resolved', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300' },
  closed: { label: 'Closed', className: 'bg-muted text-muted-foreground border-border' },
};

const PRIORITY_BADGE: Record<DealerEnquiryPriority, string> = {
  low: 'bg-muted text-muted-foreground border-border',
  medium: 'bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300',
  high: 'bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300',
  urgent: 'bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300',
};

function formatDurationMinutes(startIso?: string | null, endIso?: string | null): string {
  if (!startIso || !endIso) return 'Pending';
  const diffMs = Math.max(0, new Date(endIso).getTime() - new Date(startIso).getTime());
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = (mins / 60).toFixed(1);
  return `${hrs}h`;
}

export function Module15DealerLeads({ dealers }: { dealers: Dealer[] }) {
  const [enquiries, setEnquiries] = useState<DealerSupportEnquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDealer, setFilterDealer] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [assignedToInput, setAssignedToInput] = useState('');
  const [internalNotesInput, setInternalNotesInput] = useState('');
  const [statusInput, setStatusInput] = useState<DealerEnquiryStatus>('open');
  const [saving, setSaving] = useState(false);

  const loadLeads = useCallback(async () => {
    try {
      const list = await apiSync.fetchDealerEnquiries({ scope: 'admin' });
      setEnquiries(list);
    } catch {
      // Keep current list on retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useRealtimeSync(['dealer_enquiries', 'notifications'], () => loadLeads(), {
    onReconnect: loadLeads,
  });

  const selectedEnquiry = useMemo(
    () => enquiries.find((e) => e.id === selectedId) ?? null,
    [enquiries, selectedId]
  );

  const openModal = (item: DealerSupportEnquiry) => {
    setSelectedId(item.id);
    setAssignedToInput(item.assigned_to || '');
    setInternalNotesInput(item.internal_notes || '');
    setStatusInput(item.status);
    setReplyText('');
  };

  const counts = useMemo(() => {
    let openNew = 0;
    let inProgress = 0;
    let responded = 0;
    let closedResolved = 0;
    for (const e of enquiries) {
      if (e.status === 'new' || e.status === 'open') openNew++;
      else if (e.status === 'in_progress' || e.status === 'waiting_for_dealer') inProgress++;
      else if (e.status === 'responded') responded++;
      else closedResolved++;
    }
    return { total: enquiries.length, openNew, inProgress, responded, closedResolved };
  }, [enquiries]);

  const filtered = useMemo(() => {
    return enquiries.filter((e) => {
      if (filterDealer !== 'all' && e.dealer_id !== filterDealer) return false;
      if (filterCategory !== 'all' && e.category !== (filterCategory as DealerEnquiryCategory)) return false;
      if (filterPriority !== 'all' && e.priority !== (filterPriority as DealerEnquiryPriority)) return false;
      if (filterStatus !== 'all' && e.status !== (filterStatus as DealerEnquiryStatus)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !e.id.toLowerCase().includes(q) &&
          !e.subject.toLowerCase().includes(q) &&
          !e.shop_name.toLowerCase().includes(q) &&
          !e.dealer_name.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [enquiries, filterDealer, filterCategory, filterPriority, filterStatus, search]);

  const handleAdminUpdate = async (opts?: { includeReply?: boolean; overrideStatus?: DealerEnquiryStatus }) => {
    if (!selectedEnquiry) return;
    const msg = opts?.includeReply ? replyText.trim() : undefined;
    if (opts?.includeReply && !msg) {
      toast.error('Please enter a response message before sending.');
      return;
    }

    setSaving(true);
    try {
      const updated = await apiSync.updateDealerEnquiry({
        id: selectedEnquiry.id,
        actorRole: 'admin',
        status: opts?.overrideStatus ?? statusInput,
        assigned_to: assignedToInput,
        internal_notes: internalNotesInput,
        message: msg,
      });

      setEnquiries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setStatusInput(updated.status);
      if (msg) setReplyText('');
      toast.success(
        msg ? `Reply sent to ${selectedEnquiry.shop_name}!` : `Lead ${selectedEnquiry.id} updated.`
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update dealer lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
            <Headphones className="h-7 w-7 text-primary" /> Dealer Enquiry &amp; Lead Management
          </h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Dedicated Admin workspace for Dealer-to-Admin support tickets, approvals help &amp; escalations (strictly separate from Customer Enquiries)
          </p>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={loadLeads} className="h-9 text-xs self-start sm:self-auto">
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh Leads
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card className="p-3.5 border-border/80">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Total Leads</span>
          <p className="text-2xl font-black mt-0.5">{counts.total}</p>
        </Card>
        <Card className="p-3.5 border-amber-500/30 bg-amber-500/5">
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 uppercase">New / Open</span>
          <p className="text-2xl font-black text-amber-600 mt-0.5">{counts.openNew}</p>
        </Card>
        <Card className="p-3.5 border-indigo-500/30 bg-indigo-500/5">
          <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 uppercase">In Progress</span>
          <p className="text-2xl font-black text-indigo-600 mt-0.5">{counts.inProgress}</p>
        </Card>
        <Card className="p-3.5 border-emerald-500/30 bg-emerald-500/5">
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase">Responded</span>
          <p className="text-2xl font-black text-emerald-600 mt-0.5">{counts.responded}</p>
        </Card>
        <Card className="p-3.5 border-border/80 col-span-2 sm:col-span-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Resolved / Closed</span>
          <p className="text-2xl font-black mt-0.5">{counts.closedResolved}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 h-9 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
              <SelectItem value="new" className="text-xs">New</SelectItem>
              <SelectItem value="open" className="text-xs">Open</SelectItem>
              <SelectItem value="in_progress" className="text-xs">In Progress</SelectItem>
              <SelectItem value="waiting_for_dealer" className="text-xs">Waiting on Dealer</SelectItem>
              <SelectItem value="responded" className="text-xs">Responded</SelectItem>
              <SelectItem value="resolved" className="text-xs">Resolved</SelectItem>
              <SelectItem value="closed" className="text-xs">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterDealer} onValueChange={setFilterDealer}>
            <SelectTrigger className="w-44 h-9 text-xs">
              <SelectValue placeholder="All Dealers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Dealers</SelectItem>
              {dealers.map((d) => (
                <SelectItem key={d.id} value={d.id} className="text-xs">
                  {d.shop_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-44 h-9 text-xs">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Categories</SelectItem>
              <SelectItem value="product_approval" className="text-xs">Product Approval</SelectItem>
              <SelectItem value="catalog_request" className="text-xs">Catalog Request</SelectItem>
              <SelectItem value="account_issue" className="text-xs">Account Issue</SelectItem>
              <SelectItem value="verification" className="text-xs">Verification</SelectItem>
              <SelectItem value="technical_support" className="text-xs">Technical Support</SelectItem>
              <SelectItem value="platform_issue" className="text-xs">Platform Issue</SelectItem>
              <SelectItem value="billing_subscription" className="text-xs">Billing</SelectItem>
              <SelectItem value="other" className="text-xs">Other</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-36 h-9 text-xs">
              <SelectValue placeholder="All Priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Priorities</SelectItem>
              <SelectItem value="urgent" className="text-xs">Urgent</SelectItem>
              <SelectItem value="high" className="text-xs">High</SelectItem>
              <SelectItem value="medium" className="text-xs">Medium</SelectItem>
              <SelectItem value="low" className="text-xs">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search DENQ ID, shop, subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Table / Cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-2.5">
            {filtered.length === 0 ? (
              <Card className="p-8 text-center text-xs text-muted-foreground">
                No dealer enquiries match your current filters.
              </Card>
            ) : (
              filtered.map((item) => {
                const st = STATUS_META[item.status] || STATUS_META.open;
                return (
                  <Card key={item.id} className="p-4 border-border/80 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-[11px] font-bold text-primary">{item.id}</span>
                        <h3 className="text-sm font-black text-foreground">{item.subject}</h3>
                        <p className="text-[11px] text-muted-foreground">{item.shop_name}</p>
                      </div>
                      <Badge variant="outline" className={`text-[10px] font-bold ${st.className}`}>
                        {st.label}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openModal(item)}
                      className="w-full h-8 text-xs font-semibold"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" /> Manage Lead
                    </Button>
                  </Card>
                );
              })
            )}
          </div>

          <Card className="hidden md:block border-border/80 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/80 font-bold text-muted-foreground uppercase text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Ticket &amp; Subject</th>
                    <th className="px-4 py-3">Submitting Dealer</th>
                    <th className="px-4 py-3">Category &amp; Priority</th>
                    <th className="px-4 py-3">SLA &amp; Assignee</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                        No dealer enquiries match your current filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item) => {
                      const st = STATUS_META[item.status] || STATUS_META.open;
                      return (
                        <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3.5 max-w-xs">
                            <span className="font-mono text-[11px] font-bold text-primary block">
                              {item.id}
                            </span>
                            <span className="font-bold text-foreground line-clamp-1">
                              {item.subject}
                            </span>
                            <span className="text-[11px] text-muted-foreground line-clamp-1">
                              {item.description}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="font-bold text-foreground flex items-center gap-1">
                              <Store className="h-3.5 w-3.5 text-primary shrink-0" /> {item.shop_name}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {item.dealer_name} • {item.dealer_email}
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <Badge variant="outline" className="text-[10px] capitalize mb-1">
                              {item.category.replace(/_/g, ' ')}
                            </Badge>
                            <div>
                              <Badge variant="outline" className={`text-[10px] font-bold capitalize ${PRIORITY_BADGE[item.priority]}`}>
                                {item.priority}
                              </Badge>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-[11px] text-muted-foreground">
                            <div>First Reply: <strong>{formatDurationMinutes(item.created_at, item.first_responded_at)}</strong></div>
                            <div>Assignee: <strong>{item.assigned_to || 'Unassigned'}</strong></div>
                          </td>

                          <td className="px-4 py-3.5">
                            <Badge variant="outline" className={`text-[10px] font-bold ${st.className}`}>
                              {st.label}
                            </Badge>
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {timeAgo(item.updated_at)}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openModal(item)}
                              className="h-8 px-3 text-xs font-semibold"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" /> Open Thread
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Admin Lead Conversation & Management Modal */}
      <Dialog open={!!selectedEnquiry} onOpenChange={(v) => !v && setSelectedId(null)}>
        {selectedEnquiry && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <span className="font-mono text-primary">{selectedEnquiry.id}</span>
                <span>•</span>
                <span className="text-base">{selectedEnquiry.subject}</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                From {selectedEnquiry.shop_name} ({selectedEnquiry.dealer_email}) • Created {timeAgo(selectedEnquiry.created_at)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Timeline / SLA Bar */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-muted/30 border border-border">
                <div>
                  <span className="text-[10px] text-muted-foreground block">First Response</span>
                  <strong className="text-foreground">
                    {formatDurationMinutes(selectedEnquiry.created_at, selectedEnquiry.first_responded_at)}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Resolution Time</span>
                  <strong className="text-foreground">
                    {formatDurationMinutes(selectedEnquiry.created_at, selectedEnquiry.resolved_at)}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Priority</span>
                  <Badge variant="outline" className={`text-[10px] font-bold capitalize mt-0.5 ${PRIORITY_BADGE[selectedEnquiry.priority]}`}>
                    {selectedEnquiry.priority}
                  </Badge>
                </div>
              </div>

              {selectedEnquiry.attachment_url && (
                <div className="relative h-40 w-full overflow-hidden rounded-xl border border-border bg-muted">
                  <Image
                    src={selectedEnquiry.attachment_url}
                    alt="Attachment"
                    fill
                    sizes="520px"
                    className="object-contain p-2"
                  />
                </div>
              )}

              {/* Conversation Thread */}
              <div className="space-y-2.5 max-h-64 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3">
                {selectedEnquiry.conversation.map((msg) => {
                  const isAdminMsg = msg.sender_role === 'admin';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isAdminMsg ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                          isAdminMsg
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card border border-border text-foreground'
                        }`}
                      >
                        <div className="text-[10px] font-bold opacity-80 mb-0.5">
                          {isAdminMsg ? `Admin (${msg.sender_name})` : msg.sender_name}
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

              {/* Admin Controls: Status & Assignee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-border bg-card">
                <div>
                  <Label className="font-bold">Lead Status</Label>
                  <Select value={statusInput} onValueChange={(v) => setStatusInput(v as DealerEnquiryStatus)}>
                    <SelectTrigger className="mt-1 h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new" className="text-xs">New</SelectItem>
                      <SelectItem value="open" className="text-xs">Open</SelectItem>
                      <SelectItem value="in_progress" className="text-xs">In Progress</SelectItem>
                      <SelectItem value="waiting_for_dealer" className="text-xs">Waiting for Dealer</SelectItem>
                      <SelectItem value="responded" className="text-xs">Responded</SelectItem>
                      <SelectItem value="resolved" className="text-xs">Resolved</SelectItem>
                      <SelectItem value="closed" className="text-xs">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="font-bold flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5 text-primary" /> Assigned Admin / Team
                  </Label>
                  <Input
                    value={assignedToInput}
                    onChange={(e) => setAssignedToInput(e.target.value)}
                    placeholder="e.g. Platform Ops, Catalog Team"
                    className="mt-1 h-9 text-xs"
                  />
                </div>
              </div>

              {/* Private Internal Admin Notes (NEVER sent to Dealers) */}
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-1.5">
                <Label className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Internal Admin Notes (Private — Hidden from Dealer)
                </Label>
                <Textarea
                  rows={2}
                  value={internalNotesInput}
                  onChange={(e) => setInternalNotesInput(e.target.value)}
                  placeholder="Internal investigation notes, compliance context, or handoff notes..."
                  className="text-xs bg-background"
                />
              </div>

              {/* Public Reply to Dealer */}
              <div className="space-y-1.5">
                <Label className="font-bold">Official Response to Dealer</Label>
                <div className="flex gap-2">
                  <Textarea
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write an official response visible to the dealer..."
                    className="text-xs flex-1"
                  />
                  <Button
                    type="button"
                    disabled={saving || !replyText.trim()}
                    onClick={() => handleAdminUpdate({ includeReply: true })}
                    className="h-auto px-4 font-bold"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => handleAdminUpdate({ includeReply: false })}
              >
                Save Status &amp; Notes
              </Button>
              {selectedEnquiry.status !== 'resolved' && selectedEnquiry.status !== 'closed' ? (
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => handleAdminUpdate({ includeReply: false, overrideStatus: 'resolved' })}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Resolved
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => handleAdminUpdate({ includeReply: false, overrideStatus: 'open' })}
                >
                  <Clock className="h-4 w-4 mr-1" /> Reopen Lead
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={() => setSelectedId(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
