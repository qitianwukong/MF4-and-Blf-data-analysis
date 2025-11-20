
import React, { useCallback, useState, useEffect } from 'react';
import { Upload, FileType, AlertCircle, FileCode, Check, X } from 'lucide-react';

interface FileUploadProps {
  onFileLoaded: (logFile: File, dbcFile: File | null) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileLoaded }) => {
  const [logFile, setLogFile] = useState<File | null>(null);
  const [dbcFile, setDbcFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragOver(true);
    } else if (e.type === "dragleave") {
      setIsDragOver(false);
    }
  }, []);

  const validateAndSetLogFile = (file: File) => {
    setError(null);
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['mdf', 'mf4', 'blf', 'csv', 'asc'].includes(extension || '')) {
      setError("Unsupported log format. Use .MF4, .MDF, .BLF, .ASC or .CSV");
      return;
    }
    setLogFile(file);
    // Reset DBC if a non-BLF file is loaded
    if (extension !== 'blf') {
      setDbcFile(null);
    }
  };

  const validateAndSetDbcFile = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'dbc') {
      setError("Invalid database file. Please upload a .DBC file.");
      return;
    }
    setDbcFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      const ext = droppedFile.name.split('.').pop()?.toLowerCase();

      if (ext === 'dbc') {
        if (logFile && logFile.name.toLowerCase().endsWith('.blf')) {
           validateAndSetDbcFile(droppedFile);
        } else {
           setError("Please upload a BLF log file first before adding a DBC.");
        }
      } else {
        validateAndSetLogFile(droppedFile);
      }
    }
  }, [logFile]);

  const handleLogChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetLogFile(e.target.files[0]);
    }
  };

  const handleDbcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetDbcFile(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (logFile) {
      onFileLoaded(logFile, dbcFile);
    }
  };

  const isBlf = logFile?.name.toLowerCase().endsWith('.blf');

  return (
    <div className="w-full max-w-3xl mx-auto mt-10 p-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
            AutoLog <span className="text-blue-500">Analytics</span> Pro
        </h1>
        <p className="text-zinc-400">
            Professional automotive data analysis. Supports <span className="text-zinc-200">Vector BLF</span>, <span className="text-zinc-200">MDF4</span> and CSV.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Main Log File Upload */}
        <div 
            className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300
            ${isDragOver ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 hover:border-zinc-600 bg-zinc-900/50"}
            ${logFile ? "border-emerald-500/50 bg-emerald-900/10" : ""}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
        >
            {!logFile ? (
                <>
                    <input 
                        type="file" 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={handleLogChange}
                        accept=".mf4,.mdf,.blf,.csv,.asc"
                    />
                    <div className="flex flex-col items-center justify-center gap-4 pointer-events-none">
                        <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center">
                            <Upload className="w-7 h-7 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-lg font-medium text-white">Drop Log File (MF4, BLF, MDF, CSV)</p>
                            <p className="text-sm text-zinc-500 mt-1">Drag & drop or click to browse</p>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                            <FileType className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div className="text-left">
                            <p className="text-white font-medium">{logFile.name}</p>
                            <p className="text-xs text-zinc-400">{(logFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => { setLogFile(null); setDbcFile(null); }}
                        className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>
            )}
        </div>

        {/* DBC File Upload (Conditional) */}
        {isBlf && (
            <div className={`relative border border-dashed rounded-xl p-4 transition-all duration-500 
                ${dbcFile ? 'border-amber-500/50 bg-amber-900/10' : 'border-amber-900/30 bg-amber-950/10 border-amber-800/50'}`}>
                
                {!dbcFile ? (
                    <>
                        <input 
                            type="file" 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            onChange={handleDbcChange}
                            accept=".dbc"
                        />
                        <div className="flex items-center justify-center gap-3 pointer-events-none">
                            <FileCode className="w-5 h-5 text-amber-500" />
                            <span className="text-zinc-300 font-medium">Recommended: Add .DBC to decode signals</span>
                            <span className="text-xs bg-amber-900/50 text-amber-200 px-2 py-1 rounded border border-amber-800">Required for decoding</span>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                <FileCode className="w-4 h-4 text-amber-500" />
                            </div>
                            <div className="text-left">
                                <p className="text-white font-medium text-sm">{dbcFile.name}</p>
                                <p className="text-xs text-zinc-400">Database Loaded</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setDbcFile(null)}
                            className="p-1 hover:bg-zinc-800 rounded-full transition-colors"
                        >
                            <X className="w-4 h-4 text-zinc-400" />
                        </button>
                    </div>
                )}
            </div>
        )}

        {error && (
            <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-lg flex items-center gap-3 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{error}</span>
            </div>
        )}

        {/* Action Button */}
        {logFile && (
            <button
                onClick={handleSubmit}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
            >
                <span>Analyze Data</span>
                {dbcFile && <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-normal">+ DBC Signals</span>}
            </button>
        )}
      </div>

      <div className="mt-12 grid grid-cols-3 gap-4 text-center text-zinc-500 text-xs">
        <div className="flex flex-col items-center gap-2">
            <FileType className="w-6 h-6 mb-1 text-zinc-600" />
            <span>Real DBC<br/>Decoding</span>
        </div>
        <div className="flex flex-col items-center gap-2">
            <svg className="w-6 h-6 mb-1 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
            </svg>
            <span>Heuristic Binary<br/>Scanning</span>
        </div>
        <div className="flex flex-col items-center gap-2">
            <svg className="w-6 h-6 mb-1 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                <path d="M12 2a10 10 0 0 1 10 10" />
                <path d="m9 22 3-3 3 3" />
            </svg>
            <span>Gemini AI<br/>Diagnostics</span>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
