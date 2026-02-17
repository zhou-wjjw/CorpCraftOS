# AICRM 使用指南

## 系统概述

AICRM 是一个企业级的智能客户关系管理系统，集成了先进的数据爬取、反爬虫、验证码处理和 AI 分析能力。

## 快速开始

### 1. 安装依赖

```bash
# 安装所有服务依赖
pnpm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379

# MongoDB 配置
MONGODB_URI=mongodb://localhost:27017/aicrm

# 验证码解决服务（可选）
CAPTCHA_SOLVER_API_KEY=your_api_key_here

# API 配置
PORT=3000
HOST=0.0.0.0
```

### 3. 启动服务

```bash
# 启动 API 网关
pnpm --filter @corpcraft/crm-api dev

# 启动爬取服务
pnpm --filter @corpcraft/ai-crawler dev

# 启动反爬虫服务
pnpm --filter @corpcraft/anti-bot dev
```

## API 使用示例

### 爬取数据

```bash
# 创建爬取任务
curl -X POST http://localhost:3000/api/crawler/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "strategy": "puppeteer",
    "priority": 5,
    "selectors": {
      "fields": {
        "title": "h1",
        "description": ".description"
      }
    }
  }'

# 查看任务状态
curl http://localhost:3000/api/crawler/tasks/{taskId}

# 获取任务结果
curl http://localhost:3000/api/crawler/tasks/{taskId}/result
```

### 客户管理

```bash
# 创建客户
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张三",
    "email": "zhangsan@example.com",
    "company": "科技公司",
    "title": "CTO",
    "status": "new",
    "priority": "high",
    "estimatedValue": 100000
  }'

# 批量创建客户
curl -X POST http://localhost:3000/api/customers/batch \
  -H "Content-Type: application/json" \
  -d '[
    {"name": "李四", "email": "lisi@example.com"},
    {"name": "王五", "email": "wangwu@example.com"}
  ]'

# 搜索客户
curl "http://localhost:3000/api/customers?status=new&search=科技&page=1&pageSize=20"

# 获取分析数据
curl http://localhost:3000/api/analytics/customers
```

### 代理池管理

```bash
# 添加代理
curl -X POST http://localhost:3000/api/proxy \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://proxy.example.com:8080",
    "type": "http",
    "username": "user",
    "password": "pass"
  }'

# 批量添加代理
curl -X POST http://localhost:3000/api/proxy/batch \
  -H "Content-Type: application/json" \
  -d '[
    "http://proxy1.example.com:8080",
    "http://proxy2.example.com:8080"
  ]'

# 获取下一个可用代理
curl http://localhost:3000/api/proxy/next

# 获取最佳代理
curl http://localhost:3000/api/proxy/best

# 查看代理统计
curl http://localhost:3000/api/proxy/stats

# 清理无效代理
curl -X DELETE http://localhost:3000/api/proxy/cleanup
```

### 验证码处理

```bash
# 解决图片验证码
curl -X POST http://localhost:3000/api/captcha/image \
  -F "image=@captcha.png" \
  -F "language=eng"

# 解决 reCAPTCHA
curl -X POST http://localhost:3000/api/captcha/recaptcha \
  -H "Content-Type: application/json" \
  -d '{
    "siteKey": "6Le-wvkSAAAAABBM3l...",
    "url": "https://example.com",
    "version": "v2"
  }'

# 解决滑块验证码
curl -X POST http://localhost:3000/api/captcha/slider \
  -F "image=@slider.png"

# 查看统计
curl http://localhost:3000/api/captcha/stats
```

## 高级功能

### 1. 智能爬取策略

```typescript
// 使用不同策略爬取
const task = {
  url: 'https://example.com',
  strategy: 'puppeteer', // 或 'api'
  selectors: {
    list: '.product-list',
    item: '.product-item',
    fields: {
      title: '.title',
      price: '.price',
      image: 'img@src'
    }
  },
  pagination: {
    type: 'scroll',
    maxPages: 10
  }
};
```

