import { useEffect, useState } from "react";

const STORAGE_KEY = "app:brand-logo";
const EVENT = "app:brand-logo-changed";

/**
 * Persists the logo used on the Radiographic Examination Report print
 * (and any other branded artifact) as a base64 data URL in localStorage,
 * so it works in both API and browser-only fallback modes.
 */
export function useBrandLogo() {
  const [logo, setLogoState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  useEffect(() => {
    const onChange = () => setLogoState(localStorage.getItem(STORAGE_KEY));
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setLogo = (dataUrl: string | null) => {
    if (dataUrl) localStorage.setItem(STORAGE_KEY, dataUrl);
    else localStorage.removeItem(STORAGE_KEY);
    setLogoState(dataUrl);
    window.dispatchEvent(new Event(EVENT));
  };

  return { logo, setLogo };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const maxWidth = 600;
        const maxHeight = 240;
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) throw new Error("Canvas not available");

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    };

    img.src = objectUrl;
  });
}