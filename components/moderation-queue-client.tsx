'use client';

import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Shield, Sparkles, AlertTriangle, Check, X, Eye, Clock, ChevronDown, ChevronRight,
  Image as ImageIcon, Flag, FileText, RefreshCw, User, Bot, Cpu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { formatINR, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase, type Product, type ProductImage, type ModerationLog } from '@/lib/supabase';
import {
  fetchModerationQueue, fetchProductModerationHistory,
  adminApproveImage, adminRejectImage, adminRequestResubmit,
} from '@/lib/moderation';

type QueueItem = Product & {
  dealer?: { shop_name: string; owner_name: string; email: string } | null;
  category?: { name: string; slug: string } | null;
  brand?: { name: string } | null;
};

export function ModerationQueueClient() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<QueueItem | null>(null);
  const [showAuditDialog, setShowAuditDialog] = useState(false);
  const [filter, setFilter] = useState('all');
  const [adminNotes, setAdminNotes] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => { loadQueue(); }, []);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const items = await fetchModerationQueue();
      setQueue(items as QueueItem[]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return queue;
    return queue.filter((p) => p.moderation_status === filter);
  }, [queue, filter]);

  const stats = useMemo(() => ({
    total: queue.length,
    flagged: queue.filter((p) => p.moderation_status === 'flagged').length,
    pending: queue.filter((p) => p.moderation_status === 'pending').length,
    rejected: queue.filter((p) => p.moderation_status === 'rejected').length,
  }), [queue]);

  const handleAction = async (action: 'approve' | 'reject' | 'resubmit', product: QueueItem, imageId: string) => {
    setActing(true);
    setAdminNotes('');
    try {
      const adminEmail = 'admin@dealerconnect.ai';
      if (action === 'approve') {
        const { error } = await adminApproveImage(imageId, product.id, adminEmail, adminNotes || 'Approved by admin');
        if (error) throw error;
        toast.success('Image approved — product is now live');
      } else if (action === 'reject') {
        const { error } = await adminRejectImage(imageId, product.id, adminEmail, adminNotes || 'Rejected by admin');
        if (error) throw error;
        toast.success('Image rejected');
      } else {
        const { error } = await adminRequestResubmit(imageId, product.id, adminEmail, adminNotes || 'Please re-upload a clearer product photo');
        if (error) throw error;
        toast.success('Resubmission requested from dealer');
      }
      await loadQueue();
      setShowAuditDialog(false);
    } catch (e: any) {
      toast.error(e.message ?? 'Action failed');
    } finally { setActing(false); }
  };

  const openAudit = (product: QueueItem) => {
    setSelectedProduct(product);
    setShowAuditDialog(true);
    setAdminNotes('');
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-muted-foreground"><Shield className="h-4 w-4" /><span className="text-xs">Total Queue</span></div>
          <p className="mt-1 text-xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
          <div className="flex items-center gap-2 text-warning"><AlertTriangle className="h-4 w-4" /><span className="text-xs">Flagged</span></div>
          <p className="mt-1 text-xl font-bold text-warning">{stats.flagged}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /><span className="text-xs">Pending AI</span></div>
          <p className="mt-1 text-xl font-bold">{stats.pending}</p>
        </div>
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 text-destructive"><X className="h-4 w-4" /><span className="text-xs">Rejected</span></div>
          <p className="mt-1 text-xl font-bold text-destructive">{stats.rejected}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Queue Items</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Queue items */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Shield className="mx-auto mb-3 h-10 w-10 text-success" />
          <p className="font-semibold text-success">All Clear</p>
          <p className="mt-1 text-sm text-muted-foreground">No products pending moderation. AI has approved all submissions.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((product) => (
            <ModerationQueueCard key={product.id} product={product} onOpenAudit={() => openAudit(product)} />
          ))}
        </div>
      )}

      {/* Audit Trail Dialog */}
      {showAuditDialog && selectedProduct && (
        <AuditTrailDialog
          product={selectedProduct}
          open={showAuditDialog}
          onOpenChange={setShowAuditDialog}
          adminNotes={adminNotes}
          setAdminNotes={setAdminNotes}
          onAction={(action, imageId) => handleAction(action, selectedProduct, imageId)}
          acting={acting}
        />
      )}
    </div>
  );
}

