import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  DollarOutlined,
  CheckSquareOutlined,
  CloudDownloadOutlined,
  AnalysisOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

const { Header, Content, Sider } = Layout;

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表板',
      onClick: () => navigate('/dashboard'),
    },
    {
      key: '/customers',
      icon: <UserOutlined />,
      label: '客户管理',
      onClick: () => navigate('/customers'),
    },
    {
      key: '/deals',
      icon: <DollarOutlined />,
      label: '交易管理',
      onClick: () => navigate('/deals'),
    },
    {
      key: '/tasks',
      icon: <CheckSquareOutlined />,
      label: '任务管理',
      onClick: () => navigate('/tasks'),
    },
    {
      key: '/scraping',
      icon: <CloudDownloadOutlined />,
      label: '数据爬取',
      onClick: () => navigate('/scraping'),
    },
    {
      key: '/analytics',
      icon: <AnalysisOutlined />,
      label: '数据分析',
      onClick: () => navigate('/analytics'),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div
          style={{
            height: 32,
            margin: 16,
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: collapsed ? 12 : 16,
          }}
        >
          {collapsed ? 'AICRM' : 'AICRM System'}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          mode="inline"
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }}>
          <div
            style={{
              float: 'right',
              marginRight: 24,
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            欢迎使用 AICRM 系统
          </div>
        </Header>
        <Content style={{ margin: '16px' }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
