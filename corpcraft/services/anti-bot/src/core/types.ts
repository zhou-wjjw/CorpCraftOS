/**
 * Anti-Bot Type Definitions
 */

export interface AntiBotConfig {
  userAgentRotation?: boolean;
  headerRandomization?: boolean;
  cookieManagement?: boolean;
  requestDelay?: {
    min: number;
    max: number;
  };
  humanBehaviorSimulation?: boolean;
  captchaHandling?: boolean;
}

export interface BrowserFingerprint {
  userAgent: string;
  viewport: {
    width: number;
    height: number;
    deviceScaleFactor: number;
  };
  language: string;
  timezone: string;
  screen: {
    width: number;
    height: number;
    colorDepth: number;
  };
  hardwareConcurrency: number;
  deviceMemory: number;
}

export interface RequestThrottler {
  canMakeRequest(domain: string): boolean;
  recordRequest(domain: string): void;
  getWaitTime(domain: string): number;
}
