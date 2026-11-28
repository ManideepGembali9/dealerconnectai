'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Check,
  CheckCircle2,
  Compass,
  Edit3,
  Home,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useApp } from '@/lib/providers';
import { getPinCentroid } from '@/lib/geo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomerSubpageShell } from '@/components/profile/customer-subpage-shell';
import { cn } from '@/lib/utils';

type AddressLabel = 'Home' | 'Work' | 'Other';

type SavedAddress = {
  id: string;
  label: AddressLabel;
  custom_label?: string;
  street: string;
  area: string;
  city: string;
  district?: string;
  state?: string;
  pin_code: string;
  lat: number | null;
  lng: number | null;
  is_default: boolean;
  updated_at: string;
};

type LocationPreview = {
  pinCode: string;
  areaLabel: string;
  city: string;
  district: string;
  state: string;
  lat: number | null;
  lng: number | null;
  source: 'gps' | 'pincode' | 'manual';
};

function parseSavedAddresses(customer: {
  pin_code?: string | null;
  preferred_city?: string | null;
  preferred_location?: Record<string, unknown>;
} | null): SavedAddress[] {
  if (!customer) return [];
  const loc = (customer.preferred_location || {}) as Record<string, unknown>;
  if (Array.isArray(loc.saved_addresses) && loc.saved_addresses.length > 0) {
    return (loc.saved_addresses as SavedAddress[]).map((a, idx) => ({
      id: a.id || `addr-${idx + 1}`,
      label: a.label === 'Work' || a.label === 'Other' ? a.label : 'Home',
      custom_label: a.custom_label || '',
      street: a.street || '',
      area: a.area || a.city || '',
      city: a.city || a.area || '',
      district: a.district || '',
      state: a.state || '',
      pin_code: a.pin_code || '',
      lat: typeof a.lat === 'number' ? a.lat : null,
      lng: typeof a.lng === 'number' ? a.lng : null,
      is_default: Boolean(a.is_default),
      updated_at: a.updated_at || new Date().toISOString(),
    }));
  }

  const initialStreet = typeof loc.address === 'string' ? loc.address : '';
  const initialPin = customer.pin_code || '';
  const initialCity = customer.preferred_city || (typeof loc.city === 'string' ? loc.city : '');
  if (initialPin || initialCity || initialStreet) {
    return [
      {
        id: 'addr-default',
        label: 'Home',
        street: initialStreet,
        area: initialCity || (initialPin ? `PIN ${initialPin}` : 'Primary Area'),
        city: initialCity || '',
        district: typeof loc.district === 'string' ? loc.district : '',
        state: typeof loc.state === 'string' ? loc.state : '',
        pin_code: initialPin,
        lat: typeof loc.lat === 'number' ? loc.lat : null,
        lng: typeof loc.lng === 'number' ? loc.lng : null,
        is_default: true,
        updated_at: new Date().toISOString(),
      },
    ];
  }
  return [];
}

