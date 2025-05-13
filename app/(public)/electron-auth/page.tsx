"use client";
import dynamic from "next/dynamic";

// Only import the Electron view in the browser
const ElectronAuthView = dynamic(
  () => import("../ElectronAuthView"),
  { ssr: false }
);

export default function Page() {
  return <ElectronAuthView />;
} 