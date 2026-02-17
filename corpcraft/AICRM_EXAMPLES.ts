/**
 * AICRM 使用示例
 * 演示如何使用 AICRM 系统的各种功能
 */

import CrawlerEngine from '@corpcraft/ai-crawler/src/core/CrawlerEngine';
import { AntiBotEngine } from '@corpcraft/anti-bot/src/core/AntiBotEngine';
import CaptchaSolver from '@corpcraft/captcha-solver/src/solvers/CaptchaSolver';
import CustomerService from '@corpcraft/crm-core/src/services/CustomerService';
import axios from 'axios';

const API_BASE = 'http://localhost:3000';

// ============================================
// 示例 1: 基础网页爬取
// ============================================
async function example1_BasicWebScraping() {
  console.log('=== 示例 1: 基础网页爬取 ===');

  const response = await axios.post(`${API_BASE}/api/crawler/tasks`, {
    url: 'https://example.com',
    strategy: 'puppeteer',
    priority: 5,
    selectors: {
      fields: {
        title: 'h1',
        description: 'p',
      }
    }
  });

  const { taskId } = response.data;
  console.log('任务已创建:', taskId);

  // 等待任务完成
  await waitForTask(taskId);

  // 获取结果
  const result = await axios.get(`${API_BASE}/api/crawler/tasks/${taskId}/result`);
  console.log('爬取结果:', result.data);
}

// ============================================
// 示例 2: 批量爬取并创建客户
// ============================================
async function example2_BatchCrawlAndCreateCustomers() {
  console.log('=== 示例 2: 批量爬取并创建客户 ===');

  const urls = [
    'https://example.com/company1',
    'https://example.com/company2',
    'https://example.com/company3',
  ];

  // 创建批量爬取任务
  const tasks = urls.map(url => ({
    url,
    strategy: 'puppeteer' as const,
    selectors: {
      fields: {
        name: '.company-name',
        email: '.contact-email',
        phone: '.contact-phone',
        description: '.company-description',
      }
    }
  }));

  const response = await axios.post(`${API_BASE}/api/crawler/tasks/batch`, tasks);
  console.log('批量任务已创建:', response.data.taskIds);

  // 等待所有任务完成
  await Promise.all(
    response.data.taskIds.map((taskId: string) => waitForTask(taskId))
  );

  // 获取结果并创建客户
  for (const taskId of response.data.taskIds) {
    const result = await axios.get(`${API_BASE}/api/crawler/tasks/${taskId}/result`);
    const crawlData = result.data;

    if (crawlData.success && crawlData.data) {
      // 创建客户
      const customer = await axios.post(`${API_BASE}/api/customers`, {
        name: crawlData.data.name || 'Unknown',
        email: crawlData.data.email,
        phone: crawlData.data.phone,
        company: crawlData.data.name,
        metadata: {
          source: 'crawler',
          crawlerJobId: taskId,
          originalUrl: crawlData.url,
        }
      });

      console.log('客户已创建:', customer.data._id);
    }
  }
}

// ============================================
// 示例 3: 代理池管理
// ============================================
async function example3_ProxyPoolManagement() {
  console.log('=== 示例 3: 代理池管理 ===');

  // 添加代理
  const proxies = [
    'http://proxy1.example.com:8080',
    'http://proxy2.example.com:8080',
    'http://proxy3.example.com:8080',
  ];

  await axios.post(`${API_BASE}/api/proxy/batch`, proxies);
  console.log('代理已添加');

  // 查看代理统计
  const stats = await axios.get(`${API_BASE}/api/proxy/stats`);
  console.log('代理统计:', stats.data);

  // 获取最佳代理
  const bestProxy = await axios.get(`${API_BASE}/api/proxy/best`);
  console.log('最佳代理:', bestProxy.data);

  // 使用代理爬取
  const response = await axios.post(`${API_BASE}/api/crawler/tasks`, {
    url: 'https://example.com',
    strategy: 'puppeteer',
    proxy: {
      url: bestProxy.data.url,
      username: bestProxy.data.username,
      password: bestProxy.data.password,
    }
  });

  console.log('使用代理的任务已创建:', response.data.taskId);
}

