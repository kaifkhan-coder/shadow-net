import React from 'react';
import {
  AlertTriangle,
  Radio,
  Share2,
  Activity,
  Flame,
  Zap,
  WifiOff,
  Cpu,
  RefreshCw,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Gauge,
  UserCheck,
  UserPen,
} from 'lucide-react';
import { NetworkDensity, SimNode } from '../types/simulator';

interface SimulatorAnalyticsBarProps {
  totalNodesCount: number;
  activeNodesCount: number;
  deadNodesCount: number;
  densityIndex: NetworkDensity;
  densityScore: number;
  avgHopEfficiency: number;
  totalTransmissions: number;
  successRatePercent: number;
  onResetNetwork: () => void;
  onChaosMonkeyToggle: () => void;
  isChaosRunning: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  simSpeed: number;
  onChangeSimSpeed: (speed: number) => void;
  activeUserNode?: SimNode;
  onOpenEditUsersModal?: () => void;
}

export const SimulatorAnalyticsBar: React.FC<SimulatorAnalyticsBarProps> = ({
  totalNodesCount,
  activeNodesCount,
  deadNodesCount,
  densityIndex,
  densityScore,
  avgHopEfficiency,
  totalTransmissions,
  successRatePercent,
  onResetNetwork,
  onChaosMonkeyToggle,
  isChaosRunning,
  soundEnabled,
  onToggleSound,
  simSpeed,
  onChangeSimSpeed,
  activeUserNode,
  onOpenEditUsersModal,
}) => {
  return (
    <div className="bg-[#080c14] border-b border-slate-800 px-4 lg:px-6 py-2.5 select-none font-mono">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        {/* Metric 1: Cellular Infrastructure Status Alert + Active Operator Badge */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-800/80 shadow-[0_0_14px_rgba(225,29,72,0.25)]">
            <div className="relative flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping absolute" />
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 relative" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-wider text-rose-300">
                Cellular Infrastructure
              </span>
              <span className="text-xs font-bold text-rose-100 flex items-center gap-1.5">
                <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                CRASHED / OFFLINE
              </span>
            </div>
          </div>

          {activeUserNode && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/60 border border-amber-600/70 rounded-lg shadow-[0_0_12px_rgba(245,158,11,0.2)]">
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider font-bold text-amber-300">
                  Active Operator (You)
                </span>
                <span className="text-xs font-bold text-amber-100">
                  {activeUserNode.name} <span className="text-amber-400 font-normal">({activeUserNode.label})</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Telemetry Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 xl:gap-3 flex-1 xl:max-w-3xl">
          {/* Metric 2: Active Peer Nodes in Range */}
          <div className="px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col justify-between">
            <div className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider flex items-center justify-between">
              <span>Active Peers</span>
              <Radio className="w-3 h-3 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base font-bold text-emerald-400 tabular-nums">
                {activeNodesCount}
              </span>
              <span className="text-[10px] text-slate-500">
                / {totalNodesCount} ({deadNodesCount} down)
              </span>
            </div>
          </div>

          {/* Metric 3: Network Density Index */}
          <div className="px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col justify-between">
            <div className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider flex items-center justify-between">
              <span>Density Index</span>
              <Activity className="w-3 h-3 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span
                className={`text-base font-bold tabular-nums ${
                  densityIndex === 'Robust'
                    ? 'text-emerald-400'
                    : densityIndex === 'Moderate'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {densityIndex}
              </span>
              <span className="text-[10px] text-slate-500">
                ({densityScore}%)
              </span>
            </div>
          </div>

          {/* Metric 4: Average Hop Efficiency */}
          <div className="px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col justify-between">
            <div className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider flex items-center justify-between">
              <span>Hop Efficiency</span>
              <Share2 className="w-3 h-3 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base font-bold text-amber-300 tabular-nums">
                {avgHopEfficiency > 0 ? avgHopEfficiency : 'N/A'}
              </span>
              <span className="text-[10px] text-slate-500">
                hops / msg
              </span>
            </div>
          </div>

          {/* Metric 5: Transmission Success Ratio */}
          <div className="px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col justify-between">
            <div className="text-[10px] uppercase text-slate-400 font-semibold tracking-wider flex items-center justify-between">
              <span>Delivery Rate</span>
              <Zap className="w-3 h-3 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base font-bold text-cyan-300 tabular-nums">
                {successRatePercent}%
              </span>
              <span className="text-[10px] text-slate-500">
                ({totalTransmissions} pkts)
              </span>
            </div>
          </div>
        </div>

        {/* Global Controls: Speed Multiplier + Sound + Stress-Test + Reset */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Speed Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[10px]">
            <span className="px-1.5 text-slate-500 flex items-center gap-1 font-semibold">
              <Gauge className="w-3 h-3 text-slate-400" /> Speed:
            </span>
            <button
              onClick={() => onChangeSimSpeed(0.5)}
              className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                simSpeed === 0.5 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Slow speed - great for explaining hop-by-hop transmission"
            >
              0.5x
            </button>
            <button
              onClick={() => onChangeSimSpeed(1)}
              className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                simSpeed === 1 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Real-time speed"
            >
              1.0x
            </button>
            <button
              onClick={() => onChangeSimSpeed(2)}
              className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                simSpeed === 2 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Tactical Fast speed"
            >
              2.0x
            </button>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            className={`p-1.5 rounded-lg border text-xs flex items-center justify-center transition-colors ${
              soundEnabled
                ? 'bg-slate-900 hover:bg-slate-800 text-emerald-400 border-slate-700'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-500 border-slate-800'
            }`}
            title={soundEnabled ? 'Mute synthesized sound effects' : 'Enable tactical audio chimes'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onChaosMonkeyToggle}
            className={`px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg border flex items-center gap-1.5 transition-colors ${
              isChaosRunning
                ? 'bg-amber-950 text-amber-300 border-amber-600 animate-pulse'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
            title="Randomly drop and restore node battery to stress test protocol resilience"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Chaos:</span> <span>{isChaosRunning ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={onResetNetwork}
            className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
            title="Restore all nodes to 100% active state"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          {onOpenEditUsersModal && (
            <button
              onClick={onOpenEditUsersModal}
              className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-cyan-950/60 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/60 rounded-lg flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(6,182,212,0.2)]"
              title="Open Mesh User Directory to change user names, roles, or add custom devices"
            >
              <UserPen className="w-3.5 h-3.5 text-cyan-400" />
              <span>Users</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

