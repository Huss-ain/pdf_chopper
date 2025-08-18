import React, { useEffect, useState } from 'react';
import { Box, Stepper, Step, StepLabel, Button, Typography, Card, CardContent, LinearProgress, Alert, Stack, CircularProgress } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TableChartIcon from '@mui/icons-material/TableChart';
import { useWorkflow } from '../state/WorkflowContext';
import PageNumberIframeViewer from './PageNumberIframeViewer';
import { useToast } from '../state/ToastContext';

const steps = ['Upload', 'TOC', 'Split', 'Download']; // labels unchanged; behavior adjusted

const WorkflowStepper: React.FC = () => {
  const { file, setFile, uploadFile, fileId, fetchTOC, startSplit, jobId, pollProgress, progress, toc } = useWorkflow();
  const { success, error: toastError, info, warning } = useToast();
  const [activeStep, setActiveStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (fileId && activeStep === 0) setActiveStep(1); }, [fileId, activeStep]);
  // Removed rawTocs effect
  // Advance to Download only when backend reports completion
  useEffect(() => {
    if (progress?.status === 'completed') setActiveStep(3);
  }, [progress]);

  useEffect(() => {
    if (!jobId) return;
    pollProgress();
    const id = window.setInterval(() => { pollProgress(); }, 2000);
    return () => window.clearInterval(id);
  }, [jobId, pollProgress]);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const f = e.target.files[0];
    if (f.type !== 'application/pdf') { setError('Please select a PDF'); return; }
    setError(null);
    setFile(f);
  };

  const doUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
  try { await uploadFile(); success('Upload successful'); } catch { setError('Upload failed'); toastError('Upload failed'); } finally { setUploading(false); }
  };

  const doFetchTOC = async () => {
    setError(null);
    try {
      await fetchTOC();
      if (!toc || !toc.chapters || toc.chapters.length === 0) warning('Fallback TOC created'); else success('TOC ready');
    } catch (e: any) {
      const msg = e?.message || 'TOC extraction failed';
      setError(msg);
      toastError(msg);
    }
  };

  const doSplit = async () => {
    setError(null);
    try {
      await startSplit();
      // Move user into the Split step immediately to show progress
      setActiveStep(2);
      info('Split job started');
    } catch {
      setError('Split start failed');
      toastError('Could not start split');
    }
  };

  const completed = progress?.status === 'completed';
  const failed = progress?.status === 'failed';
  const [notified, setNotified] = useState(false);
  useEffect(() => {
    if (!notified && completed) { success('Split completed'); setNotified(true); }
    if (!notified && failed) { toastError('Split failed'); setNotified(true); }
  }, [completed, failed, notified, success, toastError]);

  return (
    <Card sx={{ p: 3, backdropFilter: 'blur(6px)', background: 'rgba(255,255,255,0.05)' }}>
      <CardContent>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {steps.map(label => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {activeStep === 0 && (
          <Box>
            <Box textAlign="center">
              <input id="file" type="file" hidden onChange={handleFilePick} />
              <Button startIcon={<CloudUploadIcon />} variant="contained" onClick={() => document.getElementById('file')?.click()} sx={{ mr: 2 }}>Choose PDF</Button>
              <Button variant="outlined" disabled={!file || uploading} onClick={doUpload}>{uploading ? 'Uploading…' : 'Upload'}</Button>
              {file && <Typography sx={{ mt: 2 }} variant="body2">Selected: {file.name}</Typography>}
              {fileId && <Alert sx={{ mt: 2 }} severity="success">Uploaded.</Alert>}
            </Box>
            {(file || fileId) && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Preview</Typography>
                <PageNumberIframeViewer file={file} fileId={fileId} />
              </Box>
            )}
          </Box>
        )}

        {activeStep === 1 && (
          <Box>
            {(file || fileId) && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Preview</Typography>
                <PageNumberIframeViewer file={file} fileId={fileId} />
              </Box>
            )}
            <Typography variant="h6" gutterBottom>Extract Table of Contents</Typography>
      {!toc && (
              <Stack spacing={2} direction="column">
                <Button startIcon={<TableChartIcon />} variant="contained" onClick={() => doFetchTOC()}>Extract TOC</Button>
        <Typography variant="body2" color="text.secondary">Click Extract TOC to use built-in or automatic fallback.</Typography>
              </Stack>
            )}
            {toc && (
              <Box>
                <Box sx={{ maxHeight: 260, overflowY: 'auto', border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 2 }}>
                  {toc?.chapters?.map((c: any, i: number) => {
                    const chapterNumber = c.number || `${i + 1}`;
                    return (
                      <Box key={i} sx={{ mb: 1 }}>
                        <Typography fontWeight={600}>{chapterNumber}. {c.title}</Typography>
                        {c.subtopics && c.subtopics.map((s: any, j: number) => {
                          const subNumber = s.number || `${chapterNumber}.${j + 1}`;
                          return (
                            <Typography key={j} variant="body2" sx={{ ml: 2 }}>{subNumber}. {s.title}</Typography>
                          );
                        })}
                      </Box>
                    );
                  })}
                  {(!toc || toc.chapters?.length === 0) && (
                    <Typography variant="body2" color="text.secondary">No TOC chapters. Create a simple TOC to proceed.</Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Button startIcon={<PlayArrowIcon />} variant="contained" disabled={!toc || toc.chapters?.length === 0} onClick={doSplit}>Start Split</Button>
                </Stack>
              </Box>
            )}
          </Box>
        )}

        {activeStep === 2 && (
          <Box textAlign="center">
            {jobId && (
              <Box>
                <Typography variant="h6" gutterBottom>Splitting Sections</Typography>
                <LinearProgress
                  sx={{ my: 3 }}
                  variant={typeof progress?.progress === 'number' ? 'determinate' : 'indeterminate'}
                  value={typeof progress?.progress === 'number' ? progress!.progress : undefined}
                />
                <Typography variant="body2">Job ID: {jobId}</Typography>
                {progress?.status && <Typography variant="body2" sx={{ mt: 1 }}>Status: {progress.status}{typeof progress?.progress === 'number' ? ` (${progress.progress}%)` : ''}</Typography>}
                {progress?.status === 'failed' && (
                  <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2 }}>
                    <Button size="small" variant="contained" onClick={doSplit}>Retry</Button>
                    <Button size="small" variant="outlined" onClick={() => setActiveStep(1)}>Back to TOC</Button>
                  </Stack>
                )}
              </Box>
            )}
            {!jobId && !error && (
              <>
                <Typography variant="body2">Preparing split…</Typography>
                <LinearProgress sx={{ my: 3 }} />
                <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2 }}>
                  <Button size="small" variant="outlined" onClick={doSplit} disabled={!toc}>Retry</Button>
                  <Button size="small" onClick={() => setActiveStep(1)}>Back to TOC</Button>
                </Stack>
              </>
            )}
            {!jobId && error && (
              <>
                <Typography variant="body2" color="error">Split not started.</Typography>
                <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2 }}>
                  <Button size="small" variant="contained" onClick={doSplit} disabled={!toc}>Retry Split</Button>
                  <Button size="small" variant="outlined" onClick={() => { setActiveStep(1); }}>Define TOC</Button>
                </Stack>
              </>
            )}
          </Box>
        )}

        {activeStep === 3 && (
          <Box textAlign="center">
            {!completed && (
              <>
                <CircularProgress />
                <Typography sx={{ mt: 2 }} variant="body2">Processing…</Typography>
              </>
            )}
            {completed && (
              <>
                <Alert severity="success" sx={{ mb: 2 }}>Split Complete</Alert>
                <Button startIcon={<DownloadIcon />} href={`http://localhost:8000/download?job_id=${jobId}`} variant="contained">Download Archive</Button>
              </>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkflowStepper;
