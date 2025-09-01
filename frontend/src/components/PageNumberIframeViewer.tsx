import React, { useEffect, useState, useCallback } from 'react';
import { Box, Stack, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
// @ts-ignore Vite asset url for worker
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
// Align worker version
(GlobalWorkerOptions as any).workerSrc = workerSrc;

interface ViewerProps { 
  file?: File; 
  fileId?: string; 
  height?: number;
  previewStartPage?: number;
  previewEndPage?: number;
  onPreviewExit?: () => void;
}

const PageNumberIframeViewer: React.FC<ViewerProps> = ({ 
  file, 
  fileId, 
  height, 
  previewStartPage, 
  previewEndPage, 
  onPreviewExit 
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);

  // Preview mode state
  const isPreviewMode = previewStartPage != null && previewEndPage != null;
  const effectiveStartPage = isPreviewMode ? previewStartPage : 1;
  const effectiveEndPage = isPreviewMode ? previewEndPage : (pages || 1);
  const effectiveTotalPages = effectiveEndPage - effectiveStartPage + 1;

  // Initialize page to preview start when entering preview mode
  useEffect(() => {
    if (isPreviewMode && previewStartPage) {
      setPage(previewStartPage);
    }
  }, [isPreviewMode, previewStartPage]);

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
      let next = p + delta;
      
      // Respect preview range if active
      if (isPreviewMode) {
        if (next < effectiveStartPage) next = effectiveStartPage;
        if (next > effectiveEndPage) next = effectiveEndPage;
      } else {
        // Normal mode
        if (next < 1) next = 1;
        if (pages && next > pages) next = pages;
      }
      
      return next;
    });
  };

  const onManualPage = (v: string) => {
    const n = parseInt(v, 10);
    if (isNaN(n)) return;
    
    // Respect preview range if active
    if (isPreviewMode) {
      if (n >= effectiveStartPage && n <= effectiveEndPage) {
        setPage(n);
      }
    } else {
      // Normal mode
      if (n >= 1 && (!pages || n <= pages)) {
        setPage(n);
      }
    }
  };

  return (
    <Box>
      {isPreviewMode && onPreviewExit && (
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1, p: 1, bgcolor: 'primary.light', color: 'primary.contrastText', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            Preview Mode: Pages {previewStartPage}-{previewEndPage}
          </Typography>
          <IconButton size="small" onClick={onPreviewExit} sx={{ color: 'inherit' }}>
            <Typography variant="caption">Exit</Typography>
          </IconButton>
        </Stack>
      )}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap' }}>
        <Tooltip title="Previous Page">
          <span>
            <IconButton 
              size="small" 
              onClick={() => changePage(-1)} 
              disabled={isPreviewMode ? page <= effectiveStartPage : page <= 1}
            >
              <NavigateBeforeIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Next Page">
          <span>
            <IconButton 
              size="small" 
              onClick={() => changePage(1)} 
              disabled={isPreviewMode ? page >= effectiveEndPage : (!!pages && page >= (pages || 0))}
            >
              <NavigateNextIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <TextField 
          size="small" 
          value={page} 
          onChange={e => onManualPage(e.target.value)} 
          inputProps={{ style: { width: 60, textAlign: 'center' } }} 
        />
        <Typography variant="body2">
          of {isPreviewMode ? effectiveTotalPages : (pages !== null && pages !== undefined ? pages : '…')} pages
          {isPreviewMode && ` (${previewStartPage}-${previewEndPage})`}
        </Typography>
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
