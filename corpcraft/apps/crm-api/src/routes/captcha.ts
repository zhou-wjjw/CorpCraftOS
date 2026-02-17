/**
 * CAPTCHA Routes
 * 验证码处理 API 路由
 */

import { FastifyInstance } from 'fastify';
import CaptchaSolver from '@corpcraft/captcha-solver/src/solvers/CaptchaSolver';
import { CaptchaOptions } from '@corpcraft/captcha-solver/src/solvers/types';

const captchaSolver = new CaptchaSolver();

export default async function captchaRoutes(fastify: FastifyInstance) {
  // 解决图片验证码
  fastify.post('/image', {
    schema: {
      description: 'Solve image CAPTCHA using OCR',
      tags: ['CAPTCHA'],
      consumes: ['multipart/form-data'],
      body: {
        type: 'object',
        properties: {
          image: { type: 'string', format: 'binary' },
          language: { type: 'string', default: 'eng' },
          postProcess: { type: 'object' },
        },
        required: ['image'],
      },
    },
  }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        reply.code(400).send({ error: 'No image file provided' });
        return;
      }

      const buffer = await data.toBuffer();
      const options: CaptchaOptions = {
        type: 'ocr',
        image: buffer,
      };

      const result = await captchaSolver.solve(options);
      return result;
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // 解决 reCAPTCHA
  fastify.post('/recaptcha', {
    schema: {
      description: 'Solve Google reCAPTCHA',
      tags: ['CAPTCHA'],
      body: {
        type: 'object',
        properties: {
          siteKey: { type: 'string' },
          url: { type: 'string' },
          version: { type: 'string', enum: ['v2', 'v3'], default: 'v2' },
        },
        required: ['siteKey', 'url'],
      },
    },
  }, async (request, reply) => {
    const { siteKey, url, version } = request.body as any;
    const result = await captchaSolver.solveRecaptcha(siteKey, url, version);
    return result;
  });

  // 解决滑块验证码
  fastify.post('/slider', {
    schema: {
      description: 'Solve slider CAPTCHA',
      tags: ['CAPTCHA'],
      consumes: ['multipart/form-data'],
      body: {
        type: 'object',
        properties: {
          image: { type: 'string', format: 'binary' },
        },
        required: ['image'],
      },
    },
  }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        reply.code(400).send({ error: 'No image file provided' });
        return;
      }

      const buffer = await data.toBuffer();
      const result = await captchaSolver.solveSliderCaptcha(buffer);
      return result;
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // 批量解决验证码
  fastify.post('/batch', {
    schema: {
      description: 'Solve multiple CAPTCHAs',
      tags: ['CAPTCHA'],
      body: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['ocr', 'recaptcha', 'slider'] },
          },
          required: ['type'],
        },
      },
    },
  }, async (request, reply) => {
    const captchaList = request.body as CaptchaOptions[];
    const results = await captchaSolver.solveBatch(captchaList);
    return { results };
  });

  // 获取统计信息
  fastify.get('/stats', {
    schema: {
      description: 'Get CAPTCHA solver statistics',
      tags: ['CAPTCHA'],
    },
  }, async (request, reply) => {
    const stats = captchaSolver.getStats();
    return stats;
  });

  // 重置统计
  fastify.delete('/stats', {
    schema: {
      description: 'Reset CAPTCHA solver statistics',
      tags: ['CAPTCHA'],
    },
  }, async (request, reply) => {
    captchaSolver.resetStats();
    return { reset: true };
  });
}
