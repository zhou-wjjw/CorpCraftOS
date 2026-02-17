/**
 * Proxy Pool Manager
 * 代理池管理器，自动获取、验证和轮换代理
 */

import Redis from 'ioredis';
import axios from 'axios';
import { EventEmitter } from 'events';

interface ProxyInfo {
  url: string;
  type: 'http' | 'https' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
  country?: string;
  lastCheck?: Date;
  isActive: boolean;
  successRate: number;
  totalRequests: number;
  failedRequests: number;
  lastUsed?: Date;
}

interface ProxyPoolConfig {
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
  checkInterval?: number;
  maxProxies?: number;
  testUrls?: string[];
  minSuccessRate?: number;
}

export class ProxyPool extends EventEmitter {
  private redis: Redis;
  private proxies: Map<string, ProxyInfo>;
  private currentIndex: number;
  private config: ProxyPoolConfig;
  private checkTimer?: NodeJS.Timeout;

  constructor(config: ProxyPoolConfig = {}) {
    super();

    this.config = {
      redis: config.redis || { host: 'localhost', port: 6379 },
      checkInterval: config.checkInterval || 5 * 60 * 1000, // 5分钟
      maxProxies: config.maxProxies || 100,
      testUrls: config.testUrls || ['http://httpbin.org/ip'],
      minSuccessRate: config.minSuccessRate || 0.5,
    };

    this.redis = new Redis(this.config.redis);
    this.proxies = new Map();
    this.currentIndex = 0;

    this.initialize();
  }

  /**
   * 初始化代理池
   */
  private async initialize(): Promise<void> {
    await this.loadProxiesFromCache();
    await this.startHealthCheck();
  }

  /**
   * 从缓存加载代理
   */
  private async loadProxiesFromCache(): Promise<void> {
    try {
      const cachedProxies = await this.redis.get('proxies');
      if (cachedProxies) {
        const proxyArray: ProxyInfo[] = JSON.parse(cachedProxies);
        proxyArray.forEach(proxy => {
          this.proxies.set(proxy.url, proxy);
        });
        this.emit('proxiesLoaded', proxyArray.length);
      }
    } catch (error) {
      console.error('Failed to load proxies from cache:', error);
    }
  }

  /**
   * 添加代理到池中
   */
  async addProxy(proxyInfo: Omit<ProxyInfo, 'isActive' | 'successRate' | 'totalRequests' | 'failedRequests'>): Promise<boolean> {
    const proxy: ProxyInfo = {
      ...proxyInfo,
      isActive: true,
      successRate: 1.0,
      totalRequests: 0,
      failedRequests: 0,
    };

    // 检查代理是否有效
    const isValid = await this.testProxy(proxy);
    if (!isValid) {
      return false;
    }

    this.proxies.set(proxy.url, proxy);
    await this.saveProxiesToCache();

    this.emit('proxyAdded', proxy);
    return true;
  }

  /**
   * 批量添加代理
   */
  async addProxies(proxies: string[]): Promise<number> {
    let addedCount = 0;

    for (const proxyUrl of proxies) {
      try {
        const url = new URL(proxyUrl);
        const proxyInfo: Omit<ProxyInfo, 'isActive' | 'successRate' | 'totalRequests' | 'failedRequests'> = {
          url: proxyUrl,
          type: proxyUrl.includes('socks') ? 'socks5' : 'http',
          host: url.hostname,
          port: parseInt(url.port),
          username: url.username,
          password: url.password,
        };

        const added = await this.addProxy(proxyInfo);
        if (added) addedCount++;
      } catch (error) {
        console.error(`Failed to add proxy ${proxyUrl}:`, error);
      }
    }

    return addedCount;
  }

  /**
   * 获取下一个可用代理
   */
  getNextProxy(): ProxyInfo | null {
    const activeProxies = Array.from(this.proxies.values()).filter(p => p.isActive);

    if (activeProxies.length === 0) {
      return null;
    }

    // 使用轮询策略
    const proxy = activeProxies[this.currentIndex % activeProxies.length];
    this.currentIndex++;

    proxy.lastUsed = new Date();
    return proxy;
  }

