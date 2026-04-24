import { useEffect, useState } from "react";

const STORAGE_KEY = "app:brand-address";
const EVENT = "app:brand-address-changed";

export const DEFAULT_BRAND_ADDRESS = `Technologies
Coventry
Nasmyth Technologies
Coventry Road, Exhall
Coventry CV7 9FT
United Kingdom
Tel: +44 (0) 2476 369400
Fax: +44 (0) 02476 368000
www.nasmythgroup.com`;

/**
 * Persists the multi-line address shown on the top-right of the printed
 * Radiographic Examination Report. Stored in localStorage so it works in
 * both API and browser-only fallback modes.
 */
export function useBrandAddress() {
  const [address, setAddressState] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_BRAND_ADDRESS;
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_BRAND_ADDRESS;
  });

  useEffect(() => {
    const onChange = () =>
      setAddressState(localStorage.getItem(STORAGE_KEY) ?? DEFAULT_BRAND_ADDRESS);
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const setAddress = (value: string) => {
    localStorage.setItem(STORAGE_KEY, value);
    setAddressState(value);
    window.dispatchEvent(new Event(EVENT));
  };

  const resetAddress = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAddressState(DEFAULT_BRAND_ADDRESS);
    window.dispatchEvent(new Event(EVENT));
  };

  return { address, setAddress, resetAddress };
}