'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Compass,
  Loader2,
  MapPin,
  Navigation,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useApp } from '@/lib/providers';
import { getPinCentroid } from '@/lib/geo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomerSubpageShell } from '@/components/profile/customer-subpage-shell';

type LocationPreview = {
  pinCode: string;
  areaLabel: string;
  city: string;
  district: string;
  state: string;
  lat: number | null;
  lng: number | null;
  source: 'gps' | 'pincode';
};

export function CustomerSavedLocationClient() {
  const { customer, updateCustomerProfile } = useAuth();
  const { location, setLocation } = useApp();

  const [pinInput, setPinInput] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [manualArea, setManualArea] = useState('');
  const [detectingGps, setDetectingGps] = useState(false);
  const [lookingUpPin, setLookingUpPin] = useState(false);
  const [saving, setSaving] = useState(false);

  const [preview, setPreview] = useState<LocationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) return;
    const savedLoc = (customer.preferred_location || {}) as Record<string, unknown>;
    setPinInput(customer.pin_code || location.pinCode || '');
    setStreetAddress(typeof savedLoc.address === 'string' ? savedLoc.address : '');
  }, [customer, location.pinCode]);

  const currentLabel =
    customer?.preferred_city ||
    location.label ||
    (customer?.pin_code ? `PIN ${customer.pin_code}` : 'No location saved yet');
  const currentPin = customer?.pin_code || location.pinCode || '';
  const currentAddress =
    typeof (customer?.preferred_location as Record<string, unknown> | undefined)?.address === 'string'
      ? String((customer?.preferred_location as Record<string, unknown>).address)
      : '';

  // Option A: Real GPS + Reverse Geocoding (never fabricates location)
  const handleUseCurrentLocation = () => {
    setError(null);
    setSuccess(null);

    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setError('Location services are not supported in this browser. Please search by your 6-digit PIN code below.');
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
            const data = (await res.json()) as {
              address?: Record<string, string>;
              display_name?: string;
            };
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
          // Reverse-geocoding unavailable; keep exact coordinates only without inventing city/district names.
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
            'GPS permission was denied. Enable browser location permission or enter your 6-digit Indian PIN code below.'
          );
        } else if (geoErr.code === geoErr.TIMEOUT) {
          setError('Location detection timed out. Please retry GPS or enter your 6-digit PIN code.');
        } else {
          setError('Unable to detect GPS coordinates right now. Please enter your 6-digit Indian PIN code below.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Option B: 6-digit Indian PIN Code lookup + preview
  const handleLookupPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      // Offline / API blocked; fall back to verified local PIN centroid lookup if available.
    }

    const fallbackCity = centroid?.label || [district, state].filter(Boolean).join(', ');
    const fullLabel = [areaName, district && district !== areaName ? district : '', state]
      .filter(Boolean)
      .join(', ');

    const effectiveLabel = fullLabel || fallbackCity;
    if (!effectiveLabel) {
      setLookingUpPin(false);
      setPreview({
        pinCode: cleanPin,
        areaLabel: `PIN ${cleanPin}`,
        city: '',
        district: '',
        state: '',
        lat: null,
        lng: null,
        source: 'pincode',
      });
      setManualArea('');
      return;
    }

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

  const handleConfirmSave = async () => {
    if (!customer || !preview) return;
    setError(null);
    setSuccess(null);

    const cleanPin = (preview.pinCode || pinInput).replace(/\D/g, '').slice(0, 6);
    const finalLabel = manualArea.trim() || preview.areaLabel;
    const trimmedStreet = streetAddress.trim();

    if (!cleanPin && (preview.lat === null || preview.lng === null)) {
      setError('Detect GPS location or enter a valid 6-digit PIN code before saving.');
      return;
    }

    setSaving(true);
    const displayLabel = trimmedStreet ? `${trimmedStreet}, ${finalLabel}` : finalLabel;

    const res = await updateCustomerProfile({
      pin_code: cleanPin || customer.pin_code || null,
      preferred_city: finalLabel,
      preferred_location: {
        ...(customer.preferred_location || {}),
        address: trimmedStreet,
        city: preview.city || finalLabel,
        district: preview.district || undefined,
        state: preview.state || undefined,
        pin_code: cleanPin || undefined,
        lat: preview.lat ?? undefined,
        lng: preview.lng ?? undefined,
        source: preview.source,
        updated_at: new Date().toISOString(),
      },
    });
    setSaving(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    setLocation({
      pinCode: cleanPin || null,
      label: displayLabel,
      lat: preview.lat,
      lng: preview.lng,
    });

    setSuccess(`Location updated to ${displayLabel}${cleanPin ? ` (${cleanPin})` : ''}.`);
    toast.success('Saved location updated!');
  };

  return (
    <CustomerSubpageShell
      title="Saved Location"
      subtitle="Set your delivery & nearby shop discovery area using GPS or a 6-digit Indian PIN code."
      redirectPath="/customer/saved-location"
    >
      {customer && (
        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-red-500/40 bg-red-950/30 p-3.5 text-xs text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-3.5 text-xs text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{success}</span>
            </div>
          )}

          {/* Current Saved Location */}
          <div className="rounded-2xl border border-[#292929] bg-[#151515] p-5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#A0A0A0]">
              <MapPin className="h-3.5 w-3.5 text-[#FFFFFF]" />
              <span>Current Saved Area</span>
            </div>
            <p className="text-base font-bold text-[#FFFFFF]">{currentLabel}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#A0A0A0]">
              {currentPin && (
                <span className="rounded-lg border border-[#292929] bg-[#202020] px-2.5 py-0.5 font-mono text-[#FFFFFF]">
                  PIN: {currentPin}
                </span>
              )}
              {currentAddress && <span>{currentAddress}</span>}
            </div>
          </div>

          {/* Option A: GPS Detection */}
          <div className="rounded-2xl border border-[#292929] bg-[#151515] p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#202020] border border-[#292929]">
                <Compass className="h-4 w-4 text-[#FFFFFF]" />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-sm font-bold text-[#FFFFFF]">Option A: Use Current GPS Location</h2>
                <p className="text-xs text-[#A0A0A0]">
                  Automatically detect your coordinates and resolve your area without typing.
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={detectingGps}
              className="w-full h-10 rounded-xl bg-[#FFFFFF] text-[#0A0A0A] hover:bg-[#E5E5E5] font-bold text-xs gap-2"
            >
              {detectingGps ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
              {detectingGps ? 'Detecting GPS Coordinates...' : 'Use My Current Location'}
            </Button>
          </div>

          {/* Option B: 6-digit Indian PIN lookup */}
          <form
            onSubmit={handleLookupPin}
            className="rounded-2xl border border-[#292929] bg-[#151515] p-5 space-y-3"
          >
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-[#FFFFFF]">Option B: Search by 6-Digit PIN Code</h2>
              <p className="text-xs text-[#A0A0A0]">
                Verify your area, district, and state before saving.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="saved-loc-pin"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="e.g. 532440"
                maxLength={6}
                inputMode="numeric"
                className="h-10 flex-1 rounded-xl border-[#292929] bg-[#202020] text-[#FFFFFF] font-mono text-sm placeholder:text-[#A0A0A0]/60"
              />
              <Button
                type="submit"
                disabled={lookingUpPin}
                className="h-10 rounded-xl bg-[#202020] border border-[#292929] text-[#FFFFFF] hover:bg-[#292929] font-semibold text-xs px-4 gap-1.5 shrink-0"
              >
                {lookingUpPin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Lookup PIN
              </Button>
            </div>
          </form>

          {/* Detected Location Preview & Confirm */}
          {preview && (
            <div className="rounded-2xl border border-[#292929] bg-[#151515] p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-[#292929] pb-3">
                <h3 className="text-sm font-bold text-[#FFFFFF]">Confirm Detected Location</h3>
                <span className="rounded-full bg-[#202020] border border-[#292929] px-2.5 py-0.5 text-[11px] font-semibold text-[#A0A0A0]">
                  {preview.source === 'gps' ? 'GPS Signal' : 'PIN Lookup'}
                </span>
              </div>

              <div className="rounded-xl border border-[#292929] bg-[#202020] p-3.5 space-y-1.5 text-xs">
                <p className="font-bold text-[#FFFFFF] text-sm">{preview.areaLabel}</p>
                {preview.district && (
                  <p className="text-[#A0A0A0]">
                    District: <span className="text-[#FFFFFF]">{preview.district}</span>
                  </p>
                )}
                {preview.state && (
                  <p className="text-[#A0A0A0]">
                    State: <span className="text-[#FFFFFF]">{preview.state}</span>
                  </p>
                )}
                {preview.pinCode && (
                  <p className="text-[#A0A0A0]">
                    PIN Code: <span className="font-mono text-[#FFFFFF]">{preview.pinCode}</span>
                  </p>
                )}
                {preview.lat !== null && preview.lng !== null && (
                  <p className="text-[#A0A0A0] font-mono text-[11px]">
                    Coordinates: {preview.lat.toFixed(4)}, {preview.lng.toFixed(4)}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="loc-area-label" className="text-xs font-semibold text-[#A0A0A0]">
                  Area / City Label
                </Label>
                <Input
                  id="loc-area-label"
                  value={manualArea}
                  onChange={(e) => setManualArea(e.target.value)}
                  placeholder="City or locality name"
                  className="h-10 rounded-xl border-[#292929] bg-[#202020] text-[#FFFFFF] text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="loc-street" className="text-xs font-semibold text-[#A0A0A0]">
                  Street / Landmark (Optional)
                </Label>
                <Input
                  id="loc-street"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="House no., street name, or nearby landmark"
                  className="h-10 rounded-xl border-[#292929] bg-[#202020] text-[#FFFFFF] text-sm"
                />
              </div>

              <Button
                type="button"
                onClick={handleConfirmSave}
                disabled={saving}
                className="w-full h-10 rounded-xl bg-[#FFFFFF] text-[#0A0A0A] hover:bg-[#E5E5E5] font-bold text-xs gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {saving ? 'Saving Location...' : 'Confirm & Save Location'}
              </Button>
            </div>
          )}
        </div>
      )}
    </CustomerSubpageShell>
  );
}
