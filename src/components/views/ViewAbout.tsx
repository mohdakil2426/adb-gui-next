import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, Heart, Code2, Rocket, Smartphone } from 'lucide-react';
import { BrowserOpenURL } from '../../lib/desktop/runtime';

export function ViewAbout() {
  const openLink = (url: string) => {
    BrowserOpenURL(url);
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center text-center py-12 gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
          <img src="/logo.png" alt="Logo" className="relative w-40 h-40 object-contain" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            ADB GUI Next
          </h1>
          <span className="bg-linear-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent font-extrabold text-2xl sm:text-4xl pt-2">
            Desktop Toolkit
          </span>
          <p className="text-muted-foreground text-base sm:text-lg max-w-150 px-4">
            A modern desktop toolkit for Android Debug Bridge, fastboot, flashing, file access, and
            payload workflows.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
            Tauri 2 Edition
          </span>
          <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm font-medium border border-border">
            Open Source
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Project Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="size-5 text-primary" />
              Mission
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-muted-foreground">
              ADB GUI Next exists to make Android device workflows faster, clearer, and safer.
              Whether you're debugging, flashing, transferring files, or extracting payloads, the
              goal is the same: powerful tools in a clean desktop experience.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Smartphone className="size-4" />
                <span>Device Management</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Code2 className="size-4" />
                <span>Terminal Shell</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Community & Links */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="size-5 text-primary" />
              Project
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4 flex flex-col gap-2">
              <p className="text-sm font-medium">Rust-first Tauri desktop app</p>
              <p className="text-sm text-muted-foreground">
                The live application is built and maintained in this Tauri + Rust codebase. Legacy
                material is kept separately for offline reference and is not part of the running
                app.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3 border border-border/50">
              <Heart className="size-5 text-destructive fill-destructive/20" />
              <div className="flex-1">
                <p className="text-sm font-medium">Built with care</p>
                <p className="text-xs text-muted-foreground">Powered by Tauri, React & Rust</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credits / Footer */}
      <div className="text-center text-sm text-muted-foreground py-6 flex flex-col gap-1">
        <p>
          ADB GUI Next by{' '}
          <button
            className="font-semibold text-foreground hover:underline cursor-pointer bg-transparent border-none p-0"
            onClick={() => openLink('https://github.com/mohdakil2426')}
          >
            AKIL
          </button>{' '}
          © 2025
        </p>
      </div>
    </div>
  );
}
