// Manual TOC Data Structures

export interface ManualTOCNode {
  id: string;
  title: string;
  startPage: number;        // Content page number (1-based)
  endPage?: number;         // Content page number (1-based)
  pdfStartPage?: number;    // Calculated PDF page
  pdfEndPage?: number;      // Calculated PDF page
  children: ManualTOCNode[];
  parentId?: string;
  level: number;            // Depth level (0 = chapter, 1 = subchapter, etc.)
}

export interface ManualTOC {
  id: string;
  fileId: string;
  contentStartPage: number;  // PDF page where content begins (1-based)
  structure: ManualTOCNode[];
  createdAt: string;
  updatedAt: string;
}

// Utility type for TOC creation mode
export type TOCCreationMode = 'rules-based' | 'gemini' | 'manual';

// Helper function to generate unique IDs
export const generateNodeId = (): string => {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Helper function to create a new empty node
export const createEmptyNode = (level: number = 0, parentId?: string): ManualTOCNode => {
  return {
    id: generateNodeId(),
    title: '',
    startPage: 1,
    endPage: 1,
    children: [],
    parentId,
    level
  };
};

// Helper function to calculate PDF pages from content pages
export const calculatePDFPages = (
  contentStartPage: number,
  contentPage: number
): number => {
  return contentStartPage + contentPage - 1;
};

// Helper function to convert manual TOC to the existing TOC structure format
export const convertManualTOCToStandard = (manualTOC: ManualTOC): { chapters: any[] } => {
  const convertNode = (node: ManualTOCNode, index: number): any => {
    return {
      title: node.title,
      number: `${index + 1}`,
      page: node.pdfStartPage || calculatePDFPages(manualTOC.contentStartPage, node.startPage),
      end_page: node.pdfEndPage || calculatePDFPages(manualTOC.contentStartPage, node.endPage || node.startPage),
      subtopics: node.children.map((child, childIndex) => convertNode(child, childIndex))
    };
  };

  return {
    chapters: manualTOC.structure.map((node, index) => convertNode(node, index))
  };
};