/**
 * Customer Routes
 * 客户管理 API 路由
 */

import { FastifyInstance } from 'fastify';
import CustomerService from '@corpcraft/crm-core/src/services/CustomerService';

const customerService = new CustomerService();

export default async function customerRoutes(fastify: FastifyInstance) {
  // 创建客户
  fastify.post('/', {
    schema: {
      description: 'Create a new customer',
      tags: ['Customers'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          company: { type: 'string' },
          title: { type: 'string' },
          status: {
            type: 'string',
            enum: ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'],
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
          },
          estimatedValue: { type: 'number' },
        },
        required: ['name'],
      },
    },
  }, async (request, reply) => {
    const customerData = request.body;
    const customer = await customerService.createCustomer(customerData);
    return customer;
  });

  // 批量创建客户
  fastify.post('/batch', {
    schema: {
      description: 'Create multiple customers',
      tags: ['Customers'],
      body: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['name'],
        },
      },
    },
  }, async (request, reply) => {
    const customersData = request.body as any[];
    const customers = await customerService.createCustomers(customersData);
    return {
      customers,
      count: customers.length,
    };
  });

  // 获取客户列表
  fastify.get('/', {
    schema: {
      description: 'Get customers with filters',
      tags: ['Customers'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          priority: { type: 'string' },
          category: { type: 'string' },
          search: { type: 'string' },
          page: { type: 'number', default: 1 },
          pageSize: { type: 'number', default: 20 },
        },
      },
    },
  }, async (request, reply) => {
    const filter = request.query as any;
    const result = await customerService.searchCustomers(filter);
    return result;
  });

  // 获取单个客户
  fastify.get('/:id', {
    schema: {
      description: 'Get customer by ID',
      tags: ['Customers'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const customer = await customerService.getCustomer(id);
    if (!customer) {
      reply.code(404).send({ error: 'Customer not found' });
      return;
    }
    return customer;
  });

  // 更新客户
  fastify.patch('/:id', {
    schema: {
      description: 'Update customer',
      tags: ['Customers'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          status: { type: 'string' },
          priority: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body;
    const customer = await customerService.updateCustomer(id, updates);
    if (!customer) {
      reply.code(404).send({ error: 'Customer not found' });
      return;
    }
    return customer;
  });

  // 删除客户
  fastify.delete('/:id', {
    schema: {
      description: 'Delete customer',
      tags: ['Customers'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await customerService.deleteCustomer(id);
    if (!deleted) {
      reply.code(404).send({ error: 'Customer not found' });
      return;
    }
    return { success: true };
  });
}
