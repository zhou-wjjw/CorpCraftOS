# AICRM 增强功能使用指南

## 📖 概述

本指南详细介绍了AICRM系统的增强功能，包括代理池管理、验证码识别、浏览器指纹对抗、人类行为模拟和AI数据分析等核心模块。

---

## 🌐 代理池管理 (Proxy Pool)

### 功能特性

✅ 自动获取和验证代理
✅ 代理质量评分系统
✅ 智能轮换和故障转移
✅ 支持HTTP/HTTPS/SOCKS5代理
✅ 定期健康检查
✅ 持久化存储

### 基本使用

```python
from aicrm.middleware.proxy_pool import get_proxy_pool, init_proxy_pool

# 初始化代理池
proxy_pool = await init_proxy_pool(
    min_size=50,           # 最小代理数量
    max_size=500,          # 最大代理数量
    validation_interval=300, # 验证间隔（秒）
    auto_fetch=True,       # 自动获取新代理
    save_path="data/proxies.json"
)

# 获取高质量代理
proxy_info = await proxy_pool.get_proxy(quality_threshold=30.0)

if proxy_info:
    print(f"使用代理: {proxy_info.proxy_url}")
    print(f"质量评分: {proxy_info.quality_score}")

    # 标记成功
    await proxy_pool.mark_success(proxy_info, response_time=0.5)

    # 或标记失败
    # await proxy_pool.mark_failure(proxy_info, error="Connection timeout")
else:
    print("没有可用代理")

# 获取统计信息
stats = proxy_pool.get_stats()
print(f"代理总数: {stats['total']}")
print(f"可用代理: {stats['working']}")
print(f"平均质量: {stats['avg_quality_score']}")
```

### 在Scrapy中使用

```python
# settings.py
PROXY_POOL_ENABLED = True
DOWNLOAD_DELAY = 1

# 在Spider中使用
from aicrm.middleware.proxy_pool import get_proxy_pool

class MySpider(scrapy.Spider):
    def start_requests(self):
        proxy_pool = get_proxy_pool()
        proxy_info = await proxy_pool.get_proxy()

        if proxy_info:
            yield scrapy.Request(
                url,
                meta={'proxy': proxy_info.proxy_url, 'proxy_info': proxy_info}
            )
```

### 自定义配置

```python
from aicrm.middleware.proxy_pool import ProxyPool, ProxyType

# 创建自定义代理池
custom_pool = ProxyPool(
    min_size=20,
    max_size=100,
    validation_interval=600,  # 10分钟验证一次
    auto_fetch=True,
)

# 手动添加代理
await custom_pool.add_proxy(
    "http://user:pass@proxy.example.com:8080",
    source="paid"  # 标记来源
)

# 验证所有代理
await custom_pool.validate_all()

# 关闭代理池
await custom_pool.shutdown()
```

---

## 🔐 验证码识别 (Captcha Solver)

### 功能特性

✅ 多引擎支持：Tesseract OCR, DDDDOCR, EasyCaptcha
✅ 深度学习模型集成
✅ 第三方打码平台（2Captcha）
✅ 混合识别策略（本地优先，降级到API）
✅ 图像预处理优化
✅ 支持多种验证码类型

### 基本使用

```python
from aicrm.middleware.captcha_solver import CaptchaSolver, CaptchaType

# 初始化识别器
solver = CaptchaSolver(config={
    'tesseract_path': '/usr/bin/tesseract',  # 可选
    '2captcha_api_key': 'your-api-key',      # 可选
})

# 识别图片验证码
result = await solver.solve(
    image_source='captcha.png',  # 支持文件路径、URL、bytes、PIL Image
    captcha_type=CaptchaType.TEXT_IMAGE
)

if result.success:
    print(f"识别结果: {result.result}")
    print(f"置信度: {result.confidence}")
    print(f"识别器: {result.solver}")
    print(f"耗时: {result.duration:.2f}秒")
else:
    print(f"识别失败: {result.error}")

# 获取统计信息
stats = solver.get_stats()
print(f"总识别数: {stats['total_solved']}")
print(f"成功率: {stats['success_rate']:.2%}")
```

