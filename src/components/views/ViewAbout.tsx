import { Code2, Globe, Heart, Rocket, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrowserOpenURL } from "../../lib/desktop/runtime";

export function ViewAbout() {
  const openLink = (url: string) => {
    BrowserOpenURL(url);
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-3xl" />
          <img
            alt="Logo"
            className="relative size-40 object-contain"
            height={160}
            src="/logo.png"
            width={160}
          />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="sr-only">ADB GUI Next Desktop Toolkit</h1>
          <span className="bg-linear-to-r from-amber-400 to-orange-500 bg-clip-text pt-2 font-extrabold text-2xl text-transparent sm:text-4xl">
            Desktop Toolkit
          </span>
          <p className="max-w-150 px-4 text-base text-muted-foreground sm:text-lg">
            A modern desktop toolkit for Android Debug Bridge, fastboot,
            flashing, file access, and payload workflows.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-medium text-primary text-sm">
            Tauri 2 Edition
          </span>
          <span className="rounded-full border border-border bg-muted px-3 py-1 font-medium text-muted-foreground text-sm">
            Open Source
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
              ADB GUI Next exists to make Android device workflows faster,
              clearer, and safer. Whether you're debugging, flashing,
              transferring files, or extracting payloads, the goal is the same:
              powerful tools in a clean desktop experience.
            </p>
            <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Smartphone className="size-4" />
                <span>Device Management</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
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
            <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/30 p-4">
              <p className="font-medium text-sm">
                Rust-first Tauri desktop app
              </p>
              <p className="text-muted-foreground text-sm">
                The live application is built and maintained in this Tauri +
                Rust codebase. Legacy material is kept separately for offline
                reference and is not part of the running app.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/50 p-4">
              <Heart className="size-5 fill-destructive/20 text-destructive" />
              <div className="flex-1">
                <p className="font-medium text-sm">Built with care</p>
                <p className="text-muted-foreground text-xs">
                  Powered by Tauri, React & Rust
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credits / Footer */}
      <div className="flex flex-col gap-1 py-6 text-center text-muted-foreground text-sm">
        <p>
          ADB GUI Next by{" "}
          <button
            className="cursor-pointer border-none bg-transparent p-0 font-semibold text-foreground hover:underline"
            onClick={() => {
              openLink("https://github.com/mohdakil2426");
            }}
          >
            AKIL
          </button>{" "}
          © 2025
        </p>
      </div>
    </div>
  );
}
