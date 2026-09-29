// Mandate Layer MCP Server
// 把協議狀態包成 MCP tools，讓 Claude 這類 agent 直接查詢與下單：
//   read:
//     - get_trader_performance  → StrategyRegistry + 鏈上 PnL 聚合
//     - get_funding_rate        → PerpetualExchange.getFundingRate
//     - get_position            → PerpetualExchange.getPosition (+ unrealized/funding)
//     - get_session             → AgentSessionManager.sessions（限額/預算/到期）
//   write（Phase 2，經 AgentSessionManager session 限額）:
//     - open_position           → openPositionForSession
//     - close_position          → closePositionForSession
// 透過 stdio 傳輸；合約讀取走 Ethereum Sepolia。寫操作需 AGENT_PRIVATE_KEY
// （session key）+ SESSION_MANAGER_ADDRESS；缺任一時 tool 回明確錯誤、不 crash。
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ethers } from "ethers";
import {
  loadEnv,
  makeProvider,
  makeContracts,
  makeSigner,
  getSessionManagerAddress,
  ADDRESSES,
  getTraderPerformance,
  getFundingRate,
  getPositionDetail,
  openPositionForSession,
  closePositionForSession,
  getSession,
  agentDid,
  parseDidPkh,
  buildAgentVerification,
  type AuthorizationVC,
  type ContractTarget,
  jsonSafe,
  topUpMargin,
  type SpendPermissionJson,
} from "@pepelab/shared";

loadEnv();

const provider = makeProvider();
const contracts = makeContracts(provider);

// ERC-8126 verifier identity（VERIFIER_PRIVATE_KEY 優先，否則一次性隨機）。
const VERIFIER_WALLET = (() => {
  const pk = process.env.VERIFIER_PRIVATE_KEY?.trim();
  if (pk && pk.startsWith("0x") && pk.length === 66) return new ethers.Wallet(pk);
  return ethers.Wallet.createRandom();
})();

const server = new McpServer({
  name: "pepelab-cfd",
  version: "0.1.0",
});

function ok(data: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(jsonSafe(data), null, 2) },
    ],
  };
}

function fail(err: unknown) {
  return {
    isError: true,
    content: [
      { type: "text" as const, text: `Error: ${(err as Error).message}` },
    ],
  };
}

server.tool(
  "get_trader_performance",
  "Trader performance summary: registration, latest strategy allocation, on-chain PnL aggregate (realized / unrealized / net) and an entry suggestion.",
  { trader: z.string().describe("Trader address, 0x…") },
  async ({ trader }) => {
    try {
      return ok(await getTraderPerformance(contracts, trader));
    } catch (err) {
      return fail(err);
    }
  },
);

server.tool(
  "get_funding_rate",
  "Current per-interval funding rate for an asset (bps and %). Positive means longs pay.",
  { asset: z.string().describe("Asset symbol, e.g. sBTC / sETH / sAAPL") },
  async ({ asset }) => {
    try {
      return ok(await getFundingRate(contracts, asset));
    } catch (err) {
      return fail(err);
    }
  },
);

server.tool(
  "get_position",
  "One position: side, entry price, margin, leverage, unrealized PnL and pending funding.",
  { positionId: z.number().int().nonnegative().describe("Position id") },
  async ({ positionId }) => {
    try {
      return ok(await getPositionDetail(contracts, positionId));
    } catch (err) {
      return fail(err);
    }
  },
);

// ── read: session 設定 ───────────────────────────────────────────────────────
server.tool(
  "get_session",
  "A session's delegated limits: user / agent, per-trade cap, total budget, spent, max leverage, expiry, revoked. Check it before placing an order.",
  { sessionId: z.number().int().nonnegative().describe("On-chain session id") },
  async ({ sessionId }) => {
    try {
      return ok(await getSession(sessionId));
    } catch (err) {
      return fail(err);
    }
  },
);

// ── read: ERC-8126 agent 驗證 ────────────────────────────────────────────────
server.tool(
  "get_agent_verification",
  "Agent verification attestation (ERC-8126 draft): ETV / SCV / WAV / WV checks, MCV (n/a), a 0–100 risk score (lower is safer) and the verifier signature. Use it to judge whether an agent is trustworthy, alongside the authorization VC.",
  { did: z.string().describe("Agent did:pkh or plain 0x address") },
  async ({ did }) => {
    try {
      const subject = did.startsWith("did:") ? did : agentDid(did);
      parseDidPkh(subject); // 驗格式
      const etvTargets: ContractTarget[] = [
        { label: "USDC (settlement)", address: process.env.X402_SETTLEMENT_TOKEN?.trim() || "0x036CbD53842c5426634e7929541eC2318f3dCF7e" },
        { label: "PerpetualExchange", address: ADDRESSES.PerpetualExchange },
      ];
      const scvTargets: ContractTarget[] = [
        { label: "PerpetualExchange", address: ADDRESSES.PerpetualExchange },
        { label: "FeeRouter", address: ADDRESSES.FeeRouter },
        { label: "AgentSessionManager", address: getSessionManagerAddress() },
      ];
      const signer = makeSigner(provider);
      const holderSigner =
        signer && ethers.getAddress(signer.address) === parseDidPkh(subject).address
          ? signer
          : undefined;
      const av = await buildAgentVerification({
        did: subject,
        verifier: VERIFIER_WALLET,
        provider,
        apiBaseUrl: process.env.SIGNAL_API_PUBLIC_URL?.trim() || "http://localhost:4021",
        etvTargets,
        scvTargets,
        explorerApiKey:
          process.env.ETHERSCAN_API_KEY?.trim() || process.env.BASESCAN_API_KEY?.trim(),
        paidPath: "/oracle/sBTC",
        holderSigner,
      });
      return ok(av);
    } catch (err) {
      return fail(err);
    }
  },
);

