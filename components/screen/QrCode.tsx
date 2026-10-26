"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** A QR code for the join link, drawn locally (no outside service). */
export function QrCode({ value, className = "" }: { value: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(value, { margin: 1, width: 640, errorCorrectionLevel: "M", color: { dark: "#140a0f", light: "#fbf3e4" } })
      .then((url) => live && setSrc(url))
      .catch(() => live && setSrc(null));
    return () => {
      live = false;
    };
  }, [value]);
  if (!src) return <div className={`animate-pulse rounded-3xl bg-surface-2 ${className}`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`QR code for ${value}`} className={`rounded-3xl ${className}`} />;
}
