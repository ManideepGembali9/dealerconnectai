'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  Sparkles, AlertTriangle, Check, X, Upload, MessageSquare, RefreshCw,
  ImageIcon, Flag, Clock, Eye,
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
import { formatINR, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase, type Product, type ProductImage, type Dealer, type Category, type Brand } from '@/lib/supabase';
import { dealerReuploadImage, dealerAddComment } from '@/lib/moderation';

type FlaggedProduct = Product & {
  category?: { name: string; slug: string } | null;
  brand?: { name: string } | null;
};

export function DealerModerationClient({ dealer }: { dealer: Dealer }) {
  const [flagged, setFlagged] = useState<FlaggedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<FlaggedProduct | null>(null);
  const [showReupload, setShowReupload] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [comment, setComment] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => { loadFlagged(); }, [dealer.id]);

  const loadFlagged = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, category:category_id(*), brand:brand_id(*)')
        .eq('dealer_id', dealer.id)
        .in('moderation_status', ['flagged', 'rejected', 'pending'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFlagged((data as FlaggedProduct[]) ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleReupload = async () => {
    if (!selectedProduct || !newImageUrl.trim()) return;
    setActing(true);
    try {
      const existing = flagged.map((p) => ({ url: p.images[0], productName: p.name }));
      const { error } = await dealerReuploadImage(
        selectedProduct.id,
        newImageUrl.trim(),
        selectedProduct.name,
        selectedProduct.category?.slug ?? '',
        dealer.id,
        dealer.shop_name,
        comment || 'Re-uploaded with corrected image',
        existing,
      );
      if (error) throw error;
      toast.success('Image re-uploaded — AI analysis complete');
      setShowReupload(false);
      setNewImageUrl('');
      setComment('');
      await loadFlagged();
    } catch (e: any) {
      toast.error(e.message ?? 'Re-upload failed');
    } finally { setActing(false); }
  };

  const handleComment = async (imageId: string) => {
    if (!selectedProduct || !comment.trim()) return;
    setActing(true);
    try {
      const { error } = await dealerAddComment(imageId, selectedProduct.id, dealer.id, dealer.shop_name, comment);
      if (error) throw error;
      toast.success('Comment added');
      setComment('');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to add comment');
    } finally { setActing(false); }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (flagged.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Check className="mx-auto mb-3 h-10 w-10 text-success" />
        <p className="font-semibold text-success">All Products Approved</p>
        <p className="mt-1 text-sm text-muted-foreground">No flagged images. All your product listings have passed AI moderation.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <h3 className="font-semibold text-warning">Flagged Products ({flagged.length})</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">These products are held until image issues are resolved. Re-upload corrected images or add comments for admin review.</p>
      </div>

      {flagged.map((product) => (
        <FlaggedProductCard
          key={product.id}
          product={product}
          dealerId={dealer.id}
          onReupload={() => { setSelectedProduct(product); setShowReupload(true); setComment(''); }}
          onComment={() => { setSelectedProduct(product); setComment(''); }}
          comment={comment}
          setComment={setComment}
          onSubmitComment={handleComment}
          acting={acting}
        />
      ))}

      {/* Re-upload dialog */}
      {showReupload && selectedProduct && (
        <Dialog open={showReupload} onOpenChange={setShowReupload}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-primary" /> Re-upload Image</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                <div className="relative h-16 w-16 overflow-hidden rounded bg-muted">
                  {selectedProduct.images[0] && <Image src={selectedProduct.images[0]} alt={selectedProduct.name} fill sizes="64px" className="object-cover" />}
                </div>
                <div>
                  <p className="font-medium">{selectedProduct.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedProduct.category?.name}</p>
                </div>
              </div>

              <div className="rounded-lg bg-accent/5 border border-accent/20 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-accent"><Sparkles className="h-4 w-4" /> AI will re-analyze your new image</p>
                <p className="mt-1 text-xs text-muted-foreground">Upload a clear, original product photo. Avoid stock images, watermarks, or photos that don't match the product name.</p>
              </div>

              <div>
                <Label className="mb-1.5 block text-sm">New Image URL</Label>
                <Input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="https://images.pexels.com/..." />
                <p className="mt-1 text-xs text-muted-foreground">Paste a direct link to your product photo</p>
              </div>

              <div>
                <Label className="mb-1.5 block text-sm">Comment for Admin (optional)</Label>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Explain what was fixed..." className="min-h-[60px]" />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowReupload(false)}>Cancel</Button>
                <Button onClick={handleReupload} disabled={acting || !newImageUrl.trim()}>
                  {acting ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                  Upload & Re-analyze
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function FlaggedProductCard({
  product, dealerId, onReupload, onComment, comment, setComment, onSubmitComment, acting,
}: {
  product: FlaggedProduct;
  dealerId: string;
  onReupload: () => void;
  onComment: () => void;
  comment: string;
  setComment: (v: string) => void;
  onSubmitComment: (imageId: string) => void;
  acting: boolean;
}) {
  const [imageData, setImageData] = useState<ProductImage | null>(null);
  const [showCommentBox, setShowCommentBox] = useState(false);

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
    pending: { label: 'Pending Review', className: 'bg-muted text-muted-foreground' },
    rejected: { label: 'Rejected', className: 'bg-destructive/15 text-destructive' },
  };
  const sc = statusConfig[product.moderation_status] ?? statusConfig.pending;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
          {product.images[0] && <Image src={product.images[0]} alt={product.name} fill sizes="80px" className="object-cover" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="line-clamp-1 font-semibold">{product.name}</p>
              <p className="text-xs text-muted-foreground">{product.category?.name} · {formatINR(product.price)}</p>
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
            <p className="mt-2 line-clamp-3 rounded bg-warning/5 px-2 py-1.5 text-xs text-warning">
              <Sparkles className="mr-1 inline h-3 w-3" /> {imageData.ai_warning}
            </p>
          )}

          {imageData?.admin_notes && (
            <p className="mt-1.5 rounded bg-primary/5 px-2 py-1 text-xs">
              <span className="font-medium text-primary">Admin:</span> {imageData.admin_notes}
            </p>
          )}

          {imageData?.dealer_comment && (
            <p className="mt-1 rounded bg-muted/50 px-2 py-1 text-xs">
              <span className="font-medium">Your comment:</span> {imageData.dealer_comment}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-2.5">
        <Button size="sm" onClick={onReupload}>
          <Upload className="mr-1.5 h-4 w-4" /> Re-upload Image
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setShowCommentBox(!showCommentBox); onComment(); }}>
          <MessageSquare className="mr-1.5 h-4 w-4" /> {showCommentBox ? 'Hide Comment' : 'Add Comment'}
        </Button>
        {imageData && (
          <span className="ml-auto text-xs text-muted-foreground">
            v{imageData.version} · AI: {imageData.ai_verdict} ({(imageData.ai_confidence * 100).toFixed(0)}%)
          </span>
        )}
      </div>

      {/* Comment box */}
      {showCommentBox && imageData && (
        <div className="border-t border-border/60 bg-muted/20 p-4">
          <Label className="mb-1.5 block text-xs text-muted-foreground">Comment for admin review</Label>
          <div className="flex gap-2">
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Explain the issue or provide context..." className="min-h-[50px]" />
          </div>
          <Button size="sm" className="mt-2" disabled={acting || !comment.trim()} onClick={() => onSubmitComment(imageData.id)}>
            <MessageSquare className="mr-1.5 h-4 w-4" /> Submit Comment
          </Button>
        </div>
      )}
    </Card>
  );
}
