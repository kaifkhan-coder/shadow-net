import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Share2,
  Battery,
  ShieldCheck,
  Send,
  RefreshCw,
  Plus,
  Compass,
  Zap,
  MapPin,
  ExternalLink,
  Wifi,
} from 'lucide-react';
import { MeshNode, ActiveTransmissionPulse } from '../types/mesh';
import { meshRouter } from '../services/meshRouter';

interface MeshTopologyProps {
  nodes: MeshNode[];
  localNode: MeshNode | null;
  onSelectNodeForWhisper: (targetNodeId: string) => void;
  activePulses: ActiveTransmissionPulse[];
}

export const MeshTopology: React.FC<MeshTopologyProps> = ({
  nodes,
  localNode,
  onSelectNodeForWhisper,
  activePulses,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSimActive, setIsSimActive] = useState(meshRouter.isSimulationActive());
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [localNodesState, setLocalNodesState] = useState<MeshNode[]>(nodes);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalNodesState(nodes);
    if (!selectedNodeId && nodes.length > 0) {
      setSelectedNodeId(localNode?.id || nodes[0].id);
    }
  }, [nodes, localNode]);

  const selectedNode = localNodesState.find((n) => n.id === selectedNodeId) || localNode;

  // Handle dragging nodes on the tactical canvas
  const handleMouseDown = (nodeId: string) => {
    setDraggingNodeId(nodeId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(8, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100));

    setLocalNodesState((prev) =>
      prev.map((n) => (n.id === draggingNodeId ? { ...n, coordinates: { ...n.coordinates, x, y } } : n))
    );

    if (draggingNodeId === localNode?.id) {
      meshRouter.updateLocalCoordinates(x, y);
    }
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
  };

  // Generate tactical connections between nodes based on proximity and routing
  const links: Array<{ from: MeshNode; to: MeshNode; rssi: number; active: boolean }> = [];
  for (let i = 0; i < localNodesState.length; i++) {
    for (let j = i + 1; j < localNodesState.length; j++) {
      const a = localNodesState[i];
      const b = localNodesState[j];
      const dx = a.coordinates.x - b.coordinates.x;
      const dy = a.coordinates.y - b.coordinates.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Links form if within RF transmission range (< 55% canvas distance) or relay
      if (dist < 58 || a.role === 'relay' || b.role === 'relay') {
        const estRssi = Math.round(-45 - dist * 0.7);
        links.push({ from: a, to: b, rssi: estRssi, active: true });
      }
    }
  }

  const handleBroadcastBeacon = () => {
    meshRouter.broadcastBeacon();
  };

  const handleToggleSimulation = () => {
    const nextState = !isSimActive;
    setIsSimActive(nextState);
    meshRouter.toggleSimulation(nextState);
  };

  const handleOpenSecondTab = () => {
    window.open(window.location.href, '_blank');
  };

  const getNodeRoleBadge = (role: MeshNode['role']) => {
    switch (role) {
      case 'relay':
        return { label: 'Repeater Tower', color: 'text-amber-400 bg-amber-950/40 border-amber-800/60' };
      case 'shelter':
        return { label: 'Civil Shelter', color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60' };
      case 'medical':
        return { label: 'Medical Triage', color: 'text-rose-400 bg-rose-950/40 border-rose-800/60' };
      case 'command':
        return { label: 'Tactical HQ', color: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/60' };
      default:
        return { label: 'Field Scout', color: 'text-slate-300 bg-slate-800/40 border-slate-700/60' };
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-57px)] overflow-hidden bg-[#06080d]">
      {/* Main Tactical Visualizer Canvas */}
      <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 relative select-none">
        {/* Canvas Sub-Header Controls */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-[#090d16] border-b border-slate-800 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-cyan-400 font-semibold uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5" />
              RF Topology Matrix
            </span>
            <span className="hidden sm:inline text-slate-500">|</span>
            <span className="hidden sm:inline">Active Nodes: {localNodesState.length}</span>
            <span className="hidden sm:inline text-slate-500">|</span>
            <span className="hidden md:inline">RF Links: {links.length}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSimulation}
              className={`px-2.5 py-1 rounded text-xs transition-colors border ${
                isSimActive
                  ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800/70'
                  : 'bg-slate-900 text-slate-400 border-slate-700'
              }`}
              title="Toggle Autonomous Emergency Relay Nodes"
            >
              Sim Fleet: {isSimActive ? 'ACTIVE' : 'OFF'}
            </button>

            <button
              onClick={handleBroadcastBeacon}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
              title="Ping all nodes with heartbeat"
            >
              <RefreshCw className="w-3 h-3" />
              Beacon Ping
            </button>

            <button
              onClick={handleOpenSecondTab}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-slate-900 hover:bg-cyan-950/40 text-cyan-400 border border-slate-700 transition-colors"
              title="Open a 2nd tab to test real inter-tab P2P mesh routing on this device"
            >
              <ExternalLink className="w-3 h-3" />
              + Peer Tab
            </button>
          </div>
        </div>

        {/* Tactical Canvas Stage */}
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="flex-1 relative tactical-grid overflow-hidden cursor-crosshair"
          style={{ minHeight: '380px' }}
        >
          {/* Circular Radar Sweep Rings in background */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-25">
            <circle cx="50%" cy="50%" r="18%" fill="none" stroke="#0ea5e9" strokeDasharray="3 3" />
            <circle cx="50%" cy="50%" r="36%" fill="none" stroke="#0ea5e9" strokeDasharray="4 4" />
            <circle cx="50%" cy="50%" r="52%" fill="none" stroke="#0ea5e9" strokeDasharray="6 6" />
            <line x1="50%" y1="0%" x2="50%" y2="100%" stroke="#0ea5e9" strokeWidth="0.5" />
            <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="#0ea5e9" strokeWidth="0.5" />
          </svg>

          {/* Render Vector Lines Between Nodes */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {links.map((link, idx) => {
              const x1 = `${link.from.coordinates.x}%`;
              const y1 = `${link.from.coordinates.y}%`;
              const x2 = `${link.to.coordinates.x}%`;
              const y2 = `${link.to.coordinates.y}%`;
              const midX = (link.from.coordinates.x + link.to.coordinates.x) / 2;
              const midY = (link.from.coordinates.y + link.to.coordinates.y) / 2;

              const isStrong = link.rssi > -65;
              const strokeColor = isStrong ? 'rgba(6, 182, 212, 0.45)' : 'rgba(100, 116, 139, 0.35)';

              return (
                <g key={`link-${idx}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={strokeColor}
                    strokeWidth={isStrong ? 1.5 : 1}
                    strokeDasharray={link.from.role === 'relay' || link.to.role === 'relay' ? 'none' : '4 3'}
                  />
                  {/* Subtle RSSI metric label */}
                  <text
                    x={`${midX}%`}
                    y={`${midY}%`}
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="middle"
                    className="select-none"
                  >
                    {link.rssi} dBm
                  </text>
                </g>
              );
            })}

            {/* Render Animated Transmission Pulses traveling along links */}
            {activePulses.map((pulse) => {
              const sender = localNodesState.find((n) => n.id === pulse.fromNodeId);
              const receiver = localNodesState.find((n) => n.id === pulse.toNodeId) || localNode;
              if (!sender || !receiver) return null;

              return (
                <circle
                  key={pulse.id}
                  cx={`${(sender.coordinates.x + receiver.coordinates.x) / 2}%`}
                  cy={`${(sender.coordinates.y + receiver.coordinates.y) / 2}%`}
                  r="6"
                  className={pulse.priority === 'SOS' ? 'fill-rose-500 animate-ping' : 'fill-cyan-400 animate-ping'}
                />
              );
            })}
          </svg>

          {/* Render Node Elements */}
          {localNodesState.map((node) => {
            const isLocal = node.id === localNode?.id;
            const isSelected = node.id === selectedNodeId;
            const isRelay = node.role === 'relay';
            const isShelter = node.role === 'shelter';
            const isMedic = node.role === 'medical';

            let nodeBorder = 'border-slate-600 bg-slate-900';
            let haloColor = 'rgba(148, 163, 184, 0.2)';

            if (isLocal) {
              nodeBorder = 'border-cyan-400 bg-cyan-950/80 ring-2 ring-cyan-500/30';
              haloColor = 'rgba(6, 182, 212, 0.3)';
            } else if (isRelay) {
              nodeBorder = 'border-amber-400 bg-amber-950/80';
              haloColor = 'rgba(245, 158, 11, 0.25)';
            } else if (isMedic) {
              nodeBorder = 'border-rose-400 bg-rose-950/80';
              haloColor = 'rgba(244, 63, 94, 0.25)';
            } else if (isShelter) {
              nodeBorder = 'border-emerald-400 bg-emerald-950/80';
              haloColor = 'rgba(16, 185, 129, 0.25)';
            }

            return (
              <div
                key={node.id}
                onMouseDown={() => handleMouseDown(node.id)}
                onClick={() => setSelectedNodeId(node.id)}
                style={{
                  left: `${node.coordinates.x}%`,
                  top: `${node.coordinates.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`absolute cursor-pointer group flex flex-col items-center z-10 transition-transform ${
                  isSelected ? 'scale-110 z-20' : 'hover:scale-105'
                }`}
              >
                {/* Node Glyph Card */}
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center border shadow-lg ${nodeBorder} transition-all`}
                  style={{ boxShadow: `0 0 14px ${haloColor}` }}
                >
                  {isRelay ? (
                    <Radio className="w-4 h-4 text-amber-400" />
                  ) : isMedic ? (
                    <Zap className="w-4 h-4 text-rose-400" />
                  ) : isShelter ? (
                    <MapPin className="w-4 h-4 text-emerald-400" />
                  ) : isLocal ? (
                    <Radio className="w-4 h-4 text-cyan-300" />
                  ) : (
                    <Share2 className="w-4 h-4 text-slate-300" />
                  )}
                </div>

                {/* Node Label Below */}
                <div className="mt-1 flex flex-col items-center">
                  <span
                    className={`text-[11px] font-mono font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${
                      isLocal ? 'bg-cyan-950 text-cyan-300 font-bold' : 'bg-slate-900/90 text-slate-300'
                    }`}
                  >
                    {node.callsign}
                  </span>
                  <div className="flex items-center gap-1 text-[9px] font-mono text-slate-500">
                    <span>{node.batteryLevel}%</span>
                    <span>·</span>
                    <span>{node.coordinates.gridRef || 'GR-LOC'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Legend Ribbon */}
        <div className="flex flex-wrap items-center justify-between px-5 py-2.5 bg-[#080c14] border-t border-slate-800 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-cyan-400" />
              <span>You (Local)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-amber-400" />
              <span>Repeater Tower</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-400" />
              <span>Shelter Base</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-rose-400" />
              <span>Medical Unit</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500">
            Tip: Drag any node icon to test dynamic mesh routing recalculation
          </div>
        </div>
      </div>

      {/* Right Column: Node Inspector & Telemetry Sheet */}
      <div className="w-full lg:w-80 xl:w-96 flex flex-col bg-[#090d16] border-t lg:border-t-0 border-slate-800 p-5 overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h2 className="text-sm font-semibold tracking-wider uppercase font-['Chakra_Petch'] text-slate-200">
            Node Telemetry
          </h2>
          {selectedNode && (
            <span
              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                getNodeRoleBadge(selectedNode.role).color
              }`}
            >
              {getNodeRoleBadge(selectedNode.role).label}
            </span>
          )}
        </div>

        {selectedNode ? (
          <div className="mt-4 space-y-4">
            {/* Identity Card */}
            <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-100 font-['Chakra_Petch']">
                    {selectedNode.callsign}
                  </h3>
                  <div className="text-xs font-mono text-cyan-400 mt-0.5">{selectedNode.id}</div>
                </div>
                {selectedNode.isLocal && (
                  <span className="px-2 py-0.5 text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/80 rounded">
                    HOST
                  </span>
                )}
              </div>

              {/* Fingerprint */}
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  ECDSA Hash
                </span>
                <span className="font-mono text-slate-300 text-[11px]">{selectedNode.fingerprint}</span>
              </div>
            </div>

            {/* Radio & Routing Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg">
                <div className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">
                  RF Signal RSSI
                </div>
                <div className="text-lg font-mono font-bold text-slate-200 mt-0.5 tabular-nums">
                  {selectedNode.rssi}{' '}
                  <span className="text-[10px] font-mono uppercase text-slate-500">dBm</span>
                </div>
                <div className="text-[10px] text-emerald-400 font-mono mt-0.5">99.2% Link Quality</div>
              </div>

              <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg">
                <div className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">
                  Battery Reserve
                </div>
                <div className="text-lg font-mono font-bold text-slate-200 mt-0.5 tabular-nums flex items-center gap-1.5">
                  <Battery className="w-4 h-4 text-emerald-400" />
                  {selectedNode.batteryLevel}%
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Standard Throttle</div>
              </div>

              <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg">
                <div className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">
                  Stored Bundles
                </div>
                <div className="text-lg font-mono font-bold text-cyan-300 mt-0.5 tabular-nums">
                  {selectedNode.storedBundlesCount}{' '}
                  <span className="text-[10px] font-mono text-slate-500">PKTS</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Delay-Tolerant Cache</div>
              </div>

              <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg">
                <div className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">
                  Relayed Packets
                </div>
                <div className="text-lg font-mono font-bold text-slate-200 mt-0.5 tabular-nums">
                  {selectedNode.relayedPacketsCount}{' '}
                  <span className="text-[10px] font-mono text-slate-500">FWD</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Micro-Hop Count</div>
              </div>
            </div>

            {/* Tactical Grid Coordinates */}
            <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg text-xs font-mono">
              <div className="text-[10px] uppercase text-slate-500 tracking-wider">Tactical Grid Ref</div>
              <div className="flex items-center justify-between text-slate-300 mt-1">
                <span>COORD {selectedNode.coordinates.gridRef || 'GR-4829'}</span>
                <span>
                  {selectedNode.coordinates.lat?.toFixed(4) || '37.7749'}° N,{' '}
                  {selectedNode.coordinates.lon?.toFixed(4) || '-122.4194'}° W
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              {!selectedNode.isLocal && (
                <button
                  onClick={() => onSelectNodeForWhisper(selectedNode.id)}
                  className="w-full py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                >
                  <Send className="w-3.5 h-3.5" />
                  Encrypted Direct Whisper
                </button>
              )}

              <button
                onClick={() => {
                  meshRouter.sendPacket({
                    type: 'telemetry',
                    targetNodeId: selectedNode.id,
                    priority: 'ROUTINE',
                    payload: `[ECHO PROBE] RSSI: ${selectedNode.rssi}dBm at ${new Date().toLocaleTimeString()}`,
                  });
                }}
                className="w-full py-2 px-3 text-xs font-mono text-slate-300 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded transition-colors flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Transmit Routing Probe
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs font-mono text-slate-500">
            Select any node on the topology to inspect micro-routing telemetry.
          </div>
        )}
      </div>
    </div>
  );
};
