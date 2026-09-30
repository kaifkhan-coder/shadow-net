import React from 'react';
import { Radio, AlertTriangle, QrCode, Volume2, ShieldAlert, Cpu, Moon } from 'lucide-react';
import { MeshNode, TacticalTheme } from '../types/mesh';

interface TopBarProps {
  activeTab: 'simulator' | 'topology' | 'comms' | 'grid' | 'acoustic' | 'sniffer' | 'mobile';
  setActiveTab: (tab: 'simulator' | 'topology' | 'comms' | 'grid' | 'acoustic' | 'sniffer' | 'mobile') => void;
  localNode: MeshNode | null;
  onOpenSosModal: () => void;
  onOpenHandshakeModal: () => void;
  tacticalTheme: TacticalTheme;
  setTacticalTheme: (theme: TacticalTheme) => void;
  connectedPeersCount: number;
  realPeersCount?: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  localNode,
  onOpenSosModal,
  onOpenHandshakeModal,
  tacticalTheme,
  setTacticalTheme,
  connectedPeersCount,
  realPeersCount = 1,
}) => {
  return (
    <header className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3.5 border-b border-slate-800 bg-[#080c14]/95 backdrop-blur z-30 select-none gap-2">
      {/* Zone 1: Single text wordmark with subtle radio status marker */}
      <div className="flex items-center justify-between sm:justify-start gap-3">
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('topology');
          }}
          className="text-lg font-bold tracking-wider font-['Chakra_Petch'] text-cyan-400 hover:text-cyan-300 transition-colors uppercase flex items-center gap-2"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          Shadow-Net
        </a>
        <div className="flex items-center text-[11px] sm:text-xs font-mono text-slate-400 gap-1.5 sm:gap-2 pl-2 border-l border-slate-800">
          <span className="hidden sm:inline text-amber-400 font-bold">[P2P SIMULATOR]</span>
          <span className="text-emerald-400 font-semibold">{connectedPeersCount} PEERS</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-cyan-300 hidden md:inline">{realPeersCount} PHYSICAL</span>
        </div>
      </div>

      {/* Zone 2: Navigation Links (scrollable on mobile) */}
      <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-0.5">
        <button
          onClick={() => setActiveTab('simulator')}
          className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-all whitespace-nowrap flex items-center gap-1.5 shadow ${
            activeTab === 'simulator'
              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
              : 'text-emerald-400/90 hover:text-emerald-200 hover:bg-emerald-950/40 border border-emerald-900/50'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          P2P Mesh Simulator
        </button>

        <button
          onClick={() => setActiveTab('topology')}
          className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium uppercase tracking-wider rounded transition-colors whitespace-nowrap ${
            activeTab === 'topology'
              ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          Live Mesh
        </button>

        <button
          onClick={() => setActiveTab('mobile')}
          className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium uppercase tracking-wider rounded transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'mobile'
              ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          Field Operators & Mobile
        </button>

        <button
          onClick={() => setActiveTab('comms')}
          className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium uppercase tracking-wider rounded transition-colors whitespace-nowrap ${
            activeTab === 'comms'
              ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          Emergency Comms
        </button>

        <button
          onClick={() => setActiveTab('grid')}
          className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium uppercase tracking-wider rounded transition-colors whitespace-nowrap ${
            activeTab === 'grid'
              ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          Field Grid
        </button>

        <button
          onClick={() => setActiveTab('acoustic')}
          className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium uppercase tracking-wider rounded transition-colors whitespace-nowrap ${
            activeTab === 'acoustic'
              ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          Acoustic Modem
        </button>

        <button
          onClick={() => setActiveTab('sniffer')}
          className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium uppercase tracking-wider rounded transition-colors whitespace-nowrap ${
            activeTab === 'sniffer'
              ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          Sniffer
        </button>
      </nav>

      {/* Zone 3: 1-2 primary actions */}
      <div className="flex items-center gap-2 self-end sm:self-auto">
        {/* Air-gapped QR WebRTC handshake */}
        <button
          onClick={onOpenHandshakeModal}
          title="Air-Gapped QR WebRTC Peer Handshake"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-cyan-300 bg-slate-900 border border-slate-700/80 rounded hover:border-cyan-600 hover:bg-cyan-950/40 transition-colors whitespace-nowrap"
        >
          <QrCode className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">P2P Pair</span>
        </button>

        {/* Emergency SOS High Priority Beacon */}
        <button
          onClick={onOpenSosModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-500 rounded border border-rose-500 shadow-[0_0_12px_rgba(225,29,72,0.4)] transition-all whitespace-nowrap"
        >
          <AlertTriangle className="w-3.5 h-3.5 animate-bounce" />
          <span>Broadcast SOS</span>
        </button>
      </div>
    </header>
  );
};
