#!/usr/bin/env bash
# create-session.sh — 在 Base Sepolia 的 AgentSessionManager 建一個受限 session，
# 授權 agent EOA 在額度內代下單，並印出 DEMO_SESSION_ID 供 agent/.env 使用。
#
# 用法（在 repo 根目錄）：
#   export RPC_URL=https://sepolia.base.org
#   export USER_PK=0x<建立 session 的使用者私鑰（=持有 freeMargin 的帳戶）>
#   export AGENT_ADDR=0x<被授權的 agent EOA 地址>
#   bash create-session.sh
#
# 前置：使用者需先在 PerpetualExchange 存過保證金（depositMargin，MockUSDC），
#       agent 開倉時才有 freeMargin 可用。AgentSessionManager 已在部署時被
#       setAgentAuthorized(true)。
set -euo pipefail

: "${RPC_URL:?set RPC_URL}"
: "${USER_PK:?set USER_PK}"
: "${AGENT_ADDR:?set AGENT_ADDR}"

# Base Sepolia 已部署位址（AgentSessionManager，**現行版本**）
#
# mandate-layer 自己的 AgentSessionManager（Deploy.s.sol，2026-09-23）。
# 它綁定本 repo 的 exchange 0xC45dEd77…3B0E，也是該 exchange 唯一授權的 agent。
# 刻意不引用原專案 pepelab_onchain_cfd 的任何 manager —— 本 repo 不得寫入原專案合約。
SESSION_MGR="0x71125e25c903AD4e198e1863d5Bf26df97926CDe"

# Session 參數（可改）：每筆最高保證金 / 總額度 / 槓桿上限 / 到期
MAX_PER_TRADE="${MAX_PER_TRADE:-50000000000000000000}"   # 50e18 (MockUSDC 18-dec)
TOTAL_BUDGET="${TOTAL_BUDGET:-200000000000000000000}"    # 200e18
MAX_LEV="${MAX_LEV:-5}"                                  # ≤ MAX_LEVERAGE
EXPIRY="${EXPIRY:-$(( $(date +%s) + 7*24*3600 ))}"       # 7 天後

echo "Creating session on $SESSION_MGR"
echo "  agent=$AGENT_ADDR  perTrade=$MAX_PER_TRADE  budget=$TOTAL_BUDGET  maxLev=$MAX_LEV  expiry=$EXPIRY"

# 先讀目前 nextSessionId（新 session 的 id 就是這個值）
NEXT=$(cast call "$SESSION_MGR" "nextSessionId()(uint256)" --rpc-url "$RPC_URL" | awk '{print $1}')

cast send "$SESSION_MGR" \
  "createSession(address,uint256,uint256,uint256,uint256)" \
  "$AGENT_ADDR" "$MAX_PER_TRADE" "$TOTAL_BUDGET" "$MAX_LEV" "$EXPIRY" \
  --rpc-url "$RPC_URL" --private-key "$USER_PK"

echo ""
echo "✅ Session 建立成功。把這個填進 agent/.env："
echo "   DEMO_SESSION_ID=$NEXT"
