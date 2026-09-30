import React, { useRef, useEffect } from 'react';
import {
  Terminal,
  Download,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CornerDownRight,
} from 'lucide-react';
import { TransmissionLogEntry } from '../types/simulator';

interface SimulatorTerminalLogProps {
  logs: TransmissionLogEntry[];
  onClearLogs: () => void;
  onExportLogs: () => void;
}

export const SimulatorTerminalLog: React.FC<SimulatorTerminalLogProps> = ({
  logs,
  onClearLogs,
  onExportLogs,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new log entries
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLogStyle = (type: TransmissionLogEntry['type']) => {
    switch (type) {
      case 'SUCCESS':
        return 'text-emerald-400 font-bold';
      case 'ERROR':
        return 'text-rose-400 font-bold bg-rose-950/40 px-1 py-0.5 rounded border border-rose-900/60';
      case 'ALERT':
        return 'text-amber-400 font-semibold';
      case 'ROUTING':
        return 'text-cyan-300';
      case 'HOP':
        return 'text-emerald-300';
      default:
        return 'text-slate-300';
    }
  };

  return (
    <div className="bg-[#06080d] border-t border-slate-800 flex flex-col font-mono text-xs select-none">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#090d16] border-b border-slate-800 text-slate-400">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
            Live Routing Log Terminal (Network Evidence Log)
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            STREAM ACTIVE
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onExportLogs}
            className="px-2 py-0.5 text-[10px] uppercase font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded transition-colors flex items-center gap-1"
            title="Download terminal evidence logs"
          >
            <Download className="w-3 h-3" />
            <span>Export</span>
          </button>
          <button
            onClick={onClearLogs}
            className="px-2 py-0.5 text-[10px] uppercase font-semibold bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded transition-colors flex items-center gap-1"
            title="Clear terminal window"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Terminal Content Screen */}
      <div className="p-3.5 overflow-y-auto max-h-52 sm:max-h-44 space-y-1.5 leading-relaxed bg-[#05070a]">
        {logs.length === 0 ? (
          <div className="text-slate-600 italic py-2">
            Terminal initialized. Cellular network is down. Select an Origin and Destination and click "Inject Offline Route" to trace packet transmission.
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 text-[11px] leading-5">
              <span className="text-slate-500 shrink-0 select-none">
                [{log.timestamp}]
              </span>
              <span className={`flex-1 break-words ${getLogStyle(log.type)}`}>
                {log.type === 'HOP' && <span className="text-emerald-400 mr-1.5 font-bold">➔</span>}
                {log.type === 'ERROR' && <span className="text-rose-400 mr-1.5 font-bold">✖</span>}
                {log.type === 'SUCCESS' && <span className="text-emerald-400 mr-1.5 font-bold">✔</span>}
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
