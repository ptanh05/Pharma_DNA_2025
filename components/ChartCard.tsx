"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface ChartCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function ChartCard({ title, description, icon: Icon, children, className = "", noPadding = false }: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center text-base">
          {Icon && <Icon className="w-5 h-5 mr-2 text-blue-600" />}
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className={noPadding ? "p-0" : ""}>
        {children}
      </CardContent>
    </Card>
  );
}

export default ChartCard;
