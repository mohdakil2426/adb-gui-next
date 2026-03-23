import React from 'react';
import { Progress } from '@/components/ui/progress';

type WelcomeScreenProps = {
  progress: number;
};

export function WelcomeScreen({ progress }: WelcomeScreenProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <img src="/logo.png" alt="ADB GUI Next logo" className="h-20 w-20 object-contain" />

        <div className="w-56 space-y-2">
          <h1 className="text-xl font-bold text-foreground text-center">ADB GUI Next</h1>
          <Progress value={clampedProgress} className="h-2" />
        </div>
      </div>
    </div>
  );
}