export function CustomerSavedLocationClient() {
  const { customer, updateCustomerProfile } = useAuth();
  const { location, setLocation } = useApp();

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [labelType, setLabelType] = useState<AddressLabel>('Home');
  const [customLabel, setCustomLabel] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [manualArea, setManualArea] = useState('');
  const [makeDefault, setMakeDefault] = useState(true);

  const [detectingGps, setDetectingGps] = useState(false);
  const [lookingUpPin, setLookingUpPin] = useState(false);
  const [saving, setSaving] = useState(false);

  const [preview, setPreview] = useState<LocationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) return;
    const parsed = parseSavedAddresses(customer);
    setAddresses(parsed);
  }, [customer]);

  const defaultAddr = useMemo(
    () => addresses.find((a) => a.is_default) || addresses[0] || null,
    [addresses]
  );

  const persistAddresses = async (nextList: SavedAddress[], toastText?: string) => {
    if (!customer) return false;
    const activeDefault = nextList.find((a) => a.is_default) || nextList[0] || null;
    const fullLabel = activeDefault
      ? activeDefault.street
        ? `${activeDefault.street}, ${activeDefault.area || activeDefault.city}`
        : activeDefault.area || activeDefault.city
      : null;

    setSaving(true);
    const res = await updateCustomerProfile({
      pin_code: activeDefault?.pin_code || customer.pin_code || null,
      preferred_city: activeDefault ? activeDefault.area || activeDefault.city : null,
      preferred_location: {
        ...(customer.preferred_location || {}),
        address: activeDefault?.street || '',
        city: activeDefault?.city || activeDefault?.area || undefined,
        district: activeDefault?.district || undefined,
        state: activeDefault?.state || undefined,
        pin_code: activeDefault?.pin_code || undefined,
        lat: activeDefault?.lat ?? undefined,
        lng: activeDefault?.lng ?? undefined,
        saved_addresses: nextList,
        updated_at: new Date().toISOString(),
      },
    });
    setSaving(false);

    if (res.error) {
      setError(res.error);
      return false;
    }

    setAddresses(nextList);
    if (activeDefault) {
      setLocation({
        pinCode: activeDefault.pin_code || null,
        label: fullLabel || location.label,
        lat: activeDefault.lat,
        lng: activeDefault.lng,
      });
    }
    if (toastText) {
      setSuccess(toastText);
      toast.success(toastText);
    }
    return true;
  };

  const openAddForm = () => {
    setEditingId(null);
    setLabelType(addresses.some((a) => a.label === 'Home') ? 'Work' : 'Home');
    setCustomLabel('');
    setPinInput('');
    setStreetAddress('');
    setManualArea('');
    setPreview(null);
    setMakeDefault(addresses.length === 0);
    setError(null);
    setSuccess(null);
    setFormOpen(true);
  };

  const openEditForm = (addr: SavedAddress) => {
    setEditingId(addr.id);
    setLabelType(addr.label);
    setCustomLabel(addr.custom_label || '');
    setPinInput(addr.pin_code || '');
    setStreetAddress(addr.street || '');
    setManualArea(addr.area || addr.city || '');
    setMakeDefault(addr.is_default);
    setPreview({
      pinCode: addr.pin_code,
      areaLabel: addr.area || addr.city,
      city: addr.city,
      district: addr.district || '',
      state: addr.state || '',
      lat: addr.lat,
      lng: addr.lng,
      source: 'manual',
    });
    setError(null);
    setSuccess(null);
    setFormOpen(true);
  };

  // Option A: Real GPS + Reverse Geocoding
  const handleUseCurrentLocation = () => {
    setError(null);
    setSuccess(null);

    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setError(
        'Location services are not supported in this browser. Please enter your 6-digit PIN code below.'
      );
      return;
    }

    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));

        let city = '';
        let district = '';
        let state = '';
        let postcode = '';
        let areaLabel = '';

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`,
            { headers: { Accept: 'application/json' } }
          );
          if (res.ok) {
            const data = (await res.json()) as { address?: Record<string, string> };
            const addr = data.address || {};
            const locality =
              addr.suburb || addr.neighbourhood || addr.town || addr.village || addr.city || '';
            city = addr.city || addr.town || addr.village || addr.county || locality;
            district = addr.state_district || addr.county || '';
            state = addr.state || '';
            postcode = (addr.postcode || '').replace(/\D/g, '').slice(0, 6);
            areaLabel = [locality, district !== locality ? district : '', state]
              .filter(Boolean)
              .join(', ');
          }
        } catch {
          // keep exact coordinates without inventing city names
        }

        const resolvedLabel = areaLabel || city || `GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        setManualArea(areaLabel || city);
        if (postcode.length === 6) setPinInput(postcode);

        setPreview({
          pinCode: postcode,
          areaLabel: resolvedLabel,
          city: city || '',
          district,
          state,
          lat,
          lng,
          source: 'gps',
        });
        setDetectingGps(false);
      },
      (geoErr) => {
        setDetectingGps(false);
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setError(
            'GPS permission was denied. Enable browser location permission or enter your 6-digit Indian PIN code.'
          );
        } else if (geoErr.code === geoErr.TIMEOUT) {
          setError('Location detection timed out. Please retry GPS or enter your 6-digit PIN code.');
        } else {
          setError('Unable to detect GPS coordinates right now. Please enter your 6-digit PIN code.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Option B: 6-digit Indian PIN lookup
  const handleLookupPin = async () => {
    setError(null);
    setSuccess(null);

    const cleanPin = pinInput.replace(/\D/g, '').slice(0, 6);
    setPinInput(cleanPin);
    if (cleanPin.length !== 6) {
      setError('Please enter a valid 6-digit Indian PIN code.');
      return;
    }

    setLookingUpPin(true);
    const centroid = getPinCentroid(cleanPin);
    let areaName = '';
    let district = '';
    let state = '';

    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
      if (res.ok) {
        const json = (await res.json()) as Array<{
          Status?: string;
          PostOffice?: Array<{ Name?: string; District?: string; State?: string }>;
        }>;
        const first = json?.[0];
        if (first?.Status === 'Success' && first.PostOffice?.length) {
          const po = first.PostOffice[0];
          areaName = po.Name || '';
          district = po.District || '';
          state = po.State || '';
        }
      }
    } catch {
      // fallback to centroid
    }

    const fallbackCity = centroid?.label || [district, state].filter(Boolean).join(', ');
    const fullLabel = [areaName, district && district !== areaName ? district : '', state]
      .filter(Boolean)
      .join(', ');
    const effectiveLabel = fullLabel || fallbackCity || `PIN ${cleanPin}`;

    setManualArea(effectiveLabel);
    setPreview({
      pinCode: cleanPin,
      areaLabel: effectiveLabel,
      city: district || centroid?.label || areaName || '',
      district,
      state,
      lat: centroid?.lat ?? null,
      lng: centroid?.lng ?? null,
      source: 'pincode',
    });
    setLookingUpPin(false);
  };

  const handleSaveAddressForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setError(null);
    setSuccess(null);

    const cleanPin = (pinInput || preview?.pinCode || '').replace(/\D/g, '').slice(0, 6);
    const areaVal = manualArea.trim() || preview?.areaLabel || '';
    const streetVal = streetAddress.trim();

    if (cleanPin.length !== 6 && !areaVal) {
      setError('Enter a valid 6-digit PIN code or area/city name.');
      return;
    }

    const id = editingId || `addr-${Date.now()}`;
    const shouldBeDefault = makeDefault || addresses.length === 0;
    const entry: SavedAddress = {
      id,
      label: labelType,
      custom_label: labelType === 'Other' ? customLabel.trim() || 'Other' : undefined,
      street: streetVal,
      area: areaVal || `PIN ${cleanPin}`,
      city: preview?.city || areaVal || '',
      district: preview?.district || '',
      state: preview?.state || '',
      pin_code: cleanPin,
      lat: preview?.lat ?? getPinCentroid(cleanPin)?.lat ?? null,
      lng: preview?.lng ?? getPinCentroid(cleanPin)?.lng ?? null,
      is_default: shouldBeDefault,
      updated_at: new Date().toISOString(),
    };

    const existingList = editingId
      ? addresses.map((a) => (a.id === editingId ? entry : a))
      : [...addresses, entry];

    const finalList = shouldBeDefault
      ? existingList.map((a) => ({ ...a, is_default: a.id === id }))
      : existingList;

    const ok = await persistAddresses(
      finalList,
      editingId ? 'Location updated successfully!' : 'New location saved!'
    );
    if (ok) {
      setFormOpen(false);
      setEditingId(null);
    }
  };

  const handleSetDefault = async (addrId: string) => {
    const nextList = addresses.map((a) => ({ ...a, is_default: a.id === addrId }));
    await persistAddresses(nextList, 'Default location updated!');
  };

  const handleDeleteAddress = async (addrId: string) => {
    const remaining = addresses.filter((a) => a.id !== addrId);
    if (remaining.length > 0 && !remaining.some((a) => a.is_default)) {
      remaining[0] = { ...remaining[0], is_default: true };
    }
    await persistAddresses(remaining, 'Saved location removed.');
  };

  const getLabelIcon = (lbl: AddressLabel) => {
    if (lbl === 'Work') return <Briefcase className="h-4 w-4 text-primary" />;
    if (lbl === 'Home') return <Home className="h-4 w-4 text-primary" />;
    return <MapPin className="h-4 w-4 text-primary" />;
  };

  return (
    <CustomerSubpageShell
      title="Saved Locations"
      subtitle="Add Home, Work, or Other delivery addresses and set your default discovery area."
      redirectPath="/customer/saved-location"
    >
      {customer && (
        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Header Action Row */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Your Addresses ({addresses.length})
            </p>
            {!formOpen && (
              <Button
                type="button"
                size="sm"
                onClick={openAddForm}
                className="h-9 rounded-xl font-bold text-xs gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Add Location
              </Button>
            )}
          </div>

          {/* Add / Edit Location Form */}
          {formOpen && (
            <form
              onSubmit={handleSaveAddressForm}
              className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-sm font-bold text-foreground">
                  {editingId ? 'Edit Saved Location' : 'Add New Location'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setFormOpen(false);
                    setEditingId(null);
                  }}
                  aria-label="Close form"
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Address Label Chips */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Save As</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Home', 'Work', 'Other'] as const).map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setLabelType(lbl)}
                      className={cn(
                        'flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition-colors',
                        labelType === lbl
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-muted/40 text-foreground hover:bg-muted'
                      )}
                    >
                      {lbl === 'Home' && <Home className="h-3.5 w-3.5" />}
                      {lbl === 'Work' && <Briefcase className="h-3.5 w-3.5" />}
                      {lbl === 'Other' && <MapPin className="h-3.5 w-3.5" />}
                      <span>{lbl}</span>
                    </button>
                  ))}
                </div>
                {labelType === 'Other' && (
                  <Input
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="Custom label (e.g., Parents House, Studio)"
                    className="mt-2 h-9 text-xs rounded-xl"
                  />
                )}
              </div>

              {/* Quick GPS + PIN Lookup */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUseCurrentLocation}
                  disabled={detectingGps}
                  className="h-10 rounded-xl text-xs font-bold gap-2"
                >
                  {detectingGps ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Navigation className="h-4 w-4 text-primary" />
                  )}
                  {detectingGps ? 'Detecting GPS...' : 'Detect GPS'}
                </Button>

                <div className="flex gap-1.5">
                  <Input
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit PIN"
                    maxLength={6}
                    inputMode="numeric"
                    className="h-10 flex-1 rounded-xl font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleLookupPin}
                    disabled={lookingUpPin}
                    className="h-10 rounded-xl text-xs font-bold px-3 shrink-0"
                  >
                    {lookingUpPin ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {preview && (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <Compass className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate font-medium text-foreground">{preview.areaLabel}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="loc-area" className="text-xs font-semibold text-muted-foreground">
                  Area / City *
                </Label>
                <Input
                  id="loc-area"
                  value={manualArea}
                  onChange={(e) => setManualArea(e.target.value)}
                  placeholder="City, locality, or district"
                  className="h-10 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="loc-street" className="text-xs font-semibold text-muted-foreground">
                  Full Street Address / Landmark
                </Label>
                <Input
                  id="loc-street"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="House no., street name, floor, or landmark"
                  className="h-10 rounded-xl text-sm"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground select-none">
                <input
                  type="checkbox"
                  checked={makeDefault}
                  onChange={(e) => setMakeDefault(e.target.checked)}
                  className="accent-primary rounded"
                />
                <span>Set as my default discovery &amp; delivery location</span>
              </label>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-10 rounded-xl font-bold text-xs gap-1.5"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {saving ? 'Saving...' : editingId ? 'Update Address' : 'Save Address'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormOpen(false);
                    setEditingId(null);
                  }}
                  className="h-10 rounded-xl text-xs font-semibold px-4"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Saved Address Cards List */}
          {addresses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center space-y-3">
              <MapPin className="mx-auto h-10 w-10 text-muted-foreground" />
              <div className="space-y-1">
                <h2 className="text-base font-bold text-foreground">No Saved Locations Yet</h2>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Save your Home, Work, or other addresses to discover local showrooms faster.
                </p>
              </div>
              {!formOpen && (
                <Button onClick={openAddForm} size="sm" className="rounded-xl text-xs font-bold">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add First Location
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {addresses.map((addr) => {
                const isDefault = defaultAddr?.id === addr.id;
                const displayTitle =
                  addr.label === 'Other' && addr.custom_label ? addr.custom_label : addr.label;

                return (
                  <div
                    key={addr.id}
                    className={cn(
                      'rounded-2xl border bg-card p-4 shadow-sm transition-colors space-y-3',
                      isDefault ? 'border-primary/50 ring-1 ring-primary/15' : 'border-border'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          {getLabelIcon(addr.label)}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-foreground">
                              {displayTitle}
                            </span>
                            {isDefault && (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                                Default
                              </Badge>
                            )}
                            {addr.pin_code && (
                              <Badge variant="outline" className="font-mono text-[10px]">
                                PIN {addr.pin_code}
                              </Badge>
                            )}
                          </div>
                          {addr.street && (
                            <p className="text-xs font-medium text-foreground">{addr.street}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {addr.area || addr.city}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-2.5">
                      {!isDefault && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() => handleSetDefault(addr.id)}
                          className="h-8 rounded-xl text-xs font-semibold gap-1"
                        >
                          <Check className="h-3.5 w-3.5 text-emerald-600" /> Set Default
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEditForm(addr)}
                        className="h-8 rounded-xl text-xs font-semibold gap-1"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() => handleDeleteAddress(addr.id)}
                        aria-label={`Delete ${displayTitle}`}
                        className="h-8 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </CustomerSubpageShell>
  );
}
