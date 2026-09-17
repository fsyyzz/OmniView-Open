/**
 * OmniView EPUB 出版元数据详情抽屉 (EpubInfoModal)
 */
import React from 'react';
import { X } from 'lucide-react';
import { type ParsedEpubBook } from '../../../lib/epubEngine';

export interface EpubInfoModalProps {
  showInfo: boolean;
  book: ParsedEpubBook | null;
  fileSize?: number;
  themeStyles: {
    paper: string;
    border: string;
  };
  onClose: () => void;
}

export const EpubInfoModal: React.FC<EpubInfoModalProps> = ({
  showInfo,
  book,
  fileSize,
  themeStyles,
  onClose,
}) => {
  if (!showInfo) return null;

  return (
    <aside
      className="absolute right-0 top-0 bottom-0 w-80 border-l p-4 flex flex-col z-20 shadow-2xl overflow-y-auto"
      style={{
        background: themeStyles.paper,
        borderColor: themeStyles.border,
      }}
    >
      <div className="flex items-center justify-between pb-3 border-b mb-4" style={{ borderColor: themeStyles.border }}>
        <h3 className="text-xs font-bold uppercase tracking-wider">电子书出版元数据</h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {book?.metadata?.coverDataUrl && (
        <div className="mb-4 flex justify-center">
          <img
            src={book.metadata.coverDataUrl}
            alt="Book Cover"
            className="max-h-48 rounded shadow-lg object-contain border"
            style={{ borderColor: themeStyles.border }}
          />
        </div>
      )}

      <div className="space-y-3 text-xs">
        <div>
          <span className="text-[10px] font-mono opacity-50 block uppercase">书名 / Title</span>
          <p className="font-semibold text-sm">{book?.metadata?.title || '未知'}</p>
        </div>

        <div>
          <span className="text-[10px] font-mono opacity-50 block uppercase">作者 / Creator</span>
          <p>{book?.metadata?.creator || '未记录'}</p>
        </div>

        <div>
          <span className="text-[10px] font-mono opacity-50 block uppercase">出版社 / Publisher</span>
          <p>{book?.metadata?.publisher || '未记录'}</p>
        </div>

        <div>
          <span className="text-[10px] font-mono opacity-50 block uppercase">语言 / Language</span>
          <p className="font-mono">{book?.metadata?.language || 'und'}</p>
        </div>

        {book?.metadata?.description && (
          <div>
            <span className="text-[10px] font-mono opacity-50 block uppercase">内容简介 / Description</span>
            <p className="opacity-80 text-[11px] leading-relaxed mt-1 max-h-40 overflow-y-auto">
              {book.metadata.description}
            </p>
          </div>
        )}

        <div className="pt-4 border-t space-y-1 font-mono text-[10px] opacity-50" style={{ borderColor: themeStyles.border }}>
          <div>总章节数: {book?.chapters.length || 0}</div>
          <div>目录索引条目: {book?.toc.length || 0}</div>
          <div>文件大小: {fileSize ? `${(fileSize / 1024).toFixed(1)} KB` : '标准 EPUB 载荷'}</div>
        </div>
      </div>
    </aside>
  );
};
