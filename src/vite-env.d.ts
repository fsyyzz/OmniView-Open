/// <reference types="vite/client" />

declare module '*?url' {
  const content: string;
  export default content;
}

declare module '@excalidraw/excalidraw' {
  import * as React from 'react';
  export const Excalidraw: React.FC<any>;
  export function restoreElements(elements: any, localElements: any): any;
  export function restoreAppState(appState: any, localAppState: any): any;
}

declare module '@excalidraw/excalidraw/index.css' {}

declare module '@excalidraw/utils' {
  export function exportToSvg(opts: any): Promise<SVGSVGElement>;
}

declare module '@myriaddreamin/typst.ts' {
  export const $typst: {
    setCompilerInitOptions(opts: { getModule: () => string | Promise<any> }): void;
    setRendererInitOptions(opts: { getModule: () => string | Promise<any> }): void;
    svg(opts: { mainFilePath?: string; mainContent?: string }): Promise<string>;
    query(opts: { mainFilePath?: string; mainContent?: string; selector: string }): Promise<any[]>;
    mapShadow(path: string, content: Uint8Array): void;
    unmapShadow(path: string): void;
    resetShadow(): void;
  };
}

declare module 'docx-preview' {
  export interface DocxOptions {
    inWrapper?: boolean;
    ignoreWidth?: boolean;
    ignoreHeight?: boolean;
    ignoreFonts?: boolean;
    breakPages?: boolean;
    debug?: boolean;
    experimental?: boolean;
    className?: string;
    trimXmlDeclaration?: boolean;
    renderHeaders?: boolean;
    renderFooters?: boolean;
    renderFootnotes?: boolean;
    renderEndnotes?: boolean;
  }
  export function renderAsync(
    data: Blob | ArrayBuffer | Uint8Array,
    bodyContainer: HTMLElement,
    styleContainer?: HTMLElement,
    options?: DocxOptions
  ): Promise<any>;
}
