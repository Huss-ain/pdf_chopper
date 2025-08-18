import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Container, CssBaseline, ThemeProvider, createTheme, IconButton } from '@mui/material';
import WorkflowStepper from './components/WorkflowStepper';
import { WorkflowProvider } from './state/WorkflowContext';
import { ToastProvider } from './state/ToastContext';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';



function App() {
  const [mode, setMode] = React.useState<'light' | 'dark'>('dark');
  const theme = React.useMemo(() => createTheme({
    palette: { mode, primary: { main: '#6366f1' }, background: { default: mode === 'dark' ? '#0f1115' : '#f7f8fa', paper: mode === 'dark' ? '#181b21' : '#ffffff' } },
    shape: { borderRadius: 12 },
    typography: { fontFamily: 'Inter, system-ui, sans-serif' }
  }), [mode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <WorkflowProvider>
        <ToastProvider>
        <Router>
          <AppBar position="static" color="transparent" elevation={0} sx={{ backdropFilter: 'blur(8px)', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Toolbar>
              <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>PDF Book Breakdown</Typography>
              <IconButton color="inherit" onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')}>
                {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Toolbar>
          </AppBar>
          <Container sx={{ my: 6, maxWidth: 1000 }}>
            <Routes>
              <Route path="/" element={<WorkflowStepper />} />
            </Routes>
          </Container>
        </Router>
        </ToastProvider>
      </WorkflowProvider>
    </ThemeProvider>
  );
}

export default App;