### 在Playwright中使用

```python
from aicrm.middleware.captcha_solver import CaptchaSolver

async def solve_and_submit(page, selector):
    """识别验证码并提交"""
    solver = CaptchaSolver()

    # 截图验证码元素
    captcha_element = await page.query_selector(selector)
    screenshot = await captcha_element.screenshot()

    # 识别
    result = await solver.solve(screenshot)

    if result.success:
        # 填入验证码
        await page.fill('#captcha-input', result.result)
        # 提交
        await page.click('#submit-btn')
        return True

    return False
```

### 验证码类型支持

| 类型 | 说明 | 推荐识别器 |
|------|------|-----------|
| TEXT_IMAGE | 文本图片验证码 | DDDDOCR, Tesseract |
| SLIDER | 滑块验证码 | 人工打码 |
| CLICK | 点击验证码 | 2Captcha |
| RECAPTCHA_V2 | Google reCAPTCHA v2 | 2Captcha |
| RECAPTCHA_V3 | Google reCAPTCHA v3 | 2Captcha |
| HCAPTCHA | hCaptcha | 2Captcha |

---

## 🎭 浏览器指纹对抗 (Fingerprint)

### 功能特性

✅ Canvas指纹随机化
✅ WebGL指纹随机化
✅ 音频指纹随机化
✅ 完整的浏览器配置文件生成
✅ 支持多种浏览器和OS
✅ 自动生成User-Agent、字体、插件等

### 基本使用

```python
from aicrm.middleware.fingerprint import get_anti_detection_manager, generate_random_profile

# 生成随机浏览器配置
profile = generate_random_profile()

print(f"浏览器: {profile.browser_type.value}")
print(f"操作系统: {profile.os_type.value}")
print(f"User-Agent: {profile.user_agent}")
print(f"分辨率: {profile.screen_resolution}")
print(f"语言: {profile.language}")
print(f"时区: {profile.timezone}")

# 在Playwright中使用
from aicrm.middleware.fingerprint import get_anti_detection_manager

manager = get_anti_detection_manager()
profile = manager.generate_new_profile()

# 应用到Playwright页面
await manager.apply_to_playwright(page, profile)

# 获取反检测脚本
scripts = manager.get_stealth_scripts(profile)
for script in scripts:
    await page.add_init_script(script)
```

### 在Selenium中使用

```python
from aicrm.middleware.fingerprint import get_anti_detection_manager

manager = get_anti_detection_manager()
profile = manager.generate_new_profile()

# 应用到Selenium
await manager.apply_to_selenium(driver, profile)
```

### 自定义配置

```python
from aicrm.middleware.fingerprint import FingerprintGenerator, BrowserType, OSType

# 生成特定类型的配置
profile = FingerprintGenerator.generate_profile(
    browser_type=BrowserType.CHROME,
    os_type=OSType.MACOS
)

# 获取HTTP请求头
headers = manager.get_headers(profile)
# 使用这些headers发送HTTP请求
```

---

## 🖱️ 人类行为模拟 (Human Behavior)

### 功能特性

✅ 贝塞尔曲线鼠标移动
✅ 随机抖动和停顿
✅ 真实的滚动行为
✅ 模拟打字（包括错误和修正）
✅ 可配置的行为序列

### 基本使用

```python
from aicrm.middleware.human_behavior import get_behavior_simulator

simulator = get_behavior_simulator()

# 模拟鼠标移动
await simulator.simulate_mouse_move(page, '#submit-button')

# 模拟点击
await simulator.simulate_click(page, '#submit-button')

# 模拟滚动
await simulator.simulate_scroll(page, target_position=1000)

# 模拟打字
await simulator.simulate_type(
    page,
    selector='#input-box',
    text='Hello, World!',
    speed='normal',
    clear_first=True
)
```

### 行为序列

