'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn('h-10 w-10 rounded-xl border border-border bg-card text-foreground', className)}
        aria-label="Toggle theme"
      >
        <Sun className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-10 w-10 rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-all active:scale-95',
            className
          )}
          title="Toggle light / dark theme"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Moon className="h-5 w-5 transition-transform duration-200 rotate-0" />
          ) : (
            <Sun className="h-5 w-5 transition-transform duration-200 rotate-0" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 rounded-xl border border-border bg-card p-1 shadow-lg">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold',
            theme === 'light' ? 'bg-primary text-primary-foreground font-bold' : 'hover:bg-muted text-foreground'
          )}
        >
          <Sun className="h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold',
            theme === 'dark' ? 'bg-primary text-primary-foreground font-bold' : 'hover:bg-muted text-foreground'
          )}
        >
          <Moon className="h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold',
            theme === 'system' ? 'bg-primary text-primary-foreground font-bold' : 'hover:bg-muted text-foreground'
          )}
        >
          <Monitor className="h-4 w-4" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
