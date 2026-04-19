/**
 * Event System for Webhooks and WebSocket
 * Trigger events khi có actions
 */

import { triggerWebhook } from "./webhooks";
import { emitNFTUpdate, emitWorkflowUpdate, emitSystemAlert, broadcast } from "./websocket";
import { logger } from "@/lib/utils/logger";

/**
 * Trigger NFT minted event
 */
export async function triggerNFTMintedEvent(nftData: any): Promise<void> {
  try {
    // Trigger webhook
    await triggerWebhook("nft.minted", {
      event: "nft.minted",
      nft: nftData,
      timestamp: new Date().toISOString(),
    });

    // Emit WebSocket
    if (nftData.id) {
      emitNFTUpdate(nftData.id, {
        event: "minted",
        nft: nftData,
      });
    }
  } catch (error) {
    logger.error("AI_EVENTS", "Error triggering NFT minted event", error as Error);
  }
}

/**
 * Trigger NFT transferred event
 */
export async function triggerNFTTransferredEvent(nftData: any, from: string, to: string): Promise<void> {
  try {
    await triggerWebhook("nft.transferred", {
      event: "nft.transferred",
      nft: nftData,
      from,
      to,
      timestamp: new Date().toISOString(),
    });

    if (nftData.id) {
      emitNFTUpdate(nftData.id, {
        event: "transferred",
        nft: nftData,
        from,
        to,
      });
    }
  } catch (error) {
    logger.error("AI_EVENTS", "Error triggering NFT transferred event", error as Error);
  }
}

/**
 * Trigger workflow completed event
 */
export async function triggerWorkflowCompletedEvent(workflowId: number, result: any): Promise<void> {
  try {
    await triggerWebhook("workflow.completed", {
      event: "workflow.completed",
      workflowId,
      result,
      timestamp: new Date().toISOString(),
    });

    emitWorkflowUpdate(workflowId, {
      event: "completed",
      result,
    });
  } catch (error) {
    logger.error("AI_EVENTS", "Error triggering workflow completed event", error as Error);
  }
}

/**
 * Trigger workflow failed event
 */
export async function triggerWorkflowFailedEvent(workflowId: number, error: string): Promise<void> {
  try {
    await triggerWebhook("workflow.failed", {
      event: "workflow.failed",
      workflowId,
      error,
      timestamp: new Date().toISOString(),
    });

    emitWorkflowUpdate(workflowId, {
      event: "failed",
      error,
    });
  } catch (error) {
    logger.error("AI_EVENTS", "Error triggering workflow failed event", error as Error);
  }
}

/**
 * Trigger quality alert event
 */
export async function triggerQualityAlertEvent(alertData: any): Promise<void> {
  try {
    await triggerWebhook("quality.alert", {
      event: "quality.alert",
      alert: alertData,
      timestamp: new Date().toISOString(),
    });

    emitSystemAlert({
      type: alertData.severity === "critical" ? "error" : "warning",
      title: "Quality Alert",
      message: alertData.message || "Quality issue detected",
    });
  } catch (error) {
    logger.error("AI_EVENTS", "Error triggering quality alert event", error as Error);
  }
}

/**
 * Trigger fraud detected event
 */
export async function triggerFraudDetectedEvent(fraudData: any): Promise<void> {
  try {
    await triggerWebhook("fraud.detected", {
      event: "fraud.detected",
      fraud: fraudData,
      timestamp: new Date().toISOString(),
    });

    emitSystemAlert({
      type: "error",
      title: "Fraud Detected",
      message: `Fraud detected: ${fraudData.message || "Suspicious activity"}`,
      role: "admin",
    });
  } catch (error) {
    logger.error("AI_EVENTS", "Error triggering fraud detected event", error as Error);
  }
}

/**
 * Trigger milestone created event
 */
export async function triggerMilestoneCreatedEvent(milestoneData: any): Promise<void> {
  try {
    await triggerWebhook("milestone.created", {
      event: "milestone.created",
      milestone: milestoneData,
      timestamp: new Date().toISOString(),
    });

    if (milestoneData.nft_id) {
      emitNFTUpdate(milestoneData.nft_id, {
        event: "milestone_created",
        milestone: milestoneData,
      });
    }
  } catch (error) {
    logger.error("AI_EVENTS", "Error triggering milestone created event", error as Error);
  }
}

/**
 * Trigger system health alert
 */
export async function triggerSystemHealthAlert(healthData: any): Promise<void> {
  try {
    await triggerWebhook("system.health", {
      event: "system.health",
      health: healthData,
      timestamp: new Date().toISOString(),
    });

    broadcast("system-health", healthData);
  } catch (error) {
    logger.error("AI_EVENTS", "Error triggering system health alert", error as Error);
  }
}

