interface WelcomeScreenProps {
  /**
   * Retained so existing callers keep compiling.
   *
   * Startup is gated on real readiness (`useAppReady`) instead of a timed
   * animation, so this is now only ever 0 or 100 — there is no meaningful
   * percentage to draw. The splash renders an honest indeterminate state
   * rather than a progress bar that is always empty.
   */
  progress?: number;
}

export function WelcomeScreen(_props: WelcomeScreenProps) {
  return (
    <div className="flex h-svh w-full flex-col items-center justify-center gap-8 bg-background">
      <div className="flex flex-col items-center gap-4">
        <img
          alt=""
          aria-hidden="true"
          className="size-16 object-contain"
          height={64}
          src="/logo.png"
          width={64}
        />
        <h1 className="text-foreground text-title">ADB GUI Next</h1>
      </div>

      <div aria-busy="true" className="flex items-center gap-2" role="status">
        <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-primary" />
        <span className="text-caption text-muted-foreground">Starting…</span>
      </div>
    </div>
  );
}
