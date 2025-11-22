
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
  // Returns number between min and max
  range(min: number, max: number) {
    return min + this.next() * (max - min);
  }
}

// --- Physics & Drive Cycle Simulation Constants ---
const SIMULATION_DURATION = 600; // 10 minutes
const SAMPLING_RATE = 0.1; // 10Hz
const TOTAL_POINTS = SIMULATION_DURATION / SAMPLING_RATE;

interface DriveCycle {
  speed: number[];
  rpm: number[];
  throttle: number[];
  brake: number[];
  gear: number[];
  load: number[]; // Engine Load calculated from accel
  steering: number[];
  wipers: number[];
  lights: number[];
}

/**
 * Generates a realistic automotive drive cycle with physics-based correlations.
 */
const generateDriveCycle = (): DriveCycle => {
  const speed: number[] = [];
  const rpm: number[] = [];
  const throttle: number[] = [];
  const brake: number[] = [];
  const gear: number[] = [];
  const load: number[] = [];
  const steering: number[] = [];
  const wipers: number[] = [];
  const lights: number[] = [];

  let currentSpeed = 0; // km/h
  let currentTarget = 0;
  let stateTimer = 0;
  let state = 'IDLE'; 
  let currentSteering = 0;

  const rng = new SeededRandom(12345);

  for (let i = 0; i < TOTAL_POINTS; i++) {
    // State Machine
    if (stateTimer <= 0) {
      const rand = rng.next();
      if (state === 'IDLE') {
        state = 'ACCEL';
        stateTimer = 100 + rng.next() * 200; 
        currentTarget = 30 + rng.next() * 100; 
      } else if (state === 'ACCEL') {
        state = 'CRUISE';
        stateTimer = 100 + rng.next() * 400; 
      } else if (state === 'CRUISE') {
        if (rng.next() > 0.5) {
            state = 'DECEL';
            stateTimer = 50 + rng.next() * 100;
            currentTarget = 0;
        } else {
            state = 'ACCEL';
            stateTimer = 50 + rng.next() * 100;
            currentTarget = 30 + rng.next() * 100;
        }
      } else if (state === 'DECEL') {
        state = 'IDLE';
        stateTimer = 50 + rng.next() * 100; 
        currentTarget = 0;
      }
    }
    stateTimer--;

    // Physics Updates
    let accel = 0;
    if (state === 'ACCEL') {
        const error = currentTarget - currentSpeed;
        accel = Math.min(error * 0.05, 2.0); 
    } else if (state === 'DECEL') {
        const error = currentTarget - currentSpeed;
        accel = Math.max(error * 0.08, -3.5); 
    } else if (state === 'CRUISE') {
        const error = currentTarget - currentSpeed;
        accel = error * 0.02 + (Math.sin(i/50)*0.1); 
    } else {
        currentSpeed = 0;
        accel = 0;
    }

    currentSpeed += accel * SAMPLING_RATE * 3.6; 
    if (currentSpeed < 0) currentSpeed = 0;

    // Steering Logic (Slowly changing random walk)
    if (currentSpeed > 5) {
        const steerChange = (rng.next() - 0.5) * 2.0;
        currentSteering += steerChange;
        // Return to center force
        currentSteering = currentSteering * 0.98; 
    } else {
        currentSteering = 0;
    }
    if (currentSteering > 540) currentSteering = 540;
    if (currentSteering < -540) currentSteering = -540;

    // Derived signals
    let currThrottle = 0;
    let currBrake = 0;
    let currLoad = 0;

    if (accel > 0.1) {
        currThrottle = Math.min(accel * 30, 100);
        currLoad = currThrottle;
    } else if (accel < -0.1) {
        currBrake = Math.min(Math.abs(accel) * 25, 100);
        currLoad = 0;
    } else {
        // Coasting load depends on speed
        currLoad = currentSpeed * 0.1;
    }

    // Gear Logic
    let currGear = 1;
    if (currentSpeed > 15) currGear = 2;
    if (currentSpeed > 35) currGear = 3;
    if (currentSpeed > 55) currGear = 4;
    if (currentSpeed > 85) currGear = 5;
    if (currentSpeed > 120) currGear = 6;
    if (currentSpeed === 0) currGear = 0; 

    // RPM Logic
    let currRpm = 800;
    if (currGear > 0) {
        currRpm = (currentSpeed / currGear) * 220; 
        if (currRpm < 800) currRpm = 800;
        // Simulate torque converter slip or shift drop
        if (accel > 1.0) currRpm += 300;
    } else {
        currRpm = 800 + (Math.sin(i/10) * 20) + ((rng.next()-0.5)*20);
        if (currThrottle > 0) currRpm += currThrottle * 40; 
    }

    speed.push(Number(currentSpeed.toFixed(2)));
    rpm.push(Number(currRpm.toFixed(0)));
    throttle.push(Number(currThrottle.toFixed(1)));
    brake.push(Number(currBrake.toFixed(1)));
    gear.push(currGear);
    load.push(Number(currLoad.toFixed(1)));
    steering.push(Number(currentSteering.toFixed(1)));
    
    // Boolean states
    wipers.push(i > 2000 && i < 2500 ? 1 : 0);
    lights.push(i > 5000 ? 1 : 0);
  }

  return { speed, rpm, throttle, brake, gear, load, steering, wipers, lights };
};

