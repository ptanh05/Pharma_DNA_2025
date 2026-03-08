import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Loading Skeleton for Lookup Page
 */
export default function LookupLoading() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Search Header */}
      <div className="text-center space-y-4">
        <Skeleton className="h-9 w-64 mx-auto" />
        <Skeleton className="h-5 w-96 mx-auto" />
        <Skeleton className="h-12 w-full max-w-md mx-auto" />
      </div>

      {/* Results */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