```python
# 执行一系列人类行为
actions = [
    ('move', {'selector': '#search-box'}),
    ('click', {'selector': '#search-box'}),
    ('type', {'selector': '#search-box', 'text': 'Python'}),
    ('wait', {'duration': 0.5}),
    ('click', {'selector': '#search-button'}),
    ('wait', {'duration': 2}),
    ('scroll', {'position': 500}),
]

await simulator.simulate_human_behavior_sequence(page, actions)
```

### 打字速度选项

```python
await simulator.simulate_type(
    page,
    '#input',
    text='快速打字',
    speed='fast'    # fast, normal, slow
)
```

---

## 🤖 AI数据分析 (AI Analytics)

### 功能特性

✅ 情感分析（支持OpenAI/Anthropic API）
✅ 实体提取（邮箱、电话、微信、人名、公司等）
✅ 客户细分（K-means聚类）
✅ 本地规则引擎（API降级）

### 情感分析

```python
from aicrm.analyzers.ai_analytics import get_analytics, analyze_sentiment

# 使用全局实例
result = await analyze_sentiment("这个产品非常好用！")

print(f"情感: {result['label']}")  # positive, negative, neutral
print(f"得分: {result['score']}")
print(f"概率分布: {result['probabilities']}")

# 或者创建自己的实例
analytics = get_analytics(
    openai_api_key='sk-...',
    anthropic_api_key='sk-ant-...'
)

sentiment = await analytics.analyze_sentiment("客户对服务很满意")
print(f"情感: {sentiment.label.value}")
print(f"置信度: {sentiment.score}")
```

### 实体提取

```python
from aicrm.analyzers.ai_analytics import extract_entities

text = "请联系张经理，电话13800138000，邮箱zhang@example.com"

entities = await extract_entities(text)

for entity in entities:
    print(f"{entity['label']}: {entity['text']} (置信度: {entity['confidence']})")

# 输出示例:
# PHONE: 13800138000 (置信度: 0.9)
# EMAIL: zhang@example.com (置信度: 0.9)
# PERSON: 张经理 (置信度: 0.6)
```

### 客户细分

```python
from aicrm.analyzers.ai_analytics import get_analytics

analytics = get_analytics()

customers = [
    {
        'name': 'Customer A',
        'sentiment_score': 0.8,
        'engagement_score': 0.9,
        'total_deals': 10,
        'total_amount': 50000,
    },
    # ... 更多客户
]

segments = await analytics.segment_customers(
    customers,
    n_clusters=5,
    features=['sentiment_score', 'engagement_score', 'total_amount']
)

for segment in segments:
    print(f"细分 #{segment.segment_id + 1}")
    print(f"  客户数: {segment.size}")
    print(f"  描述: {segment.description}")
    print(f"  特征: {segment.characteristics}")
```

### 综合文本分析

```python
analytics = get_analytics(openai_api_key='sk-...')

text = "我们公司对这次合作非常满意，期待未来的合作！联系人：李总，电话13912345678"

result = await analytics.analyze_text(text)

print("情感分析:")
print(f"  标签: {result['sentiment']['label']}")
print(f"  得分: {result['sentiment']['score']}")

print("\n实体:")
for entity in result['entities']:
    print(f"  {entity['label']}: {entity['text']}")
```

---

## 🔄 集成示例

### 完整的爬虫流程

