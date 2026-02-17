/**
 * Crawler Core Type Definitions
 */

export interface CrawlConfig {
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
  maxConcurrentJobs?: number;
  defaultTimeout?: number;
}

export interface CrawlTask {
  id?: string;
  url: string;
  method?: 'GET' | 'POST';
  strategy?: 'puppeteer' | 'api' | 'selenium';
  priority?: number;
  schedule?: string;
  timeout?: number;
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
  };
  // 爬取配置
  selectors?: {
    list?: string;
    item?: string;
    fields?: Record<string, string>;
  };
  pagination?: {
    type: 'page' | 'scroll' | 'click';
    maxPages?: number;
    selector?: string;
  };
  // 数据处理
  dataProcessor?: string;
  metadata?: Record<string, any>;
  // 代理配置
  proxy?: {
    url: string;
    username?: string;
    password?: string;
  };
}

export interface CrawlResult {
  taskId: string;
  url: string;
  success: boolean;
  data: any;
  metadata?: {
    title?: string;
    description?: string;
    keywords?: string[];
    timestamp?: string;
    duration?: number;
    [key: string]: any;
  };
  error?: string;
  timestamp: string;
}

export interface ProxyConfig {
  url: string;
  type: 'http' | 'https' | 'socks5';
  username?: string;
  password?: string;
  country?: string;
  lastCheck?: Date;
  isActive?: boolean;
  successRate?: number;
}

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

export interface CaptchaSolver {
  solve(imageBuffer: Buffer): Promise<string>;
  solveRecaptcha(siteKey: string, url: string): Promise<string>;
}

export interface DataProcessor {
  process(rawData: any): Promise<any>;
  validate(data: any): boolean;
  transform(data: any): any;
}
