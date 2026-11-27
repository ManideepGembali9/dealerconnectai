'use client';

import { Globe, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useApp } from '@/lib/providers';
import { LANGUAGES, type Language } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useApp();

  const currentLang = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'flex h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 text-xs font-bold text-foreground hover:bg-muted transition-all active:scale-95',
            className
          )}
          title="Change Language"
          aria-label="Change Language"
        >
          <Globe className="h-4 w-4 shrink-0 text-foreground" />
          <span className="hidden sm:inline-block font-semibold">
            {currentLang.flag ? `${currentLang.flag} ` : ''}
            {currentLang.nativeLabel}
          </span>
          <span className="sm:hidden font-semibold uppercase">{currentLang.code}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 max-h-[380px] overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg"
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Select Language / भाषा चुनें
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />
        <div className="grid grid-cols-1 gap-0.5">
          {LANGUAGES.map((item) => {
            const isSelected = item.code === lang;
            return (
              <DropdownMenuItem
                key={item.code}
                onClick={() => setLang(item.code as Language)}
                className={cn(
                  'flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors',
                  isSelected
                    ? 'bg-primary text-primary-foreground font-bold'
                    : 'hover:bg-muted text-foreground'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{item.flag || '🌐'}</span>
                  <div className="flex flex-col text-left">
                    <span className="font-bold">{item.nativeLabel}</span>
                    <span className="text-[10px] opacity-75">{item.label}</span>
                  </div>
                </div>
                {isSelected && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
