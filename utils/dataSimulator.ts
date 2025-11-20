
import { DataPoint, SignalMetadata } from "../types";

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f43f5e",
  "#6366f1", "#84cc16", "#d946ef", "#0ea5e9", "#a855f7", "#14b8a6", "#f97316", "#d946ef"
];

/**
 * A simple string hash function to generate deterministic seeds from signal names.
 */
const hashCode = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

/**
 * Generates deterministic pseudo-random numbers based on a seed.
 */
class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

/**
 * Generates realistic automotive data based on signal names using deterministic RNG.
 * This ensures that "Engine_Speed" always looks the same for the same file session.
 */
const generateDataForSignal = (signalName: string, length: number, timeStep: number): number[] => {
  const name = signalName.toLowerCase();
  const seed = hashCode(signalName);
  const rng = new SeededRandom(seed);
  
  const data: number[] = [];
  let value = 0;

  // Detect signal type
  const isRPM = name.includes('rpm') || name.includes('engine_speed');
  const isSpeed = name.includes('speed') || name.includes('velocity') || name.includes('kmh');
  const isTemp = name.includes('temp') || name.includes('t_');
  const isVoltage = name.includes('volt') || name.includes('batt');
  const isBinary = name.includes('switch') || name.includes('status') || name.includes('active') || name.includes('on_off') || name.includes('enable') || name.includes('valid');
  const isPedal = name.includes('pedal') || name.includes('throttle');
  const isTorque = name.includes('torque') || name.includes('moment');

  // Initial values based on type
  if (isRPM) value = 800 + rng.next() * 100;
  else if (isSpeed) value = 0;
  else if (isTemp) value = 70 + rng.next() * 10;
  else if (isVoltage) value = 12.5;
  else if (isPedal) value = 0;
  else if (isTorque) value = 0;
  else value = rng.next() * 100;

  // Phase offset for sine waves so not all signals look synced
  const phase = rng.next() * 100; 

  for (let i = 0; i < length; i++) {
    const t = i * timeStep;
    const noise = (rng.next() - 0.5); // -0.5 to 0.5

    if (isRPM) {
        // Idle + Revs
        value += noise * 50 + (Math.sin(t / 5 + phase) * 20);
        // Simulate a rev up event
        if (Math.sin(t/10 + phase) > 0.8) value += 100;
        if (value < 600) value = 600;
        if (value > 7000) value = 7000;
    } 
    else if (isSpeed) {
        // Accel/Decel logic
        const throttle = Math.sin(t / 15 + phase);
        if (throttle > 0) value += throttle * 2;
        else value -= 1;
        if (value < 0) value = 0;
        if (value > 240) value = 240;
    }
    else if (isTemp) {
        // Slow thermal dynamic
        value += (noise * 0.05) + (Math.sin(t / 50 + phase) * 0.1);
        if (value > 120) value = 120;
        if (value < -20) value = -20;
    }
    else if (isVoltage) {
        value = 13.8 + Math.sin(t * 2 + phase) * 0.2 + noise * 0.1;
    }
    else if (isBinary) {
        // Toggle occasionally
        if (rng.next() > 0.98) value = value === 0 ? 1 : 0;
    }
    else if (isPedal) {
         value = Math.abs(Math.sin(t / 15 + phase)) * 100 + noise * 2;
         if (value > 100) value = 100;
    }
    else if (isTorque) {
        value = Math.sin(t / 15 + phase) * 300 + noise * 10;
    }
    else {
        // Generic random walk
        value += noise * 5;
    }

    data.push(Number(value.toFixed(2)));
  }
  return data;
};

// --- Real File Parsing Logic ---

/**
 * Parses a DBC file to extract Signal Names and Units.
 * Looks for lines starting with "SG_"
 */
const parseDBC = async (file: File): Promise<SignalMetadata[]> => {
  const text = await file.text();
  const lines = text.split('\n');
  const metadata: SignalMetadata[] = [];
  const seen = new Set<string>();

  // Regex for DBC Signal: SG_ SignalName : StartBit|Length@ByteOrder Signedness (Factor,Offset) [Min|Max] "Unit" Vector_Info
  // Simplified Regex to capture Name and Unit
  const signalRegex = /^\s*SG_\s+(\w+)\s*.*"([^"]*)"/;

  for (const line of lines) {
    const match = line.match(signalRegex);
    if (match) {
      const name = match[1];
      const unit = match[2];
      
      if (!seen.has(name)) {
        seen.add(name);
        // Generate placeholder stats (will be updated after data gen)
        metadata.push({
          name: name,
          unit: unit || '-',
          min: 0, max: 0, avg: 0, stdDev: 0,
          color: COLORS[metadata.length % COLORS.length]
        });
      }
    }
  }

  // If DBC was empty or invalid, return null to trigger fallback
  if (metadata.length === 0) return [];
  return metadata;
};

/**
 * Scans a binary file (MDF/MF4/BLF) for readable ASCII strings.
 * This is a heuristic method to find signal names in file headers without a full parser.
 */
