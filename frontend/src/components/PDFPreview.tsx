import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface PDFPreviewProps {
  file?: File;
  fileId?: string;
  height?: number;
}

const PDFPreview: React.FC<PDFPreviewProps> = ({ file, fileId, height = 420 }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading] = useState(false);

  useEffect(() => {
    let revoke: string | null = null;
    if (file) {
      const blobUrl = URL.createObjectURL(file);
      setUrl(blobUrl);
      revoke = blobUrl;
    } else if (fileId) {
      setUrl(`http://localhost:8000/pdf?file_id=${fileId}`);
    } else {
      setUrl(null);
    }
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [file, fileId]);

  if (!url) return <Typography variant="body2" color="text.secondary">No PDF to preview yet.</Typography>;

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
      {loading && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.paper', opacity: 0.7 }}>
          <CircularProgress size={32} />
        </Box>
      )}
      <iframe
        title="PDF Preview"
        src={url}
        style={{ width: '100%', height, border: 'none' }}
      />
    </Box>
  );
};

export default PDFPreview;
