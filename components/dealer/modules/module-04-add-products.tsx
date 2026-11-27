'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  PlusCircle, ShieldCheck, Sparkles, Package, Layers, CheckCircle2,
  Image as ImageIcon, Send, ArrowRight, Tag, DollarSign, Store, Clock
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { ImagePicker } from '@/components/ui/image-picker';
import { DealerCatalogClient } from '@/components/dealer-catalog-client';
import { getDbCategories, getDbBrands, saveDbProduct, broadcastSync } from '@/lib/firebase-db';
import type { Dealer, Category, Brand, Product } from '@/lib/types';
import { toast } from 'sonner';

type Module04Props = {
  dealer: Dealer;
};

const SAMPLE_IMAGES = [
  { label: 'Headphones', url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800' },
  { label: 'Smartphone', url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800' },
  { label: 'Smart TV', url: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800' },
  { label: 'Laptop', url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800' },
  { label: 'Smartwatch', url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800' },
  { label: 'Camera', url: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800' },
];

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function Module04DealerAddProducts({ dealer }: Module04Props) {
  const [activeTab, setActiveTab] = useState<'catalog' | 'custom'>('catalog');
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  // Form states
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandName, setBrandName] = useState('');
  const [model, setModel] = useState('');
  const [mrp, setMrp] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [stockQty, setStockQty] = useState('10');
  const [stockStatus, setStockStatus] = useState<Product['stock_status']>('in_stock');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [warranty, setWarranty] = useState('1 Year Manufacturer Warranty');
  const [color, setColor] = useState('Black');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadMetadata() {
      try {
        const [cats, brnds] = await Promise.all([
          getDbCategories(),
          getDbBrands(),
        ]);
        setCategories(cats);
        setBrands(brnds);
        if (cats.length > 0) setCategoryId(cats[0].id);
      } catch (e) {
        console.error('Failed to load categories/brands', e);
      }
    }
    loadMetadata();
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Please enter product name'); return; }
    if (!categoryId) { toast.error('Please select a category'); return; }
    if (!mrp || parseFloat(mrp) <= 0) { toast.error('Please enter a valid MRP price'); return; }

    setSubmitting(true);
    try {
      const selectedCat = categories.find((c) => c.id === categoryId);
      const existingBrand = brands.find((b) => b.name.toLowerCase() === brandName.toLowerCase().trim());

      const numMrp = parseFloat(mrp);
      const numOffer = offerPrice ? parseFloat(offerPrice) : numMrp;
      const numStock = parseInt(stockQty, 10) || 0;
      const finalImage = imageUrl.trim() || SAMPLE_IMAGES[0].url;

      const newProduct: Product = {
        id: `prod-dealer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        dealer_id: dealer.id,
        name: name.trim(),
        slug: `${slugify(name)}-${Date.now().toString(36).slice(-4)}`,
        brand_id: existingBrand ? existingBrand.id : null,
        category_id: categoryId,
        model: model.trim() || null,
        sku: model.trim() || `SKU-${Date.now().toString().slice(-6)}`,
        barcode: null,
        description: description.trim() || `${name} available at ${dealer.shop_name}`,
        specifications: {
          'Warranty': warranty || '1 Year Standard Warranty',
          'Color': color || 'Standard',
          'Dealer Shop': dealer.shop_name,
          'Dealer Contact': dealer.phone,
          'City': dealer.city,
        },
        features: [
          'Authentic local store stock',
          'Verified Dealer Guarantee',
          warranty ? warranty : 'Standard Warranty Included',
        ],
        price: numMrp,
        discount_price: numOffer < numMrp ? numOffer : null,
        color: color || null,
        size: null,
        weight: null,
        material: null,
        warranty: warranty || null,
        delivery_available: dealer.delivery_available,
        pickup_available: dealer.pickup_available,
        return_policy: '7 Days Store Replacement',
        tags: [selectedCat?.name || '', brandName, dealer.city].filter(Boolean),
        images: [finalImage],
        video_url: null,
        stock_qty: numStock,
        stock_status: stockStatus,
        is_featured: false,
        is_trending: false,
        is_master: false,
        is_active: false, // Inactive until Admin Approval!
        short_description: description ? description.slice(0, 140) : `Genuine ${name} from ${dealer.shop_name}`,
        seo_title: `${name} - ${dealer.shop_name}`,
        seo_description: `Buy ${name} at best price from ${dealer.shop_name} in ${dealer.city}`,
        keywords: [name, brandName, selectedCat?.name || ''].filter(Boolean),
        model_number: model.trim() || null,
        ai_confidence: 0.96,
        ai_status: 'approved',
        subcategory_id: null,
        variants: {},
        view_count: 0,
        search_count: 0,
        ai_verified: false,
        ai_description: null,
        ai_tags: [],
        moderation_status: 'pending', // PENDING ADMIN APPROVAL
        created_at: new Date().toISOString(),
      };

      await saveDbProduct(newProduct);
      broadcastSync('products', newProduct);

      toast.success('Product submitted for Admin approval! The Admin will review and activate it shortly.');

      // Reset form
      setName('');
      setModel('');
      setMrp('');
      setOfferPrice('');
      setDescription('');
      setImageUrl('');
    } catch {
      toast.error('Failed to submit product. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl flex items-center gap-2">
          <PlusCircle className="h-7 w-7 text-emerald-600" /> Add & Propose Products
        </h1>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Add verified products from the Admin master catalog or submit your own custom items for Admin approval
        </p>
      </div>

      {/* Tabs navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="grid grid-cols-2 max-w-md h-10 p-1 bg-muted/60">
          <TabsTrigger value="catalog" className="text-xs font-bold gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground">
            <Layers className="h-3.5 w-3.5 text-emerald-600" /> Browse Master Catalog
          </TabsTrigger>
          <TabsTrigger value="custom" className="text-xs font-bold gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Create Custom Product
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: BROWSE MASTER CATALOG */}
        <TabsContent value="catalog" className="space-y-4 focus-visible:outline-none">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 text-xs text-foreground flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Instant Activation:</span> Products picked from the verified Master Catalog are already approved and appear in your showroom immediately with your custom pricing.
            </div>
          </div>

          <DealerCatalogClient dealer={dealer} />
        </TabsContent>

        {/* TAB 2: CREATE CUSTOM PRODUCT */}
        <TabsContent value="custom" className="space-y-4 focus-visible:outline-none">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs text-foreground flex items-start gap-2.5">
            <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Admin Moderation Notice:</span> Custom products you submit here are reviewed by the platform administrator before going live. Once approved, they will be activated and visible to local customers.
            </div>
          </div>

          <Card className="border-border/80 p-5 sm:p-7 shadow-sm">
            <form onSubmit={handleCreateProduct} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Product Name */}
                <div className="sm:col-span-2">
                  <Label htmlFor="prodName" className="text-xs font-bold text-foreground">
                    Product Title / Name *
                  </Label>
                  <Input
                    id="prodName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sony WH-1000XM5 Wireless Noise-Cancelling Headphones"
                    className="mt-1.5 h-10 text-xs"
                    required
                  />
                </div>

                {/* Category Selection */}
                <div>
                  <Label htmlFor="prodCat" className="text-xs font-bold text-foreground">
                    Category *
                  </Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger id="prodCat" className="mt-1.5 h-10 text-xs">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="text-xs">
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Brand Name */}
                <div>
                  <Label htmlFor="brandName" className="text-xs font-bold text-foreground">
                    Brand Name
                  </Label>
                  <Input
                    id="brandName"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g. Sony, Samsung, Apple, LG"
                    className="mt-1.5 h-10 text-xs"
                  />
                </div>

                {/* Model Number */}
                <div>
                  <Label htmlFor="prodModel" className="text-xs font-bold text-foreground">
                    Model Number / SKU
                  </Label>
                  <Input
                    id="prodModel"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. WH1000XM5/B"
                    className="mt-1.5 h-10 text-xs font-mono"
                  />
                </div>

                {/* Color */}
                <div>
                  <Label htmlFor="prodColor" className="text-xs font-bold text-foreground">
                    Color / Finish
                  </Label>
                  <Input
                    id="prodColor"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="e.g. Matte Black, Silver, Blue"
                    className="mt-1.5 h-10 text-xs"
                  />
                </div>

                {/* MRP Price */}
                <div>
                  <Label htmlFor="prodMrp" className="text-xs font-bold text-foreground">
                    MRP (Maximum Retail Price ₹) *
                  </Label>
                  <div className="relative mt-1.5">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₹</span>
                    <Input
                      id="prodMrp"
                      type="number"
                      min="1"
                      step="any"
                      value={mrp}
                      onChange={(e) => setMrp(e.target.value)}
                      placeholder="29990"
                      className="pl-7 h-10 text-xs"
                      required
                    />
                  </div>
                </div>

                {/* Offer Price */}
                <div>
                  <Label htmlFor="prodOffer" className="text-xs font-bold text-foreground">
                    Showroom Selling Price (₹)
                  </Label>
                  <div className="relative mt-1.5">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₹</span>
                    <Input
                      id="prodOffer"
                      type="number"
                      min="1"
                      step="any"
                      value={offerPrice}
                      onChange={(e) => setOfferPrice(e.target.value)}
                      placeholder="26990 (Leave blank if same as MRP)"
                      className="pl-7 h-10 text-xs"
                    />
                  </div>
                </div>

                {/* Stock Quantity */}
                <div>
                  <Label htmlFor="prodStock" className="text-xs font-bold text-foreground">
                    Initial Stock Count (Units)
                  </Label>
                  <Input
                    id="prodStock"
                    type="number"
                    min="0"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    className="mt-1.5 h-10 text-xs font-mono"
                  />
                </div>

                {/* Stock Availability */}
                <div>
                  <Label htmlFor="prodStatus" className="text-xs font-bold text-foreground">
                    Availability Status
                  </Label>
                  <Select value={stockStatus} onValueChange={(v) => setStockStatus(v as any)}>
                    <SelectTrigger id="prodStatus" className="mt-1.5 h-10 text-xs">
                      <SelectValue placeholder="Availability" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_stock" className="text-xs">In Stock (Available)</SelectItem>
                      <SelectItem value="limited" className="text-xs">Limited Stock</SelectItem>
                      <SelectItem value="out_of_stock" className="text-xs">Out of Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Image Picker with Gallery Upload & URL */}
                <div className="sm:col-span-2 p-3 rounded-xl border border-border bg-card">
                  <ImagePicker
                    value={imageUrl}
                    onChange={setImageUrl}
                    label="Product Photo"
                    description="Upload from device gallery / camera or paste a web URL"
                    presets={SAMPLE_IMAGES}
                  />
                </div>

                {/* Warranty */}
                <div className="sm:col-span-2">
                  <Label htmlFor="prodWarranty" className="text-xs font-bold text-foreground">
                    Warranty Details
                  </Label>
                  <Input
                    id="prodWarranty"
                    value={warranty}
                    onChange={(e) => setWarranty(e.target.value)}
                    placeholder="e.g. 1 Year Official Brand Warranty with Onsite Support"
                    className="mt-1.5 h-10 text-xs"
                  />
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <Label htmlFor="prodDesc" className="text-xs font-bold text-foreground">
                    Product Description & Key Specifications
                  </Label>
                  <Textarea
                    id="prodDesc"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe main features, package contents, box condition, accessories included..."
                    className="mt-1.5 text-xs"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm gap-1.5 px-6"
                >
                  <Send className="h-4 w-4" />
                  {submitting ? 'Submitting to Admin...' : 'Submit Product for Admin Review'}
                </Button>
              </div>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
