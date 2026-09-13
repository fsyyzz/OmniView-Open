import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, Cpu, HardDrive } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  status: 'healthy' | 'warning' | 'critical';
}

export const TelemetryCard: React.FC<MetricCardProps> = ({ title, value, unit, status }) => {
  const statusColor = {
    healthy: 'text-emerald-500 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800',
    warning: 'text-amber-500 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800',
    critical: 'text-rose-500 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800',
  }[status];

  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor}`}>
          {status}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">{value}</span>
        {unit && <span className="text-xs text-slate-500 dark:text-slate-400">{unit}</span>}
      </div>
    </div>
  );
};