  /**
   * 获取最佳代理（基于成功率）
   */
  getBestProxy(): ProxyInfo | null {
    const activeProxies = Array.from(this.proxies.values())
      .filter(p => p.isActive)
      .sort((a, b) => b.successRate - a.successRate);

    if (activeProxies.length === 0) {
      return null;
    }

    return activeProxies[0];
  }

  /**
   * 测试代理是否可用
   */
  private async testProxy(proxy: ProxyInfo): Promise<boolean> {
    try {
      const testUrl = this.config.testUrls![0];
      const response = await axios.get(testUrl, {
        proxy: {
          host: proxy.host,
          port: proxy.port,
          auth: proxy.username && proxy.password ? {
            username: proxy.username,
            password: proxy.password,
          } : undefined,
        },
        timeout: 10000,
      });

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * 记录代理使用结果
   */
  async recordResult(proxyUrl: string, success: boolean): Promise<void> {
    const proxy = this.proxies.get(proxyUrl);
    if (!proxy) return;

    proxy.totalRequests++;
    if (success) {
      proxy.successRate = (proxy.successRate * (proxy.totalRequests - 1) + 1) / proxy.totalRequests;
    } else {
      proxy.failedRequests++;
      proxy.successRate = (proxy.successRate * (proxy.totalRequests - 1)) / proxy.totalRequests;

      // 如果成功率低于阈值，标记为不活跃
      if (proxy.successRate < this.config.minSuccessRate!) {
        proxy.isActive = false;
      }
    }

    await this.saveProxiesToCache();
  }

  /**
   * 开始健康检查
   */
  private async startHealthCheck(): Promise<void> {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    this.checkTimer = setInterval(async () => {
      await this.healthCheck();
    }, this.config.checkInterval);
  }

  /**
   * 健康检查所有代理
   */
  private async healthCheck(): Promise<void> {
    const promises = Array.from(this.proxies.values()).map(async (proxy) => {
      const isValid = await this.testProxy(proxy);
      if (!isValid) {
        proxy.isActive = false;
      } else if (!proxy.isActive) {
        // 如果之前不可用但现在可用，重新激活
        proxy.isActive = true;
      }
      proxy.lastCheck = new Date();
    });

    await Promise.all(promises);
    await this.saveProxiesToCache();

    this.emit('healthCheckCompleted', {
      total: this.proxies.size,
      active: Array.from(this.proxies.values()).filter(p => p.isActive).length,
    });
  }

  /**
   * 保存代理到缓存
   */
  private async saveProxiesToCache(): Promise<void> {
    try {
      const proxyArray = Array.from(this.proxies.values());
      await this.redis.set('proxies', JSON.stringify(proxyArray), 'EX', 24 * 60 * 60); // 24小时过期
    } catch (error) {
      console.error('Failed to save proxies to cache:', error);
    }
  }

  /**
   * 获取代理池统计信息
   */
  getStats() {
    const allProxies = Array.from(this.proxies.values());

    return {
      total: allProxies.length,
      active: allProxies.filter(p => p.isActive).length,
      inactive: allProxies.filter(p => !p.isActive).length,
      averageSuccessRate: allProxies.reduce((sum, p) => sum + p.successRate, 0) / allProxies.length || 0,
    };
  }

  /**
   * 清理无效代理
   */
  async cleanupInvalidProxies(): Promise<number> {
    let removedCount = 0;

    for (const [url, proxy] of this.proxies.entries()) {
      if (!proxy.isActive || proxy.successRate < this.config.minSuccessRate!) {
        this.proxies.delete(url);
        removedCount++;
      }
    }

    await this.saveProxiesToCache();
    this.emit('proxiesCleaned', removedCount);

    return removedCount;
  }

  /**
   * 关闭代理池
   */
  async close(): Promise<void> {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }
    await this.redis.quit();
  }
}

export default ProxyPool;
