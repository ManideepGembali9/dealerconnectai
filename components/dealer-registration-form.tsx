'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { broadcastSync,getDbCategories,saveDbDealerApplication } from '@/lib/firebase-db';
import type { Category,DealerApplication } from '@/lib/types';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Navigation,
  Store,
  Truck,
  X
} from 'lucide-react';
import { useEffect,useState } from 'react';
import { toast } from 'sonner';

const AP_PIN_DIRECTORY: Record<string, { city: string; district: string; state: string }> = {
  '533201': { city: 'Amalapuram', district: 'Dr. B.R. Ambedkar Konaseema', state: 'Andhra Pradesh' },
  '533001': { city: 'Kakinada', district: 'Kakinada', state: 'Andhra Pradesh' },
  '533101': { city: 'Rajahmundry', district: 'East Godavari', state: 'Andhra Pradesh' },
  '533238': { city: 'Ravulapalem', district: 'Dr. B.R. Ambedkar Konaseema', state: 'Andhra Pradesh' },
  '533308': { city: 'Mandapeta', district: 'Dr. B.R. Ambedkar Konaseema', state: 'Andhra Pradesh' },
  '533255': { city: 'Ramachandrapuram', district: 'Dr. B.R. Ambedkar Konaseema', state: 'Andhra Pradesh' },
  '534260': { city: 'Palakollu', district: 'West Godavari', state: 'Andhra Pradesh' },
  '534201': { city: 'Bhimavaram', district: 'West Godavari', state: 'Andhra Pradesh' },
  '534211': { city: 'Tanuku', district: 'West Godavari', state: 'Andhra Pradesh' },
  '534001': { city: 'Eluru', district: 'Eluru', state: 'Andhra Pradesh' },
  '520001': { city: 'Vijayawada', district: 'NTR District', state: 'Andhra Pradesh' },
  '530001': { city: 'Visakhapatnam', district: 'Visakhapatnam', state: 'Andhra Pradesh' },
};

type Props = {
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  onSuccess?: (appId: string) => void;
  onCancel?: () => void;
};