interface DbcSignalInfo extends SignalMetadata {
    factor?: number;
    offset?: number;
}

/**
 * Guesses a reasonable Min/Max range based on signal name if DBC didn't provide one.
 */
const guessRangeByName = (name: string): { min: number, max: number, unit: string, factor: number } => {
    const n = name.toLowerCase();
    
    if (n.includes('temp')) return { min: -40, max: 150, unit: '°C', factor: 0.1 };
    if (n.includes('volt') || n.includes('batt')) return { min: 0, max: 18, unit: 'V', factor: 0.01 };
    if (n.includes('curr')) return { min: -200, max: 200, unit: 'A', factor: 0.1 };
    if (n.includes('soc')) return { min: 0, max: 100, unit: '%', factor: 0.5 };
    if (n.includes('steer') || n.includes('angle')) return { min: -720, max: 720, unit: 'deg', factor: 0.1 };
    if (n.includes('yaw')) return { min: -10, max: 10, unit: 'deg/s', factor: 0.01 };
    if (n.includes('torque')) return { min: -100, max: 500, unit: 'Nm', factor: 0.5 };
    if (n.includes('press')) return { min: 0, max: 250, unit: 'bar', factor: 0.1 };
    if (n.includes('speed') && !n.includes('rpm')) return { min: 0, max: 260, unit: 'km/h', factor: 0.01 };
    if (n.includes('rpm')) return { min: 0, max: 10000, unit: 'rpm', factor: 0.5 };
    if (n.includes('accel')) return { min: -20, max: 20, unit: 'm/s²', factor: 0.01 };
    if (n.includes('status') || n.includes('switch') || n.includes('st_')) return { min: 0, max: 3, unit: '', factor: 1 }; 
    if (n.includes('cnt') || n.includes('counter')) return { min: 0, max: 15, unit: '', factor: 1 };
    
    return { min: 0, max: 100, unit: '-', factor: 1 }; // Default fallback
};

/**
 * The core logic to generate data for a specific signal based on its classification.
 */
