"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface QualityContextType {
  qualityThreshold: number;
  setQualityThreshold: (threshold: number) => void;
  updateQualityThreshold: (threshold: number) => void;
}

const QualityContext = createContext<QualityContextType | undefined>(undefined);

export function QualityProvider({ children }: { children: React.ReactNode }) {
  const [qualityThreshold, setQualityThresholdState] = useState<number>(0.4);

  // Load threshold from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("imageQualityThreshold");
      if (saved) {
        const threshold = parseFloat(saved);
        if (!isNaN(threshold) && threshold >= 0 && threshold <= 1) {
          setQualityThresholdState(threshold);
        }
      }
    }
  }, []);

  const setQualityThreshold = (threshold: number) => {
    setQualityThresholdState(threshold);
    if (typeof window !== "undefined") {
      localStorage.setItem("imageQualityThreshold", threshold.toString());
    }
  };

  const updateQualityThreshold = async (threshold: number) => {
    setQualityThreshold(threshold);

    // Also update the backend configuration
    try {
      const { setQualityThreshold: setBackendThreshold } = await import(
        "@/backend_integration/api_quality"
      );
      await setBackendThreshold(threshold);
    } catch (error) {
      console.error("Error updating quality threshold on backend:", error);
    }
  };

  return (
    <QualityContext.Provider
      value={{
        qualityThreshold,
        setQualityThreshold,
        updateQualityThreshold,
      }}
    >
      {children}
    </QualityContext.Provider>
  );
}

export function useQuality() {
  const context = useContext(QualityContext);
  if (context === undefined) {
    throw new Error("useQuality must be used within a QualityProvider");
  }
  return context;
}
