/**
 * Scheduled job để monitor hệ thống và tự động giải quyết vấn đề
 * Chạy mỗi giờ hoặc theo cron schedule
 */

import { pool } from "../lib/db";
import { executeAgentTask } from "../lib/ai-agent/core";

async function monitorSystem() {
  console.log("🔍 Bắt đầu monitor hệ thống...");

  try {
    // 1. Check NFTs stuck in transit
    const stuckNFTs = await pool.query(
      `SELECT n.*, MAX(m.timestamp) as last_milestone
       FROM nfts n
       LEFT JOIN milestones m ON n.id = m.nft_id
       WHERE n.status = 'in_transit'
       GROUP BY n.id
       HAVING MAX(m.timestamp) < NOW() - INTERVAL '7 days' OR MAX(m.timestamp) IS NULL`
    );

    if (stuckNFTs.rows.length > 0) {
      console.log(`⚠️ Phát hiện ${stuckNFTs.rows.length} NFT bị stuck`);
      
      for (const nft of stuckNFTs.rows) {
        const task = `NFT #${nft.id} (${nft.name}) đã bị stuck trong quá trình vận chuyển hơn 7 ngày. 
        Distributor: ${nft.distributor_address}. 
        Hãy gửi thông báo nhắc nhở cho distributor và tạo alert.`;

        try {
          await executeAgentTask(task, { nftId: nft.id });
          console.log(`✅ Đã xử lý NFT #${nft.id}`);
        } catch (error) {
          console.error(`❌ Lỗi khi xử lý NFT #${nft.id}:`, error);
        }
      }
    }

    // 2. Check expiring NFTs
    const expiringNFTs = await pool.query(
      `SELECT * FROM nfts 
       WHERE expiry_date < NOW() + INTERVAL '30 days' 
       AND expiry_date > NOW()
       AND status != 'delivered'`
    );

    if (expiringNFTs.rows.length > 0) {
      console.log(`⚠️ Phát hiện ${expiringNFTs.rows.length} NFT sắp hết hạn`);
      
      for (const nft of expiringNFTs.rows) {
        const task = `NFT #${nft.id} (${nft.name}) sẽ hết hạn vào ${nft.expiry_date}. 
        Hãy gửi cảnh báo cho tất cả stakeholders.`;

        try {
          await executeAgentTask(task, { nftId: nft.id });
        } catch (error) {
          console.error(`❌ Lỗi khi xử lý NFT #${nft.id}:`, error);
        }
      }
    }

    // 3. Check expiring transfer requests
    const expiringRequests = await pool.query(
      `SELECT * FROM transfer_requests_v2
       WHERE status = 'pending'
       AND expires_at < NOW() + INTERVAL '2 hours'
       AND expires_at > NOW()`
    );

    if (expiringRequests.rows.length > 0) {
      console.log(`⚠️ Phát hiện ${expiringRequests.rows.length} transfer request sắp hết hạn`);
      
      for (const req of expiringRequests.rows) {
        const task = `Transfer request #${req.id} sắp hết hạn. 
        NFT #${req.nft_id} từ ${req.distributor_address} đến ${req.pharmacy_address}. 
        Hãy gửi thông báo nhắc nhở cho pharmacy.`;

        try {
          await executeAgentTask(task, { requestId: req.id });
        } catch (error) {
          console.error(`❌ Lỗi khi xử lý request #${req.id}:`, error);
        }
      }
    }

    console.log("✅ Hoàn thành monitor hệ thống");
  } catch (error) {
    console.error("❌ Lỗi khi monitor hệ thống:", error);
  }
}

// Run if called directly
if (require.main === module) {
  monitorSystem()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default monitorSystem;

