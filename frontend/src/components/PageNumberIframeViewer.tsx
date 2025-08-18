import React, { useEffect, useState, useCallback } from 'react';
import { Box, Stack, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
// @ts-ignore Vite asset url for worker
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
// Align worker version
(GlobalWorkerOptions as any).workerSrc = workerSrc;

interface ViewerProps { file?: File; fileId?: string; height?: number }

const PageNumberIframeViewer: React.FC<ViewerProps> = ({ file, fileId, height }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);

  // Fetch page count (server for uploaded file, client parse for local file)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (fileId) {
        try {
          const r = await fetch(`http://localhost:8000/pdf/info?file_id=${fileId}`);
          if (!r.ok) throw new Error('Failed to fetch info');
          const d = await r.json();
          if (!cancelled) setPages(d.pages);
        } catch (e: any) {
          if (!cancelled) setError(e.message);
        }
        return;
      }
      if (file) {
        try {
          const buf = await file.arrayBuffer();
          const task = getDocument({ data: buf });
          const doc = await task.promise;
          if (!cancelled) setPages(doc.numPages);
          await doc.destroy();
        } catch (e: any) {
          if (!cancelled) setError(e.message || 'Failed to read PDF');
        }
      } else {
        if (!cancelled) setPages(null);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [fileId, file]);

  // Manage blob URL for local file (prefer showing local selection even after upload)
  useEffect(() => {
    setError(null);
    setPage(1);
    if (file) {
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setObjectUrl(null);
    }
  }, [file]);

  const srcBase = file && objectUrl ? objectUrl : (fileId ? `http://localhost:8000/pdf?file_id=${fileId}` : null);

  // Canvas fallback rendering (first page for now or selected page) when in canvas mode
  const renderCanvas = useCallback(async () => {
    try {
      let data: ArrayBuffer | null = null;
      if (file) data = await file.arrayBuffer();
      else if (fileId) {
        const r = await fetch(`http://localhost:8000/pdf?file_id=${fileId}`);
        if (!r.ok) throw new Error('Fetch PDF failed');
        data = await r.arrayBuffer();
      }
      if (!data) return;
      const docTask = getDocument({ data });
      const doc = await docTask.promise;
      const pNum = Math.min(page, doc.numPages);
      const pdfPage = await doc.getPage(pNum);
      const viewport = pdfPage.getViewport({ scale: 1.2 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await pdfPage.render({ canvasContext: ctx as any, viewport }).promise;
      setCanvasUrl(canvas.toDataURL('image/png'));
      await doc.destroy();
    } catch (e: any) {
      setError(e.message || 'Canvas render failed');
    }
  }, [file, fileId, page]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  const changePage = (delta: number) => {
    setPage(p => {
      if (!pages) return Math.max(1, p + delta);
      let next = p + delta;
      if (next < 1) next = 1;
      if (next > pages) next = pages;
      return next;
    });
  };

  const onManualPage = (v: string) => {
    const n = parseInt(v, 10);
    if (!isNaN(n) && n >= 1 && (!pages || n <= pages)) setPage(n);
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap' }}>
        <Tooltip title="Previous Page"><span><IconButton size="small" onClick={() => changePage(-1)} disabled={page <= 1}><NavigateBeforeIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="Next Page"><span><IconButton size="small" onClick={() => changePage(1)} disabled={!!pages && page >= (pages || 0)}><NavigateNextIcon fontSize="small" /></IconButton></span></Tooltip>
  <TextField size="small" value={page} onChange={e => onManualPage(e.target.value)} inputProps={{ style: { width: 60, textAlign: 'center' } }} />
  <Typography variant="body2">of {pages !== null && pages !== undefined ? pages : '…'} pages</Typography>
        {error && !/Unexpected server response \(0\)/.test(error) && (
          <Typography color="error" variant="caption" sx={{ ml: 2 }}>{error}</Typography>
        )}
      </Stack>
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', position: 'relative', height: height ? height : '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {srcBase ? (
          canvasUrl ? <img src={canvasUrl} alt="PDF page" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Rendering page…</Typography>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No PDF selected.</Typography>
        )}
      </Box>
    </Box>
  );
};

export default PageNumberIframeViewer;
