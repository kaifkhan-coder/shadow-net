import React, { useState, useEffect } from 'react';
import {
  Layers,
  ShieldCheck,
  ShieldAlert,
  Download,
  Share2,
  Filter,
  FileCode,
  Radio,
  Clock,
  Zap,
} from 'lucide-react';
import { MeshPacket, MeshPacketPriority } from '../types/mesh';
import { meshRouter } from '../services/meshRouter';

export const PacketSniffer: React.FC = () => {
  const [packets, setPackets] = useState<MeshPacket[]>(meshRouter.getHistory());
  const [selectedPacket, setSelectedPacket] = useState<MeshPacket | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setPackets(meshRouter.getHistory());
    const unsub = meshRouter.onPacket(() => {
      setPackets(meshRouter.getHistory());
    });
    return unsub;
  }, []);

  const filteredPackets = packets.filter((p) => {
    if (filterPriority !== 'ALL' && p.priority !== filterPriority) return false;
    if (
      searchQuery &&
      !p.originCallsign.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !p.id.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !p.payload.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleExportMissionLog = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(packets, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `shadow_net_mesh_log_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-57px)] overflow-hidden bg-[#06080d]">
      {/* Packet Table List */}
      <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 overflow-hidden">
        {/* Sub-header Filter Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-[#080c14] border-b border-slate-800 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-cyan-400 font-semibold uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5" />
              Wire Packet Sniffer
            </span>
            <span className="text-slate-600">·</span>
            <span>Total Captured: {packets.length}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded px-2 py-0.5">
              <Filter className="w-3 h-3 text-slate-500" />
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="bg-transparent text-slate-300 text-[11px] focus:outline-none"
              >
                <option value="ALL">All Priorities</option>
                <option value="SOS">SOS Distresses</option>
                <option value="HIGH">High Priority</option>
                <option value="ROUTINE">Routine Packets</option>
              </select>
            </div>

            <button
              onClick={handleExportMissionLog}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded transition-colors"
              title="Download tactical packet history to local drive"
            >
              <Download className="w-3 h-3" />
              Export Log
            </button>
          </div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto">
          {filteredPackets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-slate-500 font-mono text-xs">
              No packets match filter parameters.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {filteredPackets.map((pkt) => {
                const isSelected = selectedPacket?.id === pkt.id;
                const isSos = pkt.priority === 'SOS';
                const isHigh = pkt.priority === 'HIGH';

                return (
                  <div
                    key={pkt.id}
                    onClick={() => setSelectedPacket(pkt)}
                    className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors text-xs font-mono ${
                      isSelected
                        ? 'bg-cyan-950/40 border-l-2 border-cyan-400'
                        : 'hover:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate pr-4">
                      {/* Priority Icon */}
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isSos
                            ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'
                            : isHigh
                            ? 'bg-amber-400'
                            : 'bg-cyan-400'
                        }`}
                      />

                      <div className="flex flex-col truncate">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200">
                            {pkt.originCallsign}
                          </span>
                          <span className="text-slate-500 text-[10px]">
                            → {pkt.targetNodeId}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            [{pkt.channel}]
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 truncate mt-0.5">
                          {pkt.payload.slice(0, 70)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-500">
                      <span>{pkt.hopCount} hop{pkt.hopCount !== 1 ? 's' : ''}</span>
                      <span>{new Date(pkt.timestamp).toLocaleTimeString()}</span>
                      {pkt.tamperVerified ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Deep Packet Frame Inspector */}
      <div className="w-full lg:w-96 xl:w-[440px] flex flex-col bg-[#090d16] border-t lg:border-t-0 border-slate-800 p-5 overflow-y-auto">
        <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-wider uppercase font-['Chakra_Petch'] text-slate-200">
              Packet Frame Inspector
            </h2>
            <div className="text-xs font-mono text-slate-500 mt-0.5">
              Micro-Routing Wire Frame & Cryptography
            </div>
          </div>
          {selectedPacket && (
            <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-900 border border-slate-800 text-cyan-400 rounded">
              {selectedPacket.priority}
            </span>
          )}
        </div>

        {selectedPacket ? (
          <div className="mt-4 space-y-4 text-xs font-mono">
            {/* Header Summary Card */}
            <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Frame ID:</span>
                <span className="text-cyan-300 select-all font-semibold">{selectedPacket.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Origin Node:</span>
                <span className="text-slate-200">{selectedPacket.originCallsign} ({selectedPacket.originNodeId})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Channel / Target:</span>
                <span className="text-slate-200">{selectedPacket.channel} / {selectedPacket.targetNodeId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">TTL Expiry:</span>
                <span className="text-slate-400">{new Date(selectedPacket.ttl).toLocaleTimeString()}</span>
              </div>
            </div>

            {/* Micro-Route Hop Ladder */}
            <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-lg">
              <div className="text-[10px] uppercase text-slate-500 tracking-wider mb-2 flex items-center gap-1">
                <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                Relay Hop Trace Ladder
              </div>
              <div className="space-y-1.5 pl-2 border-l border-cyan-800/80">
                {selectedPacket.routeHistory.map((hopNodeId, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-slate-300">
                    <span className="text-[10px] text-cyan-400">Hop {idx}:</span>
                    <span className="font-semibold">{hopNodeId}</span>
                    {idx === 0 && <span className="text-[9px] text-slate-500">(Originator)</span>}
                    {idx === selectedPacket.routeHistory.length - 1 && (
                      <span className="text-[9px] text-emerald-400">(Latest Forwarder)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Cryptographic Signature Verification */}
            <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-slate-500 tracking-wider">
                  ECDSA P-256 Digital Signature
                </span>
                <span
                  className={`text-[10px] font-bold ${
                    selectedPacket.tamperVerified ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {selectedPacket.tamperVerified ? 'AUTHENTIC' : 'UNVERIFIED'}
                </span>
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800 text-[10px] text-slate-400 break-all select-all font-mono">
                {selectedPacket.signature || 'SIG_DEV_MOCK_AUTHENTIC'}
              </div>
            </div>

            {/* Raw JSON Wire Structure */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] uppercase text-slate-500 tracking-wider">
                <span className="flex items-center gap-1">
                  <FileCode className="w-3.5 h-3.5" />
                  Wire Payload
                </span>
                <span>Format: JSON Packet</span>
              </div>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[10px] text-slate-300 font-mono overflow-x-auto max-h-52">
                {JSON.stringify(selectedPacket, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs font-mono text-slate-500 mt-4">
            Select any packet in the sniffer table to analyze wire frame, cryptographic signature, and hop relay path.
          </div>
        )}
      </div>
    </div>
  );
};