const generateSmartSignal = (
    name: string, 
    dbcMin: number, 
    dbcMax: number, 
    factor: number = 1,
    offset: number = 0,
    rng: SeededRandom, 
    driveCycle: DriveCycle
): number[] => {
    const data: number[] = [];
    
    // 1. Determine Range: Use DBC if available (non-zero range), otherwise guess
    let min = dbcMin;
    let max = dbcMax;
    
    // If DBC has explicit range [0,0] or Min >= Max, we treat it as uninitialized or default
    // UNLESS it's a 1-bit signal where min=0 max=1
    if (min >= max && !(min === 0 && max === 0 && factor === 1)) {
        // trust DBC if it looks like a constant or single bit
    } else if (min === 0 && max === 0) {
        const guess = guessRangeByName(name);
        min = guess.min;
        max = guess.max;
        if (factor === 1 && guess.factor !== 1) factor = guess.factor;
    }

    const range = max - min;
    const n = name.toLowerCase();

    // 2. Classify Signal Behavior
    const isTemp = n.includes('temp') || n.includes('t_');
    const isVolt = n.includes('volt') || n.includes('ubatt') || n.includes('terminal');
    const isTorque = n.includes('torque') || n.includes('moment');
    const isSteer = n.includes('steer') || n.includes('angle');
    const isYaw = n.includes('yaw');
    const isCounter = n.includes('cnt') || n.includes('count') || n.includes('alive') || n.includes('heartbeat');
    const isPressure = n.includes('press') || n.includes('p_');
    const isWheelSpeed = n.includes('wheel') && n.includes('speed');
    
    // Heuristic for State/Status/Enum signals:
    // Usually Factor is integer (1), and Range is small integer (e.g. 0-7, 0-3)
    const isState = (factor === 1 && range > 0 && range < 20 && Number.isInteger(min) && Number.isInteger(max)) || 
                    n.includes('status') || n.includes('state') || n.includes('mode') || n.includes('switch');

    // 3. Generate Loop
    // Initialize state machine current value
    let currentStateVal = Math.floor(min);
    let stateHoldTimer = 0;

    for (let i = 0; i < TOTAL_POINTS; i++) {
        let val = 0;

        if (isCounter) {
            // Perfect sawtooth: 0, 1, 2... Max, 0, 1...
            // Check if max is valid, else default 15
            const limit = max > 0 ? Math.floor(max) : 15;
            val = Math.floor(i % (limit + 1));
        } 
        else if (isState) {
            // Hold value for random duration, then switch
            if (stateHoldTimer <= 0) {
                // Change state
                // Bias towards 0 or Min
                if (rng.next() > 0.7) {
                    currentStateVal = Math.floor(rng.range(min, max + 0.99));
                } else {
                    currentStateVal = min;
                }
                stateHoldTimer = rng.range(20, 100); // hold for 2-10 seconds
            } else {
                stateHoldTimer--;
            }
            val = currentStateVal;
        }
        else if (isWheelSpeed) {
             // Close to vehicle speed but with tiny variance
             val = driveCycle.speed[i] * (0.99 + rng.next() * 0.02);
        }
        else if (isTorque) {
            // Correlate to load
            const loadPct = driveCycle.load[i] / 100;
            val = min + (loadPct * range);
            val += (rng.next() - 0.5) * (range * 0.05);
        } 
        else if (isTemp) {
            // Logarithmic warm up
            const target = max * 0.85; 
            const ambient = Math.max(20, min);
            const progress = 1 - Math.exp(-i / 1200); 
            val = ambient + (target - ambient) * progress;
            if (driveCycle.load[i] > 80) val += 0.5; 
            else val -= 0.1;
        } 
        else if (isVolt) {
            const isRunning = driveCycle.rpm[i] > 400;
            const target = isRunning ? 14.4 : 12.4;
            val = target + (rng.next() - 0.5) * 0.2;
        } 
        else if (isSteer) {
            val = driveCycle.steering[i];
        }
        else if (isYaw) {
            // Yaw rate is roughly derivative of steering angle * speed
            const steerDelta = i > 0 ? driveCycle.steering[i] - driveCycle.steering[i-1] : 0;
            val = (steerDelta * driveCycle.speed[i]) / 100; 
            // Add sensor noise
            val += (rng.next() - 0.5) * 0.1;
        }
        else if (isPressure) {
             const rpmFactor = driveCycle.rpm[i] / 8000;
             val = min + (rpmFactor * range * 0.8) + (rng.next() * range * 0.1);
        }
        else {
            // Generic physics noise if we have a valid range
            if (range > 0) {
                const timeFactor = Math.sin(i / 50) * Math.cos(i / 120);
                val = min + (range / 2) + (timeFactor * (range / 3));
                val += (rng.next() - 0.5) * (range * 0.1);
            } else {
                // Fallback for truly unknown signals
                val = (Math.sin(i/10) * 50) + 50;
            }
        }

        // Strict Clamping to Physical Min/Max
        // IMPORTANT: Do not clamp if Min/Max are 0 (uninitialized)
        if (max > min) {
            if (val > max) val = max;
            if (val < min) val = min;
        }

        // Quantization logic (Vector CANoe style)
        // Physical Value = Raw * Factor + Offset
        // We generated Physical Value 'val'. We need to snap it to the grid defined by Factor.
        // Snapped = Math.round((val - offset) / factor) * factor + offset
        
        if (factor > 0) {
            // Reverse to Raw
            let raw = (val - offset) / factor;
            // Round Raw to nearest integer
            raw = Math.round(raw);
            // Convert back to Physical
            val = raw * factor + offset;
        }

        // Precision formatting to avoid floating point ugliness (e.g. 10.000000001)
        let decimals = 0;
        if (factor < 1 && factor > 0) {
            const str = factor.toString();
            if (str.includes('.')) decimals = str.split('.')[1].length;
            if (str.includes('e')) {
                 // Handle scientific notation like 1e-2
                 const match = str.match(/-(\d+)/);
                 if (match) decimals = parseInt(match[1], 10);
            }
        }
        // Cap max decimals to 6
        decimals = Math.min(decimals, 6);

        data.push(parseFloat(val.toFixed(decimals)));
    }
    return data;
};

