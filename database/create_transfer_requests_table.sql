-- Tạo bảng lưu trữ yêu cầu chuyển lô từ distributor sang pharmacy
CREATE TABLE IF NOT EXISTS transfer_requests (
    id SERIAL PRIMARY KEY,
    nft_id INTEGER NOT NULL,
    distributor_address VARCHAR(42) NOT NULL,
    pharmacy_address VARCHAR(42) NOT NULL,
    transfer_note TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, rejected, cancelled
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tạo index để tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_transfer_requests_distributor ON transfer_requests(distributor_address);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_pharmacy ON transfer_requests(pharmacy_address);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_nft_id ON transfer_requests(nft_id);

-- Thêm comment cho bảng
COMMENT ON TABLE transfer_requests IS 'Bảng lưu trữ yêu cầu chuyển lô thuốc từ nhà phân phối sang nhà thuốc';
COMMENT ON COLUMN transfer_requests.nft_id IS 'ID của NFT thuốc cần chuyển';
COMMENT ON COLUMN transfer_requests.distributor_address IS 'Địa chỉ ví của nhà phân phối';
COMMENT ON COLUMN transfer_requests.pharmacy_address IS 'Địa chỉ ví của nhà thuốc';
COMMENT ON COLUMN transfer_requests.transfer_note IS 'Ghi chú khi chuyển lô';
COMMENT ON COLUMN transfer_requests.status IS 'Trạng thái: pending, approved, rejected, cancelled';
