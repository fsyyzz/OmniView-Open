/**
 * CSV 追加新数据列弹窗组件 (AddColumnModal)
 */
import React, { useState } from 'react';
import { Columns } from 'lucide-react';

export interface AddColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddColumn: (colName: string) => void;
  defaultIndex: number;
}

export const AddColumnModal: React.FC<AddColumnModalProps> = ({
  isOpen,
  onClose,
  onAddColumn,
  defaultIndex,
}) => {
  const [newColName, setNewColName] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onAddColumn(newColName);
    setNewColName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div
        style={{
          backgroundColor: 'var(--ov-surface)',
          borderColor: 'var(--ov-border)',
          color: 'var(--ov-text)',
          boxShadow: 'var(--ov-shadow)',
        }}
        className="border rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4"
        role="dialog"
        aria-label="追加新数据列"
      >
        <div
          style={{ borderBottomColor: 'var(--ov-border)' }}
          className="flex items-center justify-between border-b pb-2"
        >
          <h3 style={{ color: 'var(--ov-text)' }} className="text-sm font-semibold flex items-center gap-2">
            <Columns className="w-4 h-4 text-emerald-500" />
            <span>追加新数据列</span>
          </h3>
          <button
            onClick={onClose}
            style={{ color: 'var(--ov-text-muted)' }}
            className="hover:text-[var(--ov-text)] text-sm"
          >
            ✕
          </button>
        </div>
        <div>
          <label style={{ color: 'var(--ov-text-muted)' }} className="block text-xs mb-1.5">列名 (Column Name):</label>
          <input
            type="text"
            autoFocus
            value={newColName}
            onChange={e => setNewColName(e.target.value)}
            placeholder={`例如: Column_${defaultIndex + 1}`}
            onKeyDown={e => {
              if (e.key === 'Enter') handleConfirm();
              if (e.key === 'Escape') onClose();
            }}
            style={{
              backgroundColor: 'var(--ov-bg)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
            className="w-full px-3 py-1.5 border rounded-lg text-xs outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="px-3 py-1.5 rounded-lg text-xs border transition hover:text-[var(--ov-text)]"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            style={{ backgroundColor: 'var(--ov-accent)', color: '#ffffff' }}
            className="px-4 py-1.5 rounded-lg text-xs font-medium transition hover:opacity-90"
          >
            添加列
          </button>
        </div>
      </div>
    </div>
  );
};
