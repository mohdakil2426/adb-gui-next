import { Progress } from '@/shared/ui/progress';

interface WelcomeScreenProps {
  progress: number;
}

export function WelcomeScreen({ progress }: WelcomeScreenProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="flex h-svh w-full flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <img
          alt="ADB GUI Next logo"
          className="size-20 object-contain"
          height={80}
          src="/logo.png"
          width={80}
        />

        <div className="flex w-56 flex-col gap-2">
          <h1 className="text-center font-semibold text-foreground text-xl">ADB GUI Next</h1>
          <Progress aria-label="Loading ADB GUI Next" className="h-2" value={clampedProgress} />
        </div>
      </div>
    </div>
  );
}
