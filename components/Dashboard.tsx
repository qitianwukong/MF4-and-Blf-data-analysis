
import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { SignalMetadata, DataPoint, GeminiAnalysisResult, AnalysisStatus } from '../types';
import { Activity, FileBarChart, Sparkles, AlertTriangle, CheckCircle, Info, Search, CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react';
import { analyzeVehicleData } from '../services/geminiService';

interface DashboardProps {
  data: DataPoint[];
  metadata: SignalMetadata[];
  fileName: string;
}

const Dashboard: React.FC<DashboardProps> = ({ data, metadata, fileName }) => {
  // Initialize with first 3 signals selected by default
  const [selectedSignals, setSelectedSignals] = useState<string[]>(
    metadata.map(m => m.name).slice(0, 3)
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [analysis, setAnalysis] = useState<GeminiAnalysisResult | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  
  const [isAnomaliesOpen, setIsAnomaliesOpen] = useState(true);
  const [isRecommendationsOpen, setIsRecommendationsOpen] = useState(true);

  const toggleSignal = (name: string) => {
    setSelectedSignals(prev => 
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const selectAllVisible = () => {
    const visibleNames = filteredMetadata.map(m => m.name);
    // Add visible names that aren't already selected
    const newSelection = [...new Set([...selectedSignals, ...visibleNames])];
    setSelectedSignals(newSelection);
  };

  const deselectAllVisible = () => {
    const visibleNames = filteredMetadata.map(m => m.name);
    setSelectedSignals(prev => prev.filter(name => !visibleNames.includes(name)));
  };

  const handleRunAnalysis = async () => {
    setAnalysisStatus(AnalysisStatus.LOADING);
    try {
      // Analyze active signals only to save tokens and be relevant
      const activeSignals = metadata.filter(m => selectedSignals.includes(m.name));
      // If no signals selected, analyze top 5 important looking ones or just first 5
      const signalsToAnalyze = activeSignals.length > 0 ? activeSignals : metadata.slice(0, 5);
      
      const result = await analyzeVehicleData(fileName, signalsToAnalyze);
      setAnalysis(result);
      // Reset toggles to open when new analysis comes in
      setIsAnomaliesOpen(true);
      setIsRecommendationsOpen(true);
      setAnalysisStatus(AnalysisStatus.COMPLETE);
    } catch (e) {
      setAnalysisStatus(AnalysisStatus.ERROR);
    }
  };

  // Filter sidebar list based on search
  const filteredMetadata = useMemo(() => {
    if (!searchTerm) return metadata;
    return metadata.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [metadata, searchTerm]);

  // Get data for chart
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
            {data.length} samples • {selectedSignals.length}/{metadata.length} signals active
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
        <div className="w-72 bg-zinc-950 border-r border-zinc-800 flex flex-col">
          {/* Search & Tools */}
          <div className="p-3 border-b border-zinc-800 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-zinc-500" />
              <input 
                type="text"
                placeholder="Search signals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={selectAllVisible}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <CheckSquare className="w-3 h-3" /> All
              </button>
              <button 
                onClick={deselectAllVisible}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <Square className="w-3 h-3" /> None
              </button>
            </div>
          </div>

          {/* Signal List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
             {filteredMetadata.length === 0 ? (
                <div className="text-center p-4 text-zinc-600 text-sm">
                  No signals found
                </div>
             ) : (
               filteredMetadata.map((sig) => (
                <button
                  key={sig.name}
                  onClick={() => toggleSignal(sig.name)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg text-sm transition-all border group ${
                    selectedSignals.includes(sig.name)
                      ? 'bg-zinc-900/80 border-zinc-700 text-white'
                      : 'hover:bg-zinc-900/30 border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div 
                      className={`w-2.5 h-2.5 rounded-full shrink-0 transition-opacity ${selectedSignals.includes(sig.name) ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'}`}
                      style={{ backgroundColor: sig.color }}
                    />
                    <span className="truncate" title={sig.name}>{sig.name}</span>
                  </div>
                  {selectedSignals.includes(sig.name) && (
                    <Activity className="w-3.5 h-3.5 text-zinc-600" />
                  )}
                </button>
              ))
             )}
          </div>
        </div>

        {/* Main Content: Charts & Stats */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 gap-4 bg-zinc-950/50">
          
          {/* Chart Area */}
          <div className="h-[450px] bg-zinc-900 rounded-xl border border-zinc-800 p-4 shadow-sm relative">
            {activeMetadata.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-zinc-500 flex-col gap-3">
                    <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center">
                      <Activity className="w-8 h-8 opacity-40" />
                    </div>
                    <p>Select signals from the sidebar to visualize</p>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis 
                      dataKey="timestamp" 
                      stroke="#52525b" 
                      tick={{fontSize: 11, fill: '#71717a'}}
                      tickLine={false}
                      axisLine={{ stroke: '#3f3f46' }}
                      label={{ value: 'Time (mm:ss)', position: 'insideBottomRight', offset: -5, fill: '#71717a', fontSize: 12 }}
                      tickFormatter={(value) => {
                          if (typeof value === 'number') {
                              const m = Math.floor(value / 60);
                              const s = Math.floor(value % 60);
                              return `${m}:${s.toString().padStart(2, '0')}`;
                          }
                          return value;
                      }}
                    />
                    <YAxis 
                      stroke="#52525b" 
                      tick={{fontSize: 11, fill: '#71717a'}} 
                      tickLine={false}
                      axisLine={{ stroke: '#3f3f46' }}
                    />
                    <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(24, 24, 27, 0.95)', borderColor: '#3f3f46', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        itemStyle={{ fontSize: '12px', padding: '2px 0' }}
                        labelStyle={{ color: '#a1a1aa', marginBottom: '8px', fontSize: '12px', fontWeight: 600 }}
                        cursor={{ stroke: '#52525b', strokeWidth: 1 }}
                        labelFormatter={(value) => {
                            if (typeof value === 'number') {
                                const m = Math.floor(value / 60);
                                const s = Math.floor(value % 60);
                                return `Time: ${m}:${s.toString().padStart(2, '0')} (${value.toFixed(1)}s)`;
                            }
                            return `Time: ${value}`;
                        }}
                        formatter={(value: number, name: string) => {
                            const meta = metadata.find(m => m.name === name);
                            const unitStr = (meta?.unit && meta.unit !== '-' && meta.unit !== '') ? ` ${meta.unit}` : '';
                            return [`${value}${unitStr}`, name];
                        }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', opacity: 0.8 }} />
                    {activeMetadata.map((sig) => (
                    <Line
                        key={sig.name}
                        type="monotone"
                        dataKey={sig.name}
                        stroke={sig.color}
                        dot={false}
                        strokeWidth={1.5}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                        animationDuration={800}
                        isAnimationActive={false}
                    />
                    ))}
                    <Brush 
                        dataKey="timestamp" 
                        height={30} 
                        stroke="#3f3f46"
                        fill="#18181b"
                        tickFormatter={() => ''}
                        opacity={0.5}
                    />
                </LineChart>
                </ResponsiveContainer>
            )}
          </div>

          {/* Stats Grid */}
          {activeMetadata.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {activeMetadata.map((sig) => (
                <div key={sig.name} className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 hover:border-zinc-700 transition-colors group">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-medium text-zinc-200 flex items-center gap-2 text-sm truncate pr-2" title={sig.name}>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sig.color }} />
                      <span className="truncate">{sig.name}</span>
                    </h3>
                    <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 font-mono shrink-0">{sig.unit}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                    <div>
                      <p className="text-zinc-500 mb-0.5">Avg</p>
                      <p className="text-zinc-200 font-mono">{sig.avg}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 mb-0.5">Max</p>
                      <p className="text-zinc-200 font-mono">{sig.max}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 mb-0.5">Min</p>
                      <p className="text-zinc-200 font-mono">{sig.min}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 mb-0.5">StdDev</p>
                      <p className="text-zinc-400 font-mono">{sig.stdDev}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Gemini Analysis Panel */}
          {analysis && (
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-purple-500/30 rounded-xl p-6 shadow-xl mt-4">
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
                    <div className="bg-red-950/10 p-4 rounded-lg border border-red-900/20 transition-all">
                        <button 
                            onClick={() => setIsAnomaliesOpen(!isAnomaliesOpen)}
                            className="w-full flex items-center justify-between text-red-400 text-sm uppercase font-bold tracking-wider mb-2 hover:text-red-300 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> Anomalies Detected
                            </div>
                            {isAnomaliesOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        
                        {isAnomaliesOpen && (
                            <ul className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                {analysis.anomalies.map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-zinc-300 text-sm">
                                        <span className="text-red-500 mt-1">•</span> {item}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="bg-emerald-950/10 p-4 rounded-lg border border-emerald-900/20 transition-all">
                        <button 
                            onClick={() => setIsRecommendationsOpen(!isRecommendationsOpen)}
                            className="w-full flex items-center justify-between text-emerald-400 text-sm uppercase font-bold tracking-wider mb-2 hover:text-emerald-300 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" /> Recommendations
                            </div>
                            {isRecommendationsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {isRecommendationsOpen && (
                            <ul className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                {analysis.recommendations.map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-zinc-300 text-sm">
                                        <span className="text-emerald-500 mt-1">•</span> {item}
                                    </li>
                                ))}
                            </ul>
                        )}
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
