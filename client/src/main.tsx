import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/error-boundary";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary 
    level="critical"
    onError={(error, errorInfo) => {
      // Global error handler for critical app errors
      console.error('Critical App Error:', error, errorInfo);
      
      // Report to analytics/error tracking service
      if (window.gtag) {
        window.gtag('event', 'exception', {
          description: error.message,
          fatal: true,
        });
      }
    }}
  >
    <App />
  </ErrorBoundary>
);