// ============================================
// 示例 4: 验证码处理
// ============================================
async function example4_CaptchaSolving() {
  console.log('=== 示例 4: 验证码处理 ===');

  // 模拟图片验证码
  const fs = require('fs');
  const imageBuffer = fs.readFileSync('captcha.png');

  const FormData = require('form-data');
  const form = new FormData();
  form.append('image', imageBuffer, 'captcha.png');
  form.append('language', 'eng');

  const response = await axios.post(
    `${API_BASE}/api/captcha/image`,
    form,
    {
      headers: form.getHeaders(),
    }
  );

  console.log('验证码识别结果:', response.data);

  if (response.data.success) {
    console.log('识别的验证码文本:', response.data.text);
    console.log('置信度:', response.data.confidence);
  }
}

// ============================================
// 示例 5: 客户搜索和分析
// ============================================
async function example5_CustomerSearchAndAnalytics() {
  console.log('=== 示例 5: 客户搜索和分析 ===');

  // 搜索客户
  const searchResult = await axios.get(`${API_BASE}/api/customers`, {
    params: {
      status: 'new',
      priority: 'high',
      search: '科技',
      page: 1,
      pageSize: 10,
    }
  });

  console.log('找到客户:', searchResult.data.customers.length);
  console.log('总数:', searchResult.data.total);

  // 获取分析数据
  const analytics = await axios.get(`${API_BASE}/api/analytics/customers`);
  console.log('客户分析:', analytics.data);

  // 获取销售漏斗
  const funnel = await axios.get(`${API_BASE}/api/analytics/sales-funnel`);
  console.log('销售漏斗:', funnel.data);
}

// ============================================
// 示例 6: 反爬虫对抗
// ============================================
async function example6_AntiBotTechniques() {
  console.log('=== 示例 6: 反爬虫对抗 ===');

  // 创建带有反爬虫措施的爬取任务
  const response = await axios.post(`${API_BASE}/api/crawler/tasks`, {
    url: 'https://example.com',
    strategy: 'puppeteer',
    // 反爬虫配置
    metadata: {
      antiBot: {
        userAgentRotation: true,
        headerRandomization: true,
        humanBehaviorSimulation: true,
        requestDelay: {
          min: 2000,
          max: 5000,
        },
      }
    }
  });

  console.log('反爬虫任务已创建:', response.data.taskId);
}

// ============================================
// 示例 7: 定时任务和监控
// ============================================
async function example7_ScheduledTasks() {
  console.log('=== 示例 7: 定时任务和监控 ===');

  // 创建定时任务（在指定时间执行）
  const scheduleTime = new Date(Date.now() + 60 * 60 * 1000); // 1小时后
  const response = await axios.post(`${API_BASE}/api/crawler/tasks`, {
    url: 'https://example.com',
    strategy: 'puppeteer',
    schedule: scheduleTime.toISOString(),
  });

  console.log('定时任务已创建:', response.data.taskId);

  // 监控任务状态
  const checkStatus = async () => {
    const status = await axios.get(`${API_BASE}/api/crawler/tasks/${response.data.taskId}`);
    console.log('任务状态:', status.data.state);

    if (status.data.state === 'completed') {
      console.log('任务完成！');
      return true;
    }
    return false;
  };

  // 定期检查状态
  const interval = setInterval(async () => {
    const completed = await checkStatus();
    if (completed) {
      clearInterval(interval);
    }
  }, 10000); // 每10秒检查一次
}

// ============================================
// 辅助函数
// ============================================
async function waitForTask(taskId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const status = await axios.get(`${API_BASE}/api/crawler/tasks/${taskId}`);
        const state = status.data.state;

        if (state === 'completed') {
          clearInterval(interval);
          resolve();
        } else if (state === 'failed') {
          clearInterval(interval);
          reject(new Error(status.data.failedReason));
        }
      } catch (error) {
        clearInterval(interval);
        reject(error);
      }
    }, 2000);
  });
}

// ============================================
// 主函数
// ============================================
async function main() {
  try {
    // 运行所有示例
    await example1_BasicWebScraping();
    await example2_BatchCrawlAndCreateCustomers();
    await example3_ProxyPoolManagement();
    await example4_CaptchaSolving();
    await example5_CustomerSearchAndAnalytics();
    await example6_AntiBotTechniques();
    await example7_ScheduledTasks();

    console.log('所有示例执行完成！');
  } catch (error) {
    console.error('执行示例时出错:', error);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

export {
  example1_BasicWebScraping,
  example2_BatchCrawlAndCreateCustomers,
  example3_ProxyPoolManagement,
  example4_CaptchaSolving,
  example5_CustomerSearchAndAnalytics,
  example6_AntiBotTechniques,
  example7_ScheduledTasks,
};
