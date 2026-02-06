export default function PublicLookupPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-6">
            Pharma DNA - Public Lookup
          </h1>
          <div className="bg-white rounded-lg shadow-md p-6">
            <input
              type="text"
              placeholder="Nhập batch number hoặc NFT ID..."
              className="w-full p-3 border rounded-lg mb-4"
            />
            <button className="w-full bg-indigo-600 text-white py-3 rounded-lg">
              Tra Cứu
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
