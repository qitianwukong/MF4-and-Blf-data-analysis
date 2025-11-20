import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { SignalMetadata, DataPoint, GeminiAnalysisResult, AnalysisStatus } from '../types';
import { Activity, Cpu, FileBarChart, Sparkles, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { analyzeVehicleData } from '../services/geminiService';

interface DashboardProps {
  data: DataPoint[];
  metadata: SignalMetadata[];
  fileName: string;
}

const Dashboard: React.FC<DashboardProps> = ({ data, metadata, fileName }) => {
  const [selectedSignals, setSelectedSignals] = useState<string[]>(metadata.map(m => m.name).slice(0, 2));
  const [analysis, setAnalysis] = useState<GeminiAnalysisResult | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);

  const toggleSignal = (name: string) => {
    setSelectedSignals(prev => 
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const handleRunAnalysis = async () => {
    setAnalysisStatus(AnalysisStatus.LOADING);
    try {
      // Only analyze selected or all? Let's analyze all metadata to give context
      const result = await analyzeVehicleData(fileName, metadata);
      setAnalysis(result);
      setAnalysisStatus(AnalysisStatus.COMPLETE);
    } catch (e) {
      setAnalysisStatus(AnalysisStatus.ERROR);
    }
  };

  const activeMetadata = useMemo(() => 
    metadata.filter(m => selectedSignals.includes(m.name)), 
  [metadata, selectedSignals]);

  return (
    <div className="flex flex-col h-full bg-zinc-900/50 rounded-xl overflow-hidden border border-zinc-800">
      {/* Top Toolbar */}
      <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-blue-500" />
            {fileName}
          </h2>
          <p className="text-zinc-400 text-xs mt-1">
            {data.length} samples • {metadata.length} signals available
          </p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleRunAnalysis}
                disabled={analysisStatus === AnalysisStatus.LOADING}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20"
            >
                {analysisStatus === AnalysisStatus.LOADING ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <Sparkles className="w-4 h-4" />
                )}
                Run AI Diagnostics
            </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: Signals */}
        <div className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col overflow-y-auto">
          <div className="p-3 text-xs font-bold text-zinc-500 uppercase tracking-wider sticky top-0 bg-zinc-950 z-10">
            Available Signals
          </div>
          <div className="flex flex-col gap-1 p-2">
            {metadata.map((sig) => (
              <button
                key={sig.name}
                onClick={() => toggleSignal(sig.name)}
                className={`flex items-center justify-between p-3 rounded-lg text-sm transition-colors border ${
                  selectedSignals.includes(sig.name)
                    ? 'bg-zinc-900 border-zinc-700 text-white'
                    : 'hover:bg-zinc-900/50 border-transparent text-zinc-400'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <div 
                    className="w-2 h-2 rounded-full shrink-0" 
                    style={{ backgroundColor: sig.color }}
                  />
                  <span className="truncate">{sig.name}</span>
                </div>
                {selectedSignals.includes(sig.name) && (
                  <Activity className="w-3 h-3 text-zinc-500" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content: Charts & Stats */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 gap-4">
          
          {/* Chart Area */}
          <div className="h-[400px] bg-zinc-900 rounded-xl border border-zinc-800 p-4 shadow-sm relative">
            {selectedSignals.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-zinc-500 flex-col">
                    <Activity className="w-12 h-12 mb-2 opacity-20" />
                    <p>Select signals from the sidebar to visualize</p>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis 
                    dataKey="timestamp" 
                    stroke="#71717a" 
                    tick={{fontSize: 12}}
                    label={{ value: 'Time (s)', position: 'insideBottomRight', offset: -5, fill: '#71717a' }}
                    />
                    <YAxis stroke="#71717a" tick={{fontSize: 12}} />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff' }}
                        itemStyle={{ fontSize: '12px' }}
                        labelStyle={{ color: '#a1a1aa', marginBottom: '0.5rem' }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    {activeMetadata.map((sig) => (
                    <Line
                        key={sig.name}
                        type="monotone"
                        dataKey={sig.name}
                        stroke={sig.color}
                        dot={false}
                        strokeWidth={2}
                        activeDot={{ r: 6 }}
                        animationDuration={1000}
                    />
                    ))}
                    <Brush 
                        dataKey="timestamp" 
                        height={30} 
                        stroke="#52525b"
                        fill="#27272a"
                        tickFormatter={() => ''}
                    />
                </LineChart>
                </ResponsiveContainer>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeMetadata.map((sig) => (
              <div key={sig.name} className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium text-zinc-200 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sig.color }} />
                    {sig.name}
                  </h3>
                  <span className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-400">{sig.unit}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-zinc-500 text-xs">Average</p>
                    <p className="text-xl font-semibold text-white">{sig.avg}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Max</p>
                    <p className="text-white">{sig.max}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Min</p>
                    <p className="text-white">{sig.min}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Std Dev</p>
                    <p className="text-zinc-400">{sig.stdDev}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Gemini Analysis Panel */}
          {analysis && (
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-purple-500/30 rounded-xl p-6 shadow-xl">
              <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                AI Diagnostic Report
              </h3>
              
              <div className="space-y-6">
                <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/50">
                  <h4 className="text-zinc-400 text-sm uppercase font-bold tracking-wider mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4" /> Executive Summary
                  </h4>
                  <p className="text-zinc-300 leading-relaxed">{analysis.summary}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-red-950/10 p-4 rounded-lg border border-red-900/20">
                        <h4 className="text-red-400 text-sm uppercase font-bold tracking-wider mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> Anomalies Detected
                        </h4>
                        <ul className="space-y-2">
                            {analysis.anomalies.map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-zinc-300 text-sm">
                                    <span className="text-red-500 mt-1">•</span> {item}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-emerald-950/10 p-4 rounded-lg border border-emerald-900/20">
                        <h4 className="text-emerald-400 text-sm uppercase font-bold tracking-wider mb-2 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" /> Recommendations
                        </h4>
                        <ul className="space-y-2">
                            {analysis.recommendations.map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-zinc-300 text-sm">
                                    <span className="text-emerald-500 mt-1">•</span> {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
