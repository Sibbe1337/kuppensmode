"use client";
import React, { useEffect } from "react";

export default function ElectronAuthView() {
  useEffect(() => {
    // Any Electron or window-specific logic can go here
    console.log("ElectronAuthView loaded in browser context");
  }, []);

  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <h1>Electron Auth View</h1>
      <p>This page is only loaded in the browser (Electron in-app webview).</p>
    </div>
  );
}
