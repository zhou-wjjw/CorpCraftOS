import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag } from 'antd';
import {
  UserOutlined,
  DollarOutlined,
  CheckSquareOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import axios from 'axios';

interface DashboardStats {
  total_customers: number;
  total_deals: number;
  total_tasks: number;
  new_customers_last_30_days: number;
  total_deal_value: number;
  overdue_tasks: number;
  customers_by_status: Array<{ status: string; count: number }>;
  deals_by_stage: Array<{ stage: string; count: number; total_value: number }>;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/dashboard/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCustomerStatusOption = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      lead: { color: 'blue', text: '潜在客户' },
      prospect: { color: 'cyan', text: '意向客户' },
      active: { color: 'green', text: '活跃客户' },
      inactive: { color: 'default', text: '非活跃客户' },
      churned: { color: 'red', text: '流失客户' },
    };
    const statusInfo = statusMap[status] || { color: 'default', text: status };
    return { color: statusInfo.color, text: statusInfo.text };
  };

  const getDealStageOption = (stage: string) => {
    const stageMap: Record<string, { color: string; text: string }> = {
      prospecting: { color: 'blue', text: '开拓' },
      qualification: { color: 'cyan', text: '资格确认' },
      proposal: { color: 'purple', text: '方案' },
      negotiation: { color: 'orange', text: '谈判' },
      closed_won: { color: 'green', text: '已成交' },
      closed_lost: { color: 'red', text: '已丢失' },
    };
    const stageInfo = stageMap[stage] || { color: 'default', text: stage };
    return { color: stageInfo.color, text: stageInfo.text };
  };

  // 客户状态分布图配置
  const customerStatusChartOption = {
    title: {
      text: '客户状态分布',
      left: 'center',
    },
    tooltip: {
      trigger: 'item',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
    },
    series: [
      {
        name: '客户状态',
        type: 'pie',
        radius: '50%',
        data: stats?.customers_by_status.map((item) => ({
          value: item.count,
          name: getCustomerStatusOption(item.status).text,
        })) || [],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  };

  // 交易阶段分布图配置
  const dealStageChartOption = {
    title: {
      text: '交易阶段分布',
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
    },
    xAxis: {
      type: 'category',
      data: stats?.deals_by_stage.map((item) => getDealStageOption(item.stage).text) || [],
    },
    yAxis: {
      type: 'value',
      name: '数量',
    },
    series: [
      {
        name: '交易数量',
        type: 'bar',
        data: stats?.deals_by_stage.map((item) => item.count) || [],
        itemStyle: {
          color: '#1890ff',
        },
      },
    ],
  };

  const customerColumns = [
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const { color, text } = getCustomerStatusOption(status);
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      render: (count: number) => <Statistic value={count} valueStyle={{ fontSize: 16 }} />,
    },
  ];

  const dealColumns = [
    {
      title: '阶段',
      dataIndex: 'stage',
      key: 'stage',
      render: (stage: string) => {
        const { color, text } = getDealStageOption(stage);
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      render: (count: number) => <Statistic value={count} valueStyle={{ fontSize: 16 }} />,
    },
    {
      title: '总价值',
      dataIndex: 'total_value',
      key: 'total_value',
      render: (value: number) => (
        <Statistic
          value={value}
          precision={2}
          valueStyle={{ fontSize: 16 }}
          prefix="¥"
        />
      ),
    },
  ];

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>仪表板</h1>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总客户数"
              value={stats?.total_customers || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总交易数"
              value={stats?.total_deals || 0}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总任务数"
              value={stats?.total_tasks || 0}
              prefix={<CheckSquareOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="30天内新客户"
              value={stats?.new_customers_last_30_days || 0}
              prefix={<ArrowUpOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="总交易价值"
              value={stats?.total_deal_value || 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#1890ff', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="逾期任务"
              value={stats?.overdue_tasks || 0}
              valueStyle={{
                color: (stats?.overdue_tasks || 0) > 0 ? '#cf1322' : '#3f8600',
                fontSize: 24,
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="客户状态分布">
            <ReactECharts option={customerStatusChartOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="交易阶段分布">
            <ReactECharts option={dealStageChartOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      {/* 表格 */}
      <Row gutter={16}>
        <Col span={12}>
          <Card title="客户状态详情">
            <Table
              columns={customerColumns}
              dataSource={stats?.customers_by_status || []}
              rowKey="status"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="交易阶段详情">
            <Table
              columns={dealColumns}
              dataSource={stats?.deals_by_stage || []}
              rowKey="stage"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