/**
 * Helper to parse numbers that might be in European format (1.000,00) or standard (1,000.00)
 */
const parseFlexibleFloat = (val: string, decimalSeparator: string): number => {
  if (!val) return 0;
  const cleanVal = val.trim();
  if (cleanVal === '') return 0;

  if (cleanVal.toLowerCase() === 'true' || cleanVal.toLowerCase() === 'on') return 1;
  if (cleanVal.toLowerCase() === 'false' || cleanVal.toLowerCase() === 'off') return 0;

  if (decimalSeparator === ',') {
    const normalized = cleanVal.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  } else {
    const normalized = cleanVal.replace(/,/g, '');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  }
};

/**
 * Parses a DBC file to extract Signal Names, Units AND Ranges.
 * IMPLEMENTS ROBUST PARSING FOR MULTIPLEXORS AND VARYING FORMATS.
 */
const parseDBC = async (file: File): Promise<DbcSignalInfo[]> => {
  const text = await file.text();
  const lines = text.split('\n');
  const metadata: DbcSignalInfo[] = [];
  const seen = new Set<string>();

  // Regex Breakdown:
  // 1. Start with SG_
  // 2. Capture Name (alphanumeric + _)
  // 3. Optional Multiplexor (m12, M, etc)
  // 4. Colon separator
  // 5. Bit info (ignored here mostly)
  // 6. Scale/Offset: (Factor,Offset) allow scientific notation
  // 7. Range: [Min|Max] allow scientific notation
  // 8. Unit: "UnitString"
  
  // E.g. SG_ EngineSpeed : 24|16@1+ (0.5,0) [0|8000] "rpm" Vector__XXX
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('SG_ ')) continue;

    try {
        // Split by colon first to separate definition from metadata
        const colonSplit = trimmed.split(':');
        if (colonSplit.length < 2) continue;

        const preColon = colonSplit[0].trim();
        const postColon = colonSplit.slice(1).join(':').trim();

        // Parse Name
        // preColon looks like "SG_ SignalName" or "SG_ SignalName m12"
        const nameParts = preColon.split(/\s+/);
        if (nameParts.length < 2) continue;
        const name = nameParts[1];

        if (seen.has(name)) continue;

        // Parse Metadata from postColon
        // Look for (Factor, Offset)
        let factor = 1;
        let offset = 0;
        const scaleMatch = postColon.match(/\(\s*([+\-]?(?:0|[1-9]\d*)(?:\.\d*)?(?:[eE][+\-]?\d+)?)\s*,\s*([+\-]?(?:0|[1-9]\d*)(?:\.\d*)?(?:[eE][+\-]?\d+)?)\s*\)/);
        if (scaleMatch) {
            factor = parseFloat(scaleMatch[1]);
            offset = parseFloat(scaleMatch[2]);
        }

        // Look for [Min|Max]
        let min = 0;
        let max = 0;
        const rangeMatch = postColon.match(/\[\s*([+\-]?(?:0|[1-9]\d*)(?:\.\d*)?(?:[eE][+\-]?\d+)?)\s*\|\s*([+\-]?(?:0|[1-9]\d*)(?:\.\d*)?(?:[eE][+\-]?\d+)?)\s*\]/);
        if (rangeMatch) {
            min = parseFloat(rangeMatch[1]);
            max = parseFloat(rangeMatch[2]);
        }

        // Look for Unit
        let unit = "-";
        const unitMatch = postColon.match(/"([^"]*)"/);
        if (unitMatch) {
            unit = unitMatch[1];
        }

        seen.add(name);
        metadata.push({ 
            name, 
            unit: unit, 
            min, 
            max, 
            factor,
            offset,
            avg: 0, 
            stdDev: 0, 
            color: COLORS[metadata.length % COLORS.length] 
        });

    } catch (e) {
        console.warn("Failed to parse DBC line:", line, e);
    }
  }
  return metadata;
};

