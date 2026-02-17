/**
 * AI Crawler Engine
 * 分布式爬取引擎核心类，支持多种爬取策略和智能调度
 */

import { EventEmitter } from 'events';
import { Queue, Worker, Job } from 'bull';
import PuppeteerStrategy from '../strategies/PuppeteerStrategy';
import ApiStrategy from '../strategies/ApiStrategy';
import { CrawlTask, CrawlResult, CrawlConfig } from './types';

export class CrawlerEngine extends EventEmitter {
  private taskQueue: Queue<CrawlTask>;
  private worker: Worker<CrawlTask>;
  private strategies: Map<string, any>;
  private activeJobs: Map<string, Job<CrawlTask>>;
  private stats: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    activeJobs: number;
  };

  constructor(config: CrawlConfig) {
    super();

    this.taskQueue = new Queue('crawl-tasks', {
      redis: config.redis || { host: 'localhost', port: 6379 },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.strategies = new Map();
    this.activeJobs = new Map();
    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      activeJobs: 0,
    };

    this.initializeStrategies();
    this.initializeWorker();
  }

  /**
   * 初始化爬取策略
   */
  private initializeStrategies(): void {
    this.strategies.set('puppeteer', new PuppeteerStrategy());
    this.strategies.set('api', new ApiStrategy());
    // 可以添加更多策略
  }

  /**
   * 初始化工作进程
   */
  private initializeWorker(): void {
    this.worker = new Worker(
      'crawl-tasks',
      async (job: Job<CrawlTask>) => {
        return await this.processTask(job);
      },
      {
        connection: this.taskQueue.opts.connection,
        concurrency: 5,
      }
    );

    this.worker.on('completed', (job: Job<CrawlTask>, result: CrawlResult) => {
      this.stats.completedTasks++;
      this.stats.activeJobs--;
      this.activeJobs.delete(job.id.toString());
      this.emit('taskCompleted', { job, result });
    });

    this.worker.on('failed', (job: Job<CrawlTask>, error: Error) => {
      this.stats.failedTasks++;
      this.stats.activeJobs--;
      this.activeJobs.delete(job.id?.toString() || '');
      this.emit('taskFailed', { job, error });
    });
  }

  /**
   * 添加爬取任务
   */
  async addTask(task: CrawlTask, options?: any): Promise<Job<CrawlTask>> {
    const job = await this.taskQueue.add('crawl', task, {
      priority: task.priority || 5,
      delay: task.schedule ? new Date(task.schedule).getTime() - Date.now() : 0,
      ...options,
    });

    this.stats.totalTasks++;
    this.stats.activeJobs++;
    this.activeJobs.set(job.id.toString(), job);

    this.emit('taskAdded', { job, task });
    return job;
  }

  /**
   * 批量添加任务
   */
  async addBatchTasks(tasks: CrawlTask[]): Promise<Job<CrawlTask>[]> {
    const jobs = await Promise.all(
      tasks.map(task => this.addTask(task))
    );
    return jobs;
  }

  /**
   * 处理单个爬取任务
   */
  private async processTask(job: Job<CrawlTask>): Promise<CrawlResult> {
    const task = job.data;
    const strategy = this.strategies.get(task.strategy || 'puppeteer');

    if (!strategy) {
      throw new Error(`Unknown strategy: ${task.strategy}`);
    }

    try {
      // 更新任务进度
      await job.updateProgress(10);

      // 执行爬取策略
      const result = await strategy.execute(task, {
        onProgress: async (progress: number) => {
          await job.updateProgress(Math.round(10 + progress * 0.8));
        },
      });

      await job.updateProgress(100);

      return {
        taskId: job.id.toString(),
        url: task.url,
        success: true,
        data: result.data,
        metadata: result.metadata || {},
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Crawl failed for ${task.url}: ${error.message}`);
    }
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(jobId: string): Promise<any> {
    const job = await this.taskQueue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    return {
      id: job.id,
      state: await job.getState(),
      progress: job.progress(),
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
    };
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      queueStats: {
        waiting: await this.taskQueue.getWaitingCount(),
        active: await this.taskQueue.getActiveCount(),
        completed: await this.taskQueue.getCompletedCount(),
        failed: await this.taskQueue.getFailedCount(),
      },
    };
  }

  /**
   * 暂停队列
   */
  async pause(): Promise<void> {
    await this.taskQueue.pause();
    this.worker.pause();
  }

  /**
   * 恢复队列
   */
  async resume(): Promise<void> {
    await this.taskQueue.resume();
    this.worker.resume();
  }

  /**
   * 清空队列
   */
  async obliterates(): Promise<void> {
    await this.taskQueue.obliterate({ force: true });
  }

  /**
   * 关闭引擎
   */
  async close(): Promise<void> {
    await this.worker.close();
    await this.taskQueue.close();
  }
}

export default CrawlerEngine;