function ModerationQueueCard({ product, onOpenAudit }: { product: QueueItem; onOpenAudit: () => void }) {
  const [imageData, setImageData] = useState<ProductImage | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', product.id)
        .eq('is_active', true)
        .maybeSingle();
      setImageData(data as ProductImage | null);
    })();
  }, [product.id]);

  const statusConfig: Record<string, { label: string; className: string }> = {
    flagged: { label: 'Flagged', className: 'bg-warning/15 text-warning' },
    pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
    rejected: { label: 'Rejected', className: 'bg-destructive/15 text-destructive' },
    approved: { label: 'Approved', className: 'bg-success/15 text-success' },
  };
  const sc = statusConfig[product.moderation_status] ?? statusConfig.pending;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        {/* Image */}
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
          {product.images[0] && <Image src={product.images[0]} alt={product.name} fill sizes="80px" className="object-cover" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="line-clamp-1 font-semibold">{product.name}</p>
              <p className="text-xs text-muted-foreground">{product.dealer?.shop_name} · {product.category?.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Submitted {timeAgo(product.created_at)}</p>
            </div>
            <Badge className={cn('shrink-0', sc.className)}>{sc.label}</Badge>
          </div>

          {/* AI flags */}
          {imageData && imageData.ai_flags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {imageData.ai_flags.map((flag) => (
                <Badge key={flag} variant="outline" className="gap-1 text-[10px] border-warning/40 text-warning">
                  <Flag className="h-2.5 w-2.5" /> {flag.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          )}

          {imageData?.ai_warning && (
            <p className="mt-2 line-clamp-2 rounded bg-warning/5 px-2 py-1 text-xs text-warning">{imageData.ai_warning}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          AI Details
        </Button>
        <Button size="sm" onClick={onOpenAudit}>
          <Eye className="mr-1.5 h-4 w-4" /> Review & Audit Trail
        </Button>
      </div>

      {expanded && imageData && (
        <div className="border-t border-border/60 bg-muted/20 p-4 text-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">AI Verdict</p><p className="font-medium">{imageData.ai_verdict}</p></div>
            <div><p className="text-xs text-muted-foreground">Confidence</p><p className="font-medium">{(imageData.ai_confidence * 100).toFixed(0)}%</p></div>
            <div><p className="text-xs text-muted-foreground">Detected Product</p><p className="font-medium">{imageData.ai_detected_product ?? '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Detected Brand</p><p className="font-medium">{imageData.ai_detected_brand ?? '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Detected Category</p><p className="font-medium">{imageData.ai_detected_category ?? '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Detected Color</p><p className="font-medium">{imageData.ai_detected_color ?? '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Image Version</p><p className="font-medium">v{imageData.version}</p></div>
            <div><p className="text-xs text-muted-foreground">Moderation Status</p><p className="font-medium">{imageData.moderation_status.replace(/_/g, ' ')}</p></div>
          </div>
          {imageData.ai_description && (
            <div className="mt-3"><p className="text-xs text-muted-foreground">AI Description</p><p className="mt-0.5">{imageData.ai_description}</p></div>
          )}
          {imageData.ai_tags && imageData.ai_tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {imageData.ai_tags.map((tag) => <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>)}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function AuditTrailDialog({
  product, open, onOpenChange, adminNotes, setAdminNotes, onAction, acting,
}: {
  product: QueueItem;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  adminNotes: string;
  setAdminNotes: (v: string) => void;
  onAction: (action: 'approve' | 'reject' | 'resubmit', imageId: string) => void;
  acting: boolean;
}) {
  const [images, setImages] = useState<ProductImage[]>([]);
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [loadingTrail, setLoadingTrail] = useState(true);
  const [activeImageId, setActiveImageId] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoadingTrail(true);
      try {
        const { images: imgs, logs: lgs } = await fetchProductModerationHistory(product.id);
        setImages(imgs);
        setLogs(lgs);
        const active = imgs.find((i) => i.is_active);
        setActiveImageId(active?.id ?? imgs[0]?.id ?? '');
      } catch (e) { console.error(e); }
      finally { setLoadingTrail(false); }
    })();
  }, [open, product.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Moderation Audit Trail
          </DialogTitle>
        </DialogHeader>

        {/* Product summary */}
        <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
          <div className="relative h-14 w-14 overflow-hidden rounded-lg bg-muted">
            {product.images[0] && <Image src={product.images[0]} alt={product.name} fill sizes="56px" className="object-cover" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{product.name}</p>
            <p className="text-xs text-muted-foreground">{product.dealer?.shop_name} · {formatINR(product.price)}</p>
          </div>
        </div>

        {loadingTrail ? (
          <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : (
          <div className="space-y-4">
            {/* Image versions */}
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><ImageIcon className="h-4 w-4" /> Image Versions ({images.length})</h4>
              <div className="space-y-2">
                {images.map((img) => (
                  <div key={img.id} className={cn('rounded-lg border p-3', img.id === activeImageId ? 'border-primary/40 bg-primary/5' : 'border-border/60')}>
                    <div className="flex items-start gap-3">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-muted">
                        <Image src={img.image_url} alt={`v${img.version}`} fill sizes="64px" className="object-cover" />
                      </div>
                      <div className="flex-1 min-w-0 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">v{img.version}</Badge>
                          {img.is_active && <Badge className="bg-success/15 text-success text-[10px]">Active</Badge>}
                          <span className="text-xs text-muted-foreground">{timeAgo(img.created_at)}</span>
                        </div>
                        <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <span><span className="text-muted-foreground">AI Verdict:</span> <span className={cn('font-medium', img.ai_verdict === 'approved' ? 'text-success' : img.ai_verdict === 'flagged' ? 'text-warning' : 'text-destructive')}>{img.ai_verdict}</span></span>
                          <span><span className="text-muted-foreground">Confidence:</span> <span className="font-medium">{(img.ai_confidence * 100).toFixed(0)}%</span></span>
                          {img.ai_flags.length > 0 && (
                            <span className="col-span-2"><span className="text-muted-foreground">Flags:</span> {img.ai_flags.map((f) => <Badge key={f} variant="outline" className="ml-1 text-[10px] border-warning/40 text-warning">{f.replace(/_/g, ' ')}</Badge>)}</span>
                          )}
                          <span><span className="text-muted-foreground">Moderation:</span> <span className="font-medium">{img.moderation_status.replace(/_/g, ' ')}</span></span>
                          <span><span className="text-muted-foreground">Reviewed by:</span> <span className="font-medium">{img.reviewed_by ?? '—'}</span></span>
                        </div>
                        {img.dealer_comment && (
                          <p className="mt-1.5 rounded bg-muted/50 px-2 py-1 text-xs"><span className="text-muted-foreground">Dealer:</span> {img.dealer_comment}</p>
                        )}
                        {img.admin_notes && (
                          <p className="mt-1 rounded bg-primary/5 px-2 py-1 text-xs"><span className="text-muted-foreground">Admin:</span> {img.admin_notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit log timeline */}
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><FileText className="h-4 w-4" /> Action Timeline ({logs.length})</h4>
              <div className="space-y-2">
                {logs.map((log) => {
                  const icon = log.actor_type === 'ai' ? <Bot className="h-3.5 w-3.5" /> : log.actor_type === 'admin' ? <Shield className="h-3.5 w-3.5" /> : log.actor_type === 'dealer' ? <User className="h-3.5 w-3.5" /> : <Cpu className="h-3.5 w-3.5" />;
                  const color = log.actor_type === 'ai' ? 'text-accent' : log.actor_type === 'admin' ? 'text-primary' : log.actor_type === 'dealer' ? 'text-muted-foreground' : 'text-muted-foreground';
                  return (
                    <div key={log.id} className="flex items-start gap-2 rounded-lg border border-border/40 p-2.5 text-xs">
                      <span className={cn('mt-0.5 shrink-0', color)}>{icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{log.action.replace(/_/g, ' ')}</span>
                          {log.verdict && (
                            <Badge variant="outline" className={cn('text-[10px]', log.verdict === 'approved' ? 'border-success/40 text-success' : log.verdict === 'flagged' ? 'border-warning/40 text-warning' : 'border-destructive/40 text-destructive')}>{log.verdict}</Badge>
                          )}
                          {log.image_version && <span className="text-muted-foreground">v{log.image_version}</span>}
                        </div>
                        <p className="text-muted-foreground">{log.actor_name} · {timeAgo(log.created_at)}</p>
                        {log.notes && <p className="mt-0.5">{log.notes}</p>}
                        {log.flags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {log.flags.map((f) => <Badge key={f} variant="outline" className="text-[10px] border-warning/40 text-warning">{f.replace(/_/g, ' ')}</Badge>)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {logs.length === 0 && <p className="text-sm text-muted-foreground">No actions logged yet.</p>}
              </div>
            </div>

            {/* Admin action panel */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <h4 className="mb-2 text-sm font-semibold">Admin Review Action</h4>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Notes (visible to dealer)</Label>
              <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Add review notes..." className="mb-3 min-h-[60px]" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="bg-success hover:bg-success/90" disabled={acting || !activeImageId} onClick={() => onAction('approve', activeImageId)}>
                  <Check className="mr-1.5 h-4 w-4" /> Approve & Publish
                </Button>
                <Button size="sm" variant="outline" className="border-warning/40 text-warning hover:bg-warning/10" disabled={acting || !activeImageId} onClick={() => onAction('resubmit', activeImageId)}>
                  <RefreshCw className="mr-1.5 h-4 w-4" /> Request Resubmit
                </Button>
                <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" disabled={acting || !activeImageId} onClick={() => onAction('reject', activeImageId)}>
                  <X className="mr-1.5 h-4 w-4" /> Reject
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