const scanBinaryForStrings = async (file: File): Promise<string[]> => {
  const chunkSize = Math.min(file.size, 5 * 1024 * 1024); 
  const buffer = await file.slice(0, chunkSize).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  let strings: string[] = [];
  let currentStr = "";
  
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if ((b >= 32 && b <= 126)) {
      currentStr += String.fromCharCode(b);
    } else {
      if (currentStr.length > 2) {
        const cleaned = currentStr.trim();
        if (/^[a-zA-Z][a-zA-Z0-9_.-]+$/.test(cleaned)) {
             if (cleaned.length > 2 && cleaned.length < 50) strings.push(cleaned);
        } else if (cleaned.includes("<CN>")) {
             const match = cleaned.match(/<CN>(.*?)<\/CN>/);
             if (match) strings.push(match[1]);
        }
      }
      currentStr = "";
    }
  }

  const blockList = ['MDF4', 'Vector', 'CANape', 'Intel', 'Motorola', 'Version', 'Format', 'Date', 'Time', 'Program', 'Block', 'HDBlock', 'DGBlock'];
  strings = strings.filter(s => 
    !blockList.some(bad => s.includes(bad)) && 
    !/^\d+$/.test(s) && 
    s.length > 2
  );

  return Array.from(new Set(strings));
};

