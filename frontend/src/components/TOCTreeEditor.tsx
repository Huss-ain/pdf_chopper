import React, { useState } from 'react';
import { 
  Box,
  TextField,
  IconButton,
  Stack,
  Typography,
  Tooltip,
  Collapse,
  Chip,
  Button
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';
import type { ManualTOCNode } from '../types/manual-toc';
import { calculatePDFPages } from '../types/manual-toc';

interface TOCNodeEditorProps {
  node: ManualTOCNode;
  contentStartPage: number;
  onUpdate: (updatedNode: ManualTOCNode) => void;
  onDelete: (nodeId: string) => void;
  onAddChild: (parentId: string) => void;
  onPreview?: (node: ManualTOCNode) => void;
  level?: number;
}

const TOCNodeEditor: React.FC<TOCNodeEditorProps> = ({
  node,
  contentStartPage,
  onUpdate,
  onDelete,
  onAddChild,
  onPreview,
  level = 0
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [editData, setEditData] = useState({
    title: node.title,
    startPage: node.startPage,
    endPage: node.endPage || node.startPage
  });

  // Calculate PDF page numbers for display
  const pdfStartPage = calculatePDFPages(contentStartPage, node.startPage);
  const pdfEndPage = calculatePDFPages(contentStartPage, node.endPage || node.startPage);

  const handleEdit = () => {
    setEditData({
      title: node.title,
      startPage: node.startPage,
      endPage: node.endPage || node.startPage
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    const updatedNode: ManualTOCNode = {
      ...node,
      title: editData.title.trim() || `Chapter ${level + 1}`,
      startPage: Math.max(1, editData.startPage),
      endPage: Math.max(editData.startPage, editData.endPage),
      pdfStartPage: calculatePDFPages(contentStartPage, Math.max(1, editData.startPage)),
      pdfEndPage: calculatePDFPages(contentStartPage, Math.max(editData.startPage, editData.endPage))
    };
    onUpdate(updatedNode);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData({
      title: node.title,
      startPage: node.startPage,
      endPage: node.endPage || node.startPage
    });
    setIsEditing(false);
  };

  const handleAddSubchapter = () => {
    onAddChild(node.id);
    setIsExpanded(true); // Expand to show new child
  };

  const indentLevel = level * 24;
  const nodeIcon = level === 0 ? '📁' : '📄';
  const hasChildren = node.children && node.children.length > 0;

  return (
    <Box>
      {/* Main Node */}
      <Box sx={{ 
        ml: `${indentLevel}px`,
        mb: 2,
        p: isEditing ? 3 : 2,
        border: '2px solid',
        borderColor: isEditing ? 'primary.main' : 'divider',
        borderRadius: 2,
        bgcolor: isEditing ? 'primary.50' : 'transparent',
        position: 'relative',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          borderColor: isEditing ? 'primary.main' : 'primary.light',
          bgcolor: isEditing ? 'primary.50' : 'action.hover'
        }
      }}>
        <Stack direction="row" alignItems="flex-start" spacing={1}>
          {/* Expand/Collapse for chapters with children */}
          {level === 0 && (
            <IconButton
              size="small"
              onClick={() => setIsExpanded(!isExpanded)}
              disabled={!hasChildren}
              sx={{ visibility: hasChildren ? 'visible' : 'hidden', mt: isEditing ? 1 : 0 }}
            >
              {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
            </IconButton>
          )}

          <Typography variant="body2" sx={{ minWidth: 20, mt: isEditing ? 1 : 0 }}>
            {nodeIcon}
          </Typography>

          {/* Editing Mode Header */}
          {isEditing && (
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <Typography variant="h6" color="primary.main">
                  Editing {level === 0 ? 'Chapter' : 'Subchapter'}
                </Typography>
                <Chip
                  label="Edit Mode"
                  size="small"
                  color="primary"
                  variant="filled"
                />
              </Stack>
              
              {/* Title Field - Full Width */}
              <TextField
                fullWidth
                label="Title"
                value={editData.title}
                onChange={(e) => setEditData({...editData, title: e.target.value})}
                placeholder={`Enter ${level === 0 ? 'chapter' : 'subchapter'} title...`}
                sx={{ mb: 2 }}
                autoFocus
              />
              
              {/* Page Range Fields and Actions */}
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <TextField
                  type="number"
                  label="Start Page"
                  value={editData.startPage}
                  onChange={(e) => setEditData({...editData, startPage: Number(e.target.value)})}
                  inputProps={{ min: 1 }}
                  sx={{ width: 130 }}
                  helperText="Content page"
                />
                <TextField
                  type="number"
                  label="End Page"
                  value={editData.endPage}
                  onChange={(e) => setEditData({...editData, endPage: Number(e.target.value)})}
                  inputProps={{ min: editData.startPage }}
                  sx={{ width: 130 }}
                  helperText="Content page"
                />
                
                {/* PDF Page Preview */}
                <Box sx={{ 
                  px: 2, 
                  py: 1, 
                  bgcolor: 'action.hover', 
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider'
                }}>
                  <Typography variant="caption" color="text.secondary">
                    PDF Pages
                  </Typography>
                  <Typography variant="body2">
                    {calculatePDFPages(contentStartPage, editData.startPage)} - {calculatePDFPages(contentStartPage, editData.endPage)}
                  </Typography>
                </Box>

                {/* Action Buttons */}
                <Stack direction="row" spacing={1}>
                  <Button 
                    variant="contained" 
                    size="small" 
                    onClick={handleSave} 
                    startIcon={<SaveIcon />}
                    color="primary"
                  >
                    Save
                  </Button>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={handleCancel}
                    startIcon={<CancelIcon />}
                  >
                    Cancel
                  </Button>
                </Stack>
              </Stack>
            </Box>
          )}

          {/* Display Mode */}
          {!isEditing && (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  flex: 1, 
                  fontWeight: 500,
                  cursor: onPreview ? 'pointer' : 'default',
                  '&:hover': onPreview ? {
                    color: 'primary.main',
                    textDecoration: 'underline'
                  } : {}
                }}
                onClick={onPreview ? () => onPreview(node) : undefined}
                title={onPreview ? 'Click to preview this section' : undefined}
              >
                {node.title}
              </Typography>
              <Chip
                label={`p.${node.startPage}-${node.endPage || node.startPage}`}
                size="small"
                variant="outlined"
                color="primary"
              />
              <Chip
                label={`PDF: ${pdfStartPage}-${pdfEndPage}`}
                size="small"
                variant="outlined"
                color="secondary"
              />
              <Tooltip title="Edit">
                <IconButton size="small" onClick={handleEdit}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {level === 0 && (
                <Tooltip title="Add Subchapter">
                  <IconButton size="small" onClick={handleAddSubchapter} color="primary">
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Delete">
                <IconButton size="small" onClick={() => onDelete(node.id)} color="error">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </Stack>
      </Box>

      {/* Children (Subchapters) */}
      {level === 0 && hasChildren && (
        <Collapse in={isExpanded}>
          <Box>
            {node.children.map((child) => (
              <TOCNodeEditor
                key={child.id}
                node={child}
                contentStartPage={contentStartPage}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onAddChild={onAddChild}
                onPreview={onPreview}
                level={level + 1}
              />
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

interface TOCTreeEditorProps {
  nodes: ManualTOCNode[];
  contentStartPage: number;
  onUpdateNode: (nodeId: string, updatedNode: ManualTOCNode) => void;
  onDeleteNode: (nodeId: string) => void;
  onAddNode: (parentId?: string) => void;
  onPreview?: (node: ManualTOCNode) => void;
}

const TOCTreeEditor: React.FC<TOCTreeEditorProps> = ({
  nodes,
  contentStartPage,
  onUpdateNode,
  onDeleteNode,
  onAddNode,
  onPreview
}) => {
  const handleUpdateNode = (updatedNode: ManualTOCNode) => {
    onUpdateNode(updatedNode.id, updatedNode);
  };

  const handleAddChild = (parentId: string) => {
    onAddNode(parentId);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">
          Table of Contents Structure
        </Typography>
        <Tooltip title="Add Chapter">
          <IconButton onClick={() => onAddNode()} color="primary">
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      <Box sx={{ 
        border: '1px solid', 
        borderColor: 'divider', 
        borderRadius: 2, 
        p: 2, 
        minHeight: 300,
        maxHeight: 500,
        overflowY: 'auto'
      }}>
        {nodes.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              No chapters added yet. Click the + button to add your first chapter.
            </Typography>
          </Box>
        ) : (
          <Box>
            {nodes.map((node) => (
              <TOCNodeEditor
                key={node.id}
                node={node}
                contentStartPage={contentStartPage}
                onUpdate={handleUpdateNode}
                onDelete={onDeleteNode}
                onAddChild={handleAddChild}
                onPreview={onPreview}
                level={0}
              />
            ))}
          </Box>
        )}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        <strong>Tips:</strong> Content pages start from 1. PDF pages are calculated automatically based on your content start page setting.
      </Typography>
    </Box>
  );
};

export default TOCTreeEditor;
