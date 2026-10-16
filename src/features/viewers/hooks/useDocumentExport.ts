import { useState, useCallback } from 'react';
import { exportToWordDocument, exportToPortableHtml, buildPortableHtml } from '../lib/exportEngine';
import { requestPrintHtml } from '../../../shared/lib/printBridge';
import { extractSectionContent, type MarkdownHeading } from '../lib/markdownAst';
import type { VsCodeApi } from '../../../shared/lib/vscode';

export interface UseDocumentExportOptions {
  fileName: string;
  documentContent: string;
  headings: MarkdownHeading[];
  activeHeadingIndex: number;
  getSearchCanvas: () => HTMLElement | null;
  scrollRef: React.RefObject<HTMLElement | null>;
  vscode?: VsCodeApi;
  setPrintEagerMount: (val: boolean) => void;
}

export function useDocumentExport({
  fileName,
  documentContent,
  headings,
  activeHeadingIndex,
  getSearchCanvas,
  scrollRef,
  vscode,
  setPrintEagerMount,
}: UseDocumentExportOptions) {
  const [copied, setCopied] = useState(false);
  const [copiedSection, setCopiedSection] = useState(false);
  const [copiedRich, setCopiedRich] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);

  const handleCopyRawMarkdown = async () => {
    await navigator.clipboard.writeText(documentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleCopyCurrentSection = async () => {
    const sectionText = extractSectionContent(documentContent, headings, activeHeadingIndex);
    await navigator.clipboard.writeText(sectionText);
    setCopiedSection(true);
    setTimeout(() => setCopiedSection(false), 1600);
  };

  const handleCopyRichText = async () => {
    const canvas = getSearchCanvas();
    if (!canvas) return;
    try {
      const html = canvas.innerHTML;
      const blob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([documentContent], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blob,
          'text/plain': textBlob,
        }),
      ]);
      setCopiedRich(true);
      setTimeout(() => setCopiedRich(false), 1600);
    } catch {
      await handleCopyRawMarkdown();
    }
  };

  const runWithEagerMount = useCallback(
    (action: () => void | Promise<void>) => {
      setPrintEagerMount(true);
      window.setTimeout(() => {
        void Promise.resolve()
          .then(action)
          .finally(() => setPrintEagerMount(false));
      }, 120);
    },
    [setPrintEagerMount]
  );

  const handleExportHtml = () => {
    runWithEagerMount(() => {
      const canvas = getSearchCanvas();
      if (!canvas) return;
      exportToPortableHtml(fileName, canvas);
    });
  };

  const handlePrint = () => {
    if (vscode) {
      runWithEagerMount(() => {
        const canvas = getSearchCanvas() || (scrollRef.current as HTMLElement | null);
        if (!canvas) {
          void requestPrintHtml(fileName, '<!DOCTYPE html><html><body><p>无可打印内容</p></body></html>', {
            vscode,
          });
          return;
        }
        const html = buildPortableHtml(fileName, canvas);
        requestPrintHtml(fileName, html, { vscode });
      });
      return;
    }
    window.print();
  };

  const handleExportWord = () => {
    runWithEagerMount(async () => {
      const canvas = getSearchCanvas();
      if (!canvas) return;
      try {
        setIsExportingWord(true);
        await exportToWordDocument(fileName, canvas);
      } catch (err) {
        console.error('Word export error:', err);
      } finally {
        setIsExportingWord(false);
      }
    });
  };

  return {
    copied,
    copiedSection,
    copiedRich,
    isExportingWord,
    handleCopyRawMarkdown,
    handleCopyCurrentSection,
    handleCopyRichText,
    handleExportHtml,
    handlePrint,
    handleExportWord,
    runWithEagerMount,
  };
}
