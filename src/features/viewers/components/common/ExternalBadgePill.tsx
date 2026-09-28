import React from 'react';

export interface ExternalBadgePillProps {
  externalFile?: string;
}

export const ExternalBadgePill: React.FC<ExternalBadgePillProps> = ({ externalFile }) => {
  if (!externalFile) return null;

  return (
    <div
      data-clipboard-ignore="true"
      className="ov-external-badge-wrapper ov-clipboard-ignore select-none"
      style={{
        position: 'absolute',
        bottom: '8px',
        right: '10px',
        zIndex: 60,
        padding: 0,
        margin: 0,
        minHeight: 0,
        height: 'auto',
      }}
    >
      <span
        data-clipboard-ignore="true"
        className="ov-external-diagram-badge-pill ov-clipboard-ignore select-none"
      >
        📌 外部挂载文件: <code>{externalFile}</code>
      </span>
    </div>
  );
};
