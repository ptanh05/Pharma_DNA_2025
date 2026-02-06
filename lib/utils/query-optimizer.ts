/**
 * Query Optimization Utilities
 * lib/utils/query-optimizer.ts
 */

export const OPTIMIZED_QUERIES = {
  // Get NFT with all related data
  getNFTWithDetails: `
    SELECT n.*, 
           COUNT(m.id) as milestone_count,
           MAX(m.timestamp) as last_milestone
    FROM nfts n
    LEFT JOIN milestones m ON n.id = m.nft_id
    WHERE n.id = $1
    GROUP BY n.id
  `,

  // Get NFTs by status with pagination
  getNFTsByStatus: `
    SELECT n.id, n.batch_number, n.status, n.expiry_date
    FROM nfts n
    WHERE n.status = $1
    ORDER BY n.created_at DESC
    LIMIT $2 OFFSET $3
  `,

  // Get transfer requests with NFT info
  getTransferRequestsWithNFT: `
    SELECT tr.*, n.batch_number, n.name
    FROM transfer_requests_v2 tr
    JOIN nfts n ON tr.nft_id = n.id
    WHERE tr.status = $1
    ORDER BY tr.created_at DESC
    LIMIT $2 OFFSET $3
  `,

  // Get user role efficiently
  getUserRole: `
    SELECT role FROM users WHERE address = $1 LIMIT 1
  `,

  // Get audit logs with aggregation
  getAuditLogStats: `
    SELECT 
      DATE(timestamp) as date,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE result = 'success') as success,
      COUNT(*) FILTER (WHERE result = 'failure') as failure
    FROM agent_audit_logs
    WHERE timestamp >= NOW() - INTERVAL $1
    GROUP BY DATE(timestamp)
    ORDER BY date DESC
  `,
};

export function buildPaginationQuery(
  baseQuery: string,
  page: number,
  limit: number
): { query: string; params: any[] } {
  const offset = (page - 1) * limit;
  return {
    query: `${baseQuery}LIMIT $${1}OFFSET $${2}`,
    params: [limit, offset],
  };
}

