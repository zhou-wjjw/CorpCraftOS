/**
 * CAPTCHA Solver Type Definitions
 */

export interface CaptchaOptions {
  type: 'ocr' | 'recaptcha' | 'slider';
  image?: Buffer;
  siteKey?: string;
  url?: string;
  version?: 'v2' | 'v3';
  language?: string;
  // OCR 特定选项
  grayscale?: boolean;
  contrast?: boolean;
  threshold?: number;
  denoise?: boolean;
  scale?: number;
  postProcess?: {
    removeSpaces?: boolean;
    alphanumericOnly?: boolean;
    numericOnly?: boolean;
    uppercase?: boolean;
    lowercase?: boolean;
    regexReplace?: Record<string, string>;
  };
}

export interface CaptchaResult {
  success: boolean;
  text?: string;
  confidence?: number;
  error?: string;
  duration?: number;
  metadata?: {
    position?: number;
    track?: Array<{ x: number; y: number; duration: number }>;
    words?: number;
    lines?: number;
    taskId?: number;
    service?: string;
  };
}
