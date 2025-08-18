import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';

type TOCStructure = { chapters: any[] } | null;

interface WorkflowState {
  file?: File;
  fileId?: string;
  toc?: TOCStructure;
  // Simplified: only one TOC (built-in or fallback)
  jobId?: string;
  progress?: { status: string; progress?: number; zip_path?: string; error?: string } | null;
  setFile: (f: File | undefined) => void;
  uploadFile: () => Promise<void>;
  fetchTOC: (opts?: { forceText?: boolean }) => Promise<void>;
  selectTOC: (key: 'merged' | 'text_based' | 'built_in') => void;
  saveEditedTOC: (next: TOCStructure) => Promise<void>;
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
  const selectTOC = useCallback((_k: any) => {}, []);

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

  const reset = () => {
    setFile(undefined);
    setFileId(undefined);
  setTOC(null);
    setTOC(null);
    setJobId(undefined);
    setProgress(null);
  };

  return (
  <WorkflowContext.Provider value={{ file, fileId, toc, jobId, progress, setFile, uploadFile, fetchTOC, selectTOC, saveEditedTOC, startSplit, pollProgress, reset }}>
      {children}
    </WorkflowContext.Provider>
  );
};

export const useWorkflow = () => {
  const ctx = useContext(WorkflowContext);
  if (!ctx) throw new Error('useWorkflow must be used within WorkflowProvider');
  return ctx;
};
