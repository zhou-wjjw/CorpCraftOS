/**
 * AICRM API Gateway
 * 集成所有 CRM 服务的 API 网关
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { Socket } from 'socket.io';
import crawlerRoutes from './routes/crawler';
import customerRoutes from './routes/customers';
import analyticsRoutes from './routes/analytics';
import proxyRoutes from './routes/proxy';
import captchaRoutes from './routes/captcha';

const fastify = Fastify({
  logger: true,
});

// 注册插件
await fastify.register(cors, {
  origin: true,
  credentials: true,
});

// Swagger 文档
await fastify.register(swagger, {
  openapi: {
    info: {
      title: 'AICRM API',
      description: 'AI-Powered Customer Relationship Management API',
      version: '1.0.0',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
  },
});

await fastify.register(swaggerUI, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
  },
});

// 健康检查
fastify.get('/health', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      crawler: 'running',
      antiBot: 'running',
      captchaSolver: 'running',
      crmCore: 'running',
    },
  };
});

// 注册路由
await fastify.register(crawlerRoutes, { prefix: '/api/crawler' });
await fastify.register(customerRoutes, { prefix: '/api/customers' });
await fastify.register(analyticsRoutes, { prefix: '/api/analytics' });
await fastify.register(proxyRoutes, { prefix: '/api/proxy' });
await fastify.register(captchaRoutes, { prefix: '/api/captcha' });

// WebSocket 支持（用于实时更新）
const io = (fastify as any).io;

io.on('connection', (socket: Socket) => {
  console.log('Client connected:', socket.id);

  // 加入房间
  socket.on('join', (room: string) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room ${room}`);
  });

  // 离开房间
  socket.on('leave', (room: string) => {
    socket.leave(room);
    console.log(`Socket ${socket.id} left room ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// 错误处理
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  reply.code(error.statusCode || 500).send({
    error: {
      message: error.message,
      code: error.code || 'INTERNAL_SERVER_ERROR',
    },
  });
});

// 启动服务器
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`🚀 AICRM API Gateway running on http://${host}:${port}`);
    console.log(`📚 API Documentation: http://${host}:${port}/docs`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
