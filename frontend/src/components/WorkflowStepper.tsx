import React, { useEffect, useState } from 'react';
import { Box, Stepper, Step, StepLabel, Button, Typography, Card, CardContent, LinearProgress, Alert, Stack, CircularProgress, TextField, Divider } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TableChartIcon from '@mui/icons-material/TableChart';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import EditIcon from '@mui/icons-material/Edit';
import { useWorkflow } from '../state/WorkflowContext';
import PageNumberIframeViewer from './PageNumberIframeViewer';
import ManualTOCEditor from './ManualTOCEditor';
import { useToast } from '../state/ToastContext';

const steps = ['Upload', 'TOC', 'Split', 'Download']; // labels unchanged; behavior adjusted

const WorkflowStepper: React.FC = () => {
  const { file, setFile, uploadFile, fileId, fetchTOC, startSplit, jobId, pollProgress, progress, toc, tocMode, setTOCMode, manualTOC, convertManualTOCToStandard } = useWorkflow();
  const { success, error: toastError, info, warning } = useToast();
  const [activeStep, setActiveStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Gemini TOC extraction state
  const [tocStartPage, setTocStartPage] = useState<number>(1);
  const [tocEndPage, setTocEndPage] = useState<number>(1);
  const [contentStartPage, setContentStartPage] = useState<number>(1);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiResponse, setGeminiResponse] = useState<any>(null);

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
      // If we're using manual TOC mode and have manual TOC data, convert it first
      if (tocMode === 'manual' && manualTOC && !toc) {
        convertManualTOCToStandard();
        // Give a brief moment for state to update
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      await startSplit();
      // Move user into the Split step immediately to show progress
      setActiveStep(2);
      info('Split job started');
    } catch {
      setError('Split start failed');
      toastError('Could not start split');
    }
  };

  const doGeminiTOCExtraction = async () => {
    if (!fileId) {
      setError('No file uploaded');
      return;
    }

    setGeminiLoading(true);
    setError(null);
    setGeminiResponse(null);

    try {
      const response = await fetch(`http://localhost:8000/toc/gemini`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_id: fileId,
          toc_start_page: tocStartPage,
          toc_end_page: tocEndPage,
          content_start_page: contentStartPage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail?.message || 'Gemini TOC extraction failed');
      }

      const result = await response.json();
      setGeminiResponse(result);
      success('Gemini TOC extracted successfully');
    } catch (err: any) {
      const message = err.message || 'Failed to extract TOC with Gemini';
      setError(message);
      toastError(message);
    } finally {
      setGeminiLoading(false);
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
            
            {/* AI TOC Extraction Section */}
            <Box sx={{ 
              mb: 4, 
              p: 3, 
              border: '1px solid', 
              borderColor: 'divider', 
              borderRadius: 2, 
              bgcolor: 'background.paper',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'text.primary', fontWeight: 600 }}>
                <AutoFixHighIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
                AI TOC Extraction
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Use AI to extract Table of Contents from specific pages. Enter the page numbers where your TOC is located.
              </Typography>
              
              <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                <TextField
                  label="TOC Start Page"
                  type="number"
                  value={tocStartPage}
                  onChange={(e) => setTocStartPage(Number(e.target.value))}
                  inputProps={{ min: 1 }}
                  size="small"
                  helperText="First page of TOC in PDF"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'background.default',
                      '&:hover': {
                        bgcolor: 'background.default',
                      },
                      '&.Mui-focused': {
                        bgcolor: 'background.default',
                      }
                    }
                  }}
                />
                <TextField
                  label="TOC End Page"
                  type="number"
                  value={tocEndPage}
                  onChange={(e) => setTocEndPage(Number(e.target.value))}
                  inputProps={{ min: 1 }}
                  size="small"
                  helperText="Last page of TOC in PDF"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'background.default',
                      '&:hover': {
                        bgcolor: 'background.default',
                      },
                      '&.Mui-focused': {
                        bgcolor: 'background.default',
                      }
                    }
                  }}
                />
                <TextField
                  label="Content Start Page"
                  type="number"
                  value={contentStartPage}
                  onChange={(e) => setContentStartPage(Number(e.target.value))}
                  inputProps={{ min: 1 }}
                  size="small"
                  helperText="Page where actual content begins"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'background.default',
                      '&:hover': {
                        bgcolor: 'background.default',
                      },
                      '&.Mui-focused': {
                        bgcolor: 'background.default',
                      }
                    }
                  }}
                />
              </Stack>
              
              {geminiLoading && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Extracting TOC with AI...
                  </Typography>
                  <LinearProgress 
                    sx={{ 
                      height: 6, 
                      borderRadius: 3,
                      bgcolor: 'grey.200',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 3,
                        bgcolor: 'primary.main'
                      }
                    }} 
                  />
                </Box>
              )}
              
              <Button
                startIcon={<AutoFixHighIcon />}
                variant="contained"
                onClick={doGeminiTOCExtraction}
                disabled={!fileId || geminiLoading}
                sx={{ 
                  mb: 2,
                  bgcolor: 'primary.main',
                  '&:hover': {
                    bgcolor: 'primary.dark'
                  }
                }}
              >
                {geminiLoading ? 'Processing...' : 'Extract with AI'}
              </Button>
              
              {geminiResponse && (
                <Box>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" sx={{ mb: 2, color: 'success.main', fontWeight: 600 }}>
                    AI Extraction Results
                  </Typography>
                  <Box sx={{ 
                    maxHeight: 400, 
                    overflowY: 'auto', 
                    bgcolor: '#1e1e1e',
                    color: '#e0e0e0',
                    p: 3, 
                    borderRadius: 2,
                    fontFamily: '"Fira Code", "JetBrains Mono", "Monaco", "Consolas", monospace',
                    fontSize: '0.875rem',
                    lineHeight: 1.6,
                    border: '1px solid #333',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    '& .MuiScrollBar-thumb': {
                      bgcolor: '#555'
                    }
                  }}>
                    <pre style={{ 
                      margin: 0, 
                      whiteSpace: 'pre-wrap',
                      color: '#e0e0e0'
                    }}>
                      {JSON.stringify(geminiResponse, null, 2)}
                    </pre>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Raw JSON response from AI model
                  </Typography>
                </Box>
              )}
            </Box>
            
            <Divider sx={{ my: 3 }} />
            
            {/* Manual TOC Creation Section */}
            {tocMode === 'manual' ? (
              <ManualTOCEditor />
            ) : (
              <Box sx={{ 
                mb: 4, 
                p: 3, 
                border: '1px solid', 
                borderColor: 'divider', 
                borderRadius: 2, 
                bgcolor: 'background.paper',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <Typography variant="h6" sx={{ mb: 2, color: 'text.primary', fontWeight: 600 }}>
                  <EditIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'secondary.main' }} />
                  Manual TOC Creation
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Create your table of contents manually with full control over chapter structure and page ranges. 
                  Perfect for scanned books or complex documents.
                </Typography>
                
                <Button
                  startIcon={<EditIcon />}
                  variant="contained"
                  color="secondary"
                  onClick={() => setTOCMode('manual')}
                  disabled={!fileId}
                  sx={{ 
                    mb: 2,
                    bgcolor: 'secondary.main',
                    '&:hover': {
                      bgcolor: 'secondary.dark'
                    }
                  }}
                >
                  Create Manual TOC
                </Button>
                
                <Typography variant="caption" color="text.secondary" display="block">
                  Switch to manual mode to define chapters, subchapters, and page ranges yourself.
                </Typography>
              </Box>
            )}
            
            <Divider sx={{ my: 3 }} />
            
            {/* Original TOC Extraction */}
            {!toc && (
              <Stack spacing={2} direction="column">
                <Button startIcon={<TableChartIcon />} variant="outlined" onClick={() => doFetchTOC()}>Extract TOC (Rules-based)</Button>
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
                  {(!toc || toc.chapters?.length === 0) && tocMode !== 'manual' && (
                    <Typography variant="body2" color="text.secondary">No TOC chapters. Create a simple TOC to proceed.</Typography>
                  )}
                  {tocMode === 'manual' && (!manualTOC || manualTOC.structure.length === 0) && (
                    <Typography variant="body2" color="text.secondary">No manual TOC created yet. Use the manual TOC editor above to create chapters.</Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <Button 
                    startIcon={<PlayArrowIcon />} 
                    variant="contained" 
                    disabled={
                      tocMode === 'manual' 
                        ? (!manualTOC || manualTOC.structure.length === 0)
                        : (!toc || toc.chapters?.length === 0)
                    } 
                    onClick={doSplit}
                  >
                    Start Split
                  </Button>
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
                <Box sx={{ mt: 3, mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {progress?.status === 'in_progress' && 'Processing PDF sections...'}
                    {progress?.status === 'completed' && 'Split completed successfully!'}
                    {progress?.status === 'failed' && 'Split failed'}
                    {!progress?.status && 'Initializing...'}
                  </Typography>
                  <LinearProgress
                    sx={{ 
                      height: 8, 
                      borderRadius: 4,
                      bgcolor: 'grey.200',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        bgcolor: progress?.status === 'failed' ? 'error.main' : 
                                progress?.status === 'completed' ? 'success.main' : 'primary.main'
                      }
                    }}
                    variant={typeof progress?.progress === 'number' ? 'determinate' : 'indeterminate'}
                    value={typeof progress?.progress === 'number' ? progress!.progress : undefined}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Job ID: {jobId.substring(0, 8)}...
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {typeof progress?.progress === 'number' ? `${progress.progress}%` : '...'}
                    </Typography>
                  </Box>
                </Box>
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
                <LinearProgress 
                  sx={{ 
                    my: 3, 
                    height: 6, 
                    borderRadius: 3,
                    bgcolor: 'grey.200',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      bgcolor: 'primary.main'
                    }
                  }} 
                />
                <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2 }}>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={doSplit} 
                    disabled={
                      tocMode === 'manual' 
                        ? (!manualTOC || manualTOC.structure.length === 0)
                        : !toc
                    }
                  >
                    Retry
                  </Button>
                  <Button size="small" onClick={() => setActiveStep(1)}>Back to TOC</Button>
                </Stack>
              </>
            )}
            {!jobId && error && (
              <>
                <Typography variant="body2" color="error">Split not started.</Typography>
                <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2 }}>
                  <Button 
                    size="small" 
                    variant="contained" 
                    onClick={doSplit} 
                    disabled={
                      tocMode === 'manual' 
                        ? (!manualTOC || manualTOC.structure.length === 0)
                        : !toc
                    }
                  >
                    Retry Split
                  </Button>
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
