import { useState } from 'react';
import { Card, Form, Select, Button, Typography, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { userApi } from '../services/api';

const { Title, Text } = Typography;

const roleMap = {
  dispatcher: { name: '配餐调度员', color: 'blue' },
  loader: { name: '装车员', color: 'orange' },
  purser: { name: '乘务长', color: 'green' },
};

export default function LoginPage({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [users, setUsers] = useState([]);

  const handleRoleChange = async (role) => {
    setSelectedRole(role);
    try {
      const data = await userApi.getList({ role });
      setUsers(data);
    } catch (err) {
      message.error('加载用户列表失败');
    }
  };

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      const user = await userApi.login(values.username);
      onLogin(user);
      message.success(`欢迎，${user.name}！`);
    } catch (err) {
      message.error(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: 24,
    }}>
      <Card style={{ width: 420, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#1890ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <UserOutlined style={{ fontSize: 32, color: '#fff' }} />
          </div>
          <Title level={3} style={{ marginBottom: 0 }}>航空配餐特殊餐</Title>
          <Text type="secondary">装机复核系统</Text>
        </div>

        <Form layout="vertical" onFinish={handleLogin}>
          <Form.Item
            label="选择角色"
            name="role"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select
              placeholder="请选择您的角色"
              onChange={handleRoleChange}
              size="large"
            >
              {Object.entries(roleMap).map(([key, val]) => (
                <Select.Option key={key} value={key}>
                  {val.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="选择用户"
            name="username"
            rules={[{ required: true, message: '请选择用户' }]}
          >
            <Select
              placeholder="请选择用户"
              size="large"
              disabled={!selectedRole}
              showSearch
              optionFilterProp="children"
            >
              {users.map((user) => (
                <Select.Option key={user.username} value={user.username}>
                  {user.name} ({user.username})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
