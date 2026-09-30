import React from 'react';
import {
  Send,
  Zap,
  Play,
  RotateCcw,
  AlertTriangle,
  Radio,
  Share2,
  Sliders,
  CheckCircle,
  XCircle,
  UserCheck,
  Target,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { SimNode, TransmissionState } from '../types/simulator';

interface SimulatorMessageConsoleProps {
  nodes: SimNode[];
  originNodeId: string;
  destNodeId: string;
  selectedMessage: string;
  customMessageText: string;
  candidatePath: string[];
  onOriginChange: (nodeId: string) => void;
  onDestChange: (nodeId: string) => void;
  onMessageSelect: (msg: string) => void;
  onCustomMessageChange: (text: string) => void;
  onInjectRoute: () => void;
  onStopTransmission: () => void;
  transmission: TransmissionState;
}

export const PRESET_EMERGENCY_MESSAGES = [
  'Need Medical Aid at Block-C',
  'Stairwell Overcrowded - Avoid Exit 2',
  'Gas Leak Reported in Chemical Wing - Evacuate East',
  'Drinking Water Station Operational at Ground Floor',
  'Casualty Extraction in Progress - Clear Corridor',
  'Custom Alert',
];

export const SimulatorMessageConsole: React.FC<SimulatorMessageConsoleProps> = ({
  nodes,
  originNodeId,
  destNodeId,
  selectedMessage,
  customMessageText,
  candidatePath,
  onOriginChange,
  onDestChange,
  onMessageSelect,
  onCustomMessageChange,
  onInjectRoute,
  onStopTransmission,
  transmission,
}) => {
  const isCustom = selectedMessage === 'Custom Alert';

  const originNode = nodes.find((n) => n.id === originNodeId);
  const destNode = nodes.find((n) => n.id === destNodeId);

  const hasRoute = candidatePath.length > 1;

  return (
    <div className="bg-[#090d16] border-t border-slate-800 p-3 lg:p-4 select-none font-mono">
      <div className="max-w-7xl mx-auto flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        {/* Origin & Destination Selectors */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Origin Node Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              Sender Node (Active User)
            </label>
            <select
              value={originNodeId}
              disabled={transmission.isTransmitting}
              onChange={(e) => onOriginChange(e.target.value)}
              className="bg-slate-950 border border-amber-500/60 rounded-lg px-2.5 py-1.5 text-xs font-bold text-amber-200 focus:outline-none focus:border-amber-400 disabled:opacity-50"
            >
              {nodes.map((node) => (
                <option key={`orig-${node.id}`} value={node.id}>
                  {node.name} ({node.role}) {node.status !== 'active' ? `[${node.status.toUpperCase()}]` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden sm:flex items-center text-slate-500 font-bold self-end pb-2">
            <ArrowRight className="w-4 h-4 text-slate-600" />
          </div>

          {/* Destination Node Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-cyan-400" />
              Target Recipient
            </label>
            <select
              value={destNodeId}
              disabled={transmission.isTransmitting}
              onChange={(e) => onDestChange(e.target.value)}
              className="bg-slate-950 border border-cyan-500/60 rounded-lg px-2.5 py-1.5 text-xs font-bold text-cyan-200 focus:outline-none focus:border-cyan-400 disabled:opacity-50"
            >
              {nodes.map((node) => (
                <option key={`dest-${node.id}`} value={node.id}>
                  {node.name} ({node.role}) {node.status !== 'active' ? `[${node.status.toUpperCase()}]` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Message Selector & Custom Text Input */}
        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Emergency Text Payload:
              </label>
              {hasRoute ? (
                <span className="text-[10px] text-emerald-400 font-semibold hidden md:inline">
                  ⚡ Path Ready: {candidatePath.map((id) => nodes.find((n) => n.id === id)?.name).join(' → ')}
                </span>
              ) : (
                <span className="text-[10px] text-rose-400 font-semibold hidden md:inline">
                  ⚠️ No Ad-Hoc Route to Target
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <select
                value={selectedMessage}
                disabled={transmission.isTransmitting}
                onChange={(e) => onMessageSelect(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-400 disabled:opacity-50"
              >
                {PRESET_EMERGENCY_MESSAGES.map((msg) => (
                  <option key={msg} value={msg}>
                    {msg}
                  </option>
                ))}
              </select>

              {isCustom && (
                <input
                  type="text"
                  value={customMessageText}
                  disabled={transmission.isTransmitting}
                  onChange={(e) => onCustomMessageChange(e.target.value)}
                  placeholder="Enter custom emergency broadcast text..."
                  className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 disabled:opacity-50"
                />
              )}
            </div>
          </div>
        </div>

        {/* Primary Action Button: Inject Offline Route */}
        <div className="flex items-center gap-2 shrink-0">
          {!transmission.isTransmitting ? (
            <button
              onClick={onInjectRoute}
              disabled={originNodeId === destNodeId || !hasRoute}
              className={`w-full sm:w-auto px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border flex items-center justify-center gap-2 transition-all transform active:scale-95 ${
                originNodeId === destNodeId || !hasRoute
                  ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
              }`}
            >
              <Zap className="w-4 h-4 fill-current animate-pulse" />
              <span>Send Ad-Hoc Message</span>
            </button>
          ) : (
            <button
              onClick={onStopTransmission}
              className="w-full sm:w-auto px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-lg bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 shadow-[0_0_15px_rgba(225,29,72,0.4)] flex items-center justify-center gap-2 transition-all"
            >
              <XCircle className="w-4 h-4" />
              <span>Abort Transmission</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
