/**
 * reCAPTCHA Solver
 * 解决 Google reCAPTCHA v2/v3
 */

import axios from 'axios';
import { CaptchaOptions, CaptchaResult } from './types';

class RecaptchaSolver {
  private apiKey?: string;
  private apiUrl: string;

  constructor() {
    // 可以使用第三方服务如 2Captcha, Anti-Captcha 等
    this.apiKey = process.env.CAPTCHA_SOLVER_API_KEY;
    this.apiUrl = 'https://api.2captcha.com/createTask';
  }

  /**
   * 解决 reCAPTCHA
   */
  async solve(options: CaptchaOptions): Promise<CaptchaResult> {
    try {
      if (!options.siteKey || !options.url) {
        throw new Error('siteKey and url are required for reCAPTCHA');
      }

      // 使用第三方服务解决
      if (this.apiKey) {
        return await this.solveWithService(options);
      }

      // 如果没有配置第三方服务，返回模拟结果
      // 实际应用中需要配置真实的验证码解决服务
      return {
        success: false,
        error: 'CAPTCHA solver service not configured. Please set CAPTCHA_SOLVER_API_KEY environment variable.',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 使用第三方服务解决
   */
  private async solveWithService(options: CaptchaOptions): Promise<CaptchaResult> {
    try {
      // 创建任务
      const createTaskResponse = await axios.post(
        this.apiUrl,
        {
          clientKey: this.apiKey,
          task: {
            type: 'RecaptchaV2TaskProxyless',
            websiteURL: options.url,
            websiteKey: options.siteKey,
          },
        }
      );

      const taskId = createTaskResponse.data.taskId;

      if (!taskId) {
        throw new Error('Failed to create CAPTCHA solving task');
      }

      // 等待解决结果
      const result = await this.waitForResult(taskId);

      return {
        success: true,
        text: result.gRecaptchaResponse,
        metadata: {
          taskId,
          service: '2captcha',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 等待解决结果
   */
  private async waitForResult(taskId: number): Promise<any> {
    const maxAttempts = 30; // 最多等待 30 次
    const interval = 2000; // 每 2 秒检查一次

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, interval));

      try {
        const response = await axios.post('https://api.2captcha.com/getTaskResult', {
          clientKey: this.apiKey,
          taskId: taskId,
        });

        if (response.data.status === 'ready') {
          return response.data.solution;
        } else if (response.data.status === 'failed') {
          throw new Error('CAPTCHA solving failed');
        }
      } catch (error) {
        if (i === maxAttempts - 1) {
          throw error;
        }
      }
    }

    throw new Error('CAPTCHA solving timeout');
  }
}

export default RecaptchaSolver;
