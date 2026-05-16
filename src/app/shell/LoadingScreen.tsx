import { motion } from 'framer-motion';
import { WelcomeScreen } from '@/shared/components/WelcomeScreen';

interface LoadingScreenProps {
  progress: number;
  shouldReduceMotion: boolean;
}

export function LoadingScreen({ progress, shouldReduceMotion }: LoadingScreenProps) {
  return (
    <motion.div
      className="absolute inset-0 z-50"
      exit={{ opacity: 0 }}
      initial={{ opacity: 1 }}
      key="welcome-screen"
      transition={{ duration: shouldReduceMotion ? 0 : 0.5 }}
    >
      <WelcomeScreen progress={progress} />
    </motion.div>
  );
}
