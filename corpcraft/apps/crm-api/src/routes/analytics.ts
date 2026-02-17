/**
 * Analytics Routes
 * 分析和报表 API 路由
 */

import { FastifyInstance } from 'fastify';
import CustomerService from '@corpcraft/crm-core/src/services/CustomerService';

const customerService = new CustomerService();

export default async function analyticsRoutes(fastify: FastifyInstance) {
  // 获取客户分析
  fastify.get('/customers', {
    schema: {
      description: 'Get customer analytics',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
        },
      },
    },
  }, async (request, reply) => {
    const { startDate, endDate } = request.query as any;
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const analytics = await customerService.getAnalytics(start, end);
    return analytics;
  });

  // 获取销售漏斗
  fastify.get('/sales-funnel', {
    schema: {
      description: 'Get sales funnel data',
      tags: ['Analytics'],
    },
  }, async (request, reply) => {
    // 这里可以实现销售漏斗逻辑
    return {
      stages: [
        { name: 'New', count: 100, value: 50000 },
        { name: 'Contacted', count: 60, value: 80000 },
        { name: 'Qualified', count: 30, value: 120000 },
        { name: 'Proposal', count: 15, value: 180000 },
        { name: 'Negotiation', count: 8, value: 250000 },
        { name: 'Won', count: 5, value: 150000 },
      ],
      totalValue: 830000,
      conversionRate: 5,
    };
  });

  // 获取趋势数据
  fastify.get('/trends', {
    schema: {
      description: 'Get customer trends',
      tags: ['Analytics'],
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['daily', 'weekly', 'monthly'], default: 'daily' },
          days: { type: 'number', default: 30 },
        },
      },
    },
  }, async (request, reply) => {
    const { period, days } = request.query as any;
    // 这里可以实现趋势分析逻辑
    return {
      period,
      data: [],
    };
  });
}