export const parseFile = async (file: File, dbcFile: File | null): Promise<{ data: DataPoint[], metadata: SignalMetadata[] }> => {
    
    // 1. Handle CSV
    if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text();
        // Filter out comment lines often found in CANoe/CANalyzer exports
        const lines = text.split('\n').filter(l => {
            const t = l.trim();
            return t !== '' && !t.startsWith('//') && !t.startsWith('#') && !t.startsWith('Begin');
        });
        
        if (lines.length < 2) return { data: [], metadata: [] };

        const firstLine = lines[0];
        const commaCount = (firstLine.match(/,/g) || []).length;
        const semiCount = (firstLine.match(/;/g) || []).length;
        const tabCount = (firstLine.match(/\t/g) || []).length;
        
        let delimiter = ',';
        if (semiCount > commaCount) delimiter = ';';
        if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

        const decimalSeparator = delimiter === ';' ? ',' : '.';

        const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
        let timeIdx = headers.findIndex(h => ['time', 't', 'timestamp', 'seconds', 's', 'zeit', 'globaltime'].includes(h.toLowerCase()));
        
        const parsedData: DataPoint[] = [];
        // CANoe exports can be huge, cap for performance demo
        const dataRows = lines.slice(1, 8000); 
        
        let startTime = -1;

        dataRows.forEach((row, i) => {
            const vals = row.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
            // CANoe sometimes puts units in the second row, detect if row is numeric
            if (i === 0 && isNaN(parseFlexibleFloat(vals[timeIdx > -1 ? timeIdx : 0], decimalSeparator))) return;

            if (vals.length !== headers.length && vals.length < headers.length) return;

            let timeVal = 0;
            if (timeIdx >= 0) {
                timeVal = parseFlexibleFloat(vals[timeIdx], decimalSeparator);
                if (startTime === -1) startTime = timeVal;
                timeVal = timeVal - startTime;
            } else {
                timeVal = i * 0.1; 
            }

            const pt: DataPoint = { timestamp: Number(timeVal.toFixed(3)) };
            
            headers.forEach((h, idx) => {
                if (idx !== timeIdx) {
                    pt[h] = parseFlexibleFloat(vals[idx], decimalSeparator);
                }
            });
            parsedData.push(pt);
        });
        
        parsedData.sort((a, b) => a.timestamp - b.timestamp);

        const metadata: SignalMetadata[] = headers.filter((h, i) => i !== timeIdx).map((name, idx) => ({
            name, unit: '-', min: 0, max: 0, avg: 0, stdDev: 0, color: COLORS[idx % COLORS.length]
        }));
        
        metadata.forEach(m => {
            const vals = parsedData.map(d => d[m.name]);
            if (vals.length > 0) {
                m.min = Math.min(...vals);
                m.max = Math.max(...vals);
                m.avg = vals.reduce((a,b)=>a+b,0)/vals.length;
                m.stdDev = Math.sqrt(vals.reduce((a,b)=>a+(b-m.avg)**2,0)/vals.length);
                
                m.min = parseFloat(m.min.toFixed(2));
                m.max = parseFloat(m.max.toFixed(2));
                m.avg = parseFloat(m.avg.toFixed(2));
                m.stdDev = parseFloat(m.stdDev.toFixed(2));
            }
        });

        return { data: parsedData, metadata };
    }

    // 2. Handle Binary (MDF/BLF Simulation)
    let extractedSignals: DbcSignalInfo[] = [];

    if (dbcFile) {
        extractedSignals = await parseDBC(dbcFile);
    } 
    
    if (extractedSignals.length === 0) {
        const rawStrings = await scanBinaryForStrings(file);
        if (rawStrings.length > 5) {
            extractedSignals = rawStrings.slice(0, 100).map((s, i) => ({
                name: s, unit: '-', min: 0, max: 0, avg: 0, stdDev: 0, color: COLORS[i % COLORS.length]
            }));
        } else {
            for (let i = 0; i < 12; i++) {
                extractedSignals.push({
                    name: `CAN_ID_0x${(200 + i * 10).toString(16).toUpperCase()}_Signal_${i}`,
                    unit: 'raw', min: 0, max: 0, avg: 0, stdDev: 0, color: COLORS[i % COLORS.length]
                });
            }
        }
    }

    // 3. Generate Data using Physics Model
    const driveCycle = generateDriveCycle();
    const signalDataMap: Record<string, number[]> = {};

    extractedSignals.forEach(sig => {
        const n = sig.name.toLowerCase();
        const rng = new SeededRandom(hashCode(sig.name));

        // Direct mapping to drive cycle
        if (n === 'vehiclespeed' || n === 'enginespeed' || n === 'speed' || n === 'rpm') {
             if (n.includes('speed')) signalDataMap[sig.name] = driveCycle.speed;
             else signalDataMap[sig.name] = driveCycle.rpm;
        } 
        // Fuzzy mapping
        else if (n.includes('speed') && !n.includes('fan') && !n.includes('wheel')) {
             signalDataMap[sig.name] = driveCycle.speed;
        } else if ((n.includes('rpm') || n.includes('engine_speed')) && !n.includes('fan')) {
             signalDataMap[sig.name] = driveCycle.rpm;
        } else if (n.includes('throttle') || n.includes('pedal') || n.includes('accel_pos')) {
             signalDataMap[sig.name] = driveCycle.throttle;
        } else if (n.includes('brake') && n.includes('pedal')) {
             signalDataMap[sig.name] = driveCycle.brake;
        } else if (n.includes('gear')) {
             signalDataMap[sig.name] = driveCycle.gear;
        } else if (n.includes('wiper')) {
            signalDataMap[sig.name] = driveCycle.wipers;
        } else if (n.includes('light') && !n.includes('lightning')) {
            signalDataMap[sig.name] = driveCycle.lights;
        } else {
             // Smart Generation based on name and DBC limits
             signalDataMap[sig.name] = generateSmartSignal(
                 sig.name, sig.min, sig.max, sig.factor, sig.offset, rng, driveCycle
             );
        }
    });

    const generatedData: DataPoint[] = [];
    for (let i = 0; i < TOTAL_POINTS; i++) {
        const pt: DataPoint = { timestamp: Number((i * SAMPLING_RATE).toFixed(1)) };
        extractedSignals.forEach(sig => {
            pt[sig.name] = signalDataMap[sig.name][i];
        });
        generatedData.push(pt);
    }

    // 4. Final Metadata Update
    const finalMetadata = extractedSignals.map(sig => {
        const values = signalDataMap[sig.name];
        if (!values) return sig;

        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((a,b) => a+b, 0) / values.length;
        const variance = values.reduce((a,b) => a + Math.pow(b - avg, 2), 0) / values.length;
        
        // Determine unit if missing
        let unit = sig.unit;
        if (unit === '-' || unit === '') {
             unit = guessRangeByName(sig.name).unit;
        }

        return {
            ...sig,
            unit,
            min: parseFloat(min.toFixed(2)),
            max: parseFloat(max.toFixed(2)),
            avg: parseFloat(avg.toFixed(2)),
            stdDev: parseFloat(Math.sqrt(variance).toFixed(2))
        };
    });

    return { data: generatedData, metadata: finalMetadata };
};
