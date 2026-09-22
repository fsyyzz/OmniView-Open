/**
 * PlantUML 渲染服务器配置弹层组件 (PlantUmlServerModal)
 */
import React from 'react';
import { Server } from 'lucide-react';
import { PLANTUML_SERVER_PRESETS } from '../../../../../shared/lib/plantuml';

export interface PlantUmlServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverUrl: string;
  onSaveServer: (url: string) => void;
  customInput: string;
  setCustomInput: (url: string) => void;
}

export const PlantUmlServerModal: React.FC<PlantUmlServerModalProps> = ({
  isOpen,
  onClose,
  serverUrl,
  onSaveServer,
  customInput,
  setCustomInput,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        backgroundColor: 'var(--ov-surface)',
        borderColor: 'var(--ov-border)',
        color: 'var(--ov-text)',
        boxShadow: 'var(--ov-shadow)',
      }}
      className="absolute right-0 mt-2 w-80 border rounded-xl p-4 z-50 text-xs space-y-3"
      role="dialog"
      aria-label="PlantUML 服务器配置"
    >
      <div
        style={{ borderBottomColor: 'var(--ov-border)' }}
        className="flex items-center justify-between border-b pb-2"
      >
        <span className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--ov-text)' }}>
          <Server className="w-4 h-4 text-[var(--ov-accent)]" />
          PlantUML 服务器配置
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{ color: 'var(--ov-text-muted)' }}
          className="hover:text-[var(--ov-text)] transition"
          aria-label="关闭"
        >
          ✕
        </button>
      </div>
      <div className="space-y-2">
        <div style={{ color: 'var(--ov-text-muted)' }} className="text-[11px]">选择渲染服务器或连接内网本地容器：</div>
        {PLANTUML_SERVER_PRESETS.map(preset => (
          <button
            key={preset.id}
            type="button"
            onClick={() => {
              if (preset.url) {
                onSaveServer(preset.url);
              } else {
                setCustomInput(serverUrl);
              }
            }}
            style={
              serverUrl === preset.url
                ? { backgroundColor: 'var(--ov-accent-bg, rgba(99,102,241,0.15))', borderColor: 'var(--ov-accent)', color: 'var(--ov-accent)' }
                : { borderColor: 'var(--ov-border)', color: 'var(--ov-text-secondary)', backgroundColor: 'var(--ov-bg)' }
            }
            className="w-full text-left p-2 rounded-lg border transition hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))]"
          >
            <div className="font-medium text-xs">{preset.name}</div>
            {preset.url && <div style={{ color: 'var(--ov-text-muted)' }} className="text-[10px] truncate">{preset.url}</div>}
          </button>
        ))}
        <div className="pt-2">
          <label style={{ color: 'var(--ov-text-muted)' }} className="text-[11px] block mb-1">自定义私有服务器 URL：</label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              placeholder="http://localhost:8080"
              style={{
                backgroundColor: 'var(--ov-bg)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="flex-1 px-2.5 py-1 border rounded font-mono text-[11px] outline-none focus:border-[var(--ov-accent)]"
            />
            <button
              type="button"
              onClick={() => onSaveServer(customInput)}
              style={{ backgroundColor: 'var(--ov-accent)', color: '#ffffff' }}
              className="px-3 py-1 rounded text-xs font-medium transition hover:opacity-90"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
