/**
 * API Strategy
 * 用于爬取基于 API 的数据源
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { CrawlTask } from '../core/types';

interface StrategyContext {
  onProgress?: (progress: number) => void;
}

class ApiStrategy {
  private clients: Map<string, AxiosInstance>;

  constructor() {
    this.clients = new Map();
  }

  async execute(task: CrawlTask, context: StrategyContext = {}): Promise<any> {
    context.onProgress?.(10);

    // 创建或获取 HTTP 客户端
    const client = this.getClient(task);

    try {
      context.onProgress?.(30);

      // 发送请求
      const response = await client.request({
        method: task.method || 'GET',
        url: task.url,
        timeout: task.timeout || 10000,
      });

      context.onProgress?.(70);

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 处理响应数据
      const data = this.processResponse(response);

      context.onProgress?.(100);

      return {
        taskId: task.id || '',
        url: task.url,
        success: true,
        data,
        metadata: {
          status: response.status,
          headers: response.headers,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  /**
   * 获取 HTTP 客户端
   */
  private getClient(task: CrawlTask): AxiosInstance {
    const cacheKey = `${task.proxy?.url || 'default'}`;

    if (!this.clients.has(cacheKey)) {
      const config: AxiosRequestConfig = {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      };

      if (task.proxy) {
        config.proxy = {
          host: new URL(task.proxy.url).hostname,
          port: parseInt(new URL(task.proxy.url).port),
          auth: task.proxy.username && task.proxy.password ? {
            username: task.proxy.username,
            password: task.proxy.password,
          } : undefined,
        };
      }

      this.clients.set(cacheKey, axios.create(config));
    }

    return this.clients.get(cacheKey)!;
  }

  /**
   * 处理响应数据
   */
  private processResponse(response: any): any {
    const contentType = response.headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      return response.data;
    } else if (contentType.includes('text/html') || contentType.includes('text/xml')) {
      // 返回 HTML/XML 文本
      return {
        text: response.data,
        html: response.data,
      };
    } else {
      // 返回原始数据
      return response.data;
    }
  }
}

export default ApiStrategy;
