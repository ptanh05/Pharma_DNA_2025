/**
 * AI Orchestrator Agent - Core System
 * Agent tự động điều phối toàn bộ chuỗi cung ứng
 */

import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { pool } from "@/lib/db";
import { ethers } from "ethers";
import pharmaNFTAbi from "@/lib/pharmaNFT-abi.json";

// Initialize LLM - Using GPT-3.5-turbo for cost efficiency
const llm = new ChatOpenAI({
  modelName: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
  temperature: 0.3,
  openAIApiKey: process.env.OPENAI_API_KEY,
  maxTokens: 2000, // Limit tokens to control cost
});

// Memory store for agent context
const agentMemory = new Map<string, any>();

/**
 * Tool: Mint NFT
 */
const mintNFTTool = new DynamicStructuredTool({
  name: "mint_nft",
  description: "Mint một NFT mới cho lô thuốc. Cần IPFS hash của metadata.",
  schema: z.object({
    ipfsHash: z.string().describe("IPFS hash của metadata"),
    manufacturerAddress: z.string().describe("Địa chỉ ví nhà sản xuất"),
  }),
  func: async ({ ipfsHash, manufacturerAddress }) => {
    try {
      const { getRpcUrl } = await import("@/lib/blockchain/config");
      const provider = new ethers.JsonRpcProvider(getRpcUrl());
      const contractAddress = process.env.NEXT_PUBLIC_PHARMA_NFT_ADDRESS;
      if (!contractAddress) throw new Error("Contract address not configured");

      const signer = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY || "", provider);
      const contract = new ethers.Contract(contractAddress, pharmaNFTAbi.abi || pharmaNFTAbi, signer);

      // Check if manufacturer has role
      const role = await contract.roles(manufacturerAddress);
      if (Number(role) !== 1) {
        throw new Error("Manufacturer does not have correct role");
      }

      // Mint NFT (need to use manufacturer's wallet, but for automation we use owner)
      // In production, this should be signed by manufacturer
      const tx = await contract.mintProductNFT(ipfsHash);
      await tx.wait();

      return JSON.stringify({
        success: true,
        transactionHash: tx.hash,
        message: `NFT minted successfully with IPFS hash: ${ipfsHash}`,
      });
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message });
    }
  },
});

/**
 * Tool: Transfer NFT
 */
