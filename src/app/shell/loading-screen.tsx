import { m } from "framer-motion";

import { WelcomeScreen } from "@/shared/components/welcome-screen";

interface LoadingScreenProps {
  progress: number;
  shouldReduceMotion: boolean;
}

export const LoadingScreen = ({ progress, shouldReduceMotion }: LoadingScreenProps) => (
  <m.div
    className="absolute inset-0 z-50"
    exit={{ opacity: 0 }}
    initial={{ opacity: 1 }}
    key="welcome-screen"
    transition={{ duration: shouldReduceMotion ? 0 : 0.5 }}
  >
    <WelcomeScreen progress={progress} />
  </m.div>
);
