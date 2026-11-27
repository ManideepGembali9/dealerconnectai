'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera,Link as LinkIcon,X } from 'lucide-react';
import Image from 'next/image';
import { useRef,useState } from 'react';
import { toast } from 'sonner';

type ImagePickerProps = {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  description?: string;
  presets?: { label: string; url: string }[];
  className?: string;
};

export function ImagePicker({
  value,
  onChange,
  label = 'Product Image',
  description = 'Upload from your device/gallery or enter an image web URL',
  presets,
  className = '',
}: ImagePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WEBP, etc.)');
      return;
    }

    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be under 5 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        onChange(result);
        toast.success('Image loaded from gallery/device!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return;
    onChange(urlInput.trim());
    setUrlInput('');
    setShowUrlInput(false);
    toast.success('Image URL applied!');
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-foreground">{label}</Label>
          {description && <span className="text-[11px] text-muted-foreground">{description}</span>}
        </div>
      )}

      {/* Hidden file input for native device gallery / camera / file browser */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* When image is selected: show preview & actions */}
      {value ? (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
          <div className="relative h-20 w-20 shrink-0 rounded-lg overflow-hidden border border-border bg-muted">
            <Image
              src={value}
              alt="Selected Preview"
              fill
              className="object-cover"
              sizes="80px"
              unoptimized={value.startsWith('data:')}
            />
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="text-xs font-semibold text-foreground truncate">
              {value.startsWith('data:') ? 'Photo loaded from device / gallery' : value}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs font-semibold"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="mr-1.5 h-3.5 w-3.5 text-primary" /> Change Photo
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => onChange('')}
              >
                <X className="mr-1 h-3.5 w-3.5" /> Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* When no image is selected: show gallery button and URL button */
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-11 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 flex items-center justify-center gap-2 text-xs font-semibold"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-4 w-4 text-primary" /> Choose from Gallery / Camera
            </Button>

            <Button
              type="button"
              variant="secondary"
              className="h-11 px-3 text-xs font-semibold flex items-center gap-1.5"
              onClick={() => setShowUrlInput(!showUrlInput)}
            >
              <LinkIcon className="h-3.5 w-3.5" /> {showUrlInput ? 'Hide URL' : 'Paste Image URL'}
            </Button>
          </div>

          {/* URL Input Form */}
          {showUrlInput && (
            <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/40">
              <Input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/photo.jpg"
                className="h-8 text-xs"
              />
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs font-bold"
                onClick={handleApplyUrl}
              >
                Apply
              </Button>
            </div>
          )}

          {/* Quick presets */}
          {presets && presets.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-muted-foreground mr-1">Sample Photos:</span>
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-2 bg-muted/50 hover:bg-muted"
                  onClick={() => onChange(preset.url)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
