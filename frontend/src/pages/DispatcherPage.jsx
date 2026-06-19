import { useState, useEffect } from 'react';
import {
  Layout, Menu, Table, Button, Modal, Form, Select, InputNumber,
  Input, DatePicker, Tag, Space, Card, message, Popconfirm, Row, Col, Statistic,
  Divider, List, Alert
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined,
  SwapOutlined, UserAddOutlined
} from '@ant-design/icons';
import { flightApi, mealTypeApi, mealRequirementApi } from '../services/api';
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

export default function DispatcherPage({ user, onLogout }) {
  const [flights, setFlights] = useState([]);
  const [mealTypes, setMealTypes] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [flightModalVisible, setFlightModalVisible] = useState(false);
  const [editingFlight, setEditingFlight] = useState(null);
  const [waitlistModalVisible, setWaitlistModalVisible] = useState(false);
  const [recalcModalVisible, setRecalcModalVisible] = useState(false);
  const [recalcAdjustments, setRecalcAdjustments] = useState([]);
  const [form] = Form.useForm();
  const [flightForm] = Form.useForm();
  const [waitlistForm] = Form.useForm();

  useEffect(() => {
    loadFlights();
    loadMealTypes();
  }, []);

  useEffect(() => {
    if (selectedFlight) {
      loadRequirements(selectedFlight.id);
      loadWaitlist(selectedFlight.id);
    }
  }, [selectedFlight]);

  const loadFlights = async () => {
    setLoading(true);
    try {
      const data = await flightApi.getList();
      setFlights(data);
      if (data.length > 0 && !selectedFlight) {
        setSelectedFlight(data[0]);
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

  const loadRequirements = async (flightId) => {
    try {
      const data = await mealRequirementApi.getList({ flight_id: flightId });
      setRequirements(data);
    } catch (err) {
      message.error('加载餐食需求失败');
    }
  };

  const loadWaitlist = async (flightId) => {
    try {
      const data = await mealRequirementApi.getWaitlist(flightId);
      setWaitlist(data);
    } catch (err) {
      // ignore
    }
  };

  const handleAddReq = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditReq = (record) => {
    setEditingItem(record);
    form.setFieldsValue({
      meal_type_id: record.meal_type_id,
      quantity: record.quantity,
      remark: record.remark,
    });
    setModalVisible(true);
  };

  const handleDeleteReq = async (id) => {
    try {
      await mealRequirementApi.remove(id);
      message.success('删除成功');
      loadRequirements(selectedFlight.id);
      loadFlights();
    } catch (err) {
      message.error(err.message || '删除失败');
    }
  };

  const handleSubmitReq = async (values) => {
    try {
      if (editingItem) {
        await mealRequirementApi.update(editingItem.id, values);
        message.success('修改成功');
      } else {
        await mealRequirementApi.create({
          ...values,
          flight_id: selectedFlight.id,
          dispatcher_id: String(user.id),
          dispatcher_name: user.name,
        });
        message.success('添加成功');
      }
      setModalVisible(false);
      loadRequirements(selectedFlight.id);
      loadFlights();
    } catch (err) {
      message.error(err.message || '操作失败');
    }
  };

  const handleAddFlight = () => {
    setEditingFlight(null);
    flightForm.resetFields();
    setFlightModalVisible(true);
  };

  const handleEditFlight = (record) => {
    setEditingFlight(record);
    flightForm.setFieldsValue({
      flight_no: record.flight_no,
      departure: record.departure,
      arrival: record.arrival,
      scheduled_departure_time: dayjs(record.scheduled_departure_time),
      passenger_count: record.passenger_count,
    });
    setFlightModalVisible(true);
  };

  const handleSubmitFlight = async (values) => {
    try {
      const data = {
        ...values,
        scheduled_departure_time: values.scheduled_departure_time.toISOString(),
      };
      if (editingFlight) {
        await flightApi.update(editingFlight.id, data);
        message.success('修改成功');
      } else {
        await flightApi.create(data);
        message.success('添加成功');
      }
      setFlightModalVisible(false);
      loadFlights();
    } catch (err) {
      message.error(err.message || '操作失败');
    }
  };

  const handleDeleteFlight = async (id) => {
    try {
      await flightApi.remove(id);
      message.success('删除成功');
      if (selectedFlight?.id === id) {
        setSelectedFlight(null);
      }
      loadFlights();
    } catch (err) {
      message.error(err.message || '删除失败');
    }
  };

  const handleAddWaitlist = () => {
    waitlistForm.resetFields();
    setWaitlistModalVisible(true);
  };

  const handleSubmitWaitlist = async (values) => {
    try {
      await mealRequirementApi.addWaitlist({
        ...values,
        flight_id: selectedFlight.id,
        operator_id: String(user.id),
        operator_name: user.name,
      });
      message.success('候补旅客添加成功');
      setWaitlistModalVisible(false);
      loadWaitlist(selectedFlight.id);
    } catch (err) {
      message.error(err.message || '操作失败');
    }
  };

  const handleTransferWaitlist = async (id) => {
    try {
      await mealRequirementApi.transferWaitlist(id, {
        operator_id: String(user.id),
        operator_name: user.name,
      });
      message.success('候补旅客已转正，特殊餐数量已重新核算');
      loadWaitlist(selectedFlight.id);
      loadRequirements(selectedFlight.id);
      loadFlights();
    } catch (err) {
      message.error(err.message || '操作失败');
    }
  };

  const handleOpenRecalc = () => {
    const adjustments = requirements
      .filter(r => r.status !== 'cancelled')
      .map(r => ({
        requirement_id: r.id,
        meal_type_name: r.meal_type_name,
        meal_type_code: r.meal_type_code,
        current_quantity: r.quantity,
        previous_quantity: r.previous_quantity,
        new_quantity: r.quantity,
        remark: '',
      }));
    setRecalcAdjustments(adjustments);
    setRecalcModalVisible(true);
  };

  const handleRecalcChange = (index, field, value) => {
    const updated = [...recalcAdjustments];
    updated[index][field] = value;
    setRecalcAdjustments(updated);
  };

  const handleSubmitRecalc = async () => {
    const adjustments = recalcAdjustments
      .filter(a => a.new_quantity !== a.current_quantity)
      .map(a => ({
        requirement_id: a.requirement_id,
        new_quantity: a.new_quantity,
        remark: a.remark || `改签重算：${a.current_quantity}→${a.new_quantity}`,
      }));

    if (adjustments.length === 0) {
      message.info('没有数量变更');
      return;
    }

    try {
      await mealRequirementApi.recalculate(selectedFlight.id, {
        operator_id: String(user.id),
        operator_name: user.name,
        adjustments,
      });
      message.success('特殊餐数量重算完成，旧需求已保留');
      setRecalcModalVisible(false);
      loadRequirements(selectedFlight.id);
      loadFlights();
    } catch (err) {
      message.error(err.message || '重算失败');
    }
  };

  const totalRequirements = requirements.reduce((sum, r) => sum + r.quantity, 0);
  const allergyRequirements = requirements
    .filter(r => r.is_allergy)
    .reduce((sum, r) => sum + r.quantity, 0);
  const pendingWaitlist = waitlist.filter(w => w.status === 'waitlist');

  const reqColumns = [
    {
      title: '餐食类型',
      dataIndex: 'meal_type_name',
      key: 'meal_type_name',
      render: (text, record) => (
        <Space>
          {text}
          {record.is_allergy && <Tag color="red">过敏餐</Tag>}
        </Space>
      ),
    },
    { title: '类型代码', dataIndex: 'meal_type_code', key: 'meal_type_code', width: 100 },
    { title: '当前数量', dataIndex: 'quantity', key: 'quantity', width: 90 },
    {
      title: '变更前数量',
      dataIndex: 'previous_quantity',
      key: 'previous_quantity',
      width: 100,
      render: (val) => val != null ? <span style={{ color: '#999' }}>{val}</span> : '-',
    },
    {
      title: '候补增量',
      dataIndex: 'waitlist_quantity',
      key: 'waitlist_quantity',
      width: 90,
      render: (val) => val > 0 ? <Tag color="blue">+{val}</Tag> : '-',
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (status) => {
        const map = { pending: { text: '待处理', color: 'orange' }, confirmed: { text: '已确认', color: 'green' }, cancelled: { text: '已取消', color: 'red' } };
        return <Tag color={map[status]?.color || 'default'}>{map[status]?.text || status}</Tag>;
      }
    },
    { title: '调度员', dataIndex: 'dispatcher_name', key: 'dispatcher_name', width: 80 },
    { title: '备注', dataIndex: 'remark', key: 'remark' },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => {
        const isDeparted = new Date(selectedFlight?.scheduled_departure_time) <= new Date();
        return (
          <Space>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditReq(record)} disabled={isDeparted}>
              编辑
            </Button>
            <Popconfirm title="确定删除？" onConfirm={() => handleDeleteReq(record.id)} disabled={isDeparted}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={isDeparted}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const waitlistColumns = [
    { title: '旅客姓名', dataIndex: 'passenger_name', key: 'passenger_name', width: 100 },
    { title: '餐食类型', dataIndex: 'meal_type_name', key: 'meal_type_name' },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 70 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status) => {
        const map = { waitlist: { text: '候补中', color: 'orange' }, transferred: { text: '已转正', color: 'green' }, cancelled: { text: '已取消', color: 'red' } };
        return <Tag color={map[status]?.color || 'default'}>{map[status]?.text || status}</Tag>;
      }
    },
    { title: '备注', dataIndex: 'remark', key: 'remark' },
    {
      title: '操作',
      key: 'action',
      width: 90,
      render: (_, record) => record.status === 'waitlist' ? (
        <Popconfirm title="确认将此候补旅客转正？特殊餐数量将自动调整。" onConfirm={() => handleTransferWaitlist(record.id)}>
          <Button type="link" size="small" icon={<SwapOutlined />}>转正</Button>
        </Popconfirm>
      ) : null,
    },
  ];

  const flightColumns = [
    { title: '航班号', dataIndex: 'flight_no', key: 'flight_no', width: 100 },
    { title: '出发', dataIndex: 'departure', key: 'departure', width: 80 },
    { title: '到达', dataIndex: 'arrival', key: 'arrival', width: 80 },
    { title: '计划起飞', dataIndex: 'scheduled_departure_time', key: 'scheduled_departure_time', width: 160,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm')
    },
    { title: '旅客数', dataIndex: 'passenger_count', key: 'passenger_count', width: 80 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (status) => <Tag color={statusMap[status]?.color || 'default'}>{statusMap[status]?.text || status}</Tag>
    },
    { title: '需求数', dataIndex: 'req_count', key: 'req_count', width: 80 },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditFlight(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDeleteFlight(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const isDeparted = selectedFlight && new Date(selectedFlight.scheduled_departure_time) <= new Date();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <InfoCircleOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <span style={{ fontSize: 18, fontWeight: 600 }}>航空配餐特殊餐装机复核系统</span>
          <Tag color="blue">配餐调度</Tag>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>欢迎，{user.name}</span>
          <Button onClick={onLogout}>退出</Button>
        </div>
      </Header>

      <Layout>
        <Sider width={280} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ marginBottom: 8 }}>
              <Button type="primary" icon={<PlusOutlined />} block onClick={handleAddFlight}>
                新增航班
              </Button>
            </div>
            <Input.Search placeholder="搜索航班号..." allowClear />
          </div>
          <div style={{ padding: '8px 0' }}>
            <div style={{ padding: '8px 16px', color: '#666', fontSize: 12 }}>航班列表</div>
            {flights.map(flight => (
              <div
                key={flight.id}
                onClick={() => setSelectedFlight(flight)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: selectedFlight?.id === flight.id ? '#e6f7ff' : '#fff',
                  borderLeft: selectedFlight?.id === flight.id ? '3px solid #1890ff' : '3px solid transparent',
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
                    <Statistic title="计划起飞" value={dayjs(selectedFlight.scheduled_departure_time).format('YYYY-MM-DD HH:mm')} />
                  </Col>
                  <Col span={6}>
                    <Statistic title="旅客人数" value={selectedFlight.passenger_count} suffix="人" />
                  </Col>
                </Row>
              </Card>

              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <Card>
                    <Statistic title="特殊餐需求总数" value={totalRequirements} suffix="份" valueStyle={{ color: '#1890ff' }} prefix={<InfoCircleOutlined />} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic title="过敏餐数量" value={allergyRequirements} suffix="份" valueStyle={{ color: '#f5222d' }} prefix={<ExclamationCircleOutlined />} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic title="候补旅客" value={pendingWaitlist.length} suffix="人" valueStyle={{ color: '#fa8c16' }} prefix={<UserAddOutlined />} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic title="餐食种类" value={requirements.length} suffix="种" valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
                  </Card>
                </Col>
              </Row>

              <Card
                title="特殊餐食需求"
                extra={
                  <Space>
                    <Button icon={<PlusOutlined />} onClick={handleAddReq} disabled={isDeparted}>
                      添加需求
                    </Button>
                    <Button icon={<SwapOutlined />} onClick={handleOpenRecalc} disabled={isDeparted || requirements.length === 0}>
                      改签重算
                    </Button>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                <Table columns={reqColumns} dataSource={requirements} rowKey="id" pagination={false} />
                {isDeparted && (
                  <div style={{ marginTop: 12, padding: 12, background: '#fff7e6', borderRadius: 4 }}>
                    <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
                    航班已起飞，不能添加或修改餐食需求
                  </div>
                )}
              </Card>

              <Card
                title="候补旅客"
                extra={
                  <Button icon={<UserAddOutlined />} onClick={handleAddWaitlist} disabled={isDeparted}>
                    添加候补
                  </Button>
                }
              >
                {pendingWaitlist.length > 0 && (
                  <Alert
                    message={`当前有 ${pendingWaitlist.length} 名候补旅客等待转正`}
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                  />
                )}
                <Table columns={waitlistColumns} dataSource={waitlist} rowKey="id" pagination={false} size="small" />
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
        title={editingItem ? '编辑餐食需求' : '添加餐食需求'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitReq}>
          <Form.Item label="餐食类型" name="meal_type_id" rules={[{ required: true, message: '请选择餐食类型' }]}>
            <Select placeholder="请选择餐食类型" showSearch optionFilterProp="children">
              {mealTypes.map(type => (
                <Option key={type.id} value={type.id}>
                  {type.name} ({type.code}){type.is_allergy && ' [过敏]'}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="需求数量" name="quantity" rules={[{ required: true, message: '请输入数量' }]}>
            <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入份数" />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确定</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingFlight ? '编辑航班' : '新增航班'}
        open={flightModalVisible}
        onCancel={() => setFlightModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={flightForm} layout="vertical" onFinish={handleSubmitFlight}>
          <Form.Item label="航班号" name="flight_no" rules={[{ required: true, message: '请输入航班号' }]}>
            <Input placeholder="请输入航班号，如 CA1234" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="出发地" name="departure" rules={[{ required: true, message: '请输入出发地' }]}>
                <Input placeholder="如 北京" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="到达地" name="arrival" rules={[{ required: true, message: '请输入到达地' }]}>
                <Input placeholder="如 上海" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="计划起飞时间" name="scheduled_departure_time" rules={[{ required: true, message: '请选择起飞时间' }]}>
            <DatePicker showTime style={{ width: '100%' }} placeholder="请选择起飞时间" />
          </Form.Item>
          <Form.Item label="旅客人数" name="passenger_count" rules={[{ required: true, message: '请输入旅客人数' }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入旅客人数" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setFlightModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确定</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加候补旅客"
        open={waitlistModalVisible}
        onCancel={() => setWaitlistModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={waitlistForm} layout="vertical" onFinish={handleSubmitWaitlist}>
          <Form.Item label="旅客姓名" name="passenger_name" rules={[{ required: true, message: '请输入旅客姓名' }]}>
            <Input placeholder="请输入旅客姓名" />
          </Form.Item>
          <Form.Item label="所需餐食类型" name="meal_type_id" rules={[{ required: true, message: '请选择餐食类型' }]}>
            <Select placeholder="请选择餐食类型" showSearch optionFilterProp="children">
              {mealTypes.map(type => (
                <Option key={type.id} value={type.id}>
                  {type.name} ({type.code}){type.is_allergy && ' [过敏]'}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="数量" name="quantity" initialValue={1}>
            <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入份数" />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <TextArea rows={2} placeholder="候补原因等" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setWaitlistModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确定</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="改签重算特殊餐数量"
        open={recalcModalVisible}
        onCancel={() => setRecalcModalVisible(false)}
        onOk={handleSubmitRecalc}
        okText="确认重算"
        width={700}
      >
        <Alert
          message="旅客改签后需重新核算特殊餐数量，调整后的旧数量将被保留记录"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Table
          dataSource={recalcAdjustments}
          rowKey="requirement_id"
          pagination={false}
          size="small"
          columns={[
            { title: '餐食类型', dataIndex: 'meal_type_name', key: 'meal_type_name' },
            {
              title: '当前数量',
              dataIndex: 'current_quantity',
              key: 'current_quantity',
              width: 90,
            },
            {
              title: '变更前',
              dataIndex: 'previous_quantity',
              key: 'previous_quantity',
              width: 80,
              render: (val) => val != null ? <Tag>{val}</Tag> : '-',
            },
            {
              title: '新数量',
              key: 'new_quantity',
              width: 120,
              render: (_, record, index) => (
                <InputNumber
                  min={0}
                  value={record.new_quantity}
                  onChange={(val) => handleRecalcChange(index, 'new_quantity', val)}
                  style={{ width: '100%' }}
                />
              ),
            },
            {
              title: '调整原因',
              key: 'remark',
              width: 150,
              render: (_, record, index) => (
                <Input
                  value={record.remark}
                  onChange={(e) => handleRecalcChange(index, 'remark', e.target.value)}
                  placeholder="改签原因"
                />
              ),
            },
          ]}
        />
      </Modal>
    </Layout>
  );
}
