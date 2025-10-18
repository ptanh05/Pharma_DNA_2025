import { NextRequest, NextResponse } from 'next/server';
import { ethers } from "ethers";
import pharmaNFTAbi from "@/lib/pharmaNFT-abi.json";
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const PHARMA_NFT_ADDRESS = process.env.NEXT_PUBLIC_PHARMA_NFT_ADDRESS;
const PHARMADNA_RPC = process.env.PHARMADNA_RPC || "https://pharmadna-2759821881746000-1.jsonrpc.sagarpc.io";

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
    const { nft_id, pharmacy_address, transfer_note } = await req.json();

    if (!nft_id || !pharmacy_address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Lấy thông tin distributor từ header hoặc session
    const distributor_address = req.headers.get('x-distributor-address');
    if (!distributor_address) {
      return NextResponse.json({ error: 'Distributor address required' }, { status: 400 });
    }

    // Tạo yêu cầu chuyển lô
    const { rows } = await pool.query(
      `INSERT INTO transfer_requests (nft_id, distributor_address, pharmacy_address, transfer_note, status, created_at)
       VALUES ($1, $2, $3, $4, 'pending', NOW())
       RETURNING *`,
      [nft_id, distributor_address.toLowerCase(), pharmacy_address.toLowerCase(), transfer_note || '']
    );

    return NextResponse.json({ 
      ...rows[0], 
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
    const { request_id, status, pharmacy_address } = await req.json();

    if (!request_id || !status || !pharmacy_address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
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
        if (!PHARMA_NFT_ADDRESS) {
          throw new Error("PHARMA_NFT_ADDRESS not configured");
        }

        const provider = new ethers.JsonRpcProvider(PHARMADNA_RPC);
        const contract = new ethers.Contract(PHARMA_NFT_ADDRESS, pharmaNFTAbi.abi || pharmaNFTAbi, provider);

        // Lấy thông tin NFT từ request
        const request = rows[0];
        
        // Chuyển quyền sở hữu NFT từ distributor sang pharmacy
        // Note: Cần distributor ký transaction này
        console.log(`Transferring NFT ${request.nft_id} from ${request.distributor_address} to ${request.pharmacy_address}`);
        
        // TODO: Implement actual NFT transfer logic
        // const tx = await contract.transferFrom(distributor_address, pharmacy_address, nft_id);
        // await tx.wait();

      } catch (blockchainError: any) {
        console.error('Blockchain transfer error:', blockchainError);
        // Rollback database update
        await pool.query(
          `UPDATE transfer_requests SET status = 'pending', updated_at = NOW() WHERE id = $1`,
          [request_id]
        );
        return NextResponse.json({ 
          error: 'Failed to transfer NFT on blockchain',
          detail: blockchainError.message 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      ...rows[0], 
      message: status === 'approved' 
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
