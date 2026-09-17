import React from 'react';

export interface ExternalBadgePillProps {
  externalFile?: string;
}

export const ExternalBadgePill: React.FC<ExternalBadgePillProps> = ({ externalFile }) => {
  if (!externalFile) return null;

  return (
    <div
      className="ov-external-badge-wrapper"
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
      <span className="ov-external-diagram-badge-pill">
        📌 外部挂载文件: <code>{externalFile}</code>
      </span>
    </div>
  );
};
