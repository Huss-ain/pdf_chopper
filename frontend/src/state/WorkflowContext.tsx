import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';
import type { ManualTOC, TOCCreationMode } from '../types/manual-toc';
import { convertManualTOCToStandard } from '../types/manual-toc';

type TOCStructure = { chapters: any[] } | null;

interface WorkflowState {
  file?: File;
  fileId?: string;
  toc?: TOCStructure;
  // Manual TOC state
  manualTOC?: ManualTOC;
  tocMode: TOCCreationMode;
  // Simplified: only one TOC (built-in or fallback)
  jobId?: string;
  progress?: { status: string; progress?: number; zip_path?: string; error?: string } | null;
  setFile: (f: File | undefined) => void;
  uploadFile: () => Promise<void>;
  fetchTOC: (opts?: { forceText?: boolean }) => Promise<void>;
  selectTOC: (key: 'merged' | 'text_based' | 'built_in') => void;
  saveEditedTOC: (next: TOCStructure) => Promise<void>;
  // Manual TOC methods
  setTOCMode: (mode: TOCCreationMode) => void;
  saveManualTOC: (manualTOC: ManualTOC) => Promise<void>;
  loadManualTOC: () => Promise<void>;
  convertManualTOCToStandard: () => void;
  startSplit: () => Promise<void>;
  pollProgress: () => Promise<void>;
  reset: () => void;
}

const WorkflowContext = createContext<WorkflowState | undefined>(undefined);

export const WorkflowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [file, setFile] = useState<File | undefined>();
  const [fileId, setFileId] = useState<string | undefined>();
  // Removed rawTocs and selection state
  const [toc, setTOC] = useState<TOCStructure>(null);
  const [jobId, setJobId] = useState<string | undefined>();
  const [progress, setProgress] = useState<WorkflowState['progress']>(null);
  
  // Manual TOC state
  const [manualTOC, setManualTOC] = useState<ManualTOC | undefined>();
  const [tocMode, setTOCMode] = useState<TOCCreationMode>('rules-based');

  const baseURL = 'http://localhost:8000';

  const uploadFile = useCallback(async () => {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const res = await axios.post('/upload', form, { baseURL });
    setFileId(res.data.file_id);
  }, [file]);

  const fetchTOC = useCallback(async () => {
    if (!fileId) return;
    try {
      const res = await axios.get('/toc', { baseURL, params: { file_id: fileId } });
      setTOC(res.data.toc);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : (detail?.error || 'TOC extraction failed');
      throw new Error(message);
    }
  }, [fileId]);
  const selectTOC = useCallback((_k: any) => {
    // Legacy function - kept for interface compatibility but not used
  }, []);

  const saveEditedTOC = useCallback(async (next: TOCStructure) => {
    if (!fileId || !next) return;
    await axios.post(`/toc/edit?file_id=${fileId}`, next, { baseURL });
    setTOC(next);
  }, [fileId]);

  const startSplit = useCallback(async () => {
    if (!fileId || !toc) return;
    // Send TOC explicitly so backend doesn't need stored state
    const res = await axios.post(`/split?file_id=${fileId}`, toc, { baseURL });
    setJobId(res.data.job_id);
  }, [fileId, toc]);

  const pollProgress = useCallback(async () => {
    if (!jobId) return;
    const res = await axios.get(`/progress?job_id=${jobId}`, { baseURL });
    setProgress(res.data);
  }, [jobId]);

  // Manual TOC methods
  const saveManualTOC = useCallback(async (manualTOCData: ManualTOC) => {
    if (!fileId) return;
    await axios.post(`/toc/manual?file_id=${fileId}`, manualTOCData, { baseURL });
    setManualTOC(manualTOCData);
    // Convert manual TOC to standard format and set as current TOC
    const standardTOC = convertManualTOCToStandard(manualTOCData);
    setTOC(standardTOC);
  }, [fileId]);

  const loadManualTOC = useCallback(async () => {
    if (!fileId) return;
    try {
      const res = await axios.get(`/toc/manual?file_id=${fileId}`, { baseURL });
      setManualTOC(res.data);
    } catch (err) {
      // If no manual TOC exists, that's ok
      setManualTOC(undefined);
    }
  }, [fileId]);

  const convertManualTOCToStandardMethod = useCallback(() => {
    if (!manualTOC) return;
    const standardTOC = convertManualTOCToStandard(manualTOC);
    setTOC(standardTOC);
  }, [manualTOC]);

  const reset = () => {
    setFile(undefined);
    setFileId(undefined);
    setTOC(null);
    setJobId(undefined);
    setProgress(null);
    setManualTOC(undefined);
    setTOCMode('rules-based');
  };

  return (
  <WorkflowContext.Provider value={{ 
    file, 
    fileId, 
    toc, 
    manualTOC,
    tocMode,
    jobId, 
    progress, 
    setFile, 
    uploadFile, 
    fetchTOC, 
    selectTOC, 
    saveEditedTOC,
    setTOCMode,
    saveManualTOC,
    loadManualTOC,
    convertManualTOCToStandard: convertManualTOCToStandardMethod,
    startSplit, 
    pollProgress, 
    reset 
  }}>
      {children}
    </WorkflowContext.Provider>
  );
};

export const useWorkflow = () => {
  const ctx = useContext(WorkflowContext);
  if (!ctx) throw new Error('useWorkflow must be used within WorkflowProvider');
  return ctx;
};
