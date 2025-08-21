import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
// pdf.js imports
import { GlobalWorkerOptions, getDocument, version } from 'pdfjs-dist';
// @ts-ignore query import for worker asset URL (vite)
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Keep worker version aligned with installed pdfjs-dist
(GlobalWorkerOptions as any).workerSrc = workerSrc;

interface SimplePDFViewerProps {
  file?: File;
  fileId?: string;
  height?: number;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const SCALE_STEP = 0.15;

const SimplePDFViewer: React.FC<SimplePDFViewerProps> = ({ file, fileId, height = 500 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState<number>();
  const [scale, setScale] = useState(1.0);
  const [fitWidth, setFitWidth] = useState(true);
  const [containerWidth, setContainerWidth] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const source = React.useMemo(() => {
    if (file) return URL.createObjectURL(file);
    if (fileId) return `http://localhost:8000/pdf?file_id=${fileId}`;
    return null;
  }, [file, fileId]);

  // Track width for fit-width scaling
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const handle = () => setContainerWidth(el.clientWidth);
    handle();
    const ro = new ResizeObserver(handle);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load document
  useEffect(() => {
    let revoked: string | null = null;
    setPdf(null);
    setNumPages(undefined);
    setPage(1);
    setError(null);
    if (!source) return;
    const loadingTask = getDocument({ url: source });
    loadingTask.promise.then(doc => {
      setPdf(doc);
      setNumPages(doc.numPages);
    }).catch(e => {
      setError(e?.message || 'Failed to load PDF');
    });
    if (file) revoked = source;
    return () => { if (revoked) URL.revokeObjectURL(revoked); loadingTask.destroy(); };
  }, [source, file]);

  const renderPage = useCallback(async () => {
    if (!pdf || !canvasRef.current) return;
    try {
      const p = await pdf.getPage(page);
      let targetScale = scale;
      if (fitWidth && containerWidth) {
        const unscaledViewport = p.getViewport({ scale: 1 });
        targetScale = (containerWidth - 24) / unscaledViewport.width * scale; // base fit * manual scale
      }
      const viewport = p.getViewport({ scale: targetScale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const renderContext = { canvasContext: ctx, viewport } as any;
      await p.render(renderContext).promise;
    } catch (e: any) {
      setError(e?.message || 'Render error');
    }
  }, [pdf, page, scale, fitWidth, containerWidth]);

  useEffect(() => { renderPage(); }, [renderPage]);

  const changePage = (delta: number) => setPage(p => {
    if (!numPages) return p;
    let next = p + delta;
    if (next < 1) next = 1;
    if (next > numPages) next = numPages;
    return next;
  });

  const onManualPage = (val: string) => {
    const n = parseInt(val, 10);
    if (!isNaN(n) && numPages) {
      if (n >= 1 && n <= numPages) setPage(n);
    }
  };

  const zoom = (delta: number) => setScale(s => {
    let next = Number((s + delta).toFixed(2));
    if (next < MIN_SCALE) next = MIN_SCALE;
    if (next > MAX_SCALE) next = MAX_SCALE;
    return next;
  });

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary">pdf.js v{version}</Typography>
        <Tooltip title="Previous Page"><span><IconButton size="small" onClick={() => changePage(-1)} disabled={page <= 1}><NavigateBeforeIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="Next Page"><span><IconButton size="small" onClick={() => changePage(1)} disabled={!!numPages && page >= (numPages || 0)}><NavigateNextIcon fontSize="small" /></IconButton></span></Tooltip>
        <TextField size="small" value={page} onChange={e => onManualPage(e.target.value)} inputProps={{ style: { width: 56, textAlign: 'center' } }} />
        <Typography variant="body2">/ {numPages || '—'}</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Zoom Out"><span><IconButton size="small" onClick={() => zoom(-SCALE_STEP)} disabled={scale <= MIN_SCALE}><ZoomOutIcon fontSize="small" /></IconButton></span></Tooltip>
        <Typography variant="caption" sx={{ width: 50, textAlign: 'center' }}>{Math.round(scale * 100)}%</Typography>
        <Tooltip title="Zoom In"><span><IconButton size="small" onClick={() => zoom(SCALE_STEP)} disabled={scale >= MAX_SCALE}><ZoomInIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title={fitWidth ? 'Disable Fit Width' : 'Fit Width'}><IconButton size="small" color={fitWidth ? 'primary' : 'default'} onClick={() => setFitWidth(f => !f)}>{fitWidth ? <CloseFullscreenIcon fontSize="small" /> : <FitScreenIcon fontSize="small" />}</IconButton></Tooltip>
      </Stack>
      <Box ref={containerRef} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1, background: 'background.paper', maxHeight: height, overflow: 'auto', position: 'relative' }}>
        {!source && <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No PDF selected.</Typography>}
        {error && <Typography color="error" variant="body2" sx={{ p: 2 }}>{error}</Typography>}
        <canvas ref={canvasRef} style={{ display: source && !error ? 'block' : 'none', margin: '0 auto' }} />
      </Box>
    </Box>
  );
};

export default SimplePDFViewer;
