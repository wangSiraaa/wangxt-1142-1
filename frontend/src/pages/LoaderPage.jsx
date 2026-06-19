import { useState, useEffect } from 'react';
import {
  Layout, Table, Button, Modal, Form, Select, InputNumber,
  Tag, Space, Card, message, Popconfirm, Row, Col, Statistic,
  Input, Alert, Divider, List
} from 'antd';
import {
  PlusOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  InboxOutlined, InfoCircleOutlined, FileSearchOutlined,
  WarningOutlined, SwapOutlined, SafetyOutlined
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
  anomaly: { text: '异常', color: 'red' },
  cancelled: { text: '已取消', color: 'default' },
};

const anomalyTypeMap = {
  temp_control: { text: '温控异常', color: 'red' },
  label: { text: '标签异常', color: 'orange' },
  seal: { text: '封装异常', color: 'volcano' },
  other: { text: '其他异常', color: 'default' },
};

export default function LoaderPage({ user, onLogout }) {
  const [flights, setFlights] = useState([]);
  const [mealTypes, setMealTypes] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [replacements, setReplacements] = useState([]);
  const [isolations, setIsolations] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [checkModalVisible, setCheckModalVisible] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [latestCheck, setLatestCheck] = useState(null);
  const [anomalyModalVisible, setAnomalyModalVisible] = useState(false);
  const [anomalyBox, setAnomalyBox] = useState(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedReplacement, setSelectedReplacement] = useState(null);
  const [isolationModalVisible, setIsolationModalVisible] = useState(false);
  const [isolationBox, setIsolationBox] = useState(null);
  const [form] = Form.useForm();
  const [anomalyForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [isolationForm] = Form.useForm();

  useEffect(() => {
    loadFlights();
    loadMealTypes();
  }, []);

  useEffect(() => {
    if (selectedFlight) {
      loadBoxes(selectedFlight.id);
      loadRequirements(selectedFlight.id);
      loadLatestCheck(selectedFlight.id);
      loadReplacements(selectedFlight.id);
      loadIsolations(selectedFlight.id);
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

  const loadReplacements = async (flightId) => {
    try {
      const data = await mealBoxApi.getReplacements(flightId);
      setReplacements(data);
    } catch (err) {
      // ignore
    }
  };

  const loadIsolations = async (flightId) => {
    try {
      const data = await mealBoxApi.getAllergyIsolations(flightId);
      setIsolations(data);
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
    if (record.replace_status === 'pending') {
      message.warning('该餐箱正在换箱复核中，不能直接装车放行');
      return;
    }
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

  const handleReportAnomaly = (record) => {
    setAnomalyBox(record);
    anomalyForm.resetFields();
    setAnomalyModalVisible(true);
  };

  const handleSubmitAnomaly = async (values) => {
    try {
      await mealBoxApi.reportAnomaly(anomalyBox.id, {
        ...values,
        operator_id: String(user.id),
        operator_name: user.name,
      });
      message.success('已报告异常，餐箱已转为换箱复核，不能直接放行');
      setAnomalyModalVisible(false);
      loadBoxes(selectedFlight.id);
      loadReplacements(selectedFlight.id);
    } catch (err) {
      message.error(err.message || '操作失败');
    }
  };

  const handleReviewReplacement = (replacement) => {
    setSelectedReplacement(replacement);
    reviewForm.resetFields();
    setReviewModalVisible(true);
  };

  const handleSubmitReview = async (values) => {
    try {
      await mealBoxApi.reviewReplacement(selectedReplacement.id, {
        ...values,
        reviewer_id: String(user.id),
        reviewer_name: user.name,
      });
      if (values.review_status === 'approved') {
        message.success('换箱复核通过，新餐箱已替换旧餐箱');
      } else {
        message.info('换箱复核已驳回');
      }
      setReviewModalVisible(false);
      loadBoxes(selectedFlight.id);
      loadReplacements(selectedFlight.id);
      loadIsolations(selectedFlight.id);
    } catch (err) {
      message.error(err.message || '操作失败');
    }
  };

  const handleIsolation = (record) => {
    setIsolationBox(record);
    isolationForm.resetFields();
    setIsolationModalVisible(true);
  };

  const handleSubmitIsolation = async (values) => {
    try {
      await mealBoxApi.addAllergyIsolation({
        ...values,
        flight_id: selectedFlight.id,
        box_id: isolationBox.id,
        meal_type_id: isolationBox.meal_type_id,
        operator_id: String(user.id),
        operator_name: user.name,
      });
      message.success('过敏餐隔离记录已创建');
      setIsolationModalVisible(false);
      loadBoxes(selectedFlight.id);
      loadIsolations(selectedFlight.id);
    } catch (err) {
      message.error(err.message || '操作失败');
    }
  };

  const isDeparted = selectedFlight && new Date(selectedFlight.scheduled_departure_time) <= new Date();

  const totalBoxes = boxes.reduce((sum, b) => sum + b.quantity, 0);
  const allergyBoxes = boxes.filter(b => b.is_allergy).reduce((sum, b) => sum + b.quantity, 0);
  const anomalyBoxes = boxes.filter(b => b.status === 'anomaly' || b.replace_status === 'pending');
  const totalRequirements = requirements.reduce((sum, r) => sum + r.quantity, 0);
  const pendingReplacements = replacements.filter(r => r.review_status === 'pending');

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
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status, record) => {
        if (record.replace_status === 'pending') {
          return <Tag color="red">换箱复核中</Tag>;
        }
        if (record.replace_status === 'approved') {
          return <Tag color="green">换箱通过</Tag>;
        }
        return <Tag color={boxStatusMap[status]?.color || 'default'}>{boxStatusMap[status]?.text || status}</Tag>;
      }
    },
    { title: '装车员', dataIndex: 'loader_name', key: 'loader_name', width: 80 },
    {
      title: '操作',
      key: 'action',
      width: 260,
      render: (_, record) => (
        <Space size="small" wrap>
          {record.status === 'prepared' && record.replace_status !== 'pending' && (
            <Button type="link" size="small" onClick={() => handleLoadBox(record)} disabled={isDeparted}>
              装车
            </Button>
          )}
          {record.status === 'prepared' && record.replace_status !== 'pending' && (
            <Button type="link" size="small" onClick={() => handleEditBox(record)} disabled={isDeparted}>
              编辑
            </Button>
          )}
          {record.status === 'prepared' && record.replace_status !== 'pending' && (
            <Popconfirm title="确定删除？" onConfirm={() => handleDeleteBox(record.id)} disabled={isDeparted}>
              <Button type="link" size="small" danger disabled={isDeparted}>
                删除
              </Button>
            </Popconfirm>
          )}
          {record.status !== 'anomaly' && record.replace_status !== 'pending' && record.replace_status !== 'approved' && (
            <Button
              type="link"
              size="small"
              danger
              icon={<WarningOutlined />}
              onClick={() => handleReportAnomaly(record)}
              disabled={isDeparted}
            >
              异常
            </Button>
          )}
          {record.is_allergy && !record.is_allergy_marked && (
            <Button
              type="link"
              size="small"
              icon={<SafetyOutlined />}
              onClick={() => handleIsolation(record)}
              disabled={isDeparted}
            >
              隔离
            </Button>
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
                    <Statistic title="需求总数" value={totalRequirements} suffix="份" valueStyle={{ color: '#1890ff' }} prefix={<InboxOutlined />} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic title="已装餐箱" value={totalBoxes} suffix="份" valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic title="异常餐箱" value={anomalyBoxes.length} suffix="个" valueStyle={{ color: anomalyBoxes.length > 0 ? '#f5222d' : '#52c41a' }} prefix={<WarningOutlined />} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic title="过敏餐" value={allergyBoxes} suffix="份" valueStyle={{ color: '#f5222d' }} prefix={<ExclamationCircleOutlined />} />
                  </Card>
                </Col>
              </Row>

              {isDeparted && (
                <Alert message="航班已起飞" description="航班已起飞，不能进行装车、修改等操作" type="warning" showIcon style={{ marginBottom: 16 }} />
              )}

              {anomalyBoxes.length > 0 && (
                <Alert
                  message={`有 ${anomalyBoxes.length} 个餐箱存在异常`}
                  description="异常餐箱不能直接放行，需转为换箱复核处理"
                  type="error"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}

              <Row gutter={16}>
                <Col span={12}>
                  <Card title="餐食需求" size="small" style={{ marginBottom: 16 }}>
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
                      <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>暂无餐食需求</div>
                    )}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="装车汇总" size="small" style={{ marginBottom: 16 }}>
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
                      <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>暂无餐箱</div>
                    )}
                  </Card>
                </Col>
              </Row>

              {pendingReplacements.length > 0 && (
                <Card title="待复核换箱" size="small" style={{ marginBottom: 16 }}>
                  <Table
                    dataSource={pendingReplacements}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    columns={[
                      { title: '原餐箱', dataIndex: 'old_box_no', key: 'old_box_no', width: 130 },
                      { title: '新餐箱', dataIndex: 'new_box_no', key: 'new_box_no', width: 130 },
                      { title: '餐食类型', dataIndex: 'meal_type_name', key: 'meal_type_name' },
                      { title: '异常类型', dataIndex: 'anomaly_type', key: 'anomaly_type', width: 100,
                        render: (type) => <Tag color={anomalyTypeMap[type]?.color || 'default'}>{anomalyTypeMap[type]?.text || type}</Tag>
                      },
                      { title: '原因', dataIndex: 'reason', key: 'reason' },
                      {
                        title: '操作',
                        key: 'action',
                        width: 100,
                        render: (_, record) => (
                          <Button type="link" size="small" icon={<SwapOutlined />} onClick={() => handleReviewReplacement(record)}>
                            复核
                          </Button>
                        ),
                      },
                    ]}
                  />
                </Card>
              )}

              {isolations.length > 0 && (
                <Card title="过敏餐隔离记录" size="small" style={{ marginBottom: 16 }}>
                  <List
                    size="small"
                    dataSource={isolations}
                    renderItem={item => (
                      <List.Item>
                        <Space>
                          <Tag color="red">过敏</Tag>
                          <span>{item.box_no}</span>
                          <span>{item.meal_type_name}</span>
                          {item.isolation_method && <Tag>{item.isolation_method}</Tag>}
                        </Space>
                        <Space>
                          <span style={{ color: '#999', fontSize: 12 }}>{item.operator_name}</span>
                        </Space>
                      </List.Item>
                    )}
                  />
                </Card>
              )}

              <Card
                title="餐箱管理"
                extra={
                  <Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddBox} disabled={isDeparted}>
                      添加餐箱
                    </Button>
                    <Button type="primary" icon={<FileSearchOutlined />} onClick={handleCheck} disabled={isDeparted || boxes.length === 0}>
                      装车复核
                    </Button>
                  </Space>
                }
              >
                <Table columns={boxColumns} dataSource={boxes} rowKey="id" pagination={false} size="small" />
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
          <Form.Item label="餐食类型" name="meal_type_id" rules={[{ required: true, message: '请选择餐食类型' }]}>
            <Select placeholder="请选择餐食类型" showSearch optionFilterProp="children">
              {mealTypes.map(type => (
                <Option key={type.id} value={type.id}>
                  {type.name} ({type.code}){type.is_allergy && ' [过敏]'}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="数量" name="quantity" rules={[{ required: true, message: '请输入数量' }]}>
            <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入份数" />
          </Form.Item>
          <Form.Item name="is_allergy_marked">
            <Select placeholder="过敏餐是否单独标记" style={{ width: '100%' }}>
              <Option value={true}>已单独标记</Option>
              <Option value={false}>未单独标记</Option>
            </Select>
          </Form.Item>
          <Alert message="注意：过敏餐必须单独标记" type="warning" showIcon style={{ marginBottom: 16 }} />
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确定</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="报告餐箱异常"
        open={anomalyModalVisible}
        onCancel={() => setAnomalyModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Alert
          message="异常餐箱不能直接放行，将自动转为换箱复核流程"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        {anomalyBox && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            <div>餐箱编号：{anomalyBox.box_no}</div>
            <div>餐食类型：{anomalyBox.meal_type_name} {anomalyBox.is_allergy && <Tag color="red">过敏</Tag>}</div>
            <div>数量：{anomalyBox.quantity} 份</div>
          </div>
        )}
        <Form form={anomalyForm} layout="vertical" onFinish={handleSubmitAnomaly}>
          <Form.Item label="异常类型" name="anomaly_type" rules={[{ required: true, message: '请选择异常类型' }]}>
            <Select placeholder="请选择异常类型">
              <Option value="temp_control">温控异常</Option>
              <Option value="label">标签异常</Option>
              <Option value="seal">封装异常</Option>
              <Option value="other">其他异常</Option>
            </Select>
          </Form.Item>
          <Form.Item label="异常原因" name="reason" rules={[{ required: true, message: '请输入异常原因' }]}>
            <TextArea rows={3} placeholder="请详细描述异常情况" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAnomalyModalVisible(false)}>取消</Button>
              <Button type="primary" danger htmlType="submit">提交异常报告</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="换箱复核"
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        {selectedReplacement && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            <Row gutter={8}>
              <Col span={12}><div>原餐箱：<strong>{selectedReplacement.old_box_no}</strong></div></Col>
              <Col span={12}><div>新餐箱：<strong>{selectedReplacement.new_box_no}</strong></div></Col>
            </Row>
            <div style={{ marginTop: 8 }}>餐食类型：{selectedReplacement.meal_type_name}</div>
            <div>数量：{selectedReplacement.quantity} 份</div>
            <div>异常类型：<Tag color={anomalyTypeMap[selectedReplacement.anomaly_type]?.color}>{anomalyTypeMap[selectedReplacement.anomaly_type]?.text}</Tag></div>
            <div>异常原因：{selectedReplacement.reason}</div>
            <div>报告人：{selectedReplacement.operator_name}</div>
          </div>
        )}
        <Form form={reviewForm} layout="vertical" onFinish={handleSubmitReview}>
          <Form.Item name="review_status" rules={[{ required: true, message: '请选择审核结果' }]}>
            <Select placeholder="请选择审核结果">
              <Option value="approved">通过 - 使用新餐箱替换</Option>
              <Option value="rejected">驳回 - 保留原餐箱</Option>
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setReviewModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交复核</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="过敏餐隔离记录"
        open={isolationModalVisible}
        onCancel={() => setIsolationModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Alert
          message="过敏餐必须进行隔离处理并记录隔离方式"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        {isolationBox && (
          <div style={{ marginBottom: 16, padding: 12, background: '#fff1f0', borderRadius: 4 }}>
            <div>餐箱编号：{isolationBox.box_no}</div>
            <div>餐食类型：{isolationBox.meal_type_name} <Tag color="red">过敏</Tag></div>
          </div>
        )}
        <Form form={isolationForm} layout="vertical" onFinish={handleSubmitIsolation}>
          <Form.Item label="隔离方式" name="isolation_method" rules={[{ required: true, message: '请选择隔离方式' }]}>
            <Select placeholder="请选择隔离方式">
              <Option value="独立封装">独立封装</Option>
              <Option value="专用隔离区">专用隔离区</Option>
              <Option value="标识隔离">标识隔离</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <TextArea rows={2} placeholder="隔离处理备注" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsolationModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确认隔离</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="装车复核结果"
        open={checkModalVisible}
        onCancel={() => setCheckModalVisible(false)}
        footer={[<Button key="close" onClick={() => setCheckModalVisible(false)}>关闭</Button>]}
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
