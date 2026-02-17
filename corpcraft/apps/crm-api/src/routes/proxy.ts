/**
 * Proxy Routes
 * 代理池管理 API 路由
 */

import { FastifyInstance } from 'fastify';
import ProxyPool from '@corpcraft/anti-bot/src/core/ProxyPool';

const proxyPool = new ProxyPool({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

export default async function proxyRoutes(fastify: FastifyInstance) {
  // 添加代理
  fastify.post('/', {
    schema: {
      description: 'Add proxy to pool',
      tags: ['Proxy'],
      body: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          type: { type: 'string', enum: ['http', 'https', 'socks5'] },
          username: { type: 'string' },
          password: { type: 'string' },
          country: { type: 'string' },
        },
        required: ['url', 'type'],
      },
    },
  }, async (request, reply) => {
    const proxyData = request.body as any;
    const added = await proxyPool.addProxy(proxyData);
    return { added };
  });

  // 批量添加代理
  fastify.post('/batch', {
    schema: {
      description: 'Add multiple proxies',
      tags: ['Proxy'],
      body: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
    },
  }, async (request, reply) => {
    const proxyUrls = request.body as string[];
    const count = await proxyPool.addProxies(proxyUrls);
    return { added: count };
  });

  // 获取代理
  fastify.get('/next', {
    schema: {
      description: 'Get next available proxy',
      tags: ['Proxy'],
    },
  }, async (request, reply) => {
    const proxy = proxyPool.getNextProxy();
    if (!proxy) {
      reply.code(404).send({ error: 'No proxies available' });
      return;
    }
    return proxy;
  });

  // 获取最佳代理
  fastify.get('/best', {
    schema: {
      description: 'Get best proxy based on success rate',
      tags: ['Proxy'],
    },
  }, async (request, reply) => {
    const proxy = proxyPool.getBestProxy();
    if (!proxy) {
      reply.code(404).send({ error: 'No proxies available' });
      return;
    }
    return proxy;
  });

  // 获取统计信息
  fastify.get('/stats', {
    schema: {
      description: 'Get proxy pool statistics',
      tags: ['Proxy'],
    },
  }, async (request, reply) => {
    const stats = proxyPool.getStats();
    return stats;
  });

  // 清理无效代理
  fastify.delete('/cleanup', {
    schema: {
      description: 'Remove inactive proxies',
      tags: ['Proxy'],
    },
  }, async (request, reply) => {
    const removed = await proxyPool.cleanupInvalidProxies();
    return { removed };
  });

  // 记录代理使用结果
  fastify.post('/record', {
    schema: {
      description: 'Record proxy usage result',
      tags: ['Proxy'],
      body: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          success: { type: 'boolean' },
        },
        required: ['url', 'success'],
      },
    },
  }, async (request, reply) => {
    const { url, success } = request.body as { url: string; success: boolean };
    await proxyPool.recordResult(url, success);
    return { recorded: true };
  });
}
