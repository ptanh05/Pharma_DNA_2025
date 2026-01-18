import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { transferProductNFT, getProductNFTData } from "@/lib/blockchain/contract";
import { parseSuiError, getSuiErrorHints } from "@/lib/blockchain/errors-sui";
import { getExplorerTxUrl } from "@/lib/blockchain/contract";
import { createTransferRequestSchema, updateTransferRequestSchema, suiAddressSchema } from "@/lib/validation/schemas";
import { validateAndSanitizeRequest, validationErrorResponse, sanitizeAddress } from "@/lib/validation/middleware";
import { emitTransferRequestCreated, emitTransferRequestUpdated } from "@/lib/socket/events";
import { withRateLimit, rateLimitConfigs } from "@/lib/middleware/rate-limit-wrapper";

// FIXED: Force dynamic rendering to prevent SSG/prerender
export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const DISTRIBUTOR_PRIVATE_KEY = process.env.DISTRIBUTOR_PRIVATE_KEY;

// GET - Lấy danh sách yêu cầu chuyển lô từ distributor sang pharmacy
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const distributor_address = searchParams.get('distributor_address');
    const pharmacy_address = searchParams.get('pharmacy_address');
    const status = searchParams.get('status');

    let query = 'SELECT * FROM transfer_requests WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (distributor_address) {
      paramCount++;
      query += ` AND distributor_address = $${paramCount}`;
      params.push(distributor_address.toLowerCase());
    }

    if (pharmacy_address) {
      paramCount++;
      query += ` AND pharmacy_address = $${paramCount}`;
      params.push(pharmacy_address.toLowerCase());
    }

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const { rows } = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Error fetching transfer requests:', error);
    return NextResponse.json({ error: 'Failed to fetch transfer requests' }, { status: 500 });
  }
}

// POST - Tạo yêu cầu chuyển lô từ distributor sang pharmacy
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate request body
    const validation = validateAndSanitizeRequest(createTransferRequestSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }

    const { nft_id, pharmacy_address, transfer_note } = validation.data;

    // Lấy thông tin distributor từ header hoặc session
    const distributor_address = req.headers.get('x-distributor-address');
    if (!distributor_address) {
      return NextResponse.json({ error: 'Distributor address required' }, { status: 400 });
    }

    // Validate distributor address format
    const distributorValidation = suiAddressSchema.safeParse(sanitizeAddress(distributor_address));
    if (!distributorValidation.success) {
      return NextResponse.json({ 
        error: 'Distributor address không hợp lệ',
        details: distributorValidation.error.errors 
      }, { status: 400 });
    }

    // Tạo yêu cầu chuyển lô
    const { rows } = await pool.query(
      `INSERT INTO transfer_requests (nft_id, distributor_address, pharmacy_address, transfer_note, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW())
       RETURNING *`,
      [
        typeof nft_id === 'number' ? nft_id : parseInt(String(nft_id), 10),
        distributorValidation.data.toLowerCase(),
        validation.data.pharmacy_address.toLowerCase(),
        transfer_note || ''
      ]
    );

    const newRequest = rows[0];

    // Emit socket event for real-time update
    try {
      emitTransferRequestCreated({
        requestId: newRequest.id,
        nftId: newRequest.nft_id,
        distributorAddress: newRequest.distributor_address,
        pharmacyAddress: newRequest.pharmacy_address,
        status: newRequest.status,
      });
    } catch (socketError) {
      // Don't fail the request if socket emit fails
      console.error("Failed to emit socket event:", socketError);
    }

    return NextResponse.json({ 
      ...newRequest, 
      message: `Yêu cầu chuyển lô NFT #${nft_id} đã được tạo thành công! Đang chờ nhà thuốc xác nhận.` 
    });
  } catch (error: any) {
    console.error('Error creating transfer request:', error);
    return NextResponse.json({ error: 'Failed to create transfer request' }, { status: 500 });
  }
}

