import React, { useEffect, useMemo, useState } from 'react';
import { Box, IconButton, Stack, Typography, Tooltip, TextField } from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import { Document, Page, pdfjs } from 'react-pdf';
// Use Vite '?url' to get a static URL for the worker bundle
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite query import
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
// Configure worker source (react-pdf expects this) 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pdfjs as any).GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

interface PDFReaderProps {
  file?: File;
  fileId?: string;
  height?: number;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const SCALE_STEP = 0.15;

const PDFReader: React.FC<PDFReaderProps> = ({ file, fileId, height = 500 }) => {
  const [numPages, setNumPages] = useState<number>();
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [fitWidth, setFitWidth] = useState(true);
  const [containerWidth, setContainerWidth] = useState<number | undefined>();
  const [loadError, setLoadError] = useState<string | null>(null);

  const source = useMemo(() => {
    if (file) return file;
    if (fileId) return `http://localhost:8000/pdf?file_id=${fileId}`;
    return null;
  }, [file, fileId]);

  useEffect(() => { setPage(1); }, [source]);

  const onDocumentLoad = ({ numPages: np }: { numPages: number }) => {
    setNumPages(np);
    if (page > np) setPage(1);
    setLoadError(null);
  };
  const onDocumentError = (err: any) => {
    setLoadError(err?.message || 'Failed to load PDF');
  };

  const changePage = (delta: number) => setPage(p => {
    const next = p + delta;
    if (!numPages) return p;
    if (next < 1) return 1;
    if (next > numPages) return numPages;
    return next;
  });

  const zoom = (delta: number) => setScale(s => {
    const next = Number((s + delta).toFixed(2));
    if (next < MIN_SCALE) return MIN_SCALE;
    if (next > MAX_SCALE) return MAX_SCALE;
    return next;
  });

  const onManualPage = (val: string) => {
    const n = parseInt(val, 10);
    if (!isNaN(n) && numPages) {
      if (n >= 1 && n <= numPages) setPage(n);
    }
  };

  const containerRef = React.useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const resize = () => setContainerWidth(node.clientWidth);
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(node);
      return () => ro.disconnect();
    }
  }, []);

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap' }}>
        <Tooltip title="Previous Page"><span><IconButton size="small" onClick={() => changePage(-1)} disabled={page <= 1}><NavigateBeforeIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="Next Page"><span><IconButton size="small" onClick={() => changePage(1)} disabled={!!numPages && page >= (numPages || 0)}><NavigateNextIcon fontSize="small" /></IconButton></span></Tooltip>
        <TextField size="small" value={page} onChange={e => onManualPage(e.target.value)} inputProps={{ style: { width: 48, textAlign: 'center' } }} />
        <Typography variant="body2">/ {numPages || '—'}</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Zoom Out"><span><IconButton size="small" onClick={() => zoom(-SCALE_STEP)} disabled={scale <= MIN_SCALE}><ZoomOutIcon fontSize="small" /></IconButton></span></Tooltip>
        <Typography variant="caption" sx={{ width: 56, textAlign: 'center' }}>{Math.round(scale * 100)}%</Typography>
        <Tooltip title="Zoom In"><span><IconButton size="small" onClick={() => zoom(SCALE_STEP)} disabled={scale >= MAX_SCALE}><ZoomInIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="Toggle Fit Width"><IconButton size="small" color={fitWidth ? 'primary' : 'default'} onClick={() => setFitWidth(f => !f)}><FitScreenIcon fontSize="small" /></IconButton></Tooltip>
      </Stack>
      <Box ref={containerRef} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1, background: 'background.paper', maxHeight: height, overflow: 'auto' }}>
        {source ? (
          <Document
            file={source}
            onLoadSuccess={onDocumentLoad}
            onLoadError={onDocumentError}
            loading={<Typography variant="body2" sx={{ p: 2 }}>Loading PDF…</Typography>}
            error={<Typography color="error" variant="body2" sx={{ p: 2 }}>Failed to load PDF.</Typography>}
          >
            {!loadError && (
              <Page
                pageNumber={page}
                scale={fitWidth && containerWidth ? (containerWidth - 32) / 600 * scale : scale}
                width={fitWidth && containerWidth ? containerWidth - 32 : undefined}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            )}
          </Document>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No PDF selected.</Typography>
        )}
        {loadError && (
          <Typography color="error" variant="caption" sx={{ display: 'block', mt: 1 }}>{loadError}</Typography>
        )}
      </Box>
    </Box>
  );
};

export default PDFReader;