// ── write: 經 AgentSessionManager 在 session 限額內下單 ───────────────────────
server.tool(
  "open_position",
  "[WRITE] Open a position for the session's user, bounded by the session (per-trade cap, budget, leverage cap, asset allow-list, expiry). Needs AGENT_PRIVATE_KEY and SESSION_MANAGER_ADDRESS; returns a clear error if missing. authVcJson (the user-signed authorization VC) is REQUIRED: its signature is verified and every cap is cross-checked against the on-chain session before sending. Returns tx hash and positionId.",
  {
    sessionId: z.number().int().nonnegative().describe("On-chain session id"),
    asset: z.string().describe("Asset symbol, e.g. sBTC / sETH / sAAPL"),
    isLong: z.boolean().describe("true = long, false = short"),
    marginUsdc: z.number().positive().describe("Margin in USDC (human units)"),
    leverage: z.number().int().positive().describe("Leverage (bounded by session.maxLeverage)"),
    // 稽核 A-3：這裡原本是 .optional()，而 write 層又是「有帶才驗」，兩個可選相乘
    // 等於沒有授權層。現在改必填，缺 VC 連呼叫都組不起來。
    authVcJson: z.string().min(1).describe("User-signed authorization VC as a JSON string (required); must verify before the order is sent"),
  },
  async ({ sessionId, asset, isLong, marginUsdc, leverage, authVcJson }) => {
    try {
      let authVc: AuthorizationVC;
      try {
        authVc = JSON.parse(authVcJson) as AuthorizationVC;
      } catch (e) {
        return fail(new Error(`authVcJson is not valid JSON: ${(e as Error).message}`));
      }
      const res = await openPositionForSession({
        sessionId,
        symbol: asset,
        isLong,
        marginUsdc,
        leverage,
        authVc,
      });
      return res.ok ? ok(res) : fail(new Error(res.error));
    } catch (err) {
      return fail(err);
    }
  },
);

server.tool(
  "close_position",
  "[WRITE] Close a position this session opened (realizes PnL, so authorization is as strict as opening). Needs AGENT_PRIVATE_KEY, SESSION_MANAGER_ADDRESS and authVcJson; returns a clear error if missing. Returns tx hash.",
  {
    sessionId: z.number().int().nonnegative().describe("On-chain session id"),
    positionId: z.number().int().nonnegative().describe("Position id to close"),
    // 稽核 A-4：平倉會實現虧損，破壞力與開倉對稱，因此授權要求也必須對稱。
    authVcJson: z.string().min(1).describe("User-signed authorization VC as a JSON string (required); must verify before closing"),
  },
  async ({ sessionId, positionId, authVcJson }) => {
    try {
      let authVc: AuthorizationVC;
      try {
        authVc = JSON.parse(authVcJson) as AuthorizationVC;
      } catch (e) {
        return fail(new Error(`authVcJson is not valid JSON: ${(e as Error).message}`));
      }
      const res = await closePositionForSession({ sessionId, positionId, authVc });
      return res.ok ? ok(res) : fail(new Error(res.error));
    } catch (err) {
      return fail(err);
    }
  },
);

server.tool(
  "top_up_margin",
  "[WRITE] Move margin from the session user's Base Account into their exchange margin, through a Base Spend Permission the user approved for SpendPermissionMarginFunder. The Spend Permission caps how much can move per period; the session caps what the agent does with it. Needs AGENT_PRIVATE_KEY, SESSION_MANAGER_ADDRESS, SPEND_PERMISSION_FUNDER_ADDRESS (the funder is not deployed by default) and authVcJson, verified and cross-checked on chain like open_position.",
  {
    sessionId: z.number().int().nonnegative().describe("On-chain session id; its user must be the Base Account in the permission"),
    permissionJson: z.string().min(1).describe("The SpendPermission the user approved, as JSON: account, spender, token, allowance, period, start, end, salt, extraData"),
    amountUsdc: z.number().positive().describe("Amount of margin token to move (human units)"),
    authVcJson: z.string().min(1).describe("User-signed authorization VC as a JSON string (required)"),
  },
  async ({ sessionId, permissionJson, amountUsdc, authVcJson }) => {
    try {
      let permission: SpendPermissionJson;
      let authVc: AuthorizationVC;
      try {
        permission = JSON.parse(permissionJson) as SpendPermissionJson;
        authVc = JSON.parse(authVcJson) as AuthorizationVC;
      } catch (e) {
        return fail(new Error(`permissionJson or authVcJson is not valid JSON: ${(e as Error).message}`));
      }
      const res = await topUpMargin({ sessionId, permission, amountUsdc, authVc });
      return res.ok ? ok(res) : fail(new Error(res.error));
    } catch (err) {
      return fail(err);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(
  "▶ pepelab-cfd MCP server ready (stdio) — read tools + session-bounded write tools",
);
