/**
 * Crawler Routes
 * 爬虫相关 API 路由
 */

import { FastifyInstance } from 'fastify';
import CrawlerEngine from '@corpcraft/ai-crawler/src/core/CrawlerEngine';

const crawlerEngine = new CrawlerEngine({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

export default async function crawlerRoutes(fastify: FastifyInstance) {
  // 创建爬取任务
  fastify.post('/tasks', {
    schema: {
      description: 'Create a new crawl task',
      tags: ['Crawler'],
      body: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          strategy: { type: 'string', enum: ['puppeteer', 'api'] },
          priority: { type: 'number', minimum: 1, maximum: 10 },
          timeout: { type: 'number' },
          selectors: {
            type: 'object',
          },
        },
        required: ['url'],
      },
    },
  }, async (request, reply) => {
    const task = request.body as any;
    const job = await crawlerEngine.addTask(task);
    return { taskId: job.id, status: 'queued' };
  });

  // 批量创建任务
  fastify.post('/tasks/batch', {
    schema: {
      description: 'Create multiple crawl tasks',
      tags: ['Crawler'],
      body: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            strategy: { type: 'string' },
          },
          required: ['url'],
        },
      },
    },
  }, async (request, reply) => {
    const tasks = request.body as any[];
    const jobs = await crawlerEngine.addBatchTasks(tasks);
    return {
      taskIds: jobs.map(job => job.id),
      count: jobs.length,
      status: 'queued',
    };
  });

  // 获取任务状态
  fastify.get('/tasks/:taskId', {
    schema: {
      description: 'Get crawl task status',
      tags: ['Crawler'],
      params: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
        },
        required: ['taskId'],
      },
    },
  }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const status = await crawlerEngine.getTaskStatus(taskId);
    return status;
  });

  // 获取任务结果
  fastify.get('/tasks/:taskId/result', {
    schema: {
      description: 'Get crawl task result',
      tags: ['Crawler'],
      params: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
        },
        required: ['taskId'],
      },
    },
  }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const status = await crawlerEngine.getTaskStatus(taskId);
    return status.result;
  });

  // 获取统计信息
  fastify.get('/stats', {
    schema: {
      description: 'Get crawler statistics',
      tags: ['Crawler'],
    },
  }, async (request, reply) => {
    const stats = await crawlerEngine.getStats();
    return stats;
  });

  // 暂停队列
  fastify.post('/pause', {
    schema: {
      description: 'Pause crawler queue',
      tags: ['Crawler'],
    },
  }, async (request, reply) => {
    await crawlerEngine.pause();
    return { status: 'paused' };
  });

  // 恢复队列
  fastify.post('/resume', {
    schema: {
      description: 'Resume crawler queue',
      tags: ['Crawler'],
    },
  }, async (request, reply) => {
    await crawlerEngine.resume();
    return { status: 'resumed' };
  });

  // 清空队列
  fastify.delete('/queue', {
    schema: {
      description: 'Clear crawler queue',
      tags: ['Crawler'],
    },
  }, async (request, reply) => {
    await crawlerEngine.obliterates();
    return { status: 'cleared' };
  });
}
