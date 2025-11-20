import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import { parseFile } from './utils/dataSimulator';
import { DataPoint, SignalMetadata } from './types';
import { RefreshCcw, FileCode } from 'lucide-react';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [dbcFile, setDbcFile] = useState<File | null>(null);
  const [data, setData] = useState<DataPoint[]>([]);
  const [metadata, setMetadata] = useState<SignalMetadata[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileLoad = async (uploadedFile: File, uploadedDbc: File | null) => {
    setLoading(true);
    try {
      const { data: parsedData, metadata: parsedMeta } = await parseFile(uploadedFile, uploadedDbc);
      
      setFile(uploadedFile);
      setDbcFile(uploadedDbc);
      setData(parsedData);
      setMetadata(parsedMeta);
    } catch (error) {
      console.error("Error processing file", error);
      alert("Failed to parse file. Please ensure the format is correct.");
    } finally {
      setLoading(false);
    }
  };

  const resetApp = () => {
    setFile(null);
    setDbcFile(null);
    setData([]);
    setMetadata([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-100">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-xl font-semibold animate-pulse">Processing Log Data...</h2>
        {dbcFile && (
            <p className="text-emerald-400 mt-2 text-sm flex items-center gap-2">
                <FileCode className="w-4 h-4" />
                Applying DBC Decoder: {dbcFile.name}
            </p>
        )}
        <p className="text-zinc-500 mt-2 text-sm">Analyzing {file?.name}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header for App State */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-950 flex items-center px-6 justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md shadow-lg shadow-blue-500/20"></div>
            <span className="font-bold text-lg tracking-tight">AutoLog Pro</span>
            {file && (
                <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1 bg-zinc-900 rounded-full border border-zinc-800 text-xs text-zinc-400">
                    <span>{file.name}</span>
                    {dbcFile && (
                        <>
                            <span className="text-zinc-600">|</span>
                            <span className="text-amber-500">{dbcFile.name}</span>
                        </>
                    )}
                </div>
            )}
        </div>
        {file && (
            <button 
                onClick={resetApp}
                className="text-sm text-zinc-400 hover:text-white flex items-center gap-2 transition-colors px-3 py-1.5 hover:bg-zinc-900 rounded-lg"
            >
                <RefreshCcw className="w-4 h-4" />
                Load New File
            </button>
        )}
      </header>

      <main className="flex-1 p-4 md:p-6 overflow-hidden flex flex-col">
        {!file ? (
          <div className="flex-1 flex items-center justify-center">
            <FileUpload onFileLoaded={handleFileLoad} />
          </div>
        ) : (
          <Dashboard 
            data={data} 
            metadata={metadata} 
            fileName={file.name} 
          />
        )}
      </main>
    </div>
  );
};

export default App;