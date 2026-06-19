import { useState, useEffect } from 'react';
import {
  Layout, Table, Button, Modal, Form,
  Tag, Space, Card, message, Row, Col, Statistic,
  Input, Alert, Divider, List, Checkbox, Descriptions
} from 'antd';
import {
  CheckCircleOutlined, ExclamationCircleOutlined,
  InboxOutlined, InfoCircleOutlined, UserOutlined,
  FileSearchOutlined, LockOutlined, UnlockOutlined,
  SafetyOutlined, EditOutlined
} from '@ant-design/icons';
import { flightApi, mealBoxApi, cabinReceiptApi } from '../services/api';
import dayjs from 'dayjs';

const { Header, Sider, Content } = Layout;
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

export default function PurserPage({ user, onLogout }) {
  const [flights, setFlights] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [isolations, setIsolations] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmResult, setConfirmResult] = useState(null);
  const [latestReceipt, setLatestReceipt] = useState(null);
  const [checkedBoxes, setCheckedBoxes] = useState([]);
  const [remark, setRemark] = useState('');
  const [diffModalVisible, setDiffModalVisible] = useState(false);
  const [diffForm] = Form.useForm();

  useEffect(() => {
    loadFlights();
  }, []);

  useEffect(() => {
    if (selectedFlight) {
      loadBoxes(selectedFlight.id);
      loadLatestReceipt(selectedFlight.id);
      loadIsolations(selectedFlight.id);
    }
  }, [selectedFlight]);

  const loadFlights = async () => {
    setLoading(true);
    try {
      const data = await flightApi.getList();
      setFlights(data.filter(f => f.status === 'checked' || f.status === 'received' || f.status === 'departed'));
      if (data.length > 0 && !selectedFlight) {
        const available = data.find(f => f.status === 'checked' || f.status === 'received' || f.status === 'departed');
        if (available) setSelectedFlight(available);
      }
    } catch (err) {
      message.error('加载航班列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadBoxes = async (flightId) => {
    try {
      const data = await cabinReceiptApi.getBoxes(flightId);
      setBoxes(data);
      setCheckedBoxes(data.map(b => b.id));
    } catch (err) {
      message.error('加载餐箱列表失败');
    }
  };

  const loadLatestReceipt = async (flightId) => {
    try {
      const data = await cabinReceiptApi.getLatest(flightId);
      setLatestReceipt(data);
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

  const handleConfirm = () => {
    if (checkedBoxes.length === 0) {
      message.warning('请至少选择一个餐箱');
      return;
    }
    setConfirmModalVisible(true);
  };

  const handleSubmitConfirm = async () => {
    try {
      const received_boxes = boxes
        .filter(b => checkedBoxes.includes(b.id))
        .map(b => ({ box_id: b.id, received_quantity: b.quantity }));

      const result = await cabinReceiptApi.confirm({
        flight_id: selectedFlight.id,
        purser_id: String(user.id),
        purser_name: user.name,
        remark: remark,
        received_boxes: received_boxes,
      });
      setConfirmResult(result);
      loadFlights();
      loadLatestReceipt(selectedFlight.id);
      loadIsolations(selectedFlight.id);

      if (result.is_confirmed) {
        if (result.is_locked) {
          message.success('机上接收确认成功，航班已起飞，装机数据已锁定');
        } else {
          message.success('机上接收确认成功');
        }
      } else {
        message.warning('接收确认存在问题，请检查');
      }
    } catch (err) {
      message.error(err.message || '确认失败');
    }
  };

  const handleLock = async () => {
    if (!latestReceipt) return;
    try {
      await cabinReceiptApi.lock(latestReceipt.id);
      message.success('装机数据已锁定，过敏餐标识已锁定');
      loadLatestReceipt(selectedFlight.id);
    } catch (err) {
      message.error(err.message || '锁定失败');
    }
  };

  const handleOpenDiffModal = () => {
    diffForm.resetFields();
    if (latestReceipt?.diff_description) {
      diffForm.setFieldsValue({ diff_description: latestReceipt.diff_description });
    }
    if (latestReceipt?.responsible_person) {
      diffForm.setFieldsValue({ responsible_person: latestReceipt.responsible_person });
    }
    setDiffModalVisible(true);
  };

  const handleSubmitDiff = async () => {
    try {
      const values = await diffForm.validateFields();
      await cabinReceiptApi.addDiffDescription(latestReceipt.id, values);
      message.success('差异说明已追加');
      setDiffModalVisible(false);
      loadLatestReceipt(selectedFlight.id);
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || '操作失败');
    }
  };

  const handleBoxCheck = (boxId, checked) => {
    if (latestReceipt?.is_locked) return;
    if (checked) {
      setCheckedBoxes([...checkedBoxes, boxId]);
    } else {
      setCheckedBoxes(checkedBoxes.filter(id => id !== boxId));
    }
  };

  const handleCheckAll = (checked) => {
    if (latestReceipt?.is_locked) return;
    if (checked) {
      setCheckedBoxes(boxes.map(b => b.id));
    } else {
      setCheckedBoxes([]);
    }
  };

  const isDeparted = selectedFlight && new Date(selectedFlight.scheduled_departure_time) <= new Date();
  const isLocked = latestReceipt?.is_locked === 1;
  const isConfirmed = latestReceipt?.is_confirmed;

  const totalBoxes = boxes.reduce((sum, b) => sum + b.quantity, 0);
  const allergyBoxes = boxes.filter(b => b.is_allergy).reduce((sum, b) => sum + b.quantity, 0);
  const unmarkedAllergyBoxes = boxes.filter(b => b.is_allergy && !b.is_allergy_marked);

  const boxColumns = [
    {
      title: '',
      dataIndex: 'check',
      key: 'check',
      width: 40,
      render: (_, record) => (
        <Checkbox
          checked={checkedBoxes.includes(record.id)}
          onChange={(e) => handleBoxCheck(record.id, e.target.checked)}
          disabled={isConfirmed || isLocked}
        />
      ),
    },
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
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <InfoCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
          <span style={{ fontSize: 18, fontWeight: 600 }}>航空配餐特殊餐装机复核系统</span>
          <Tag color="green">乘务长</Tag>
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
            <div style={{ padding: '8px 16px', color: '#666', fontSize: 12 }}>待接收/已接收航班</div>
            {flights.map(flight => (
              <div
                key={flight.id}
                onClick={() => setSelectedFlight(flight)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: selectedFlight?.id === flight.id ? '#f6ffed' : '#fff',
                  borderLeft: selectedFlight?.id === flight.id ? '3px solid #52c41a' : '3px solid transparent',
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
                <Col span={5}>
                  <Card>
                    <Statistic
                      title="餐箱总数"
                      value={boxes.length}
                      suffix="个"
                      valueStyle={{ color: '#1890ff' }}
                      prefix={<InboxOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={5}>
                  <Card>
                    <Statistic
                      title="餐食份数"
                      value={totalBoxes}
                      suffix="份"
                      valueStyle={{ color: '#52c41a' }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={5}>
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
                <Col span={5}>
                  <Card>
                    <Statistic
                      title="接收状态"
                      value={isConfirmed ? '已确认' : '待确认'}
                      valueStyle={{ color: isConfirmed ? '#52c41a' : '#faad14' }}
                      prefix={<FileSearchOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={4}>
                  <Card>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>锁定状态</div>
                      {isLocked ? (
                        <Tag color="red" icon={<LockOutlined />} style={{ fontSize: 14, padding: '4px 12px' }}>
                          已锁定
                        </Tag>
                      ) : (
                        <Tag color="default" icon={<UnlockOutlined />} style={{ fontSize: 14, padding: '4px 12px' }}>
                          未锁定
                        </Tag>
                      )}
                    </div>
                  </Card>
                </Col>
              </Row>

              {unmarkedAllergyBoxes.length > 0 && !isLocked && (
                <Alert
                  message="过敏餐未标记警告"
                  description={`有 ${unmarkedAllergyBoxes.length} 个过敏餐箱未单独标记，请特别留意！`}
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}

              {isConfirmed && !isLocked && (
                <Alert
                  message="已确认接收，待锁定"
                  description={`于 ${dayjs(latestReceipt.receipt_time).format('YYYY-MM-DD HH:mm')} 由 ${latestReceipt.purser_name} 确认接收。航班起飞后请锁定装机数据。`}
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  action={
                    isDeparted && (
                      <Button size="small" type="primary" danger icon={<LockOutlined />} onClick={handleLock}>
                        立即锁定
                      </Button>
                    )
                  }
                />
              )}

              {isLocked && (
                <Alert
                  message="装机数据已锁定"
                  description="起飞后装机数量和过敏餐标识已锁定，只允许追加差异说明和责任人"
                  type="success"
                  showIcon
                  style={{ marginBottom: 16 }}
                  icon={<LockOutlined />}
                />
              )}

              {latestReceipt?.diff_description && (
                <Card title="差异说明" size="small" style={{ marginBottom: 16 }}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="差异说明">{latestReceipt.diff_description}</Descriptions.Item>
                    {latestReceipt.responsible_person && (
                      <Descriptions.Item label="责任人">
                        <Tag icon={<UserOutlined />} color="blue">{latestReceipt.responsible_person}</Tag>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>
              )}

              {isolations.length > 0 && (
                <Card
                  title={<span><SafetyOutlined style={{ marginRight: 8, color: '#f5222d' }} />过敏餐隔离记录</span>}
                  size="small"
                  style={{ marginBottom: 16 }}
                >
                  <List
                    size="small"
                    dataSource={isolations}
                    renderItem={item => (
                      <List.Item>
                        <Space>
                          <Tag color="red">过敏</Tag>
                          <span>{item.box_no}</span>
                          <span>{item.meal_type_name}</span>
                          {item.isolation_method && <Tag color="orange">{item.isolation_method}</Tag>}
                          {item.confirmed_by_name && (
                            <Tag icon={<CheckCircleOutlined />} color="green">已确认: {item.confirmed_by_name}</Tag>
                          )}
                        </Space>
                        <Space>
                          <span style={{ color: '#999', fontSize: 12 }}>{item.operator_name}</span>
                          <span style={{ color: '#999', fontSize: 12 }}>
                            {item.confirmed_at && dayjs(item.confirmed_at).format('HH:mm')}
                          </span>
                        </Space>
                      </List.Item>
                    )}
                  />
                </Card>
              )}

              <Card
                title={
                  <Space>
                    <span>机上餐箱清单</span>
                    {isLocked && <Tag color="red" icon={<LockOutlined />}>已锁定</Tag>}
                  </Space>
                }
                extra={
                  <Space>
                    {!isConfirmed && (
                      <Button
                        type="primary"
                        icon={<FileSearchOutlined />}
                        onClick={handleConfirm}
                        disabled={boxes.length === 0}
                      >
                        确认接收
                      </Button>
                    )}
                    {isConfirmed && !isLocked && isDeparted && (
                      <Button
                        type="primary"
                        danger
                        icon={<LockOutlined />}
                        onClick={handleLock}
                      >
                        锁定装机数据
                      </Button>
                    )}
                    {isLocked && (
                      <Button
                        icon={<EditOutlined />}
                        onClick={handleOpenDiffModal}
                      >
                        追加差异说明
                      </Button>
                    )}
                  </Space>
                }
              >
                <div style={{ marginBottom: 12 }}>
                  <Checkbox
                    checked={checkedBoxes.length === boxes.length && boxes.length > 0}
                    onChange={(e) => handleCheckAll(e.target.checked)}
                    disabled={isConfirmed || isLocked}
                  >
                    全选（共 {boxes.length} 个餐箱）
                  </Checkbox>
                  <span style={{ marginLeft: 16, color: '#666' }}>
                    已选 {checkedBoxes.length} 个
                  </span>
                </div>
                <Table
                  columns={boxColumns}
                  dataSource={boxes}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              </Card>

              {latestReceipt?.remark && (
                <Card title="接收备注" size="small" style={{ marginTop: 16 }}>
                  <p style={{ margin: 0 }}>{latestReceipt.remark}</p>
                </Card>
              )}
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
        title="机上接收确认"
        open={confirmModalVisible}
        onCancel={() => {
          setConfirmModalVisible(false);
          setConfirmResult(null);
        }}
        footer={!confirmResult ? [
          <Button key="cancel" onClick={() => setConfirmModalVisible(false)}>取消</Button>,
          <Button key="submit" type="primary" onClick={handleSubmitConfirm}>确认接收</Button>,
        ] : [
          <Button key="close" type="primary" onClick={() => {
            setConfirmModalVisible(false);
            setConfirmResult(null);
          }}>关闭</Button>,
        ]}
        width={600}
        destroyOnClose
      >
        {!confirmResult ? (
          <div>
            <Alert
              message="请核对所有餐箱数量和状态"
              description="确认无误后点击「确认接收」按钮完成机上接收"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            {isDeparted && (
              <Alert
                message="航班已起飞"
                description="确认后装机数量和过敏餐标识将自动锁定"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Divider orientation="left">接收汇总</Divider>
            <List
              size="small"
              dataSource={boxes.filter(b => checkedBoxes.includes(b.id))}
              renderItem={item => (
                <List.Item>
                  <Space>
                    <span>{item.box_no}</span>
                    <span>{item.meal_type_name}</span>
                    {item.is_allergy && (
                      item.is_allergy_marked
                        ? <Tag color="green">已标记</Tag>
                        : <Tag color="red">未标记</Tag>
                    )}
                  </Space>
                  <span style={{ fontWeight: 500 }}>{item.quantity} 份</span>
                </List.Item>
              )}
            />

            <Divider orientation="left">备注</Divider>
            <TextArea
              rows={3}
              placeholder="请输入备注信息（选填）"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
          </div>
        ) : (
          <div>
            <Alert
              message={confirmResult.is_confirmed ? '接收确认成功' : '接收存在问题'}
              type={confirmResult.is_confirmed ? 'success' : 'warning'}
              showIcon
              style={{ marginBottom: 16 }}
            />

            {confirmResult.is_locked && (
              <Alert
                message="装机数据已自动锁定"
                description="航班已起飞，装机数量和过敏餐标识已锁定"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                icon={<LockOutlined />}
              />
            )}

            {confirmResult.issues?.length > 0 && (
              <>
                <Divider orientation="left">问题清单</Divider>
                <List
                  size="small"
                  dataSource={confirmResult.issues}
                  renderItem={issue => (
                    <List.Item style={{ alignItems: 'flex-start' }}>
                      <ExclamationCircleOutlined style={{ color: '#faad14', marginTop: 3 }} />
                      <span style={{ flex: 1, marginLeft: 8 }}>{issue.message}</span>
                    </List.Item>
                  )}
                />
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="追加差异说明"
        open={diffModalVisible}
        onCancel={() => setDiffModalVisible(false)}
        onOk={handleSubmitDiff}
        okText="提交"
        cancelText="取消"
        destroyOnClose
      >
        <Alert
          message="装机数据已锁定，只能追加差异说明和责任人信息"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          icon={<LockOutlined />}
        />
        <Form form={diffForm} layout="vertical">
          <Form.Item
            label="差异说明"
            name="diff_description"
            rules={[{ required: true, message: '请输入差异说明' }]}
          >
            <TextArea
              rows={4}
              placeholder="请描述装机数量或过敏餐标识与实际情况的差异"
            />
          </Form.Item>
          <Form.Item
            label="责任人"
            name="responsible_person"
            rules={[{ required: true, message: '请输入责任人' }]}
          >
            <Input placeholder="请输入责任人姓名" prefix={<UserOutlined />} />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
