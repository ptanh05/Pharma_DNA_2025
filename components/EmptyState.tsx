"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  illustration?: React.ReactNode;
  className?: string;
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  illustration,
  className = "",
}: EmptyStateProps) {
  return (
    <Card className={`border-dashed ${className}`}>
      <CardContent className="flex flex-col items-center justify-center py-12 px-6">
        {illustration ? (
          illustration
        ) : (
          <Icon className="w-16 h-16 text-gray-300 mb-4 animate-float" />
        )}
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 text-center max-w-md mb-6">
          {description}
        </p>
        {action && (
          <Button onClick={action.onClick} variant="default">
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default memo(EmptyState)
