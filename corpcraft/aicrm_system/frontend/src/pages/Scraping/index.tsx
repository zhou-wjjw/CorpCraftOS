import React, { useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Space,
  Table,
  Tag,
  message,
  Progress,
  Divider,
  Alert,
} from 'antd';
import {
  CloudDownloadOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import axios from 'axios';

interface ScrapingResult {
  url: string;
  status: 'success' | 'failed' | 'pending';
  data?: string;
  error?: string;
}

const Scraping: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScrapingResult[]>([]);

  const handleSingleScrape = async (values: any) => {
    setLoading(true);
    try {
      const response = await axios.post('/api/scrape', {
        url: values.url,
        strategy: values.strategy,
        wait_for_selector: values.wait_for_selector || undefined,
      });

      message.success('爬取成功');
      setResults([
        {
          url: values.url,
          status: 'success',
          data: response.data.data,
        },
        ...results,
      ]);
    } catch (error: any) {
      message.error('爬取失败: ' + (error.response?.data?.detail || error.message));
      setResults([
        {
          url: values.url,
          status: 'failed',
          error: error.response?.data?.detail || error.message,
        },
        ...results,
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchScrape = async (values: any) => {
    const urls = values.urls.split('\n').filter((url: string) => url.trim());

    if (urls.length === 0) {
      message.warning('请输入至少一个URL');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/scrape/batch', {
        urls: urls,
        strategy: values.strategy,
        concurrency: values.concurrency || 5,
      });

      message.success(`已启动批量爬取，共 ${urls.length} 个URL`);
    } catch (error: any) {
      message.error('批量爬取失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (url: string) => (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusConfig: Record<string, { color: string; text: string }> = {
          success: { color: 'success', text: '成功' },
          failed: { color: 'error', text: '失败' },
          pending: { color: 'processing', text: '进行中' },
        };
        const config = statusConfig[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '数据',
      dataIndex: 'data',
      key: 'data',
      ellipsis: true,
      render: (data: string) => data?.substring(0, 100) || '-',
    },
    {
      title: '错误',
      dataIndex: 'error',
      key: 'error',
      ellipsis: true,
      render: (error: string) => error || '-',
    },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>数据爬取</h1>

      <Alert
        message="数据爬取功能"
        description="支持HTTP请求、Selenium和Playwright等多种爬取策略，自动反爬虫检测和验证码处理。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {/* 单URL爬取 */}
      <Card title="单个URL爬取" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleSingleScrape}>
          <Form.Item
            label="目标URL"
            name="url"
            rules={[{ required: true, message: '请输入URL' }]}
          >
            <Input placeholder="https://example.com" prefix={<CloudDownloadOutlined />} />
          </Form.Item>

          <Space size="large">
            <Form.Item label="爬取策略" name="strategy" initialValue="http">
              <Select style={{ width: 200 }}>
                <Select.Option value="http">HTTP请求</Select.Option>
                <Select.Option value="selenium">Selenium</Select.Option>
                <Select.Option value="playwright">Playwright</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item label="等待选择器 (可选)" name="wait_for_selector">
              <Input placeholder=".content, #main" style={{ width: 300 }} />
            </Form.Item>
          </Space>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<PlayCircleOutlined />}>
              开始爬取
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 批量爬取 */}
      <Card title="批量URL爬取" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleBatchScrape}>
          <Form.Item
            label="URL列表 (每行一个)"
            name="urls"
            rules={[{ required: true, message: '请输入URL列表' }]}
          >
            <Input.TextArea
              rows={6}
              placeholder="https://example1.com&#10;https://example2.com&#10;https://example3.com"
            />
          </Form.Item>

          <Space size="large">
            <Form.Item label="爬取策略" name="strategy" initialValue="http">
              <Select style={{ width: 200 }}>
                <Select.Option value="http">HTTP请求</Select.Option>
                <Select.Option value="selenium">Selenium</Select.Option>
                <Select.Option value="playwright">Playwright</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item label="并发数" name="concurrency" initialValue={5}>
              <Select style={{ width: 100 }}>
                <Select.Option value={3}>3</Select.Option>
                <Select.Option value={5}>5</Select.Option>
                <Select.Option value={10}>10</Select.Option>
                <Select.Option value={20}>20</Select.Option>
              </Select>
            </Form.Item>
          </Space>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<PlayCircleOutlined />}>
              开始批量爬取
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 爬取结果 */}
      {results.length > 0 && (
        <Card title="爬取结果">
          <Table columns={columns} dataSource={results} rowKey="url" />
        </Card>
      )}
    </div>
  );
};

export default Scraping;
