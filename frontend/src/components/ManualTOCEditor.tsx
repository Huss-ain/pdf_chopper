import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  Stack, 
  Divider,
  Alert,
  TextField,
  Tabs,
  Tab
} from '@mui/material';
import { useWorkflow } from '../state/WorkflowContext';
import { useToast } from '../state/ToastContext';
import PageNumberIframeViewer from './PageNumberIframeViewer';
import TOCTreeEditor from './TOCTreeEditor';
import type { ManualTOC, ManualTOCNode } from '../types/manual-toc';
import { generateNodeId, createEmptyNode, calculatePDFPages } from '../types/manual-toc';

const ManualTOCEditor: React.FC = () => {
  const { file, fileId, manualTOC, saveManualTOC, loadManualTOC, tocMode } = useWorkflow();
  const { success, error, info } = useToast();
  
  const [currentTOC, setCurrentTOC] = useState<ManualTOC | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [contentStartPage, setContentStartPage] = useState(1);
  const [activeTab, setActiveTab] = useState(0);

  // Preview state
  const [previewNode, setPreviewNode] = useState<ManualTOCNode | null>(null);

  // Preview helper functions
  const handleNodePreview = (node: ManualTOCNode) => {
    setPreviewNode(node);
  };

  const handleExitPreview = () => {
    setPreviewNode(null);
  };

  // Calculate PDF pages for preview
  const getPreviewPages = () => {
    if (!previewNode || !currentTOC) return { start: undefined, end: undefined };
    
    const startPage = calculatePDFPages(currentTOC.contentStartPage, previewNode.startPage);
    const endPage = calculatePDFPages(currentTOC.contentStartPage, previewNode.endPage || previewNode.startPage);
    
    return { start: startPage, end: endPage };
  };

  const { start: previewStartPage, end: previewEndPage } = getPreviewPages();

  // Load existing manual TOC if available
  useEffect(() => {
    if (fileId && tocMode === 'manual') {
      loadManualTOC();
    }
  }, [fileId, tocMode, loadManualTOC]);

  // Update local state when manual TOC is loaded
  useEffect(() => {
    if (manualTOC) {
      setCurrentTOC(manualTOC);
      setContentStartPage(manualTOC.contentStartPage);
    }
  }, [manualTOC]);

  // Initialize empty TOC structure if none exists
  const initializeTOC = () => {
    if (!fileId) return;
    
    const newTOC: ManualTOC = {
      id: generateNodeId(),
      fileId,
      contentStartPage,
      structure: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setCurrentTOC(newTOC);
    info('Manual TOC editor initialized. Add your first chapter to get started.');
  };

  // Update content start page
  const handleContentStartPageChange = (newStartPage: number) => {
    if (!currentTOC) return;
    
    const validStartPage = Math.max(1, newStartPage);
    setContentStartPage(validStartPage);
    
    const updatedTOC = {
      ...currentTOC,
      contentStartPage: validStartPage,
      updatedAt: new Date().toISOString()
    };
    
    setCurrentTOC(updatedTOC);
  };

  // Add a new node (chapter or subchapter)
  const handleAddNode = (parentId?: string) => {
    if (!currentTOC) return;

    const newNode: ManualTOCNode = parentId 
      ? createEmptyNode(1, parentId) // Subchapter
      : createEmptyNode(0); // Chapter

    // Set default title and page numbers
    const nodeCount = parentId 
      ? currentTOC.structure.find(ch => ch.id === parentId)?.children.length || 0
      : currentTOC.structure.length;
    
    newNode.title = parentId 
      ? `New Subchapter ${nodeCount + 1}`
      : `New Chapter ${nodeCount + 1}`;
    
    // Set reasonable default pages
    const lastPage = getLastUsedPage(currentTOC.structure);
    newNode.startPage = lastPage + 1;
    newNode.endPage = lastPage + 10; // Default 10-page chapter

    let updatedStructure;
    
    if (parentId) {
      // Add as subchapter
      updatedStructure = currentTOC.structure.map(chapter => {
        if (chapter.id === parentId) {
          return {
            ...chapter,
            children: [...chapter.children, newNode]
          };
        }
        return chapter;
      });
    } else {
      // Add as new chapter
      updatedStructure = [...currentTOC.structure, newNode];
    }

    const updatedTOC = {
      ...currentTOC,
      structure: updatedStructure,
      updatedAt: new Date().toISOString()
    };

    setCurrentTOC(updatedTOC);
  };

  // Update a node
  const handleUpdateNode = (nodeId: string, updatedNode: ManualTOCNode) => {
    if (!currentTOC) return;

    const updateNodeInStructure = (nodes: ManualTOCNode[]): ManualTOCNode[] => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          return updatedNode;
        }
        if (node.children.length > 0) {
          return {
            ...node,
            children: updateNodeInStructure(node.children)
          };
        }
        return node;
      });
    };

    const updatedTOC = {
      ...currentTOC,
      structure: updateNodeInStructure(currentTOC.structure),
      updatedAt: new Date().toISOString()
    };

    setCurrentTOC(updatedTOC);
  };

  // Delete a node
  const handleDeleteNode = (nodeId: string) => {
    if (!currentTOC) return;

    const deleteNodeFromStructure = (nodes: ManualTOCNode[]): ManualTOCNode[] => {
      return nodes.filter(node => {
        if (node.id === nodeId) {
          return false; // Remove this node
        }
        if (node.children.length > 0) {
          node.children = deleteNodeFromStructure(node.children);
        }
        return true;
      });
    };

    const updatedTOC = {
      ...currentTOC,
      structure: deleteNodeFromStructure(currentTOC.structure),
      updatedAt: new Date().toISOString()
    };

    setCurrentTOC(updatedTOC);
  };

  // Helper function to get the last used page number
  const getLastUsedPage = (structure: ManualTOCNode[]): number => {
    let lastPage = 0;
    
    const findLastPage = (nodes: ManualTOCNode[]) => {
      nodes.forEach(node => {
        const nodeEndPage = node.endPage || node.startPage;
        if (nodeEndPage > lastPage) {
          lastPage = nodeEndPage;
        }
        if (node.children.length > 0) {
          findLastPage(node.children);
        }
      });
    };
    
    findLastPage(structure);
    return lastPage;
  };

  // Save current TOC
  const handleSave = async () => {
    if (!currentTOC) return;

    setIsLoading(true);
    try {
      await saveManualTOC(currentTOC);
      success('Manual TOC saved successfully');
    } catch (err: any) {
      error('Failed to save manual TOC: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  if (tocMode !== 'manual') {
    return null;
  }

  return (
    <Card sx={{ p: 3, backdropFilter: 'blur(6px)', background: 'rgba(255,255,255,0.05)' }}>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Manual TOC Editor
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Create your table of contents structure manually by defining chapters and page ranges.
        </Typography>

        {/* Split Layout Container */}
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 3,
          minHeight: '70vh'
        }}>
          
          {/* Left Side - PDF Viewer */}
          <Box>
            <Typography variant="h6" gutterBottom>
              PDF Preview
            </Typography>
            {(file || fileId) ? (
              <PageNumberIframeViewer 
                file={file} 
                fileId={fileId} 
                height={500}
                previewStartPage={previewStartPage}
                previewEndPage={previewEndPage}
                onPreviewExit={handleExitPreview}
              />
            ) : (
              <Alert severity="warning">
                No PDF loaded. Please go back and upload a PDF first.
              </Alert>
            )}
          </Box>

          {/* Right Side - TOC Editor */}
          <Box>
            {!currentTOC ? (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Initialize Manual TOC
                </Typography>
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    No manual TOC found. Start creating your table of contents structure.
                  </Typography>
                  
                  {/* Content Start Page Setting */}
                  <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 3 }}>
                    <TextField
                      label="Content starts at PDF page"
                      type="number"
                      value={contentStartPage}
                      onChange={(e) => setContentStartPage(Math.max(1, Number(e.target.value)))}
                      inputProps={{ min: 1 }}
                      size="small"
                      helperText="Page number where actual content begins"
                    />
                  </Stack>
                  
                  <Button 
                    variant="contained" 
                    onClick={initializeTOC}
                    disabled={!fileId}
                  >
                    Start Manual TOC Creation
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box>
                {/* Content Start Page Setting */}
                <Box sx={{ mb: 3 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <TextField
                      label="Content starts at PDF page"
                      type="number"
                      value={contentStartPage}
                      onChange={(e) => handleContentStartPageChange(Number(e.target.value))}
                      inputProps={{ min: 1 }}
                      size="small"
                      sx={{ width: 200 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      This offset is used to calculate PDF page numbers from content pages.
                    </Typography>
                  </Stack>
                </Box>

                {/* Tabbed Interface */}
                <Box sx={{ mb: 2 }}>
                  <Tabs 
                    value={activeTab} 
                    onChange={(_, newValue) => setActiveTab(newValue)}
                    variant="fullWidth"
                  >
                    <Tab label="Structure Editor" />
                    <Tab label="Preview" disabled={currentTOC.structure.length === 0} />
                  </Tabs>
                </Box>

                {/* Tab Content */}
                <Box sx={{ minHeight: 400 }}>
                  {activeTab === 0 && (
                    <TOCTreeEditor
                      nodes={currentTOC.structure}
                      contentStartPage={contentStartPage}
                      onUpdateNode={handleUpdateNode}
                      onDeleteNode={handleDeleteNode}
                      onAddNode={handleAddNode}
                      onPreview={handleNodePreview}
                    />
                  )}

                  {activeTab === 1 && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Final Structure Preview
                      </Typography>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        This will show the final folder structure and page assignments.
                      </Alert>
                      <Box sx={{ 
                        border: '1px solid', 
                        borderColor: 'divider', 
                        borderRadius: 2, 
                        p: 2,
                        bgcolor: 'background.default'
                      }}>
                        {currentTOC.structure.map((chapter, index) => (
                          <Box key={chapter.id} sx={{ mb: 2 }}>
                            <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                              📁 {index + 1}_{chapter.title.replace(/\s+/g, '_')}/
                            </Typography>
                            <Box sx={{ ml: 2 }}>
                              {chapter.children.length > 0 ? (
                                chapter.children.map((sub, subIndex) => (
                                  <Typography key={sub.id} variant="body2" sx={{ fontFamily: 'monospace' }}>
                                    📄 {index + 1}_{subIndex + 1}_{sub.title.replace(/\s+/g, '_')}.pdf (pages {sub.startPage}-{sub.endPage})
                                  </Typography>
                                ))
                              ) : (
                                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                  📄 {index + 1}_{chapter.title.replace(/\s+/g, '_')}.pdf (pages {chapter.startPage}-{chapter.endPage})
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>

                {/* Action Buttons */}
                <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                  <Button 
                    variant="contained" 
                    onClick={handleSave}
                    disabled={isLoading || currentTOC.structure.length === 0}
                  >
                    {isLoading ? 'Saving...' : 'Save TOC'}
                  </Button>
                  <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
                    {currentTOC.structure.length} chapters • Last updated: {new Date(currentTOC.updatedAt).toLocaleTimeString()}
                  </Typography>
                </Stack>
              </Box>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />
        
        {/* Instructions */}
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>How to use:</strong> Click the + button to add chapters. Click edit (pencil icon) to modify titles and page ranges. 
            Use "Add Subchapter" to create nested sections. Content pages start from 1, PDF pages are calculated automatically.
          </Typography>
        </Alert>

      </CardContent>
    </Card>
  );
};

export default ManualTOCEditor;