### 2. 数据自动处理

```typescript
// 爬取结果自动转换为 CRM 客户
const crawlResult = await crawler.execute(task);
const customer = await customerService.createCustomer({
  name: crawlResult.data.name,
  email: crawlResult.data.email,
  company: crawlResult.data.company,
  metadata: {
    source: 'crawler',
    crawlerJobId: crawlResult.taskId,
    originalUrl: crawlResult.url
  }
});
```

### 3. 反爬虫对抗

```typescript
// 应用反爬虫措施
const antiBot = new AntiBotEngine({
  userAgentRotation: true,
  headerRandomization: true,
  humanBehaviorSimulation: true,
  requestDelay: { min: 1000, max: 3000 }
});

await antiBot.applyToPage(page, { domain: 'example.com' });
```

### 4. 实时监控

```typescript
// WebSocket 监听任务进度
const io = io('http://localhost:3000');

io.on('connect', () => {
  io.emit('join', 'crawler-tasks');
});

io.on('taskCompleted', (data) => {
  console.log('Task completed:', data);
});
```

## 最佳实践

### 1. 爬取策略

- **API 优先**: 优先使用 API 爬取，性能更好
- **合理延迟**: 设置适当的请求延迟，避免被封
- **错误处理**: 实现完善的错误处理和重试机制
- **增量更新**: 只爬取更新的内容，节省资源

### 2. 代理使用

- **定期测试**: 定期测试代理可用性
- **负载均衡**: 合理分配请求到不同代理
- **监控成功率**: 及时剔除无效代理
- **地理分布**: 使用不同地区的代理

### 3. 数据质量

- **去重处理**: 爬取前检查是否已存在
- **数据验证**: 验证数据完整性和正确性
- **分类标记**: 自动分类和标记客户
- **定期清理**: 清理无效和过期数据

### 4. 性能优化

- **批量操作**: 使用批量 API 提高效率
- **异步处理**: 使用任务队列异步处理
- **缓存策略**: 合理使用缓存减少重复请求
- **监控指标**: 监控关键指标，及时优化

## 故障排除

### 常见问题

1. **爬取失败**
   - 检查目标网站是否可访问
   - 验证代理是否正常工作
   - 检查是否遇到验证码

2. **代理不可用**
   - 测试代理连接
   - 检查代理认证信息
   - 更换代理提供商

3. **验证码识别失败**
   - 检查图片质量
   - 尝试不同的预处理参数
   - 考虑使用第三方服务

4. **性能问题**
   - 减少并发数
   - 优化数据库查询
   - 启用缓存

## 安全建议

1. **API 密钥管理**: 不要在代码中硬编码 API 密钥
2. **访问控制**: 实施适当的访问控制和权限管理
3. **数据加密**: 敏感数据加密存储
4. **日志审计**: 记录所有关键操作
5. **定期更新**: 保持依赖项更新

## 扩展开发

### 添加新的爬取策略

```typescript
class CustomStrategy {
  async execute(task, context) {
    // 实现自定义爬取逻辑
  }
}

// 注册策略
crawlerEngine.strategies.set('custom', new CustomStrategy());
```

### 自定义数据处理

```typescript
class CustomDataProcessor {
  process(rawData) {
    // 自定义数据处理逻辑
  }
}
```

## 监控和日志

### 系统监控

```bash
# 查看系统状态
curl http://localhost:3000/health

# 查看爬虫统计
curl http://localhost:3000/api/crawler/stats

# 查看验证码统计
curl http://localhost:3000/api/captcha/stats
```

### 日志配置

系统使用结构化日志，可以集成到 ELK 或其他日志平台。

## 部署建议

### Docker 部署

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

### Kubernetes 部署

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aicrm-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: aicrm-api
  template:
    metadata:
      labels:
        app: aicrm-api
    spec:
      containers:
      - name: api
        image: aicrm-api:latest
        ports:
        - containerPort: 3000
```

## 贡献指南

欢迎贡献代码、报告问题或提出改进建议。

## 许可证

MIT License
