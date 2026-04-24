import { Progress } from '@/components/ui/progress';

type WelcomeScreenProps = {
  progress: number;
};

export function WelcomeScreen({ progress }: WelcomeScreenProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="flex h-svh w-full flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <img
          src="/logo.png"
          alt="ADB GUI Next logo"
          width={80}
          height={80}
          className="size-20 object-contain"
        />

        <div className="w-56 flex flex-col gap-2">
          <h1 className="text-xl font-bold text-foreground text-center">ADB GUI Next</h1>
          <Progress value={clampedProgress} className="h-2" aria-label="Loading ADB GUI Next" />
        </div>
      </div>
    </div>
  );
}