const transferNFTTool = new DynamicStructuredTool({
  name: "transfer_nft",
  description: "Chuyển quyền sở hữu NFT từ một address sang address khác",
  schema: z.object({
    tokenId: z.number().describe("Token ID của NFT"),
    fromAddress: z.string().describe("Địa chỉ hiện tại sở hữu NFT"),
    toAddress: z.string().describe("Địa chỉ nhận NFT"),
  }),
  func: async ({ tokenId, fromAddress, toAddress }) => {
    try {
      // Input validation
      const { validateTokenId, validateAddress } = await import("./validator");
      const tokenValidation = validateTokenId(tokenId);
      if (!tokenValidation.valid) {
        return JSON.stringify({ success: false, error: tokenValidation.error });
      }

      const fromValidation = validateAddress(fromAddress);
      if (!fromValidation.valid) {
        return JSON.stringify({ success: false, error: `Invalid from address: ${fromValidation.error}` });
      }

      const toValidation = validateAddress(toAddress);
      if (!toValidation.valid) {
        return JSON.stringify({ success: false, error: `Invalid to address: ${toValidation.error}` });
      }

      const { getRpcUrl } = await import("@/lib/blockchain/config");
      const provider = new ethers.JsonRpcProvider(getRpcUrl());
      const contractAddress = process.env.NEXT_PUBLIC_PHARMA_NFT_ADDRESS;
      if (!contractAddress) {
        return JSON.stringify({ success: false, error: "Contract address not configured" });
      }

      // In production, this should be signed by fromAddress
      const signer = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY || "", provider);
      const contract = new ethers.Contract(contractAddress, pharmaNFTAbi.abi || pharmaNFTAbi, signer);

      const tx = await contract.transferProductNFT(tokenId, toAddress);
      await tx.wait();

      // Update database
      await pool.query(
        `UPDATE nfts SET distributor_address = $1, status = 'in_transit' WHERE id = $2`,
        [toAddress, tokenId]
      );

      return JSON.stringify({
        success: true,
        transactionHash: tx.hash,
        message: `NFT #${tokenId} transferred from ${fromAddress} to ${toAddress}`,
      });
    } catch (error: any) {
      console.error("Transfer NFT error:", error);
      return JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error occurred",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  },
});

/**
 * Tool: Create Milestone
 */
const createMilestoneTool = new DynamicStructuredTool({
  name: "create_milestone",
  description: "Tạo một milestone mới cho NFT trong quá trình vận chuyển",
  schema: z.object({
    nftId: z.number().describe("ID của NFT trong database"),
    type: z.string().describe("Loại milestone (ví dụ: Nhận hàng, Đang vận chuyển, Đã nhập kho)"),
    description: z.string().optional().describe("Mô tả milestone"),
    location: z.string().optional().describe("Vị trí"),
    actorAddress: z.string().describe("Địa chỉ người thực hiện"),
  }),
  func: async ({ nftId, type, description, location, actorAddress }) => {
    try {
      // Input validation
      const { validateTokenId, validateAddress } = await import("./validator");
      const tokenValidation = validateTokenId(nftId);
      if (!tokenValidation.valid) {
        return JSON.stringify({ success: false, error: tokenValidation.error });
      }

      const addressValidation = validateAddress(actorAddress);
      if (!addressValidation.valid) {
        return JSON.stringify({ success: false, error: `Invalid actor address: ${addressValidation.error}` });
      }

      if (!type || type.trim().length === 0) {
        return JSON.stringify({ success: false, error: "Milestone type is required" });
      }

      if (type.length > 100) {
        return JSON.stringify({ success: false, error: "Milestone type too long (max 100 characters)" });
      }

      const result = await pool.query(
        `INSERT INTO milestones (nft_id, type, description, location, timestamp, actor_address)
         VALUES ($1, $2, $3, $4, NOW(), $5) RETURNING *`,
        [nftId, type.trim(), description?.trim() || null, location?.trim() || null, actorAddress]
      );

      return JSON.stringify({
        success: true,
        milestone: result.rows[0],
        message: `Milestone "${type}" created for NFT #${nftId}`,
      });
    } catch (error: any) {
      console.error("Create milestone error:", error);
      return JSON.stringify({ 
        success: false, 
        error: error.message || "Unknown error occurred",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  },
});

/**
 * Tool: Query Database
 */
const queryDatabaseTool = new DynamicStructuredTool({
  name: "query_database",
  description: "Truy vấn database để lấy thông tin NFT, milestones, users, etc.",
  schema: z.object({
    query: z.string().describe("Câu hỏi về dữ liệu (ví dụ: 'Get all NFTs with status in_transit', 'Get milestones for NFT 123')"),
    nftId: z.number().optional().describe("NFT ID nếu cần"),
  }),
  func: async ({ query, nftId }) => {
    try {
      if (query.includes("NFT") && nftId) {
        const nftResult = await pool.query("SELECT * FROM nfts WHERE id = $1", [nftId]);
        if (nftResult.rows.length === 0) {
          return JSON.stringify({ success: false, error: "NFT not found" });
        }

        const milestonesResult = await pool.query(
          "SELECT * FROM milestones WHERE nft_id = $1 ORDER BY timestamp ASC",
          [nftId]
        );

        return JSON.stringify({
          success: true,
          nft: nftResult.rows[0],
          milestones: milestonesResult.rows,
        });
      }

      if (query.includes("in_transit")) {
        const result = await pool.query("SELECT * FROM nfts WHERE status = 'in_transit'");
        return JSON.stringify({ success: true, nfts: result.rows });
      }

      if (query.includes("milestones") && nftId) {
        const result = await pool.query(
          "SELECT * FROM milestones WHERE nft_id = $1 ORDER BY timestamp ASC",
          [nftId]
        );
        return JSON.stringify({ success: true, milestones: result.rows });
      }

      return JSON.stringify({ success: false, error: "Query not understood" });
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message });
    }
  },
});

/**
 * Tool: Send Notification
 */
const sendNotificationTool = new DynamicStructuredTool({
  name: "send_notification",
  description: "Gửi thông báo cho một địa chỉ ví",
  schema: z.object({
    recipientAddress: z.string().describe("Địa chỉ ví nhận thông báo"),
    type: z.string().describe("Loại thông báo"),
    title: z.string().describe("Tiêu đề"),
    message: z.string().describe("Nội dung thông báo"),
  }),
  func: async ({ recipientAddress, type, title, message }) => {
    try {
      await pool.query(
        `INSERT INTO notifications (recipient_address, type, title, message, is_read, created_at)
         VALUES ($1, $2, $3, $4, false, NOW())`,
        [recipientAddress.toLowerCase(), type, title, message]
      );

      return JSON.stringify({
        success: true,
        message: `Notification sent to ${recipientAddress}`,
      });
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message });
    }
  },
});

