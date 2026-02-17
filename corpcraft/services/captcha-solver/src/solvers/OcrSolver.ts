/**
 * OCR CAPTCHA Solver
 * 使用 Tesseract.js 解决图片验证码
 */

import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import { CaptchaOptions, CaptchaResult } from './types';

class OcrSolver {
  /**
   * 解决图片验证码
   */
  async solve(options: CaptchaOptions): Promise<CaptchaResult> {
    try {
      if (!options.image) {
        throw new Error('Image buffer is required');
      }

      // 预处理图片
      const processedImage = await this.preprocessImage(options.image, options);

      // 使用 Tesseract 进行 OCR
      const result = await Tesseract.recognize(
        processedImage,
        options.language || 'eng',
        {
          logger: (m: any) => console.log(m),
        }
      );

      // 提取文本
      let text = result.data.text.trim();

      // 后处理文本
      if (options.postProcess) {
        text = this.postProcessText(text, options.postProcess);
      }

      return {
        success: true,
        text,
        confidence: result.data.confidence,
        metadata: {
          words: result.data.words.length,
          lines: result.data.lines.length,
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
   * 预处理图片以提高识别率
   */
  private async preprocessImage(imageBuffer: Buffer, options: CaptchaOptions): Promise<Buffer> {
    let pipeline = sharp(imageBuffer);

    // 转换为灰度
    if (options.grayscale !== false) {
      pipeline = pipeline.grayscale();
    }

    // 调整对比度
    if (options.contrast) {
      pipeline = pipeline.normalize();
    }

    // 二值化
    if (options.threshold) {
      pipeline = pipeline.threshold(options.threshold);
    } else {
      // 自动阈值
      pipeline = pipeline.threshold(128);
    }

    // 去噪
    if (options.denoise) {
      pipeline = pipeline.sharpen();
    }

    // 调整大小
    if (options.scale) {
      const width = Math.floor(options.scale * (await sharp(imageBuffer).metadata()).width!);
      pipeline = pipeline.resize(width);
    }

    return await pipeline.png().toBuffer();
  }

  /**
   * 后处理文本
   */
  private postProcessText(text: string, rules: any): string {
    let processedText = text;

    // 移除空格
    if (rules.removeSpaces) {
      processedText = processedText.replace(/\s/g, '');
    }

    // 只保留字母数字
    if (rules.alphanumericOnly) {
      processedText = processedText.replace(/[^a-zA-Z0-9]/g, '');
    }

    // 只保留数字
    if (rules.numericOnly) {
      processedText = processedText.replace(/[^0-9]/g, '');
    }

    // 转换为大写
    if (rules.uppercase) {
      processedText = processedText.toUpperCase();
    }

    // 转换为小写
    if (rules.lowercase) {
      processedText = processedText.toLowerCase();
    }

    // 自定义正则替换
    if (rules.regexReplace) {
      for (const [pattern, replacement] of Object.entries(rules.regexReplace)) {
        processedText = processedText.replace(new RegExp(pattern, 'g'), replacement as string);
      }
    }

    return processedText;
  }
}

export default OcrSolver;
