import React from 'react';
import { GitBranch, ShieldCheck, Zap, Heart, CheckCircle2 } from 'lucide-react';
import { DriverId } from '../../../shared/types';

interface StatusBarProps {
  activeDriverId: DriverId;
  fileName?: string;
  fileSize?: number;
  lineCount?: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  activeDriverId,
  fileName,
  fileSize = 0,
  lineCount = 0,
}) => {
  const getDriverLabel = () => {
    switch (activeDriverId) {
      case 'markdown':
        return 'Driver: Markdown + Mermaid 10+ + PlantUML';
      case 'svg':
        return 'Driver: SVG Vector Inspector';
      case 'pdf':
        return 'Driver: Mozilla PDF.js Reader';
      case 'plantuml':
        return 'Driver: PlantUML Vector Pipeline';
      case 'mindmap':
        return 'Driver: Markmap Vector Studio';
      case 'csv':
        return 'Driver: Virtual Data Grid';
      default:
        return 'Driver: Universal Code Highlight';
    }
  };

  return (
    <footer id="workbench-statusbar" className="h-6 bg-slate-950 border-t border-slate-800 flex items-center justify-between px-3 text-[11px] font-mono text-slate-400 select-none shrink-0 z-20">
      {/* Left items */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer transition">
          <GitBranch className="w-3 h-3 text-blue-400" />
          <span>main</span>
        </div>

        <div className="flex items-center gap-1 text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          <span>{getDriverLabel()}</span>
        </div>
      </div>

      {/* Right items */}
      <div className="flex items-center gap-4">
        {fileName && (
          <span className="text-slate-400 hidden sm:inline">
            大小: {Math.round(fileSize / 1024 * 10) / 10} KB {lineCount > 0 ? `· 行数: ${lineCount}` : ''}
          </span>
        )}

        <span className="text-slate-400">UTF-8</span>

        <div className="flex items-center gap-1 text-cyan-400 hidden md:flex">
          <ShieldCheck className="w-3 h-3" />
          <span>CSP 安全沙箱</span>
        </div>

        <div className="flex items-center gap-1 text-pink-400 font-semibold">
          <Heart className="w-3 h-3 fill-pink-500/20" />
          <span>100% 永久免费开源</span>
        </div>
      </div>
    </footer>
  );
};