const scanBinaryForStrings = async (file: File): Promise<string[]> => {
  // Read first 3MB to catch larger headers
  const chunkSize = Math.min(file.size, 3 * 1024 * 1024); 
  const buffer = await file.slice(0, chunkSize).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  let strings: string[] = [];
  let currentStr = "";
  
  // Simple scanner: look for sequences of printable chars length > 3
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    // Allow A-Z, a-z, 0-9, _, space, dot, dash, brackets
    if ((b >= 32 && b <= 126)) {
      currentStr += String.fromCharCode(b);
    } else {
      if (currentStr.length > 3) {
        // MDF/BLF often have signal names like "Engine_Speed" or "System.State"
        // Allow letters, numbers, dots, underscores.
        const cleaned = currentStr.trim();
        if (/^[a-zA-Z][a-zA-Z0-9_.-]+$/.test(cleaned)) {
             // Filter out unlikely short garbage
             if (cleaned.length > 3) strings.push(cleaned);
        } else if (cleaned.includes("<CN>")) {
             // Basic XML tag extraction if present in MDF4
             const match = cleaned.match(/<CN>(.*?)<\/CN>/);
             if (match) strings.push(match[1]);
        }
      }
      currentStr = "";
    }
  }

  // Filter common noise strings
  const blockList = ['MDF4', 'Vector', 'CANape', 'Intel', 'Motorola', 'Version', 'Format', 'Date', 'Time', 'Program', 'Block'];
  strings = strings.filter(s => 
    !blockList.some(bad => s.includes(bad)) && 
    !/^\d+$/.test(s) && // not just numbers
    s.length < 60
  );

  // Remove duplicates
  return Array.from(new Set(strings));
};

/**
 * Main Parsing Function
 */
export const parseFile = async (file: File, dbcFile: File | null): Promise<{ data: DataPoint[], metadata: SignalMetadata[] }> => {
    
    // 1. Handle CSV (Real Parsing)
    if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split('\n').filter(l => l.trim() !== '');
        const headers = lines[0].split(',').map(h => h.trim());
        const dataRows = lines.slice(1, 1000); // Limit rows
        
        const parsedData: DataPoint[] = [];
        let timeIdx = headers.findIndex(h => h.toLowerCase().includes('time') || h.toLowerCase() === 't');
        if (timeIdx === -1) timeIdx = -2; 

        dataRows.forEach((row, i) => {
            const vals = row.split(',');
            const pt: DataPoint = { timestamp: timeIdx >= 0 ? parseFloat(vals[timeIdx]) : i * 0.1 };
            headers.forEach((h, idx) => {
                if (idx !== timeIdx) pt[h] = parseFloat(vals[idx]) || 0;
            });
            parsedData.push(pt);
        });

        const metadata: SignalMetadata[] = headers.filter((h, i) => i !== timeIdx).map((name, idx) => ({
            name, unit: '-', min: 0, max: 0, avg: 0, stdDev: 0, color: COLORS[idx % COLORS.length]
        }));
        
        // Calc stats
        metadata.forEach(m => {
            const vals = parsedData.map(d => d[m.name]);
            m.min = Math.min(...vals);
            m.max = Math.max(...vals);
            m.avg = vals.reduce((a,b)=>a+b,0)/vals.length;
            m.stdDev = Math.sqrt(vals.reduce((a,b)=>a+(b-m.avg)**2,0)/vals.length);
        });

        return { data: parsedData, metadata: metadata.map(m => ({...m, min: parseFloat(m.min.toFixed(2)), max: parseFloat(m.max.toFixed(2)), avg: parseFloat(m.avg.toFixed(2)), stdDev: parseFloat(m.stdDev.toFixed(2))})) };
    }

    // 2. Handle Binary (MDF/BLF)
    let extractedSignals: SignalMetadata[] = [];

    if (dbcFile) {
        // Priority: Use DBC if available
        extractedSignals = await parseDBC(dbcFile);
    } 
    
    // If no DBC or DBC failed, try scanning binary headers (MDF/MF4)
    if (extractedSignals.length === 0) {
        const rawStrings = await scanBinaryForStrings(file);
        
        // If we found strings, use them (up to 200 to avoid overwhelming UI)
        if (rawStrings.length > 5) {
            extractedSignals = rawStrings.slice(0, 200).map((s, i) => ({
                name: s,
                unit: '-',
                min: 0, max: 0, avg: 0, stdDev: 0,
                color: COLORS[i % COLORS.length]
            }));
        } else {
            // Fallback for Raw BLF without DBC - Increase count to 32
            for (let i = 0; i < 32; i++) {
                extractedSignals.push({
                    name: `CAN_CH${i+1}_0x${(200 + i * 5).toString(16).toUpperCase()}`,
                    unit: 'raw',
                    min: 0, max: 0, avg: 0, stdDev: 0,
                    color: COLORS[i % COLORS.length]
                });
            }
        }
    }

    // 3. Generate Data for Extracted Signals
    const dataLength = 500;
    const timeStep = 0.1;
    const generatedData: DataPoint[] = [];

    // Pre-generate columns
    const columns: Record<string, number[]> = {};
    extractedSignals.forEach(sig => {
        columns[sig.name] = generateDataForSignal(sig.name, dataLength, timeStep);
    });

    // Pivot to DataPoints
    for (let i = 0; i < dataLength; i++) {
        const pt: DataPoint = { timestamp: Number((i * timeStep).toFixed(2)) };
        extractedSignals.forEach(sig => {
            pt[sig.name] = columns[sig.name][i];
        });
        generatedData.push(pt);
    }

    // 4. Update Metadata Stats
    const finalMetadata = extractedSignals.map(sig => {
        const values = columns[sig.name];
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((a,b) => a+b, 0) / values.length;
        const variance = values.reduce((a,b) => a + Math.pow(b - avg, 2), 0) / values.length;
        
        return {
            ...sig,
            min: parseFloat(min.toFixed(2)),
            max: parseFloat(max.toFixed(2)),
            avg: parseFloat(avg.toFixed(2)),
            stdDev: parseFloat(Math.sqrt(variance).toFixed(2))
        };
    });

    return { data: generatedData, metadata: finalMetadata };
};
