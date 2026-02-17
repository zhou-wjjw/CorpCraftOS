# AICRM System - 使用示例

## 目录
1. [快速开始](#快速开始)
2. [数据爬取示例](#数据爬取示例)
3. [验证码识别示例](#验证码识别示例)
4. [AI分析示例](#ai分析示例)
5. [CRM操作示例](#crm操作示例)
6. [完整工作流示例](#完整工作流示例)

---

## 快速开始

### 1. 启动系统

```bash
# 使用快速启动脚本
./start.sh

# 或使用Docker Compose
docker-compose up -d
```

### 2. 验证安装

```bash
# 检查健康状态
curl http://localhost:8000/health

# 查看API文档
open http://localhost:8000/docs
```

---

## 数据爬取示例

### Python API 调用

#### 1. 简单HTTP爬取

```python
import httpx
import asyncio

async def simple_scrape():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/scrape",
            json={
                "url": "https://example.com",
                "strategy": "http"
            }
        )
        result = response.json()
        print(f"爬取成功: {result['success']}")
        print(f"使用策略: {result['strategy_used']}")

asyncio.run(simple_scrape())
```

#### 2. 使用代理和延迟

```python
async def scrape_with_proxy():
    # 注意：需要在配置中设置代理池
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/scrape",
            json={
                "url": "https://example.com",
                "strategy": "http",
                "wait_for_selector": ".content"
            }
        )
        result = response.json()
        if result['success']:
            print(result['data'][:500])  # 打印前500字符
```

#### 3. 批量爬取

```python
async def batch_scrape():
    urls = [
        "https://example1.com",
        "https://example2.com",
        "https://example3.com"
    ]

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/scrape/batch",
            json={
                "urls": urls,
                "concurrency": 3
            }
        )
        result = response.json()
        print(f"完成爬取: {result['results']} 个URL")
```

#### 4. 使用 Playwright 爬取动态内容

```python
async def scrape_dynamic():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/scrape",
            json={
                "url": "https://dynamic-site.com",
                "strategy": "playwright",
                "wait_for_selector": ".loaded-content",
                "execute_js": "window.scrollTo(0, document.body.scrollHeight)"
            }
        )
        result = response.json()
        return result
```

---

## 验证码识别示例

### 1. 图片验证码识别

```python
import httpx
import base64

async def solve_image_captcha(image_path: str):
    # 读取图片并转换为base64
    with open(image_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode()

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/captcha/solve",
            json={
                "image_base64": image_data,
                "captcha_type": "text_image"
            }
        )
        result = response.json()

        if result['success']:
            print(f"验证码答案: {result['answer']}")
            print(f"使用方法: {result['solver_used']}")
            print(f"置信度: {result['confidence']}")
            print(f"耗时: {result['solve_time']}秒")
        else:
            print(f"识别失败: {result.get('error')}")

asyncio.run(solve_image_captcha("captcha.png"))
```

### 2. reCAPTCHA v2 解决

```python
async def solve_recaptcha(site_key: str, page_url: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/captcha/solve",
            json={
                "captcha_type": "recaptcha_v2",
                "site_key": site_key,
                "page_url": page_url
            }
        )
        result = response.json()

        if result['success']:
            print(f"reCAPTCHA Token: {result['answer']}")
        else:
            print(f"需要配置第三方打码服务: {result.get('error')}")
```

---

## AI分析示例

### 1. 情感分析

```python
async def analyze_sentiment():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/analyze/sentiment",
            json={
                "text": "客户对我们的产品非常满意，强烈推荐！"
            }
        )
        result = response.json()

        print(f"情感倾向: {result['data']['sentiment']}")
        print(f"情感分数: {result['data']['score']}")
        print(f"置信度: {result['data']['confidence']}")
        print(f"关键话题: {result['data']['key_topics']}")
```

### 2. 实体提取

```python
async def extract_entities():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/analyze/entities",
            json={
                "text": """
                您好，我是ABC公司的张经理。
                您可以联系我：电话13800138000，
                邮箱zhang@abc.com，微信abc123。
                我们公司位于北京市朝阳区，专注于AI解决方案。
                """
            }
        )
        result = response.json()

        print("提取的实体:")
        print(f"- 公司: {result['data'].get('companies', [])}")
        print(f"- 人员: {result['data'].get('people', [])}")
        print(f"- 邮箱: {result['data'].get('emails', [])}")
        print(f"- 电话: {result['data'].get('phones', [])}")
        print(f"- 微信: {result['data'].get('wechats', [])}")
        print(f"- 地点: {result['data'].get('locations', [])}")
```

---

## CRM操作示例

### 1. 创建客户

```python
async def create_customer():
    customer_data = {
        "name": "张三",
        "email": "zhangsan@example.com",
        "phone": "13800138000",
        "wechat": "zhangsan_wx",
        "company": "ABC科技有限公司",
        "company_size": "100-500",
        "industry": "人工智能",
        "title": "技术总监",
        "status": "lead",
        "source": "website",
        "tags": ["重要客户", "AI行业"],
        "priority": "high"
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/customers",
            json=customer_data
        )
        customer = response.json()

        print(f"客户ID: {customer['id']}")
        print(f"创建时间: {customer['created_at']}")
```

### 2. 创建交互记录

```python
async def create_interaction(customer_id: str):
    interaction_data = {
        "customer_id": customer_id,
        "interaction_type": "email",
        "direction": "outbound",
        "subject": "产品介绍和合作洽谈",
        "content": """
        尊敬的张总：

        您好！我是AICRM公司的销售代表，想向您介绍我们的AI驱动的CRM系统。

        我们的产品可以帮助您：
        1. 自动化数据采集和分析
        2. 智能客户细分和推荐
        3. 提高销售效率

        期待与您的合作！

        此致
        敬礼
        """
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/interactions",
            json=interaction_data
        )
        interaction = response.json()

        print(f"交互记录ID: {interaction['id']}")
```

### 3. 创建交易

```python
async def create_deal(customer_id: str):
    deal_data = {
        "customer_id": customer_id,
        "name": "ABC公司AICRM系统采购",
        "description": "为ABC公司提供完整的AICRM解决方案",
        "amount": 50000,
        "currency": "CNY",
        "stage": "proposal",
        "probability": 60,
        "expected_close_date": "2024-03-31",
        "tags": ["重点项目"]
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/deals",
            json=deal_data
        )
        deal = response.json()

        print(f"交易ID: {deal['id']}")
        print(f"交易阶段: {deal['stage']}")
```

### 4. 创建任务

```python
async def create_task(customer_id: str):
    task_data = {
        "customer_id": customer_id,
        "title": "跟进ABC公司的合作意向",
        "description": "需要跟进张总对我们产品的反馈",
        "task_type": "follow_up",
        "status": "pending",
        "priority": "high",
        "due_date": "2024-02-20",
        "assigned_to": "sales_rep_1"
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/tasks",
            json=task_data
        )
        task = response.json()

        print(f"任务ID: {task['id']}")
        print(f"截止日期: {task['due_date']}")
```

### 5. 分析客户

```python
async def analyze_customer(customer_id: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"http://localhost:8000/api/customers/{customer_id}/analyze"
        )
        analysis = response.json()

        print(f"客户情感分数: {analysis['sentiment_score']}")
        print(f"客户参与度: {analysis['engagement_score']}")
        print(f"分析交互数: {analysis['total_interactions_analyzed']}")
        print(f"最近交互数: {analysis['recent_interactions']}")
```

### 6. 获取仪表板统计

```python
async def get_dashboard_stats():
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "http://localhost:8000/api/dashboard/stats"
        )
        stats = response.json()

        print("=== AICRM 系统统计 ===")
        print(f"总客户数: {stats['total_customers']}")
        print(f"总交易数: {stats['total_deals']}")
        print(f"总任务数: {stats['total_tasks']}")
        print(f"近30天新客户: {stats['new_customers_last_30_days']}")
        print(f"总交易价值: ¥{stats['total_deal_value']:,.2f}")
        print(f"逾期任务: {stats['overdue_tasks']}")

        print("\n按状态统计客户:")
        for item in stats['customers_by_status']:
            print(f"  - {item['status']}: {item['count']}")

        print("\n按阶段统计交易:")
        for item in stats['deals_by_stage']:
            print(f"  - {item['stage']}: {item['count']} 个, 价值 ¥{item['total_value']:,.2f}")
```

---

## 完整工作流示例

### 场景：从网站爬取客户信息并导入CRM

```python
import asyncio
import httpx
from typing import List, Dict

class AICRMWorkflow:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.client = None

    async def __aenter__(self):
        self.client = httpx.AsyncClient()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()

    async def scrape_website(self, url: str) -> Dict:
        """1. 爬取网站数据"""
        print(f"🕷️  正在爬取: {url}")
        response = await self.client.post(
            f"{self.base_url}/api/scrape",
            json={"url": url, "strategy": "http"}
        )
        return response.json()

    async def extract_contact_info(self, html_content: str) -> Dict:
        """2. 提取联系信息"""
        print("🔍 提取联系信息...")
        response = await self.client.post(
            f"{self.base_url}/api/analyze/entities",
            json={"text": html_content[:5000]}  # 限制长度
        )
        entities = response.json()['data']

        return {
            "emails": entities.get('emails', []),
            "phones": entities.get('phones', []),
            "wechats": entities.get('wechats', []),
            "companies": entities.get('companies', [])
        }

    async def analyze_sentiment(self, text: str) -> Dict:
        """3. 分析情感倾向"""
        print("💭 分析情感倾向...")
        response = await self.client.post(
            f"{self.base_url}/api/analyze/sentiment",
            json={"text": text}
        )
        return response.json()['data']

    async def create_customer(self, contact_info: Dict, sentiment: Dict) -> str:
        """4. 创建客户记录"""
        print("👤 创建客户记录...")

        # 构造客户数据
        customer_data = {
            "name": "潜在客户",  # 可以从页面中提取
            "email": contact_info['emails'][0] if contact_info['emails'] else None,
            "phone": contact_info['phones'][0] if contact_info['phones'] else None,
            "wechat": contact_info['wechats'][0] if contact_info['wechats'] else None,
            "company": contact_info['companies'][0] if contact_info['companies'] else None,
            "status": "lead",
            "source": "web_scraping",
            "sentiment_score": sentiment.get('score', 0),
            "priority": "medium" if sentiment.get('sentiment') == 'neutral' else "high"
        }

        response = await self.client.post(
            f"{self.base_url}/api/customers",
            json=customer_data
        )
        customer = response.json()
        print(f"✅ 客户创建成功: {customer['id']}")
        return customer['id']

    async def create_follow_up_task(self, customer_id: str):
        """5. 创建跟进任务"""
        print("📋 创建跟进任务...")

        task_data = {
            "customer_id": customer_id,
            "title": "联系新获取的潜在客户",
            "description": "通过爬虫获取的客户信息，需要进行初步联系",
            "task_type": "follow_up",
            "status": "pending",
            "priority": "medium",
            "due_date": "2024-02-20"
        }

        await self.client.post(
            f"{self.base_url}/api/tasks",
            json=task_data
        )
        print("✅ 跟进任务创建成功")

    async def run_complete_workflow(self, url: str):
        """执行完整工作流"""
        try:
            # 1. 爬取网站
            scrape_result = await self.scrape_website(url)

            if not scrape_result['success']:
                print(f"❌ 爬取失败: {scrape_result.get('error')}")
                return

            html = scrape_result['data']

            # 2. 提取联系信息
            contact_info = await self.extract_contact_info(html)

            if not any([contact_info['emails'], contact_info['phones']]):
                print("⚠️  未找到有效联系信息")
                return

            print(f"找到: {len(contact_info['emails'])} 个邮箱, {len(contact_info['phones'])} 个电话")

            # 3. 分析情感
            sentiment = await self.analyze_sentiment(html[:1000])

            # 4. 创建客户
            customer_id = await self.create_customer(contact_info, sentiment)

            # 5. 创建任务
            await self.create_follow_up_task(customer_id)

            print("\n🎉 工作流完成！")
            print(f"客户ID: {customer_id}")
            print(f"情感倾向: {sentiment.get('sentiment')}")

        except Exception as e:
            print(f"❌ 工作流出错: {str(e)}")


# 使用示例
async def main():
    urls_to_scrape = [
        "https://example-company1.com/contact",
        "https://example-company2.com/about",
        "https://example-company3.com"
    ]

    async with AICRMWorkflow() as workflow:
        for url in urls_to_scrape:
            print(f"\n{'='*60}")
            await workflow.run_complete_workflow(url)
            await asyncio.sleep(2)  # 避免请求过快

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 高级示例

### 1. 客户细分分析

```python
import pandas as pd

async def segment_customers():
    # 准备客户数据
    customers_df = pd.DataFrame({
        'age': [25, 35, 45, 28, 52],
        'income': [50000, 80000, 120000, 60000, 150000],
        'engagement_score': [80, 60, 90, 45, 85]
    })

    # 使用客户细分（需要直接调用Python API）
    from app.services.analytics import DataAnalyzer

    analyzer = DataAnalyzer()
    result = await analyzer.segment_customers(
        customers_df,
        features=['age', 'income', 'engagement_score'],
        n_clusters=3
    )

    if result.success:
        print("客户细分结果:")
        for cluster_id, cluster_data in result.data['clusters'].items():
            print(f"\n{cluster_id}:")
            print(f"  客户数: {cluster_data['size']}")
            print(f"  占比: {cluster_data['percentage']:.1f}%")
```

### 2. 批量导入客户

```python
async def import_customers_from_csv(csv_file: str):
    # 读取CSV文件
    df = pd.read_csv(csv_file)

    async with httpx.AsyncClient() as client:
        for _, row in df.iterrows():
            customer_data = {
                "name": row['name'],
                "email": row['email'],
                "phone": row.get('phone', ''),
                "company": row.get('company', ''),
                "status": "lead"
            }

            response = await client.post(
                "http://localhost:8000/api/customers",
                json=customer_data
            )

            if response.status_code == 201:
                print(f"✅ 导入: {row['name']}")
            else:
                print(f"❌ 失败: {row['name']}")
```

---

## 调试和监控

### 查看日志

```bash
# 查看所有日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 查看最近100行
docker-compose logs --tail=100 backend
```

### 监控指标

```bash
# 访问Grafana仪表板
open http://localhost:3001

# 查看Prometheus指标
curl http://localhost:9090/metrics
```

---

## 故障排除

### 常见问题

1. **数据库连接失败**
```bash
# 检查PostgreSQL状态
docker-compose ps postgres
# 查看PostgreSQL日志
docker-compose logs postgres
```

2. **爬虫被封禁**
- 检查代理配置
- 降低请求频率
- 更换User-Agent

3. **验证码识别失败**
- 确认图像格式正确
- 配置第三方打码服务
- 检查Tesseract安装

---

## 更多示例代码

查看 `examples/` 目录获取更多完整示例：
- `basic_scraping.py` - 基础爬虫示例
- `crm_integration.py` - CRM集成示例
- `data_analysis.py` - 数据分析示例
- `batch_processing.py` - 批处理示例

---

需要帮助？查看完整文档：[README.md](README.md)
