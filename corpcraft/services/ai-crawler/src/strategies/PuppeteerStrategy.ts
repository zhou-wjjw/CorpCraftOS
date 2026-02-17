/**
 * Puppeteer Strategy
 * 使用无头浏览器进行复杂页面爬取
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as cheerio from 'cheerio';
import { CrawlTask, CrawlResult } from '../core/types';

// 使用隐身插件避免被检测
puppeteer.use(StealthPlugin());

interface StrategyContext {
  onProgress?: (progress: number) => void;
}

class PuppeteerStrategy {
  private userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  ];

  async execute(task: CrawlTask, context: StrategyContext = {}): Promise<CrawlResult> {
    const startTime = Date.now();
    let browser;

    try {
      // 启动浏览器
      context.onProgress?.(10);
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080',
        ],
      });

      const page = await browser.newPage();

      // 设置随机 User-Agent
      const userAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
      await page.setUserAgent(userAgent);

      // 设置视口大小
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      });

      // 拦截请求，优化加载
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        // 阻止图片、字体、样式表等资源加载，加快速度
        if (['image', 'font', 'stylesheet'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // 处理代理
      if (task.proxy) {
        await page.setExtraHTTPHeaders({
          'Proxy-Authorization': `Basic ${Buffer.from(`${task.proxy.username}:${task.proxy.password}`).toString('base64')}`,
        });
      }

      context.onProgress?.(30);

      // 导航到目标页面
      const response = await page.goto(task.url, {
        waitUntil: 'networkidle2',
        timeout: task.timeout || 30000,
      });

      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
      }

      context.onProgress?.(50);

      // 等待页面稳定
      await this.waitForPageStable(page);

      // 处理分页
      if (task.pagination) {
        await this.handlePagination(page, task.pagination, context);
      }

      context.onProgress?.(70);

      // 提取数据
      const data = await this.extractData(page, task);

      context.onProgress?.(90);

      // 获取页面元数据
      const metadata = await page.evaluate(() => {
        return {
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
          keywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content')?.split(',') || [],
          url: window.location.href,
        };
      });

      const duration = Date.now() - startTime;

      return {
        taskId: task.id || '',
        url: task.url,
        success: true,
        data,
        metadata: {
          ...metadata,
          duration,
          timestamp: new Date().toISOString(),
        },
      };
    } finally {
      if (browser) {
        await browser.close();
      }
      context.onProgress?.(100);
    }
  }

  /**
   * 等待页面稳定
   */
  private async waitForPageStable(page: any): Promise<void> {
    // 等待关键元素出现
    try {
      await page.waitForSelector('body', { timeout: 5000 });
    } catch (error) {
      // 忽略错误，继续执行
    }

    // 模拟人类行为 - 随机延迟
    await this.randomDelay(1000, 2000);
  }

  /**
   * 处理分页
   */
  private async handlePagination(page: any, pagination: any, context: StrategyContext): Promise<void> {
    const maxPages = pagination.maxPages || 5;
    let currentPage = 1;

    while (currentPage < maxPages) {
      try {
        if (pagination.type === 'scroll') {
          // 滚动加载更多
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
          });
          await this.randomDelay(2000, 3000);
        } else if (pagination.type === 'click' && pagination.selector) {
          // 点击下一页按钮
          const nextButton = await page.$(pagination.selector);
          if (nextButton) {
            await nextButton.click();
            await this.randomDelay(2000, 3000);
          } else {
            break;
          }
        }

        currentPage++;
        context.onProgress?.(50 + (currentPage / maxPages) * 20);
      } catch (error) {
        break;
      }
    }
  }

  /**
   * 提取数据
   */
  private async extractData(page: any, task: CrawlTask): Promise<any> {
    if (!task.selectors) {
      // 如果没有选择器，返回整个页面的 HTML
      return await page.evaluate(() => document.body.innerHTML);
    }

    if (task.selectors.fields) {
      // 提取特定字段
      return await page.evaluate((selectors) => {
        const result: Record<string, any> = {};
        for (const [field, selector] of Object.entries(selectors)) {
          const element = document.querySelector(selector as string);
          if (element) {
            result[field] = element.textContent?.trim() || element.getAttribute('href') || '';
          }
        }
        return result;
      }, task.selectors.fields);
    }

    if (task.selectors.item && task.selectors.list) {
      // 提取列表数据
      return await page.evaluate((selectors) => {
        const items: any[] = [];
        const listElements = document.querySelectorAll(selectors.list as string);

        listElements.forEach(listElement => {
          const itemElements = listElement.querySelectorAll(selectors.item as string);
          itemElements.forEach(itemElement => {
            items.push({
              text: itemElement.textContent?.trim() || '',
              html: itemElement.innerHTML,
            });
          });
        });

        return items;
      }, task.selectors);
    }

    return {};
  }

  /**
   * 随机延迟
   */
  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

export default PuppeteerStrategy;
