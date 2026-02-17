/**
 * CAPTCHA Solver
 * 验证码求解器，支持多种验证码类型
 */

import { EventEmitter } from 'events';
import OcrSolver from './OcrSolver';
import RecaptchaSolver from './RecaptchaSolver';
import SliderCaptchaSolver from './SliderCaptchaSolver';
import { CaptchaOptions, CaptchaResult } from './types';

export class CaptchaSolver extends EventEmitter {
  private solvers: Map<string, any>;
  private stats: {
    totalAttempts: number;
    successfulSolves: number;
    failedSolves: number;
    averageTime: number;
  };

  constructor() {
    super();

    this.solvers = new Map();
    this.stats = {
      totalAttempts: 0,
      successfulSolves: 0,
      failedSolves: 0,
      averageTime: 0,
    };

    this.initializeSolvers();
  }

  /**
   * 初始化求解器
   */
  private initializeSolvers(): void {
    this.solvers.set('ocr', new OcrSolver());
    this.solvers.set('recaptcha', new RecaptchaSolver());
    this.solvers.set('slider', new SliderCaptchaSolver());
  }

  /**
   * 解决验证码
   */
  async solve(options: CaptchaOptions): Promise<CaptchaResult> {
    const startTime = Date.now();
    this.stats.totalAttempts++;

    try {
      const solver = this.solvers.get(options.type || 'ocr');

      if (!solver) {
        throw new Error(`Unsupported captcha type: ${options.type}`);
      }

      this.emit('solveStart', { type: options.type, options });

      const result = await solver.solve(options);
      const duration = Date.now() - startTime;

      if (result.success) {
        this.stats.successfulSolves++;
        this.updateAverageTime(duration);
        this.emit('solveSuccess', { type: options.type, result, duration });
      } else {
        this.stats.failedSolves++;
        this.emit('solveFailed', { type: options.type, error: result.error });
      }

      return {
        ...result,
        duration,
      };
    } catch (error) {
      this.stats.failedSolves++;
      const duration = Date.now() - startTime;

      this.emit('solveFailed', { type: options.type, error: error.message });

      return {
        success: false,
        error: error.message,
        duration,
      };
    }
  }

  /**
   * 解决图片验证码（OCR）
   */
  async solveImageCaptcha(imageBuffer: Buffer, options?: Partial<CaptchaOptions>): Promise<CaptchaResult> {
    return this.solve({
      type: 'ocr',
      image: imageBuffer,
      ...options,
    });
  }

  /**
   * 解决 reCAPTCHA
   */
  async solveRecaptcha(siteKey: string, url: string, version: 'v2' | 'v3' = 'v2'): Promise<CaptchaResult> {
    return this.solve({
      type: 'recaptcha',
      siteKey,
      url,
      version,
    });
  }

  /**
   * 解决滑块验证码
   */
  async solveSliderCaptcha(imageBuffer: Buffer, options?: Partial<CaptchaOptions>): Promise<CaptchaResult> {
    return this.solve({
      type: 'slider',
      image: imageBuffer,
      ...options,
    });
  }

  /**
   * 批量解决验证码
   */
  async solveBatch(captchaList: CaptchaOptions[]): Promise<CaptchaResult[]> {
    const results = await Promise.all(
      captchaList.map(options => this.solve(options))
    );
    return results;
  }

  /**
   * 更新平均解决时间
   */
  private updateAverageTime(duration: number): void {
    const successfulSolves = this.stats.successfulSolves;
    this.stats.averageTime =
      (this.stats.averageTime * (successfulSolves - 1) + duration) / successfulSolves;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalAttempts > 0
        ? this.stats.successfulSolves / this.stats.totalAttempts
        : 0,
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalAttempts: 0,
      successfulSolves: 0,
      failedSolves: 0,
      averageTime: 0,
    };
  }
}

export default CaptchaSolver;
