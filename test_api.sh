#!/bin/bash

set -e

BASE_URL="http://localhost:19442/api"

echo "=========================================="
echo " 航空配餐特殊餐装机复核系统 - 集成测试"
echo "=========================================="
echo ""

echo "[1/6] 测试健康检查..."
curl -s "$BASE_URL/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✓', d['message'])"
echo ""

echo "[2/6] 测试过敏餐必须单独标记..."
RESULT=$(curl -s -X POST "$BASE_URL/meal-boxes" -H "Content-Type: application/json" \
  -d '{"flight_id": 1, "meal_type_id": 7, "quantity": 1, "is_allergy_marked": false, "loader_id": "3", "loader_name": "王强"}')
MESSAGE=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['message'])")
if [ "$MESSAGE" = "过敏餐必须单独标记" ]; then
  echo "  ✓ 过敏餐未标记时正确拒绝"
else
  echo "  ✗ 失败: $MESSAGE"
fi
echo ""

echo "[3/6] 测试数量不足不能放行..."
curl -s -X POST "$BASE_URL/meal-requirements" -H "Content-Type: application/json" \
  -d '{"flight_id": 4, "meal_type_id": 2, "quantity": 5, "dispatcher_id": "1", "dispatcher_name": "张明"}' > /dev/null

curl -s -X POST "$BASE_URL/meal-boxes" -H "Content-Type: application/json" \
  -d '{"flight_id": 4, "meal_type_id": 2, "quantity": 3, "is_allergy_marked": false, "loader_id": "3", "loader_name": "王强"}' > /dev/null

BOX_ID=$(curl -s "$BASE_URL/meal-boxes?flight_id=4" | python3 -c "
import sys,json
boxes = [b for b in json.load(sys.stdin)['data'] if b['meal_type_id'] == 2 and b['status'] == 'prepared']
print(boxes[0]['id'])
")

curl -s -X POST "$BASE_URL/meal-boxes/$BOX_ID/load" -H "Content-Type: application/json" \
  -d '{"loader_id": "3", "loader_name": "王强"}' > /dev/null

RESULT=$(curl -s -X POST "$BASE_URL/loading-checks/check" -H "Content-Type: application/json" \
  -d '{"flight_id": 4, "checker_id": "3", "checker_name": "王强"}')

IS_PASSED=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['is_passed'])")
ISSUE_COUNT=$(echo "$RESULT" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']['check_result']['issues']))")

if [ "$IS_PASSED" = "False" ] && [ "$ISSUE_COUNT" -gt 0 ]; then
  echo "  ✓ 数量不足时正确不通过"
else
  echo "  ✗ 失败: 通过=$IS_PASSED, 问题数=$ISSUE_COUNT"
fi
echo ""

echo "[4/6] 测试正常流程（需求=装车=复核通过）..."
FLIGHT_ID=2
RESULT=$(curl -s -X POST "$BASE_URL/loading-checks/check" -H "Content-Type: application/json" \
  -d "{\"flight_id\": $FLIGHT_ID, \"checker_id\": \"3\", \"checker_name\": \"王强\"}")

IS_PASSED=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['is_passed'])")

if [ "$IS_PASSED" = "True" ]; then
  echo "  ✓ 数量充足且过敏标记正确时复核通过"
else
  echo "  ✗ 失败"
fi
echo ""

echo "[5/6] 测试乘务长接收确认..."
RESULT=$(curl -s -X POST "$BASE_URL/cabin-receipts/confirm" -H "Content-Type: application/json" \
  -d "{\"flight_id\": $FLIGHT_ID, \"purser_id\": \"5\", \"purser_name\": \"李红\"}")

IS_CONFIRMED=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['is_confirmed'])")

if [ "$IS_CONFIRMED" = "True" ]; then
  echo "  ✓ 乘务长接收确认成功"
else
  echo "  ✗ 失败"
fi
echo ""

echo "[6/6] 验证航班状态流转..."
FLIGHT=$(curl -s "$BASE_URL/flights/$FLIGHT_ID")
STATUS=$(echo "$FLIGHT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])")
CHECK_PASSED=$(echo "$FLIGHT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['check_passed'])")
RECEIPT_CONFIRMED=$(echo "$FLIGHT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['receipt_confirmed'])")

echo "  航班状态: $STATUS"
echo "  复核通过: $CHECK_PASSED"
echo "  接收确认: $RECEIPT_CONFIRMED"

if [ "$RECEIPT_CONFIRMED" = "True" ]; then
  echo "  ✓ 状态流转正确"
else
  echo "  ✗ 状态流转异常"
fi
echo ""

echo "=========================================="
echo " 测试完成！"
echo "=========================================="
