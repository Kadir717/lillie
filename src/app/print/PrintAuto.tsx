"use client";

import { useEffect } from "react";

/**
 * Auto-opens the browser print dialog once the CV has rendered.
 * The dialog is shown a tick after mount so fonts/layout settle first.
 * No-op for keyboard users who trigger print themselves (window.print
 * in the dialog is the normal path for "Save as PDF").
 */
export default function PrintAuto() {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
