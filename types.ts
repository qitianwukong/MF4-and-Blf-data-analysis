export interface DataPoint {
  timestamp: number;
  [key: string]: number;
}

export interface SignalMetadata {
  name: string;
  unit: string;
  min: number;
  max: number;
  avg: number;
  stdDev: number;
  color: string;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}

export interface GeminiAnalysisResult {
  summary: string;
  anomalies: string[];
  recommendations: string[];
}

export interface FileUploadState {
  fileName: string | null;
  fileSize: string | null;
  type: 'MDF' | 'MF4' | 'BLF' | 'CSV' | null;
}
