declare module 'react-pdf' {
  import * as React from 'react';
  export const pdfjs: any;
  export interface DocumentProps { file: any; onLoadSuccess?: (info: { numPages: number }) => void; onLoadError?: (error: any) => void; loading?: React.ReactNode; error?: React.ReactNode; children?: React.ReactNode; }
  export class Document extends React.Component<DocumentProps> {}
  export interface PageProps { pageNumber: number; scale?: number; width?: number; renderTextLayer?: boolean; renderAnnotationLayer?: boolean; }
  export class Page extends React.Component<PageProps> {}
}
