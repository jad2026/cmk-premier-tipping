"use client";
import { useEffect, useState } from "react";

export function useIsNativeApp(serverIsApp: boolean) {
  const [isApp, setIsApp] = useState(serverIsApp);
  useEffect(() => {
    if (!serverIsApp && typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform?.()) {
      setIsApp(true);
    }
  }, [serverIsApp]);
  return isApp;
}
