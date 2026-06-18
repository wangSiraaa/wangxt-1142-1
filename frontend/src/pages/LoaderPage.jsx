import { useState, useEffect } from 'react';
import {
  Layout, Table, Button, Modal, Form, Select, InputNumber,
  Tag, Space, Card, message, Popconfirm, Row, Col, Statistic,
  Input, Alert, Divider, List
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  InboxOutlined, InfoCircleOutlined, FileSearchOutlined
} from '@ant-design/icons';
import { flightApi, mealTypeApi, mealBoxApi, loadingCheckApi, mealRequirementApi } from '../services/api';
import dayjs from 'dayjs';

const { Header, Sider, Content } = Layout;
const { Option } = Select;
const { TextArea } = Input;

const statusMap = {
  scheduled: { text: '待调度', color: 'default' },
  pending: { text: '待处理', color: 'orange' },
  checked: { text: '复核通过', color: 'green' },
  received: { text: '已接收', color: 'blue' },
  departed: { text: '已起飞', color: 'purple' },
  cancelled: { text: '已取消', color: 'red' },
};

const boxStatusMap = {
  prepared: { text: '已准备', color: 'default' },
  loaded: { text: '已装车', color: 'green' },
  delivered: { text: '已送达', color: 'blue' },
  cancelled: { text: '已取消', color: 'red' },
};