// PUT - Cập nhật trạng thái yêu cầu chuyển lô (pharmacy accept/reject)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate request body
    const validation = validateAndSanitizeRequest(updateTransferRequestSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.details);
    }

    const { request_id, status, pharmacy_address } = validation.data;

    // Additional check: status must be approved or rejected for PUT
    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ 
        error: 'Invalid status. Chỉ chấp nhận: approved, rejected' 
      }, { status: 400 });
    }

    // Cập nhật trạng thái
    const { rows } = await pool.query(
      `UPDATE transfer_requests 
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND pharmacy_address = $3
       RETURNING *`,
      [status, request_id, pharmacy_address.toLowerCase()]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Transfer request not found' }, { status: 404 });
    }

    // Nếu được approve, chuyển quyền sở hữu NFT trên blockchain
    if (status === 'approved') {
      try {
        const request = rows[0];
        // For Sui, nft_id can be objectId (string) or token_id (number from DB)
        // Check if it's a Sui object ID (starts with 0x) or a number
        const nftIdentifier = request.nft_id || request.object_id;
        const pharmacyAddress = request.pharmacy_address;

        if (!nftIdentifier) {
          throw new Error(`Invalid NFT identifier: missing nft_id or object_id`);
        }

        // Check if distributor has the NFT
        const productData = await getProductNFTData(nftIdentifier);
        if (productData.owner.toLowerCase() !== request.distributor_address.toLowerCase()) {
          throw new Error(`Distributor ${request.distributor_address} does not own token ${nftIdentifier}`);
        }

        // Check if product is expired
        if (productData.isExpired) {
          throw new Error(`Product NFT ${nftIdentifier} has expired and cannot be transferred`);
        }

        // Transfer NFT - Note: This requires distributor's private key
        // In production, distributor should sign the transaction from frontend
        // For now, we use DISTRIBUTOR_PRIVATE_KEY from env (if available)
        if (!DISTRIBUTOR_PRIVATE_KEY) {
          // If no private key, return success but note that transfer needs to be done manually
          return NextResponse.json({ 
            ...rows[0], 
            message: `✅ Đã duyệt yêu cầu. Lưu ý: Cần distributor ký transaction để chuyển NFT trên blockchain.`,
            warning: "NFT transfer requires distributor signature"
          });
        }

        // For Sui, nftIdentifier is actually objectId (string)
        const objectId = typeof nftIdentifier === 'string' ? nftIdentifier : String(nftIdentifier);
        
        const txResult = await transferProductNFT(
          objectId,
          pharmacyAddress,
          DISTRIBUTOR_PRIVATE_KEY
        );

        if (!txResult.success) {
          throw new Error(txResult.error || "Failed to transfer NFT");
        }

        const updatedRequest = rows[0];

        // Emit socket event for real-time update
        try {
          emitTransferRequestUpdated({
            requestId: updatedRequest.id,
            nftId: updatedRequest.nft_id,
            distributorAddress: updatedRequest.distributor_address,
            pharmacyAddress: updatedRequest.pharmacy_address,
            status: updatedRequest.status,
            updatedAt: updatedRequest.updated_at,
          });
        } catch (socketError) {
          console.error("Failed to emit socket event:", socketError);
        }

        return NextResponse.json({ 
          ...updatedRequest, 
          message: `✅ Đã duyệt yêu cầu chuyển lô NFT ${objectId} thành công! NFT đã được chuyển quyền sở hữu.`,
          transactionHash: txResult.digest,
          transactionDigest: txResult.digest,
          explorerUrl: getExplorerTxUrl(txResult.digest),
          checkpoint: txResult.checkpoint,
        });

      } catch (blockchainError: any) {
        const error = parseSuiError(blockchainError);
        console.error('Blockchain transfer error:', error);
        
        // Rollback database update
        await pool.query(
          `UPDATE transfer_requests SET status = 'pending', updated_at = NOW() WHERE id = $1`,
          [request_id]
        );
        
        const hints = getSuiErrorHints(blockchainError);
        
        return NextResponse.json({ 
          error: 'Failed to transfer NFT on blockchain',
          detail: error,
          hints: [
            "Kiểm tra distributor có sở hữu NFT không",
            "Kiểm tra NFT có bị expired không",
            "Kiểm tra pharmacy address có đúng role không",
            "Kiểm tra SUI balance và gas",
            ...hints,
          ]
        }, { status: 500 });
      }
    }

    // FIXED: TypeScript type narrowing - status is already validated as 'approved' | 'rejected' above
    const isApproved = status === 'approved';
    return NextResponse.json({ 
      ...rows[0], 
      message: isApproved
        ? `✅ Đã duyệt yêu cầu chuyển lô NFT #${rows[0].nft_id} thành công! NFT đã được chuyển quyền sở hữu.`
        : `❌ Đã từ chối yêu cầu chuyển lô NFT #${rows[0].nft_id}.`
    });
  } catch (error: any) {
    console.error('Error updating transfer request:', error);
    return NextResponse.json({ error: 'Failed to update transfer request' }, { status: 500 });
  }
}

// DELETE - Hủy yêu cầu chuyển lô (chỉ distributor có thể hủy)
export async function DELETE(req: NextRequest) {
  try {
    const { request_id } = await req.json();
    const distributor_address = req.headers.get('x-distributor-address');

    if (!request_id || !distributor_address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { rows } = await pool.query(
      `DELETE FROM transfer_requests 
       WHERE id = $1 AND distributor_address = $2 AND status = 'pending'
       RETURNING *`,
      [request_id, distributor_address.toLowerCase()]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Transfer request not found or cannot be cancelled' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `✅ Đã hủy yêu cầu chuyển lô NFT #${rows[0].nft_id} thành công!` 
    });
  } catch (error: any) {
    console.error('Error cancelling transfer request:', error);
    return NextResponse.json({ error: 'Failed to cancel transfer request' }, { status: 500 });
  }
}
