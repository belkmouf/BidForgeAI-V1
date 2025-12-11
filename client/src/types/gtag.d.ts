// Google Analytics gtag type definitions
interface Window {
  gtag?: (
    command: 'event' | 'config' | 'js' | 'set',
    targetId: string | Date,
    config?: Record<string, any>
  ) => void;
}
