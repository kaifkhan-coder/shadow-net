import React from 'react';
import {
  User,
  Radio,
  Share2,
  Zap,
  ArrowRight,
  Shield,
  Activity,
  BatteryCharging,
  AlertCircle,
  CheckCircle,
  XCircle,
  UserPen,
} from 'lucide-react';
import { SimNode } from '../types/simulator';
import { calculateDistanceMeters } from '../services/simulatorEngine';

interface ActiveUserSwitcherProps {
  nodes: SimNode[];
  activeUserId: string;
  onSelectActiveUser: (userId: string) => void;
  destUserId: string;
  onSelectDestUser: (userId: string) => void;
  candidatePath: string[];
  isTransmitting: boolean;
  onQuickSend?: (message: string) => void;
  onOpenEditUsersModal?: (nodeId?: string) => void;
}

export const ActiveUserSwitcher: React.FC<ActiveUserSwitcherProps> = ({
  nodes,
  activeUserId,
  onSelectActiveUser,
  destUserId,
  onSelectDestUser,
  candidatePath,
  isTransmitting,
  onQuickSend,
  onOpenEditUsersModal,
}) => {
  const activeUser = nodes.find((n) => n.id === activeUserId);
  const destUser = nodes.find((n) => n.id === destUserId);

  // Compute total route distance
  let totalDistanceMeters = 0;
  if (candidatePath.length > 1) {
    for (let i = 0; i < candidatePath.length - 1; i++) {
      const u = nodes.find((n) => n.id === candidatePath[i]);
      const v = nodes.find((n) => n.id === candidatePath[i + 1]);
      if (u && v) {
        totalDistanceMeters += calculateDistanceMeters(u, v);
      }
    }
  }

  const hasRoute = candidatePath.length > 1;

  return (
    <div className="bg-[#0b101b] border-b border-slate-800 px-3 lg:px-6 py-2 select-none font-mono">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        {/* Left Section: Active Operator Switcher Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-thin">
          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400 shrink-0 pr-1 border-r border-slate-800 mr-1">
            <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="hidden sm:inline">OPERATE AS:</span>
            <span className="sm:hidden">AS:</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {nodes.map((node) => {
              const isCurrent = node.id === activeUserId;
              const isTarget = node.id === destUserId;
              const isDead = node.status === 'dead';
              const isOutOfRange = node.status === 'out_of_range';

              return (
                <button
                  key={node.id}
                  disabled={isTransmitting}
                  onClick={() => onSelectActiveUser(node.id)}
                  className={`group relative px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isCurrent
                      ? 'bg-amber-500 text-slate-950 border-amber-300 font-bold shadow-[0_0_12px_rgba(245,158,11,0.5)] scale-105 z-10'
                      : isTarget
                      ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/70 hover:bg-cyan-900'
                      : isDead
                      ? 'bg-rose-950/40 text-rose-400/80 border-rose-900/60 line-through hover:bg-rose-950'
                      : isOutOfRange
                      ? 'bg-slate-900/40 text-slate-500 border-slate-800'
                      : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                  }`}
                  title={`${node.name} (${node.label}) - ${node.role} - Battery: ${node.battery}%\nClick to operate network as this user`}
                >
                  {/* Status dot */}
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isCurrent
                        ? 'bg-slate-950 ring-2 ring-amber-300'
                        : isDead
                        ? 'bg-rose-500'
                        : isOutOfRange
                        ? 'bg-slate-500'
                        : 'bg-emerald-400'
                    }`}
                  />

                  <span>{node.name}</span>

                  {isCurrent && (
                    <span className="text-[9px] uppercase tracking-tighter px-1 rounded bg-slate-950 text-amber-300 font-extrabold">
                      YOU
                    </span>
                  )}

                  {isTarget && !isCurrent && (
                    <span className="text-[9px] uppercase tracking-tighter px-1 rounded bg-cyan-900 text-cyan-200">
                      TARGET
                    </span>
                  )}
                </button>
              );
            })}

            {/* Edit Users / Rename Directory Button */}
            {onOpenEditUsersModal && (
              <button
                disabled={isTransmitting}
                onClick={() => onOpenEditUsersModal()}
                className="px-2.5 py-1 rounded-lg border border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 hover:text-cyan-100 text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.15)] disabled:opacity-50"
                title="Change user names, callsigns, roles, or add custom nodes"
              >
                <UserPen className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Edit Users</span>
                <span className="sm:hidden">Edit</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Section: Real-time Route Discovery Telemetry Banner */}
        <div className="flex flex-wrap items-center gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-900/90 border border-slate-800 rounded-lg text-slate-300">
            <span className="text-slate-400 text-[11px]">Route Discovery:</span>
            {hasRoute ? (
              <div className="flex items-center gap-1 text-emerald-400 font-bold">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {candidatePath.length - 1} {candidatePath.length - 1 === 1 ? 'Hop' : 'Hops'} ({totalDistanceMeters}m)
                </span>
                <span className="text-slate-500 text-[10px] hidden md:inline">
                  [{candidatePath.map((id) => nodes.find((n) => n.id === id)?.name).join(' → ')}]
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-rose-400 font-bold">
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                <span>No Path Available (Partitioned)</span>
              </div>
            )}
          </div>

          {/* Quick Target Change Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px] uppercase">Target:</span>
            <select
              value={destUserId}
              disabled={isTransmitting}
              onChange={(e) => onSelectDestUser(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-xs text-cyan-300 font-semibold focus:outline-none"
            >
              {nodes
                .filter((n) => n.id !== activeUserId)
                .map((node) => (
                  <option key={`tgt-${node.id}`} value={node.id}>
                    {node.name} ({node.role}) {node.status !== 'active' ? `[${node.status.toUpperCase()}]` : ''}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