export default function LoaderPage({ user, onLogout }) {
  const [flights, setFlights] = useState([]);
  const [mealTypes, setMealTypes] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [checkModalVisible, setCheckModalVisible] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [latestCheck, setLatestCheck] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadFlights();
    loadMealTypes();
  }, []);

  useEffect(() => {
    if (selectedFlight) {
      loadBoxes(selectedFlight.id);
      loadRequirements(selectedFlight.id);
      loadLatestCheck(selectedFlight.id);
    }
  }, [selectedFlight]);

  const loadFlights = async () => {
    setLoading(true);
    try {
      const data = await flightApi.getList();
      setFlights(data.filter(f => f.status !== 'departed' && f.status !== 'received'));
      if (data.length > 0 && !selectedFlight) {
        const available = data.find(f => f.status !== 'departed' && f.status !== 'received');
        if (available) setSelectedFlight(available);
      }
    } catch (err) {
      message.error('加载航班列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadMealTypes = async () => {
    try {
      const data = await mealTypeApi.getList();
      setMealTypes(data);
    } catch (err) {
      message.error('加载餐食类型失败');
    }
  };

  const loadBoxes = async (flightId) => {
    try {
      const data = await mealBoxApi.getList({ flight_id: flightId });
      setBoxes(data);
    } catch (err) {
      message.error('加载餐箱列表失败');
    }
  };

  const loadRequirements = async (flightId) => {
    try {
      const data = await mealRequirementApi.getList({ flight_id: flightId });
      setRequirements(data);
    } catch (err) {
      message.error('加载餐食需求失败');
    }
  };

  const loadLatestCheck = async (flightId) => {
    try {
      const data = await loadingCheckApi.getLatest(flightId);
      setLatestCheck(data);
    } catch (err) {
      // ignore
    }
  };

  const handleAddBox = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditBox = (record) => {
    setEditingItem(record);
    form.setFieldsValue({
      meal_type_id: record.meal_type_id,
      quantity: record.quantity,
      is_allergy_marked: record.is_allergy_marked ? true : false,
    });
    setModalVisible(true);
  };

  const handleDeleteBox = async (id) => {
    try {
      await mealBoxApi.remove(id);
      message.success('删除成功');
      loadBoxes(selectedFlight.id);
      loadFlights();
    } catch (err) {
      message.error(err.message || '删除失败');
    }
  };

  const handleLoadBox = async (record) => {
    try {
      await mealBoxApi.load(record.id, {
        loader_id: String(user.id),
        loader_name: user.name,
      });
      message.success('装车成功');
      loadBoxes(selectedFlight.id);
    } catch (err) {
      message.error(err.message || '操作失败');
    }
  };

  const handleSubmitBox = async (values) => {
    try {
      if (editingItem) {
        await mealBoxApi.update(editingItem.id, values);
        message.success('修改成功');
      } else {
        await mealBoxApi.create({
          ...values,
          flight_id: selectedFlight.id,
          loader_id: String(user.id),
          loader_name: user.name,
        });
        message.success('添加成功');
      }
      setModalVisible(false);
      loadBoxes(selectedFlight.id);
      loadFlights();
    } catch (err) {
      message.error(err.message || '操作失败');
    }
  };

  const handleCheck = async () => {
    try {
      const result = await loadingCheckApi.check({
        flight_id: selectedFlight.id,
        checker_id: String(user.id),
        checker_name: user.name,
      });
      setCheckResult(result);
      setCheckModalVisible(true);
      loadFlights();
      loadLatestCheck(selectedFlight.id);
      if (result.is_passed) {
        message.success('复核通过，可以放行');
      } else {
        message.warning('复核未通过，请检查问题');
      }
    } catch (err) {
      message.error(err.message || '复核失败');
    }
  };

  const isDeparted = selectedFlight && new Date(selectedFlight.scheduled_departure_time) <= new Date();

  const totalBoxes = boxes.reduce((sum, b) => sum + b.quantity, 0);
  const allergyBoxes = boxes.filter(b => b.is_allergy).reduce((sum, b) => sum + b.quantity, 0);
  const loadedBoxes = boxes.filter(b => b.status === 'loaded');
  const totalRequirements = requirements.reduce((sum, r) => sum + r.quantity, 0);

  const boxColumns = [
    { title: '餐箱编号', dataIndex: 'box_no', key: 'box_no', width: 140 },
    {
      title: '餐食类型',
      dataIndex: 'meal_type_name',
      key: 'meal_type_name',
      render: (text, record) => (
        <Space>
          {text}
          {record.is_allergy && <Tag color="red">过敏</Tag>}
        </Space>
      ),
    },
    { title: '类型代码', dataIndex: 'meal_type_code', key: 'meal_type_code', width: 80 },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80 },
    {
      title: '过敏标记',
      dataIndex: 'is_allergy_marked',
      key: 'is_allergy_marked',
      width: 100,
      render: (val, record) => {
        if (record.is_allergy) {
          return val ? <Tag color="green">已标记</Tag> : <Tag color="red">未标记</Tag>;
        }
        return <Tag color="default">-</Tag>;
      }
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (status) => <Tag color={boxStatusMap[status]?.color || 'default'}>{boxStatusMap[status]?.text || status}</Tag>
    },
    { title: '装车员', dataIndex: 'loader_name', key: 'loader_name', width: 80 },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          {record.status === 'prepared' && (
            <Button type="link" size="small" onClick={() => handleLoadBox(record)} disabled={isDeparted}>
              装车
            </Button>
          )}
          {record.status === 'prepared' && (
            <Button type="link" size="small" onClick={() => handleEditBox(record)} disabled={isDeparted}>
              编辑
            </Button>
          )}
          {record.status === 'prepared' && (
            <Popconfirm title="确定删除？" onConfirm={() => handleDeleteBox(record.id)} disabled={isDeparted}>
              <Button type="link" size="small" danger disabled={isDeparted}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const reqSummary = {};
  requirements.forEach(r => {
    if (!reqSummary[r.meal_type_id]) {
      reqSummary[r.meal_type_id] = { name: r.meal_type_name, code: r.meal_type_code, req: 0, is_allergy: r.is_allergy };
    }
    reqSummary[r.meal_type_id].req += r.quantity;
  });

  const boxSummary = {};
  boxes.forEach(b => {
    if (!boxSummary[b.meal_type_id]) {
      boxSummary[b.meal_type_id] = { name: b.meal_type_name, code: b.meal_type_code, box: 0, is_allergy: b.is_allergy, marked: true };
    }
    boxSummary[b.meal_type_id].box += b.quantity;
    if (b.is_allergy && !b.is_allergy_marked) {
      boxSummary[b.meal_type_id].marked = false;
    }
  });

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <InfoCircleOutlined style={{ fontSize: 24, color: '#fa8c16' }} />
          <span style={{ fontSize: 18, fontWeight: 600 }}>航空配餐特殊餐装机复核系统</span>
          <Tag color="orange">装车员</Tag>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>欢迎，{user.name}</span>
          <Button onClick={onLogout}>退出</Button>
        </div>
      </Header>

      <Layout>
        <Sider width={280} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
            <Input.Search placeholder="搜索航班号..." allowClear />
          </div>
          <div style={{ padding: '8px 0' }}>
            <div style={{ padding: '8px 16px', color: '#666', fontSize: 12 }}>待装车航班</div>
            {flights.map(flight => (
              <div
                key={flight.id}
                onClick={() => setSelectedFlight(flight)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: selectedFlight?.id === flight.id ? '#fff7e6' : '#fff',
                  borderLeft: selectedFlight?.id === flight.id ? '3px solid #fa8c16' : '3px solid transparent',
                }}
              >
                <div style={{ fontWeight: 500, marginBottom: 4 }}>
                  {flight.flight_no}
                  <Tag style={{ marginLeft: 8 }} color={statusMap[flight.status]?.color}>
                    {statusMap[flight.status]?.text}
                  </Tag>
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  {flight.departure} → {flight.arrival}
                </div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                  {dayjs(flight.scheduled_departure_time).format('MM-DD HH:mm')}
                </div>
              </div>
            ))}
          </div>
        </Sider>

        <Content style={{ padding: 24, background: '#f5f5f5' }}>
          {selectedFlight ? (
            <>
              <Card style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={6}>
                    <Statistic title="航班号" value={selectedFlight.flight_no} prefix={<InfoCircleOutlined />} />
                  </Col>
                  <Col span={6}>
                    <Statistic title="航线" value={`${selectedFlight.departure} → ${selectedFlight.arrival}`} />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="计划起飞"
                      value={dayjs(selectedFlight.scheduled_departure_time).format('YYYY-MM-DD HH:mm')}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic title="旅客人数" value={selectedFlight.passenger_count} suffix="人" />
                  </Col>
                </Row>
              </Card>

              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="需求总数"
                      value={totalRequirements}
                      suffix="份"
                      valueStyle={{ color: '#1890ff' }}
                      prefix={<InboxOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="已装餐箱"
                      value={totalBoxes}
                      suffix="份"
                      valueStyle={{ color: '#52c41a' }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="过敏餐"
                      value={allergyBoxes}
                      suffix="份"
                      valueStyle={{ color: '#f5222d' }}
                      prefix={<ExclamationCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="复核状态"
                      value={latestCheck?.is_passed ? '已通过' : '未复核'}
                      valueStyle={{ color: latestCheck?.is_passed ? '#52c41a' : '#faad14' }}
                      prefix={<FileSearchOutlined />}
                    />
                  </Card>
                </Col>
              </Row>

              {isDeparted && (
                <Alert
                  message="航班已起飞"
                  description="航班已起飞，不能进行装车、修改等操作"
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}

              <Row gutter={16}>
                <Col span={12}>
                  <Card
                    title="餐食需求"
                    size="small"
                    style={{ marginBottom: 16 }}
                  >
                    <List
                      size="small"
                      dataSource={Object.values(reqSummary)}
                      renderItem={item => (
                        <List.Item>
                          <Space>
                            <span>{item.name}</span>
                            {item.is_allergy && <Tag color="red">过敏</Tag>}
                          </Space>
                          <span style={{ fontWeight: 500 }}>{item.req} 份</span>
                        </List.Item>
                      )}
                    />
                    {requirements.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                        暂无餐食需求
                      </div>
                    )}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card
                    title="装车汇总"
                    size="small"
                    style={{ marginBottom: 16 }}
                  >
                    <List
                      size="small"
                      dataSource={Object.values(boxSummary)}
                      renderItem={item => (
                        <List.Item>
                          <Space>
                            <span>{item.name}</span>
                            {item.is_allergy && (
                              item.marked ? <Tag color="green">已标记</Tag> : <Tag color="red">未标记</Tag>
                            )}
                          </Space>
                          <span style={{ fontWeight: 500 }}>{item.box} 份</span>
                        </List.Item>
                      )}
                    />
                    {boxes.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                        暂无餐箱
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>

              <Card
                title="餐箱管理"
                extra={
                  <Space>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleAddBox}
                      disabled={isDeparted}
                    >
                      添加餐箱
                    </Button>
                    <Button
                      type="primary"
                      icon={<FileSearchOutlined />}
                      onClick={handleCheck}
                      disabled={isDeparted || boxes.length === 0}
                    >
                      装车复核
                    </Button>
                  </Space>
                }
              >
                <Table
                  columns={boxColumns}
                  dataSource={boxes}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              </Card>
            </>
          ) : (
            <Card>
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
                <InfoCircleOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <p>请从左侧选择一个航班</p>
              </div>
            </Card>
          )}
        </Content>
      </Layout>

      <Modal
        title={editingItem ? '编辑餐箱' : '添加餐箱'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitBox}>
          <Form.Item
            label="餐食类型"
            name="meal_type_id"
            rules={[{ required: true, message: '请选择餐食类型' }]}
          >
            <Select placeholder="请选择餐食类型" showSearch optionFilterProp="children">
              {mealTypes.map(type => (
                <Option key={type.id} value={type.id}>
                  {type.name} ({type.code})
                  {type.is_allergy && ' [过敏]'}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="数量"
            name="quantity"
            rules={[{ required: true, message: '请输入数量' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入份数" />
          </Form.Item>
          <Form.Item
            name="is_allergy_marked"
            valuePropName="checked"
          >
            <Select
              placeholder="过敏餐是否单独标记"
              style={{ width: '100%' }}
            >
              <Option value={true}>已单独标记</Option>
              <Option value={false}>未单独标记</Option>
            </Select>
          </Form.Item>
          <Alert
            message="注意：过敏餐必须单独标记"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确定</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="装车复核结果"
        open={checkModalVisible}
        onCancel={() => setCheckModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setCheckModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {checkResult && (
          <div>
            <Alert
              message={checkResult.is_passed ? '复核通过，可以放行' : '复核未通过，请整改后再试'}
              type={checkResult.is_passed ? 'success' : 'error'}
              showIcon
              style={{ marginBottom: 16 }}
            />

            {checkResult.check_result?.issues?.length > 0 && (
              <>
                <Divider orientation="left">发现的问题</Divider>
                <List
                  size="small"
                  dataSource={checkResult.check_result.issues}
                  renderItem={issue => (
                    <List.Item style={{ alignItems: 'flex-start' }}>
                      <ExclamationCircleOutlined style={{ color: '#f5222d', marginTop: 3 }} />
                      <span style={{ flex: 1, marginLeft: 8 }}>{issue.message}</span>
                    </List.Item>
                  )}
                />
              </>
            )}

            <Divider orientation="left">复核明细</Divider>
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>需求汇总</div>
                <List
                  size="small"
                  dataSource={Object.values(checkResult.check_result?.summary?.requirements || {})}
                  renderItem={item => (
                    <List.Item>
                      <span>{item.name}</span>
                      <span>{item.quantity} 份</span>
                    </List.Item>
                  )}
                />
              </Col>
              <Col span={12}>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>餐箱汇总</div>
                <List
                  size="small"
                  dataSource={Object.values(checkResult.check_result?.summary?.boxes || {})}
                  renderItem={item => (
                    <List.Item>
                      <span>{item.name}</span>
                      <span>{item.quantity} 份</span>
                    </List.Item>
                  )}
                />
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
