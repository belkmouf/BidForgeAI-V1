// Express/Node.js type extensions
import type { IncomingMessage } from 'http';

declare module 'http' {
  interface IncomingMessage {
    ip?: string;
    path?: string;
  }
}
