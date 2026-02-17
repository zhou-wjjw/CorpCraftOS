/**
 * Slider CAPTCHA Solver
 * 解决滑块验证码
 */

import sharp from 'sharp';
import { CaptchaOptions, CaptchaResult } from './types';

class SliderCaptchaSolver {
  /**
   * 解决滑块验证码
   */
  async solve(options: CaptchaOptions): Promise<CaptchaResult> {
    try {
      if (!options.image) {
        throw new Error('Image buffer is required');
      }

      // 分析图片找出缺口位置
      const position = await this.findSliderPosition(options.image, options);

      if (!position) {
        throw new Error('Failed to detect slider position');
      }

      // 生成滑动轨迹
      const track = this.generateTrack(position);

      return {
        success: true,
        metadata: {
          position,
          track,
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
   * 找出滑块位置
   */
  private async findSliderPosition(imageBuffer: Buffer, options: CaptchaOptions): Promise<number | null> {
    try {
      // 转换图片为像素数据
      const { data, info } = await sharp(imageBuffer)
        .raw()
        .toBuffer({ resolveWithObject: true });

      const { width, height } = info;
      const pixels = new Uint8ClampedArray(data);

      // 使用边缘检测找出缺口
      const edgeData = this.detectEdges(pixels, width, height);

      // 寻找可能的缺口位置
      const position = this.findGapPosition(edgeData, width, height);

      return position;
    } catch (error) {
      console.error('Error finding slider position:', error);
      return null;
    }
  }

  /**
   * 边缘检测
   */
  private detectEdges(pixels: Uint8ClampedArray, width: number, height: number): number[] {
    const edges = new Array(width * height).fill(0);

    // Sobel 算子
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;

        // Sobel 3x3 卷积核
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const gray = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;

            const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
            const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

            gx += gray * sobelX[ky + 1][kx + 1];
            gy += gray * sobelY[ky + 1][kx + 1];
          }
        }

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[y * width + x] = magnitude > 50 ? 1 : 0;
      }
    }

    return edges;
  }

  /**
   * 寻找缺口位置
   */
  private findGapPosition(edges: number[], width: number, height: number): number | null {
    // 统计每列的边缘点数量
    const columnEdges = new Array(width).fill(0);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (edges[y * width + x] === 1) {
          columnEdges[x]++;
        }
      }
    }

    // 找出边缘点密集的区域（缺口位置）
    const threshold = height * 0.3; // 阈值
    let maxScore = 0;
    let bestPosition = null;

    for (let x = 50; x < width - 50; x++) {
      const score = columnEdges[x] + columnEdges[x + 1] + columnEdges[x + 2];

      if (score > threshold && score > maxScore) {
        maxScore = score;
        bestPosition = x;
      }
    }

    return bestPosition;
  }

  /**
   * 生成滑动轨迹
   */
  private generateTrack(targetX: number): Array<{ x: number; y: number; duration: number }> {
    const track = [];
    const steps = 30; // 分成 30 步
    const stepSize = targetX / steps;

    let currentX = 0;
    let currentY = 0;

    for (let i = 0; i <= steps; i++) {
      // 添加一些随机性
      const randomX = (Math.random() - 0.5) * 2;
      const randomY = (Math.random() - 0.5) * 2;

      currentX = Math.min(targetX, currentX + stepSize + randomX);
      currentY += randomY;

      // 模拟人类滑动，速度不均匀
      const duration = Math.random() * 20 + 10;

      track.push({
        x: Math.round(currentX),
        y: Math.round(currentY),
        duration: Math.round(duration),
      });
    }

    return track;
  }
}

export default SliderCaptchaSolver;
