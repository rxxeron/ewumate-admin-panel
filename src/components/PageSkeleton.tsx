import React from 'react';
import { Skeleton } from './Skeleton';

export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header bar placeholder */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <Skeleton className="w-48 h-8 rounded-lg" />
          <Skeleton className="w-72 h-4 rounded-md" />
        </div>
        <Skeleton className="w-32 h-9 rounded-lg" />
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-5 bg-card border border-border rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <Skeleton className="w-20 h-4 rounded" />
              <Skeleton className="w-7 h-7 rounded-lg" />
            </div>
            <Skeleton className="w-28 h-7 rounded" />
            <Skeleton className="w-36 h-3 rounded" />
          </div>
        ))}
      </div>

      {/* Main Table / Data Area */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="w-40 h-5 rounded" />
          <Skeleton className="w-24 h-8 rounded-lg" />
        </div>
        <div className="space-y-3 pt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="w-full h-12 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