export function DealerRegistrationForm({
  customerId = 'cust-default',
  customerName = '',
  customerEmail = '',
  customerPhone = '',
  onSuccess,
  onCancel,
}: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedApp, setSubmittedApp] = useState<DealerApplication | null>(null);
  const [detectingGps, setDetectingGps] = useState(false);
  const [gpsCaptured, setGpsCaptured] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    // Owner Info
    owner_name: customerName,
    phone: customerPhone,
    email: customerEmail,
    alt_phone: '',
    dealer_password: '',

    // Shop Info
    shop_name: '',
    category_id: '',
    category_name: '',
    description: '',
    logo_url: '',
    images: [] as string[],

    // Shop Location
    address: '',
    village: '',
    city: 'Amalapuram',
    district: 'Dr. B.R. Ambedkar Konaseema',
    state: 'Andhra Pradesh',
    pin_code: '533201',
    map_lat: '16.5787',
    map_lng: '82.0061',

    // Business Info
    whatsapp: customerPhone,
    opening_time: '09:00 AM',
    closing_time: '09:00 PM',
    delivery_available: true,
    delivery_details: 'Free home delivery within local radius',
    gst_number: '',
  });

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      owner_name: prev.owner_name || customerName,
      phone: prev.phone || customerPhone,
      email: prev.email || customerEmail,
      whatsapp: prev.whatsapp || customerPhone,
    }));
  }, [customerName, customerEmail, customerPhone]);

  useEffect(() => {
    async function loadMeta() {
      try {
        const cats = await getDbCategories();
        setCategories(cats || []);
        if (cats && cats.length > 0) {
          setFormData((prev) => ({
            ...prev,
            category_id: cats[0].id,
            category_name: cats[0].name,
          }));
        }
      } catch (e) {
        console.error('Failed to load categories', e);
      }
    }
    loadMeta();
  }, []);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePinCodeChange = (raw: string) => {
    const cleaned = raw.replace(/\D/g, '').slice(0, 6);
    setFormData((prev) => {
      const match = AP_PIN_DIRECTORY[cleaned];
      if (match) {
        return {
          ...prev,
          pin_code: cleaned,
          city: match.city,
          district: match.district,
          state: match.state,
        };
      }
      return { ...prev, pin_code: cleaned };
    });
  };

  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          map_lat: pos.coords.latitude.toFixed(6),
          map_lng: pos.coords.longitude.toFixed(6),
        }));
        setDetectingGps(false);
        setGpsCaptured(true);
        toast.success('Showroom GPS location pinned successfully!');
      },
      () => {
        setDetectingGps(false);
        setGpsCaptured(true);
        toast.info('Using regional commercial center coordinates');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Form Validations
    if (!formData.owner_name.trim()) {
      setErrorMessage('Please enter the shop owner or contact person name.');
      return;
    }
    if (!formData.phone.trim() || formData.phone.replace(/\D/g, '').length < 10) {
      setErrorMessage('Please provide a valid 10-digit mobile number.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!formData.shop_name.trim()) {
      setErrorMessage('Please enter your Shop / Dealership Name.');
      return;
    }
    if (!formData.address.trim()) {
      setErrorMessage('Please enter your Shop Street Address.');
      return;
    }
    if (!formData.pin_code || formData.pin_code.length !== 6) {
      setErrorMessage('Please provide a valid 6-digit PIN code.');
      return;
    }
    if (!termsAccepted) {
      setErrorMessage('Please accept the marketplace terms and conditions to proceed.');
      return;
    }

    setSubmitting(true);
    try {
      const uniqueAppId = `APP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const appPayload: DealerApplication = {
        id: uniqueAppId,
        customer_id: customerId,
        owner_name: formData.owner_name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.toLowerCase().trim(),
        alt_phone: formData.alt_phone?.trim() || null,
        dealer_password: formData.dealer_password.trim() || 'dealer123',

        shop_name: formData.shop_name.trim(),
        category_id: formData.category_id || null,
        category_name: formData.category_name || null,
        description: formData.description.trim() || `Verified local shop in ${formData.city}.`,
        logo_url: formData.logo_url.trim() || 'https://images.unsplash.com/photo-1541888946425-d0fbb186f5f8?w=200',
        images: formData.images.length > 0 ? formData.images : ['https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800'],

        address: formData.address.trim(),
        village: formData.village.trim() || null,
        city: formData.city.trim(),
        district: formData.district?.trim() || null,
        state: formData.state.trim(),
        pin_code: formData.pin_code.trim(),
        map_lat: parseFloat(formData.map_lat) || 16.5787,
        map_lng: parseFloat(formData.map_lng) || 82.0061,

        whatsapp: formData.whatsapp?.trim() || formData.phone.trim(),
        opening_time: formData.opening_time,
        closing_time: formData.closing_time,
        delivery_available: formData.delivery_available,
        delivery_details: formData.delivery_details?.trim() || null,
        gst_number: formData.gst_number.trim().toUpperCase() || null,

        status: 'pending',
        admin_remarks: null,
        rejection_reason: null,
        created_at: new Date().toISOString(),
      };

      await saveDbDealerApplication(appPayload);
      broadcastSync('dealers');

      setSubmittedApp(appPayload);
      toast.success(`Application ${uniqueAppId} submitted for Admin review!`);
      if (onSuccess) onSuccess(uniqueAppId);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to submit dealer registration.');
    } finally {
      setSubmitting(false);
    }
  };

  // SUCCESS CONFIRMATION VIEW
  if (submittedApp) {
    return (
      <div className="py-6 px-4 max-w-lg mx-auto text-center space-y-4 animate-in fade-in duration-200">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
          <CheckCircle2 className="h-9 w-9" />
        </div>

        <div>
          <Badge variant="outline" className="text-xs font-bold text-foreground border-border bg-muted mb-1">
            Application Received
          </Badge>
          <h2 className="text-xl font-black text-foreground">Dealership Registration Submitted!</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Your dealer application has been submitted successfully. Our Admin team will review your application.
          </p>
        </div>

        <Card className="p-4 text-left border border-border bg-muted/30 rounded-2xl space-y-2.5 text-xs shadow-sm">
          <div className="flex justify-between border-b border-border/50 pb-2">
            <span className="text-muted-foreground">Application ID:</span>
            <span className="font-mono font-black text-foreground">{submittedApp.id}</span>
          </div>
          <div className="flex justify-between border-b border-border/50 pb-2">
            <span className="text-muted-foreground">Shop Name:</span>
            <span className="font-bold text-foreground">{submittedApp.shop_name}</span>
          </div>
          <div className="flex justify-between border-b border-border/50 pb-2">
            <span className="text-muted-foreground">Owner / Contact:</span>
            <span className="font-medium text-foreground">{submittedApp.owner_name}</span>
          </div>
          <div className="flex justify-between border-b border-border/50 pb-2">
            <span className="text-muted-foreground">Status:</span>
            <span className="font-bold text-foreground uppercase tracking-wide text-[11px]">
              ● Pending Review
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Location:</span>
            <span className="font-medium text-foreground">{submittedApp.city}, {submittedApp.pin_code}</span>
          </div>
        </Card>

        <div className="rounded-xl border border-border bg-card p-3 text-left flex items-start gap-2.5 text-xs text-muted-foreground">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>
            You can monitor this application anytime under <strong>My Profile &rarr; My Dealer Application</strong>. Once approved, the separate <strong>Dealer App</strong> will unlock.
          </span>
        </div>

        <div className="pt-2">
          <Button
            type="button"
            onClick={() => onCancel && onCancel()}
            className="w-full h-11 font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm"
          >
            Back to Customer Profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl mx-auto pb-10">
      {/* Top Header & Single Close Button */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 sm:static sm:mx-0 sm:px-0 sm:py-0 sm:pb-3 flex items-center justify-between gap-3 bg-background/95 backdrop-blur border-b border-border">
        <div className="min-w-0">
          <h2 className="text-lg font-black text-foreground flex items-center gap-2 truncate">
            <Store className="h-5 w-5 text-primary shrink-0" /> Register Your Shop
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            Connect with nearby buyers on Local Shop Product Finder
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-xs text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* SECTION A: OWNER INFORMATION */}
      <div className="space-y-3.5">
        <div className="flex items-center gap-2 pb-1 border-b border-border/40">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-black">
            1
          </span>
          <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
            Owner & Account Information
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-bold text-foreground">Full Name *</Label>
            <Input
              value={formData.owner_name}
              onChange={(e) => handleChange('owner_name', e.target.value)}
              placeholder="e.g. Ramesh Varma"
              className="mt-1 h-10 text-xs rounded-xl"
              required
            />
          </div>
          <div>
            <Label className="text-xs font-bold text-foreground">Mobile Number *</Label>
            <div className="relative mt-1 flex rounded-xl border border-input overflow-hidden bg-background">
              <span className="flex items-center bg-muted/60 px-2.5 text-xs font-bold text-muted-foreground border-r border-border shrink-0">
                +91
              </span>
              <Input
                type="tel"
                maxLength={10}
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="98480 12345"
                className="h-10 border-0 focus-visible:ring-0 text-xs rounded-none pl-2.5"
                required
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-bold text-foreground">Email Address *</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="dealer@email.com"
              className="mt-1 h-10 text-xs rounded-xl"
              required
            />
          </div>
          <div>
            <Label className="text-xs font-bold text-foreground">Alternate Contact (Optional)</Label>
            <Input
              type="tel"
              value={formData.alt_phone}
              onChange={(e) => handleChange('alt_phone', e.target.value)}
              placeholder="Landline / 2nd Phone"
              className="mt-1 h-10 text-xs rounded-xl"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-bold text-foreground">Create Dealer App Password *</Label>
          <Input
            type="password"
            value={formData.dealer_password}
            onChange={(e) => handleChange('dealer_password', e.target.value)}
            placeholder="At least 6 characters (used to log into Dealer App upon approval)"
            className="mt-1 h-10 text-xs rounded-xl"
            required
          />
        </div>
      </div>

      {/* SECTION B: SHOP INFORMATION */}
      <div className="space-y-3.5">
        <div className="flex items-center gap-2 pb-1 border-b border-border/40">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-black">
            2
          </span>
          <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
            Shop Information
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-bold text-foreground">Shop / Dealership Name *</Label>
            <Input
              value={formData.shop_name}
              onChange={(e) => handleChange('shop_name', e.target.value)}
              placeholder="e.g. Sri Krishna Electronics"
              className="mt-1 h-10 text-xs rounded-xl"
              required
            />
          </div>
          <div>
            <Label className="text-xs font-bold text-foreground">Business Category *</Label>
            <Select
              value={formData.category_id}
              onValueChange={(val) => {
                const found = categories.find((c) => c.id === val);
                handleChange('category_id', val);
                if (found) handleChange('category_name', found.name);
              }}
            >
              <SelectTrigger className="mt-1 h-10 text-xs rounded-xl">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs font-bold text-foreground">Shop Description</Label>
          <Input
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Authorized retail outlet providing genuine products & warranty support..."
            className="mt-1 h-10 text-xs rounded-xl"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-bold text-foreground">Shop Logo Image URL (Optional)</Label>
            <Input
              value={formData.logo_url}
              onChange={(e) => handleChange('logo_url', e.target.value)}
              placeholder="https://... logo.png"
              className="mt-1 h-10 text-xs rounded-xl"
            />
          </div>
          <div>
            <Label className="text-xs font-bold text-foreground">GSTIN Number (Optional)</Label>
            <Input
              value={formData.gst_number}
              onChange={(e) => handleChange('gst_number', e.target.value.toUpperCase())}
              placeholder="37AAAAA0000A1Z5"
              maxLength={15}
              className="mt-1 h-10 text-xs rounded-xl uppercase font-mono"
            />
          </div>
        </div>
      </div>

      {/* SECTION C: SHOP LOCATION */}
      <div className="space-y-3.5">
        <div className="flex items-center gap-2 pb-1 border-b border-border/40">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-black">
            3
          </span>
          <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
            Shop Location & Map Coordinates
          </h3>
        </div>

        <div>
          <Label className="text-xs font-bold text-foreground">Full Street Address *</Label>
          <Input
            value={formData.address}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="Shop #12, Clock Tower Main Road, Opp. Bus Station"
            className="mt-1 h-10 text-xs rounded-xl"
            required
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div>
            <Label className="text-[11px] font-bold text-foreground">6-Digit PIN *</Label>
            <Input
              type="tel"
              maxLength={6}
              value={formData.pin_code}
              onChange={(e) => handlePinCodeChange(e.target.value)}
              placeholder="533201"
              className="mt-1 h-10 text-xs font-mono font-bold rounded-xl"
              required
            />
          </div>
          <div>
            <Label className="text-[11px] font-bold text-foreground">City</Label>
            <Input
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              className="mt-1 h-10 text-xs rounded-xl"
              required
            />
          </div>
          <div>
            <Label className="text-[11px] font-bold text-foreground">District</Label>
            <Input
              value={formData.district}
              onChange={(e) => handleChange('district', e.target.value)}
              className="mt-1 h-10 text-xs rounded-xl"
            />
          </div>
          <div>
            <Label className="text-[11px] font-bold text-foreground">State</Label>
            <Input
              value={formData.state}
              onChange={(e) => handleChange('state', e.target.value)}
              className="mt-1 h-10 text-xs rounded-xl"
              required
            />
          </div>
        </div>

        {/* Auto Detect GPS */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/40 text-xs">
          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-primary" />
            <div>
              <p className="font-bold text-foreground">
                {gpsCaptured ? 'Showroom GPS Pinned' : 'Showroom GPS Location'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {gpsCaptured ? `Coords: ${formData.map_lat}, ${formData.map_lng}` : 'Required for customer radius discovery'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDetectGps}
            disabled={detectingGps}
            className="h-8 text-xs font-bold rounded-lg"
          >
            {detectingGps ? 'Detecting...' : gpsCaptured ? 'Update GPS' : 'Auto-Detect GPS'}
          </Button>
        </div>
      </div>

      {/* SECTION D: BUSINESS & DELIVERY INFORMATION */}
      <div className="space-y-3.5">
        <div className="flex items-center gap-2 pb-1 border-b border-border/40">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-black">
            4
          </span>
          <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
            Business & Delivery Information
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs font-bold text-foreground">WhatsApp Number</Label>
            <Input
              type="tel"
              value={formData.whatsapp}
              onChange={(e) => handleChange('whatsapp', e.target.value)}
              placeholder="98480 12345"
              className="mt-1 h-10 text-xs rounded-xl"
            />
          </div>
          <div>
            <Label className="text-xs font-bold text-foreground">Opening Time</Label>
            <Input
              type="text"
              value={formData.opening_time}
              onChange={(e) => handleChange('opening_time', e.target.value)}
              placeholder="09:00 AM"
              className="mt-1 h-10 text-xs rounded-xl"
            />
          </div>
          <div>
            <Label className="text-xs font-bold text-foreground">Closing Time</Label>
            <Input
              type="text"
              value={formData.closing_time}
              onChange={(e) => handleChange('closing_time', e.target.value)}
              placeholder="09:00 PM"
              className="mt-1 h-10 text-xs rounded-xl"
            />
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs font-bold text-foreground">Doorstep Delivery Available</p>
                <p className="text-[11px] text-muted-foreground">Do you deliver products to nearby customer homes?</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={formData.delivery_available}
              onChange={(e) => handleChange('delivery_available', e.target.checked)}
              className="h-4 w-4 accent-primary rounded cursor-pointer"
            />
          </div>
          {formData.delivery_available && (
            <Input
              value={formData.delivery_details}
              onChange={(e) => handleChange('delivery_details', e.target.value)}
              placeholder="Delivery details (e.g. Free delivery within 10 km, nominal fee beyond)"
              className="h-9 text-xs rounded-lg mt-1"
            />
          )}
        </div>
      </div>

      {/* SECTION E: TERMS & SUBMIT */}
      <div className="space-y-3 pt-2">
        <label className="flex items-start gap-2.5 cursor-pointer text-xs text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary rounded cursor-pointer"
          />
          <span>
            I certify that the shop information provided is accurate and agree to the <strong>DealerConnect AI Marketplace Terms & Conditions</strong>. I understand that submitting this application does not automatically grant dealer access until verified by our Admin team.
          </span>
        </label>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full h-12 font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm shadow-md transition-all gap-2"
        >
          {submitting ? 'Submitting Application...' : 'Submit Dealer Registration →'}
        </Button>
      </div>
    </form>
  );
}
