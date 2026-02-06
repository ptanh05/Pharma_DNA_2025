"use client";

import { useState } from "react";

export default function ConsumerLookup() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/public/lookup?batch=${query}`);
      const data = await response.json();
      setResult(data);
    } catch (error) {
      alert("Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nhập batch number hoặc QR code..."
          className="flex-1 p-3 border rounded-lg"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg"
        >
          {loading ? "..." : "Tra Cứu"}
        </button>
      </div>

      {result && (
        <div className="mt-4 bg-white border rounded-lg p-4">
          {result.data?.found ? (
            <div>
              <h3 className="font-bold text-lg">{result.data.result.name}</h3>
              <p className="text-gray-600">Batch: {result.data.result.batch_number}</p>
              <p className="text-green-600">Đã xác thực</p>
            </div>
          ) : (
            <p className="text-red-500">Không tìm thấy</p>
          )}
        </div>
      )}
    </div>
  );
}