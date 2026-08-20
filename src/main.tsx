import { ThemeProvider } from 'next-themes';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/app/App';
import { Toaster } from '@/shared/ui/sonner';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
      <Toaster closeButton position="top-right" richColors />
    </ThemeProvider>
  </React.StrictMode>,
);
