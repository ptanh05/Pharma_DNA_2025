import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Loading Skeleton for Public Page
 */
export default function PublicLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="max-w-7xl mx-auto p-6">
        <Skeleton className="h-12 w-64 mb-4" />
        <Skeleton className="h-6 w-96 mb-8" />

        {/* Search Section */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-72 mx-auto mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-12 w-full max-w-md mx-auto" />
          </CardContent>
        </Card>

        {/* Recent Searches */}
        <div className="mt-8">
          <Skeleton className="h-6 w-40 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
