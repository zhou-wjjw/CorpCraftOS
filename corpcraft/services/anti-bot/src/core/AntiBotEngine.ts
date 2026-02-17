/**
 * Anti-Bot Engine
 * 反爬虫引擎，提供各种反爬虫对抗策略
 */

import { EventEmitter } from 'events';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import ProxyPool from './ProxyPool';
import { AntiBotConfig } from './types';

puppeteer.use(StealthPlugin());

export class AntiBotEngine extends EventEmitter {
  private proxyPool: ProxyPool;
  private config: AntiBotConfig;
  private userAgents: string[];
  private requestDelays: Map<string, number>;

  constructor(config: AntiBotConfig = {}) {
    super();

    this.config = {
      userAgentRotation: config.userAgentRotation ?? true,
      headerRandomization: config.headerRandomization ?? true,
      cookieManagement: config.cookieManagement ?? true,
      requestDelay: config.requestDelay || { min: 1000, max: 3000 },
      humanBehaviorSimulation: config.humanBehaviorSimulation ?? true,
      captchaHandling: config.captchaHandling ?? true,
    };

    this.proxyPool = new ProxyPool();
    this.userAgents = this.getUserAgents();
    this.requestDelays = new Map();
  }

  /**
   * 应用反爬虫措施到 Puppeteer 页面
   */
  async applyToPage(page: any, options: any = {}): Promise<void> {
    // 设置随机 User-Agent
    if (this.config.userAgentRotation) {
      const userAgent = this.getRandomUserAgent();
      await page.setUserAgent(userAgent);
    }

    // 设置随机化请求头
    if (this.config.headerRandomization) {
      await this.setRandomHeaders(page);
    }

    // 设置视口大小
    const viewport = this.getRandomViewport();
    await page.setViewport(viewport);

    // 注入反检测脚本
    await this.injectAntiDetectionScripts(page);

    // 拦截请求
    await this.setupRequestInterception(page, options);

    // 模拟人类行为
    if (this.config.humanBehaviorSimulation) {
      await this.simulateHumanBehavior(page);
    }
  }

  /**
   * 获取随机 User-Agent
   */
  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * 获取 User-Agent 列表
   */
  private getUserAgents(): string[] {
    return [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
    ];
  }

  /**
   * 设置随机请求头
   */
  private async setRandomHeaders(page: any): Promise<void> {
    const headers = {
      'Accept-Language': ['en-US,en;q=0.9', 'zh-CN,zh;q=0.9,en;q=0.8'][Math.floor(Math.random() * 2)],
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': ['text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'][Math.floor(Math.random() * 2)],
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document',
      'Upgrade-Insecure-Requests': '1',
    };

    await page.setExtraHTTPHeaders(headers);
  }

  /**
   * 获取随机视口大小
   */
  private getRandomViewport() {
    const viewports = [
      { width: 1920, height: 1080, deviceScaleFactor: 1 },
      { width: 1366, height: 768, deviceScaleFactor: 1 },
      { width: 1440, height: 900, deviceScaleFactor: 1 },
      { width: 1536, height: 864, deviceScaleFactor: 1.25 },
      { width: 2560, height: 1440, deviceScaleFactor: 1 },
    ];

    const selected = viewports[Math.floor(Math.random() * viewports.length)];
    return {
      ...selected,
      isMobile: Math.random() > 0.9, // 10% 概率模拟移动设备
      hasTouch: Math.random() > 0.8,
    };
  }

  /**
   * 注入反检测脚本
   */
  private async injectAntiDetectionScripts(page: any): Promise<void> {
    // 隐藏 webdriver 特征
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // 伪装 Chrome 对象
      (window as any).chrome = {
        runtime: {},
      };

      // 伪装权限
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // 伪装插件
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // 伪装语言
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });
  }

  /**
   * 设置请求拦截
   */
  private async setupRequestInterception(page: any, options: any): Promise<void> {
    await page.setRequestInterception(true);

    const domain = options.domain || '';

    page.on('request', async (req: any) => {
      const resourceType = req.resourceType();

      // 阻止某些资源类型
      if (['image', 'font', 'stylesheet'].includes(resourceType)) {
        req.abort();
        return;
      }

      // 添加请求延迟
      const delay = this.getRequestDelay(domain);
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // 使用代理
      const proxy = this.proxyPool.getNextProxy();
      if (proxy) {
        // 注意：Puppeteer 的代理设置需要在启动浏览器时配置
        // 这里只是记录使用情况
        await this.proxyPool.recordResult(proxy.url, true);
      }

      req.continue();
    });
  }

  /**
   * 获取请求延迟
   */
  private getRequestDelay(domain: string): number {
    if (!this.requestDelays.has(domain)) {
      const { min, max } = this.config.requestDelay!;
      const delay = Math.floor(Math.random() * (max - min + 1)) + min;
      this.requestDelays.set(domain, delay);
    }
    return this.requestDelays.get(domain)!;
  }

  /**
   * 模拟人类行为
   */
  private async simulateHumanBehavior(page: any): Promise<void> {
    // 随机鼠标移动
    await this.simulateMouseMovement(page);

    // 随机滚动
    await this.simulateScrolling(page);

    // 随机停顿
    await this.randomPause(500, 2000);
  }

  /**
   * 模拟鼠标移动
   */
  private async simulateMouseMovement(page: any): Promise<void> {
    const movements = Math.floor(Math.random() * 5) + 2; // 2-6次移动

    for (let i = 0; i < movements; i++) {
      const x = Math.floor(Math.random() * 1000) + 100;
      const y = Math.floor(Math.random() * 800) + 100;

      await page.mouse.move(x, y, {
        steps: Math.floor(Math.random() * 10) + 5,
      });

      await this.randomPause(100, 500);
    }
  }

  /**
   * 模拟滚动
   */
  private async simulateScrolling(page: any): Promise<void> {
    const scrollCount = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < scrollCount; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, Math.floor(Math.random() * 500) + 100);
      });
      await this.randomPause(500, 1500);
    }
  }

  /**
   * 随机暂停
   */
  private async randomPause(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 获取代理池
   */
  getProxyPool(): ProxyPool {
    return this.proxyPool;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      proxyPool: this.proxyPool.getStats(),
      requestDelays: Object.fromEntries(this.requestDelays),
      config: this.config,
    };
  }

  /**
   * 关闭引擎
   */
  async close(): Promise<void> {
    await this.proxyPool.close();
  }
}

export default AntiBotEngine;
