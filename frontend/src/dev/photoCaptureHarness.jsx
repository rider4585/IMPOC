/* DEV-ONLY harness for PhotoCapture (R-55): served by vite dev at /dev/photo-capture.html. Not imported by the app. */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '../components/ui/index.js';
import PhotoCapture from '../components/PhotoCapture.jsx';
import '../index.css';

function Harness() {
  const [img, setImg] = useState(null);
  return (
    <ToastProvider>
      <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 12, padding: 24 }}>
        <PhotoCapture onPhoto={setImg} />
        {img && <img src={img} id="result" alt="result" style={{ width: 240, borderRadius: 8 }} />}
        {img && <div id="bytes">{img.length} chars</div>}
      </div>
    </ToastProvider>
  );
}

createRoot(document.getElementById('root')).render(<Harness />);
