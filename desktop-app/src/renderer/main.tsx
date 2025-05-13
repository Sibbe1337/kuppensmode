import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

console.log('Renderer main.tsx executing...');

const rootElement = document.getElementById('root');
if (rootElement) {
  console.log('Found #root element, rendering App...');
  createRoot(rootElement).render(<App />);
} else {
  console.error('#root element not found in index.html!');
} 