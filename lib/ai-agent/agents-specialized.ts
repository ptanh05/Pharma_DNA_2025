/**
 * Specialized AI Agents
 * Các agents chuyên biệt cho từng role/domain
 */

import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { pool } from "@/lib/db";
import { mintProductNFT, transferProductNFT, getRole, Role } from "@/lib/blockchain/contract";

/**
 * Manufacturing Agent
 * Chuyên về sản xuất: mint NFT, quản lý batches, quality control
 */
export async function createManufacturingAgent() {
  const llm = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
    temperature: 0.2, // Lower temperature for manufacturing precision
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const coreModule = await import("./core");
  const tools = [
    coreModule.mintNFTTool,
    coreModule.createMilestoneTool,
    coreModule.queryDatabaseTool,
  ];

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `Bạn là Manufacturing Agent chuyên về sản xuất dược phẩm trong hệ thống PharmaDNA.

Nhiệm vụ chính:
1. Mint NFT cho các lô thuốc mới
2. Quản lý batch numbers và expiry dates
3. Đảm bảo chất lượng sản phẩm
4. Tạo milestones cho quá trình sản xuất
5. Phối hợp với Distributor Agent khi cần

Bạn có kiến thức sâu về:
- Quy trình sản xuất dược phẩm
- GMP (Good Manufacturing Practice)
- Batch tracking và serialization
- Quality assurance

Luôn đảm bảo tính chính xác và tuân thủ quy định.`,
    ],
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const agent = await createOpenAIFunctionsAgent({ llm, tools, prompt });
  return new AgentExecutor({ agent, tools, verbose: true });
}

/**
 * Distribution Agent
 * Chuyên về phân phối: logistics, routing, milestones
 */
export async function createDistributionAgent() {
  const llm = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
    temperature: 0.3,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const coreModule = await import("./core");
  const advancedModule = await import("./tools-advanced");
  const tools = [
    coreModule.transferNFTTool,
    coreModule.createMilestoneTool,
    coreModule.analyzeSensorDataTool,
    advancedModule.optimizeRouteTool,
  ];

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `Bạn là Distribution Agent chuyên về logistics và phân phối trong hệ thống PharmaDNA.

Nhiệm vụ chính:
1. Quản lý vận chuyển NFT từ manufacturer đến pharmacy
2. Tối ưu hóa routes và logistics
3. Tạo milestones cho quá trình vận chuyển
4. Phân tích sensor data (temperature, humidity, GPS)
5. Đảm bảo điều kiện bảo quản trong quá trình vận chuyển
6. Phối hợp với Pharmacy Agent khi giao hàng

Bạn có kiến thức về:
- Logistics và supply chain management
- Cold chain management
- Route optimization
- Real-time tracking

Luôn ưu tiên an toàn và chất lượng sản phẩm trong quá trình vận chuyển.`,
    ],
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const agent = await createOpenAIFunctionsAgent({ llm, tools, prompt });
  return new AgentExecutor({ agent, tools, verbose: true });
}

/**
 * Pharmacy Agent
 * Chuyên về nhà thuốc: nhận hàng, inventory, customer service
 */
export async function createPharmacyAgent() {
  const llm = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
    temperature: 0.3,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const coreModule = await import("./core");
  const toolsModule = await import("./tools");
  const tools = [
    coreModule.createMilestoneTool,
    coreModule.queryDatabaseTool,
    coreModule.sendNotificationTool,
    toolsModule.autoApproveTransferRequestsTool,
  ];

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `Bạn là Pharmacy Agent chuyên về quản lý nhà thuốc trong hệ thống PharmaDNA.

Nhiệm vụ chính:
1. Nhận và xác nhận NFT từ distributor
2. Quản lý inventory và stock
3. Kiểm tra expiry dates
4. Xử lý transfer requests
5. Tạo milestones khi nhận hàng
6. Phục vụ khách hàng và tra cứu nguồn gốc

Bạn có kiến thức về:
- Pharmacy operations
- Inventory management
- Customer service
- Regulatory compliance

Luôn đảm bảo chất lượng và an toàn cho người tiêu dùng.`,
    ],
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const agent = await createOpenAIFunctionsAgent({ llm, tools, prompt });
  return new AgentExecutor({ agent, tools, verbose: true });
}

/**
 * Quality Assurance Agent
 * Chuyên về quality control và compliance
 */
export async function createQualityAgent() {
  const llm = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
    temperature: 0.1, // Very low temperature for precision
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const coreModule = await import("./core");
  const advancedModule = await import("./tools-advanced");
  const smartModule = await import("./tools-smart");
  const tools = [
    coreModule.queryDatabaseTool,
    coreModule.analyzeSensorDataTool,
    advancedModule.predictQualityTool,
    advancedModule.detectFraudTool,
    smartModule.intelligentMonitoringTool,
  ];

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `Bạn là Quality Assurance Agent chuyên về kiểm soát chất lượng và compliance trong hệ thống PharmaDNA.

Nhiệm vụ chính:
1. Phân tích và dự đoán chất lượng sản phẩm
2. Phát hiện gian lận và bất thường
3. Giám sát compliance với quy định
4. Phân tích sensor data để phát hiện vấn đề
5. Tạo quality alerts khi cần
6. Đề xuất cải thiện chất lượng

Bạn có kiến thức sâu về:
- Quality control và assurance
- Regulatory compliance (FDA, EMA, etc.)
- Statistical process control
- Risk assessment

Luôn đảm bảo tuân thủ nghiêm ngặt các tiêu chuẩn chất lượng.`,
    ],
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const agent = await createOpenAIFunctionsAgent({ llm, tools, prompt });
  return new AgentExecutor({ agent, tools, verbose: true });
}

/**
 * Admin Agent
 * Chuyên về quản trị hệ thống
 */
export async function createAdminAgent() {
  const llm = new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
    temperature: 0.2,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const coreModule = await import("./core");
  const toolsModule = await import("./tools");
  const smartModule = await import("./tools-smart");
  const tools = [
    coreModule.queryDatabaseTool,
    coreModule.sendNotificationTool,
    toolsModule.generateReportTool,
    toolsModule.checkSystemHealthTool,
    smartModule.autoRecoveryTool,
    smartModule.intelligentMonitoringTool,
  ];

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `Bạn là Admin Agent chuyên về quản trị hệ thống PharmaDNA.

Nhiệm vụ chính:
1. Giám sát toàn bộ hệ thống
2. Tạo báo cáo và analytics
3. Phục hồi từ lỗi tự động
4. Quản lý users và roles
5. Tối ưu hóa performance
6. Đảm bảo security và compliance

Bạn có quyền truy cập đầy đủ và có thể điều phối các agents khác khi cần.`,
    ],
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const agent = await createOpenAIFunctionsAgent({ llm, tools, prompt });
  return new AgentExecutor({ agent, tools, verbose: true });
}

/**
 * Get specialized agent by role
 */
export async function getSpecializedAgent(role: "manufacturer" | "distributor" | "pharmacy" | "admin" | "quality") {
  switch (role) {
    case "manufacturer":
      return await createManufacturingAgent();
    case "distributor":
      return await createDistributionAgent();
    case "pharmacy":
      return await createPharmacyAgent();
    case "admin":
      return await createAdminAgent();
    case "quality":
      return await createQualityAgent();
    default:
      throw new Error(`Unknown role: ${role}`);
  }
}

