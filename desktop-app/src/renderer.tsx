import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // You can create this file for global styles

function App() {
  const handleRestore = async () => {
    console.log('Renderer: Requesting latest good snapshot restore...');
    try {
      // This assumes your preload script exposed 'electronAPI.invoke'
      const result = await (window as any).electronAPI.invoke('trigger-restore-latest-good');
      console.log('Renderer: Restore process response:', result);
      // Update UI based on result (e.g., show success/error message)
    } catch (error) {
      console.error('Renderer: Error triggering restore:', error);
      // Update UI to show error
    }
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>PageLifeline Desktop</h1>
      <p>This is the main window. Most functionality is in the tray menu.</p>
      <button 
        onClick={handleRestore} 
        style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
      >
        Test Restore Latest Good Snapshot (from Window)
      </button>
      <p style={{ marginTop: '20px', fontSize: '12px', color: 'gray' }}>
        Right-click the PageLifeline icon in your system tray for options.
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 