/**
 * Tool: Analyze Sensor Data
 */
const analyzeSensorDataTool = new DynamicStructuredTool({
  name: "analyze_sensor_data",
  description: "Phân tích dữ liệu cảm biến AIoT và phát hiện bất thường",
  schema: z.object({
    sensorData: z.any().describe("Dữ liệu sensor (JSON object với temperature, humidity, gps)"),
    nftId: z.number().describe("NFT ID"),
  }),
  func: async ({ sensorData, nftId }) => {
    try {
      const data = typeof sensorData === "string" ? JSON.parse(sensorData) : sensorData;
      const temps = data.temperature || [];
      const humidities = data.humidity || [];

      const avgTemp = temps.reduce((a: number, b: number) => a + b, 0) / temps.length;
      const avgHumidity = humidities.reduce((a: number, b: number) => a + b, 0) / humidities.length;

      const anomalies: string[] = [];
      if (avgTemp > 8) anomalies.push("Nhiệt độ quá cao (>8°C)");
      if (avgTemp < 2) anomalies.push("Nhiệt độ quá thấp (<2°C)");
      if (avgHumidity > 60) anomalies.push("Độ ẩm quá cao (>60%)");
      if (avgHumidity < 30) anomalies.push("Độ ẩm quá thấp (<30%)");

      let qualityScore = 1.0;
      if (anomalies.length > 0) qualityScore -= anomalies.length * 0.2;

      // Create alert if needed
      if (anomalies.length > 0) {
        await pool.query(
          `INSERT INTO quality_alerts (nft_id, alert_type, severity, message, sensor_data, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            nftId,
            "sensor_anomaly",
            qualityScore < 0.5 ? "critical" : "warning",
            `Phát hiện bất thường: ${anomalies.join(", ")}`,
            JSON.stringify(data),
          ]
        );
      }

      return JSON.stringify({
        success: true,
        analysis: {
          avgTemperature: avgTemp,
          avgHumidity: avgHumidity,
          anomalies,
          qualityScore: Math.max(0, qualityScore),
          riskLevel: qualityScore < 0.5 ? "critical" : qualityScore < 0.7 ? "high" : "low",
        },
      });
    } catch (error: any) {
      return JSON.stringify({ success: false, error: error.message });
    }
  },
});

/**
 * Create Agent
 */
export async function createAgent(sessionId: string = "default") {
  // Import additional tools
  const { 
    autoApproveTransferRequestsTool, 
    generateReportTool, 
    checkSystemHealthTool 
  } = await import("./tools");
  
  // Import advanced tools
  const {
    predictQualityTool,
    detectFraudTool,
    optimizeRouteTool,
  } = await import("./tools-advanced");
  
  const tools = [
    mintNFTTool,
    transferNFTTool,
    createMilestoneTool,
    queryDatabaseTool,
    sendNotificationTool,
    analyzeSensorDataTool,
    autoApproveTransferRequestsTool,
    generateReportTool,
    checkSystemHealthTool,
    predictQualityTool,
    detectFraudTool,
    optimizeRouteTool,
  ];

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `Bạn là AI Orchestrator Agent cho hệ thống PharmaDNA - một hệ thống truy xuất nguồn gốc thuốc bằng Blockchain (Neo N3 Network).

Nhiệm vụ của bạn:
1. Tự động điều phối toàn bộ chuỗi cung ứng từ sản xuất đến người tiêu dùng
2. Thực hiện các actions cho các roles: Manufacturer, Distributor, Pharmacy, Admin
3. Phát hiện và giải quyết vấn đề tự động
4. Tối ưu hóa workflows

Bạn có các tools sau:
- mint_nft: Mint NFT mới cho lô thuốc
- transfer_nft: Chuyển quyền sở hữu NFT
- create_milestone: Tạo milestone trong quá trình vận chuyển
- query_database: Truy vấn database
- send_notification: Gửi thông báo
- analyze_sensor_data: Phân tích dữ liệu cảm biến

Luôn suy nghĩ kỹ trước khi thực hiện action. Nếu không chắc chắn, hỏi lại hoặc yêu cầu xác nhận.
Trả lời bằng tiếng Việt.`,
    ],
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools,
    prompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
    verbose: true,
  });

  return agentExecutor;
}

/**
 * Execute Agent Task
 */
export async function executeAgentTask(
  task: string,
  context?: any,
  sessionId: string = "default",
  userId?: string,
  ipAddress?: string
) {
  try {
    // Import utilities
    const { validateAndSanitizeTask } = await import("./security");
    const { checkRateLimit } = await import("./rate-limiter");
    const { getCache, setCache, generateCacheKey } = await import("./cache");
    const { addMessage, updateContext, getRecentMessages } = await import("./memory");
    const { logAction, checkPermission } = await import("./security");

    // Validate and sanitize task
    const validation = validateAndSanitizeTask(task);
    if (!validation.valid) {
      throw new Error(validation.error || "Invalid task");
    }
    const sanitizedTask = validation.sanitized || task;

    // Rate limiting
    const rateLimitKey = userId || sessionId;
    const rateLimit = checkRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      throw new Error(
        `Rate limit exceeded. Please wait ${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)} seconds.`
      );
    }

    // Check cache
    const cacheKey = generateCacheKey(sanitizedTask, context);
    const cached = getCache(cacheKey);
    if (cached) {
      addMessage(sessionId, "assistant", `[Cached] ${JSON.stringify(cached)}`);
      return { output: cached, fromCache: true };
    }

    // Update context in memory
    if (context) {
      updateContext(sessionId, context);
    }

    // Add recent messages for context
    const recentMessages = getRecentMessages(sessionId, 5);
    const contextWithHistory = {
      ...context,
      recentMessages: recentMessages.map(m => ({ role: m.role, content: m.content })),
    };

    // Add user message to memory
    addMessage(sessionId, "user", sanitizedTask, { userId, ipAddress });

    // Create agent
    const agent = await createAgent(sessionId);

    // Add context to task
    let fullTask = sanitizedTask;
    if (contextWithHistory) {
      fullTask = `${sanitizedTask}\n\nContext: ${JSON.stringify(contextWithHistory, null, 2)}`;
    }

    // Execute agent
    const result = await agent.invoke({
      input: fullTask,
    });

    // Add assistant message to memory
    addMessage(sessionId, "assistant", result.output || JSON.stringify(result), { userId });

    // Cache result (only if successful)
    if (result.output) {
      setCache(cacheKey, result.output, 5 * 60 * 1000); // 5 minutes
    }

    // Log action
    await logAction({
      sessionId,
      userId,
      action: "execute_task",
      tool: "agent",
      params: { task: sanitizedTask.substring(0, 100) }, // Truncate for logging
      result: "success",
      timestamp: new Date(),
      ipAddress,
    });

    // Store in memory
    if (!agentMemory.has(sessionId)) {
      agentMemory.set(sessionId, []);
    }
    agentMemory.get(sessionId).push({
      task: sanitizedTask,
      result,
      timestamp: new Date().toISOString(),
    });

    return result;
  } catch (error: any) {
    console.error("Agent execution error:", error);

    // Log failed action
    const { logAction } = await import("./security");
    await logAction({
      sessionId,
      userId,
      action: "execute_task",
      tool: "agent",
      params: { task: task.substring(0, 100) },
      result: "failure",
      error: error.message,
      timestamp: new Date(),
      ipAddress,
    });

    throw error;
  }
}

/**
 * Get Agent Memory
 */
export function getAgentMemory(sessionId: string = "default") {
  return agentMemory.get(sessionId) || [];
}