```python
import asyncio
from aicrm.middleware.proxy_pool import init_proxy_pool
from aicrm.middleware.captcha_solver import CaptchaSolver
from aicrm.middleware.fingerprint import get_anti_detection_manager
from aicrm.middleware.human_behavior import get_behavior_simulator
from playwright.async_api import async_playwright

async def advanced_scraping():
    # 初始化各个模块
    proxy_pool = await init_proxy_pool(auto_fetch=True)
    captcha_solver = CaptchaSolver()
    fingerprint_manager = get_anti_detection_manager()
    behavior_simulator = get_behavior_simulator()

    # 生成浏览器配置
    profile = fingerprint_manager.generate_new_profile()

    async with async_playwright() as p:
        # 启动浏览器（使用代理）
        proxy_info = await proxy_pool.get_proxy()

        browser = await p.chromium.launch(
            proxy={"server": proxy_info.proxy_url} if proxy_info else None,
            headless=False
        )

        context = await browser.new_context(
            user_agent=profile.user_agent,
            viewport={"width": 1920, "height": 1080},
            locale=profile.language,
        )

        # 应用反检测措施
        page = await context.new_page()
        await fingerprint_manager.apply_to_playwright(page, profile)

        # 访问目标网站
        await page.goto("https://example.com")

        # 模拟人类行为
        await behavior_simulator.simulate_scroll(page, 500)
        await asyncio.sleep(2)

        # 处理验证码（如果有）
        if await page.query_selector("#captcha"):
            captcha_img = await page.locator("#captcha").screenshot()
            result = await captcha_solver.solve(captcha_img)

            if result.success:
                await behavior_simulator.simulate_type(
                    page,
                    "#captcha-input",
                    result.result
                )
                await behavior_simulator.simulate_click(page, "#submit-btn")

        # 提取数据
        data = await page.content()

        # 关闭浏览器
        await browser.close()

        # 标记代理成功
        if proxy_info:
            await proxy_pool.mark_success(proxy_info, 1.5)

    return data

# 运行
result = await advanced_scraping()
```

### Scrapy集成

```python
import scrapy
from aicrm.middleware.proxy_pool import get_proxy_pool
from aicrm.middleware.captcha_solver import CaptchaSolver

class AdvancedSpider(scrapy.Spider):
    name = 'advanced'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.proxy_pool = get_proxy_pool()
        self.captcha_solver = CaptchaSolver()

    async def start_requests(self):
        proxy_info = await self.proxy_pool.get_proxy()

        yield scrapy.Request(
            'https://example.com',
            meta={
                'proxy': proxy_info.proxy_url,
                'proxy_info': proxy_info,
            }
        )

    def parse(self, response):
        # 处理响应
        pass
```

---

## 📊 性能优化建议

### 代理池

1. **设置合理的代理数量**
   - `min_size`: 根据并发需求设置（建议为并发数的2-3倍）
   - `max_size`: 避免过多导致验证开销过大

2. **调整验证间隔**
   - 高频使用: 5-10分钟
   - 低频使用: 30-60分钟

3. **使用付费代理**
   - 免费代理不稳定，建议使用付费代理服务

### 验证码识别

1. **优先使用深度学习模型**
   - DDDDOCR准确率>90%
   - EasyCaptcha适合特定类型

2. **合理设置第三方API**
   - 仅在本地识别失败时使用
   - 注意API调用成本

3. **图像预处理**
   - 对于模糊验证码，启用预处理可以提高识别率

### 浏览器指纹

1. **保持一致性**
   - 在同一会话中使用相同的profile
   - 避免频繁切换指纹

2. **定期轮换**
   - 长时间运行时，定期生成新profile
   - 每天轮换一次较为合理

### 人类行为

1. **不要过度模拟**
   - 增加随机性，避免机械性
   - 合理设置停顿时间

2. **场景化行为**
   - 根据实际场景调整行为模式
   - 不同页面使用不同策略

---

## 🔧 故障排除

### 代理问题

**问题**: 代理经常失败
**解决方案**:
- 检查代理源质量
- 增加min_size
- 降低quality_threshold

### 验证码识别失败

**问题**: 识别率低
**解决方案**:
- 检查图像质量
- 尝试不同的识别器
- 使用第三方打码平台

### 被检测为机器人

**问题**: 网站仍然检测到机器人
**解决方案**:
- 检查所有反检测措施是否启用
- 使用更高质量代理
- 增加行为随机性
- 降低请求频率

---

## 📚 API参考

详细的API文档请参考各模块的docstring：

- `aicrm.middleware.proxy_pool.ProxyPool`
- `aicrm.middleware.captcha_solver.CaptchaSolver`
- `aicrm.middleware.fingerprint.AntiDetectionManager`
- `aicrm.middleware.human_behavior.HumanBehaviorSimulator`
- `aicrm.analyzers.ai_analytics.AIAnalytics`

---

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这些功能！

---

## 📄 许可证

MIT License
