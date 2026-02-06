"use client";

export default function MilestoneTimeline({ milestones }: { milestones: any[] }) {
  return (
    <div className="bg-white border rounded-lg shadow-md p-6">
      <h3 className="text-xl font-bold mb-4">Lịch Sử Chuỗi Cung Ứng</h3>
      
      <div className="space-y-4">
        {milestones.map((m, index) => (
          <div key={index} className="relative pl-6 pb-4 border-l-2 border-blue-200">
            <div className="absolute left-[-8px] top-0 w-4 h-4 bg-blue-600 rounded-full"></div>
            <div className="ml-2">
              <p className="font-semibold text-blue-600">{m.type}</p>
              <p className="text-gray-600 text-sm">{m.description}</p>
              <p className="text-gray-400 text-xs mt-1">
                {new Date(m.timestamp).toLocaleString('vi-VN')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
