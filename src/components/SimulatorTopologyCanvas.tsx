import React, { useState, useRef, useEffect } from 'react';
import {
  Smartphone,
  Battery,
  Radio,
  Zap,
  ShieldAlert,
  Info,
  Sliders,
  Move,
  CheckCircle2,
  XCircle,
  HelpCircle,
  UserCheck,
  Send,
  Target,
  ArrowRight,
  UserPen,
  Edit3,
  Check,
  ExternalLink,
} from 'lucide-react';
import { SimNode, SimEdge, TransmissionState } from '../types/simulator';

interface SimulatorTopologyCanvasProps {
  nodes: SimNode[];
  edges: SimEdge[];
  transmission: TransmissionState;
  candidatePath: string[];
  activeUserId: string;
  destUserId: string;
  onNodeClick: (nodeId: string) => void;
  onNodeStatusChange: (nodeId: string, newStatus: SimNode['status']) => void;
  onNodeDrag: (nodeId: string, x: number, y: number) => void;
  onSelectAsOrigin: (nodeId: string) => void;
  onSelectAsDest: (nodeId: string) => void;
  onQuickSendFromNode?: (nodeId: string, message: string) => void;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onOpenEditUsersModal?: (nodeId?: string) => void;
  onUpdateNodeName?: (nodeId: string, newName: string, newLabel?: string) => void;
}

export const SimulatorTopologyCanvas: React.FC<SimulatorTopologyCanvasProps> = ({
  nodes,
  edges,
  transmission,
  candidatePath,
  activeUserId,
  destUserId,
  onNodeClick,
  onNodeStatusChange,
  onNodeDrag,
  onSelectAsOrigin,
  onSelectAsDest,
  onQuickSendFromNode,
  selectedNodeId,
  onSelectNode,
  onOpenEditUsersModal,
  onUpdateNodeName,
}) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [isEditingInDrawer, setIsEditingInDrawer] = useState(false);
  const [drawerNameInput, setDrawerNameInput] = useState('');
  const [drawerLabelInput, setDrawerLabelInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync drawer inputs when selected node changes
  useEffect(() => {
    if (selectedNodeId) {
      const selected = nodes.find((n) => n.id === selectedNodeId);
      if (selected) {
        setDrawerNameInput(selected.name);
        setDrawerLabelInput(selected.label);
      }
    } else {
      setIsEditingInDrawer(false);
    }
  }, [selectedNodeId, nodes]);

  // Compute active transmission path node IDs set
  const plannedPathSet = new Set(transmission.plannedPath);
  const candidatePathSet = new Set(candidatePath);

  // Drag-and-drop handling for nodes
  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    // Only drag with left click
    if (e.button !== 0) return;
    setDraggingNodeId(nodeId);
    onSelectNode(nodeId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(6, Math.min(94, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(10, Math.min(90, ((e.clientY - rect.top) / rect.height) * 100));
    onNodeDrag(draggingNodeId, Math.round(x), Math.round(y));
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
  };

  // Find hovered node details
  const hoveredNode = nodes.find((n) => n.id === hoveredNodeId);
  const activeOperatorNode = nodes.find((n) => n.id === activeUserId);

  // Check if an edge is part of the currently active transmission hop
  const isEdgeInActiveHop = (fromId: string, toId: string) => {
    if (!transmission.activeEdge) return false;
    return (
      (transmission.activeEdge.from === fromId && transmission.activeEdge.to === toId) ||
      (transmission.activeEdge.from === toId && transmission.activeEdge.to === fromId)
    );
  };

  // Check if edge is along the actively executing route
  const isEdgeInPlannedRoute = (fromId: string, toId: string) => {
    const path = transmission.plannedPath;
    for (let i = 0; i < path.length - 1; i++) {
      if (
        (path[i] === fromId && path[i + 1] === toId) ||
        (path[i] === toId && path[i + 1] === fromId)
      ) {
        return true;
      }
    }
    return false;
  };

  // Check if edge is along candidate preview route
  const isEdgeInCandidatePath = (fromId: string, toId: string) => {
    for (let i = 0; i < candidatePath.length - 1; i++) {
      if (
        (candidatePath[i] === fromId && candidatePath[i + 1] === toId) ||
        (candidatePath[i] === toId && candidatePath[i + 1] === fromId)
      ) {
        return true;
      }
    }
    return false;
  };

  // Compute packet particle coordinates during transmission
  const getPacketPosition = () => {
    if (!transmission.isTransmitting || !transmission.activeEdge) return null;
    const fromNode = nodes.find((n) => n.id === transmission.activeEdge?.from);
    const toNode = nodes.find((n) => n.id === transmission.activeEdge?.to);
    if (!fromNode || !toNode) return null;

    const prog = transmission.packetProgress;
    const curX = fromNode.x + (toNode.x - fromNode.x) * prog;
    const curY = fromNode.y + (toNode.y - fromNode.y) * prog;
    return { x: curX, y: curY, from: fromNode, to: toNode };
  };

  const packetPos = getPacketPosition();

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="relative flex-1 w-full h-full bg-[#05070b] tactical-radar-grid select-none overflow-hidden"
      style={{ minHeight: '440px' }}
    >
      {/* Background Radar Rings & Grid Coordinate Rulers */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
        <circle cx="50%" cy="50%" r="18%" fill="none" stroke="#0ea5e9" strokeDasharray="3 3" />
        <circle cx="50%" cy="50%" r="35%" fill="none" stroke="#0ea5e9" strokeDasharray="4 4" />
        <circle cx="50%" cy="50%" r="52%" fill="none" stroke="#0ea5e9" strokeDasharray="5 5" />
        <line x1="50%" y1="0%" x2="50%" y2="100%" stroke="#0ea5e9" strokeWidth="0.5" />
        <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="#0ea5e9" strokeWidth="0.5" />
      </svg>

      {/* SVG Wireless Ad-Hoc Mesh Edges Layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <linearGradient id="activeRouteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glowAmber" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Hover Node Range Bubble (Shows 50m physical RF propagation circle) */}
        {hoveredNode && (
          <circle
            cx={`${hoveredNode.x}%`}
            cy={`${hoveredNode.y}%`}
            r="16%"
            fill="rgba(14, 165, 233, 0.04)"
            stroke="rgba(14, 165, 233, 0.4)"
            strokeWidth="1.2"
            strokeDasharray="4 4"
          />
        )}

        {/* Active Operator Transmission Aura */}
        {activeOperatorNode && (
          <circle
            cx={`${activeOperatorNode.x}%`}
            cy={`${activeOperatorNode.y}%`}
            r="8%"
            fill="rgba(245, 158, 11, 0.05)"
            stroke="rgba(245, 158, 11, 0.3)"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
        )}

        {/* Route Request (RREQ) Discovery Wave Animation */}
        {transmission.phase === 'discovering_rreq' && activeOperatorNode && (
          <g>
            <circle
              cx={`${activeOperatorNode.x}%`}
              cy={`${activeOperatorNode.y}%`}
              r={`${transmission.discoveryWaveRadius || 25}%`}
              fill="rgba(6, 182, 212, 0.12)"
              stroke="#06b6d4"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              className="animate-pulse"
              filter="url(#glowGreen)"
            />
          </g>
        )}

        {/* Render Wireless RF Range Links between active nodes */}
        {edges.map((edge, idx) => {
          const u = nodes.find((n) => n.id === edge.fromId);
          const v = nodes.find((n) => n.id === edge.toId);
          if (!u || !v) return null;

          const isAlongActiveRoute = isEdgeInPlannedRoute(u.id, v.id);
          const isAlongCandidateRoute = !transmission.isTransmitting && isEdgeInCandidatePath(u.id, v.id);
          const isActiveHop = isEdgeInActiveHop(u.id, v.id);
          const isBrokenDuringTx =
            transmission.status === 'failed' &&
            transmission.failedNodeId &&
            (u.id === transmission.failedNodeId || v.id === transmission.failedNodeId) &&
            isAlongActiveRoute;

          let strokeColor = 'rgba(71, 85, 105, 0.3)'; // Default faint idle link
          let strokeWidth = 1.2;
          let strokeDash = '4 4';

          if (isBrokenDuringTx) {
            strokeColor = '#ef4444'; // Red broken link
            strokeWidth = 3;
            strokeDash = '6 3';
          } else if (isActiveHop) {
            strokeColor = '#10b981'; // Green active hopping link
            strokeWidth = 3.5;
            strokeDash = 'none';
          } else if (isAlongActiveRoute) {
            strokeColor = '#06b6d4'; // Cyan planned route link
            strokeWidth = 2.5;
            strokeDash = '8 4';
          } else if (isAlongCandidateRoute) {
            strokeColor = '#f59e0b'; // Amber candidate preview link
            strokeWidth = 2.2;
            strokeDash = '6 3';
          }

          const midX = (u.x + v.x) / 2;
          const midY = (u.y + v.y) / 2;

          return (
            <g key={`edge-${u.id}-${v.id}-${idx}`}>
              <line
                x1={`${u.x}%`}
                y1={`${u.y}%`}
                x2={`${v.x}%`}
                y2={`${v.y}%`}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDash}
                filter={isActiveHop ? 'url(#glowGreen)' : isBrokenDuringTx ? 'url(#glowRed)' : isAlongCandidateRoute ? 'url(#glowAmber)' : undefined}
                className={isAlongCandidateRoute || isActiveHop ? 'transition-all duration-300' : ''}
              />

              {/* Edge Distance Tag Badge */}
              {(isAlongActiveRoute || isActiveHop || isAlongCandidateRoute || isBrokenDuringTx) && (
                <text
                  x={`${midX}%`}
                  y={`${midY}%`}
                  fill={isBrokenDuringTx ? '#f87171' : isActiveHop ? '#34d399' : isAlongCandidateRoute ? '#fbbf24' : '#38bdf8'}
                  fontSize="9.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {isBrokenDuringTx ? 'SEVERED' : `${edge.distanceMeters}m`}
                </text>
              )}
            </g>
          );
        })}

        {/* Live Traveling Packet Graphic along the graph line */}
        {packetPos && (
          <g
            transform={`translate(${(packetPos.x / 100) * (containerRef.current?.clientWidth || 800)}, ${(packetPos.y / 100) * (containerRef.current?.clientHeight || 500)})`}
          >
            <circle r="14" fill="#10b981" opacity="0.35" className="animate-ping" />
            <circle r="8" fill="#10b981" stroke="#ffffff" strokeWidth="2" filter="url(#glowGreen)" />
            <circle r="3" fill="#ffffff" />

            {/* Floating Packet Label */}
            <text
              y="-14"
              textAnchor="middle"
              fill="#34d399"
              fontSize="10"
              fontFamily="monospace"
              fontWeight="bold"
            >
              [PKT #{transmission.currentHopIndex + 1}/{transmission.totalHops}]
            </text>
          </g>
        )}
      </svg>

      {/* Render Peer Nodes */}
      {nodes.map((node) => {
        const isHovered = hoveredNodeId === node.id;
        const isSelected = selectedNodeId === node.id;
        const isOrigin = activeUserId === node.id;
        const isDest = destUserId === node.id;
        const isInRoute = plannedPathSet.has(node.id) || candidatePathSet.has(node.id);
        const isCurrentHop =
          transmission.isTransmitting &&
          transmission.plannedPath[transmission.currentHopIndex] === node.id;
        const isFailedNode = transmission.failedNodeId === node.id;

        // Visual State Palette
        let statusBg = 'bg-slate-900 border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.3)]';
        let iconColor = 'text-emerald-400';

        if (node.status === 'dead') {
          statusBg = 'bg-rose-950/80 border-rose-600 shadow-[0_0_16px_rgba(239,68,68,0.5)]';
          iconColor = 'text-rose-500';
        } else if (node.status === 'out_of_range') {
          statusBg = 'bg-slate-900/90 border-slate-700 opacity-60';
          iconColor = 'text-slate-500';
        }

        if (isCurrentHop) {
          statusBg = 'bg-emerald-900 border-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.9)] scale-115';
        } else if (isFailedNode) {
          statusBg = 'bg-rose-900 border-rose-400 shadow-[0_0_24px_rgba(239,68,68,0.9)] animate-bounce';
        } else if (isOrigin) {
          statusBg = 'bg-amber-950/90 border-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.6)] ring-2 ring-amber-400/50';
        } else if (isDest) {
          statusBg = 'bg-cyan-950/90 border-cyan-400 shadow-[0_0_18px_rgba(6,182,212,0.6)] ring-2 ring-cyan-400/50';
        }

        return (
          <div
            key={node.id}
            onMouseDown={(e) => handleMouseDown(node.id, e)}
            onClick={() => onNodeClick(node.id)}
            onMouseEnter={() => setHoveredNodeId(node.id)}
            onMouseLeave={() => setHoveredNodeId(null)}
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className={`absolute flex flex-col items-center cursor-pointer transition-transform duration-150 z-20 ${
              isSelected ? 'scale-110 z-30' : 'hover:scale-105'
            }`}
          >
            {/* Origin / Destination Tactical Badges */}
            {isOrigin && (
              <span className="mb-1 text-[9px] font-mono font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500 text-slate-950 border border-amber-300 shadow flex items-center gap-1 animate-pulse">
                <UserCheck className="w-2.5 h-2.5" />
                YOU (OPERATOR)
              </span>
            )}
            {isDest && (
              <span className="mb-1 text-[9px] font-mono font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-400 text-slate-950 border border-cyan-200 shadow flex items-center gap-1">
                <Target className="w-2.5 h-2.5" />
                DESTINATION
              </span>
            )}

            {/* Node Icon Box */}
            <div
              className={`relative w-11 h-11 rounded-xl flex items-center justify-center border-2 ${statusBg} backdrop-blur-md transition-all`}
            >
              <Smartphone className={`w-5 h-5 ${iconColor}`} />

              {/* Status Dot */}
              <span
                className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border border-slate-950 ${
                  node.status === 'active'
                    ? 'bg-emerald-400 animate-pulse'
                    : node.status === 'dead'
                    ? 'bg-rose-500'
                    : 'bg-slate-500'
                }`}
              />

              {/* Battery indicator strip inside icon */}
              <div className="absolute bottom-1 w-6 h-1 bg-black/60 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    node.battery > 50
                      ? 'bg-emerald-400'
                      : node.battery > 20
                      ? 'bg-amber-400'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${node.status === 'dead' ? 0 : node.battery}%` }}
                />
              </div>
            </div>

            {/* Label and Student Name */}
            <div
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (onOpenEditUsersModal) onOpenEditUsersModal(node.id);
              }}
              className="mt-1 flex flex-col items-center text-center font-mono cursor-pointer group/label"
              title="Click to select, double-click to rename user"
            >
              <span className="text-xs font-bold text-slate-100 px-1.5 py-0.5 rounded bg-black/80 border border-slate-800 flex items-center gap-1 shadow group-hover/label:border-cyan-500/70 transition-colors">
                {node.name}
                <Edit3 className="w-2.5 h-2.5 text-slate-500 group-hover/label:text-cyan-400 opacity-60 group-hover/label:opacity-100 transition-opacity" />
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 font-medium">
                {node.label}
              </span>
            </div>
          </div>
        );
      })}

      {/* Floating Hover Tooltip: Transmission Range (50m), Battery %, Device ID */}
      {hoveredNode && (
        <div
          style={{
            left: `${Math.min(82, Math.max(12, hoveredNode.x))}%`,
            top: `${Math.min(75, Math.max(15, hoveredNode.y + 10))}%`,
          }}
          className="absolute pointer-events-none z-40 bg-slate-950/95 border border-slate-700/90 rounded-lg p-3 shadow-2xl backdrop-blur text-xs font-mono w-64 transform -translate-x-1/2"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <div className="text-slate-100 font-bold text-sm flex items-center gap-1.5">
                <span>{hoveredNode.name}</span>
                {hoveredNode.id === activeUserId && (
                  <span className="text-[9px] bg-amber-500 text-slate-950 font-extrabold px-1 rounded">
                    YOU
                  </span>
                )}
              </div>
              <div className="text-[11px] text-cyan-400">{hoveredNode.label}</div>
            </div>
            <span
              className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold border ${
                hoveredNode.status === 'active'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  : hoveredNode.status === 'dead'
                  ? 'bg-rose-950 text-rose-300 border-rose-700'
                  : 'bg-slate-900 text-slate-400 border-slate-700'
              }`}
            >
              {hoveredNode.status === 'active'
                ? 'Active'
                : hoveredNode.status === 'dead'
                ? 'Battery Dead'
                : 'Out of Range'}
            </span>
          </div>

          <div className="mt-2 space-y-1 text-slate-300 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Device ID:</span>
              <span className="text-slate-200 font-bold">{hoveredNode.deviceId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Transmission Range:</span>
              <span className="text-emerald-400 font-bold">{hoveredNode.rangeMeters} meters</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Battery Level:</span>
              <span
                className={`font-bold ${
                  hoveredNode.battery > 50
                    ? 'text-emerald-400'
                    : hoveredNode.battery > 20
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {hoveredNode.status === 'dead' ? '0% (Discharged)' : `${hoveredNode.battery}%`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tactical Role:</span>
              <span className="text-slate-300">{hoveredNode.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Signal RSSI:</span>
              <span className="text-slate-400">{hoveredNode.signalStrengthDbm} dBm</span>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-800 text-[9px] text-amber-400 flex flex-col gap-0.5">
            <span>• Click to cycle: Active → Dead → Out of Range</span>
            <span>• Drag to move and test RF range propagation</span>
          </div>
        </div>
      )}

      {/* Selected Node Real-Time Action Drawer */}
      {selectedNodeId && (
        <div className="absolute top-3 left-3 z-30 p-3 bg-slate-950/95 border border-slate-700/80 rounded-xl backdrop-blur-md text-xs font-mono flex flex-col gap-2.5 max-w-sm shadow-2xl">
          {(() => {
            const node = nodes.find((n) => n.id === selectedNodeId);
            if (!node) return null;
            const isCurrentOperator = node.id === activeUserId;
            const isCurrentDest = node.id === destUserId;

            return (
              <>
                <div className="flex items-center justify-between gap-3 pb-1.5 border-b border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-slate-100">{node.name}'s Smartphone</span>
                    <span className="text-[10px] text-slate-500">({node.label})</span>
                  </div>
                  <button
                    onClick={() => onSelectNode(null)}
                    className="text-slate-500 hover:text-slate-300 px-1"
                  >
                    ✕
                  </button>
                </div>

                {/* Node Identity & Inline Rename */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1">
                      <UserPen className="w-3.5 h-3.5 text-cyan-400" />
                      User Identity & Name:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          if (isEditingInDrawer) {
                            if (drawerNameInput.trim() && onUpdateNodeName) {
                              onUpdateNodeName(node.id, drawerNameInput.trim(), drawerLabelInput.trim());
                            }
                            setIsEditingInDrawer(false);
                          } else {
                            setDrawerNameInput(node.name);
                            setDrawerLabelInput(node.label);
                            setIsEditingInDrawer(true);
                          }
                        }}
                        className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-950/80 border border-cyan-700/80 px-2 py-0.5 rounded transition-all shadow"
                      >
                        {isEditingInDrawer ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-300">Save</span>
                          </>
                        ) : (
                          <>
                            <Edit3 className="w-3 h-3" />
                            <span>Rename</span>
                          </>
                        )}
                      </button>
                      {onOpenEditUsersModal && (
                        <button
                          onClick={() => onOpenEditUsersModal(node.id)}
                          className="text-[10px] text-slate-400 hover:text-cyan-300 p-1 bg-slate-950 rounded border border-slate-800 hover:border-cyan-500 transition-colors"
                          title="Open all mesh users directory"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditingInDrawer ? (
                    <div className="flex flex-col gap-2 pt-1 border-t border-slate-800">
                      <div>
                        <label className="text-[9px] uppercase text-slate-400 font-semibold block mb-0.5">
                          Student / User Name:
                        </label>
                        <input
                          type="text"
                          value={drawerNameInput}
                          onChange={(e) => {
                            setDrawerNameInput(e.target.value);
                            setDrawerLabelInput(`${e.target.value.replace(/\s+/g, '_')}_Phone`);
                          }}
                          className="w-full bg-slate-950 border border-cyan-500/70 rounded px-2 py-1 text-xs text-white font-bold focus:outline-none focus:border-cyan-400"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (drawerNameInput.trim() && onUpdateNodeName) {
                                onUpdateNodeName(node.id, drawerNameInput.trim(), drawerLabelInput.trim());
                              }
                              setIsEditingInDrawer(false);
                            }
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase text-slate-400 font-semibold block mb-0.5">
                          Device Callsign / Label:
                        </label>
                        <input
                          type="text"
                          value={drawerLabelInput}
                          onChange={(e) => setDrawerLabelInput(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-400"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (drawerNameInput.trim() && onUpdateNodeName) {
                                onUpdateNodeName(node.id, drawerNameInput.trim(), drawerLabelInput.trim());
                              }
                              setIsEditingInDrawer(false);
                            }
                          }}
                        />
                      </div>
                      <div className="flex justify-end gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (drawerNameInput.trim() && onUpdateNodeName) {
                              onUpdateNodeName(node.id, drawerNameInput.trim(), drawerLabelInput.trim());
                            }
                            setIsEditingInDrawer(false);
                          }}
                          className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-[10px] flex items-center gap-1 shadow"
                        >
                          <Check className="w-3 h-3" />
                          <span>Apply</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingInDrawer(false)}
                          className="px-2 py-1 bg-slate-800 text-slate-400 hover:text-slate-200 rounded text-[10px]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-100">{node.name}</span>
                        <span className="text-cyan-400 ml-1.5 font-mono text-[11px]">({node.label})</span>
                      </div>
                      <span className="text-[10px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                        {node.role}
                      </span>
                    </div>
                  )}
                </div>

                {/* Real-time Operator Assignment Buttons */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Operator Identity & Routing:
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => onSelectAsOrigin(node.id)}
                      disabled={isCurrentOperator}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border flex items-center justify-center gap-1.5 transition-all ${
                        isCurrentOperator
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 cursor-default'
                          : 'bg-slate-900 hover:bg-amber-950/50 text-slate-200 border-slate-700 hover:border-amber-500/60'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isCurrentOperator ? 'You are Sender' : 'Operate as Sender'}</span>
                    </button>

                    <button
                      onClick={() => onSelectAsDest(node.id)}
                      disabled={isCurrentDest || isCurrentOperator}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border flex items-center justify-center gap-1.5 transition-all ${
                        isCurrentDest
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 cursor-default'
                          : isCurrentOperator
                          ? 'bg-slate-950 text-slate-600 border-slate-800 cursor-not-allowed'
                          : 'bg-slate-900 hover:bg-cyan-950/50 text-slate-200 border-slate-700 hover:border-cyan-500/60'
                      }`}
                    >
                      <Target className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{isCurrentDest ? 'Is Target Dest' : 'Set as Target'}</span>
                    </button>
                  </div>
                </div>

                {/* State Toggle Buttons */}
                <div className="flex flex-col gap-1 pt-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Node Simulation State:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => onNodeStatusChange(node.id, 'active')}
                      className={`px-2 py-1 rounded text-[10px] uppercase font-bold border transition-colors ${
                        node.status === 'active'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      Active
                    </button>
                    <button
                      onClick={() => onNodeStatusChange(node.id, 'dead')}
                      className={`px-2 py-1 rounded text-[10px] uppercase font-bold border transition-colors ${
                        node.status === 'dead'
                          ? 'bg-rose-950 text-rose-300 border-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      Dead
                    </button>
                    <button
                      onClick={() => onNodeStatusChange(node.id, 'out_of_range')}
                      className={`px-2 py-1 rounded text-[10px] uppercase font-bold border transition-colors ${
                        node.status === 'out_of_range'
                          ? 'bg-slate-800 text-slate-200 border-slate-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      Out Range
                    </button>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex items-center gap-1">
                  <Move className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span>Drag node to simulate students walking across campus!</span>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Delivered Message Popover on Target Node */}
      {transmission.status === 'success' && transmission.lastDeliveredMessage && (
        <div
          style={{
            left: `${nodes.find((n) => n.id === transmission.destId)?.x || 80}%`,
            top: `${Math.max(12, (nodes.find((n) => n.id === transmission.destId)?.y || 50) - 15)}%`,
          }}
          className="absolute z-40 transform -translate-x-1/2 p-3 bg-emerald-950/95 border-2 border-emerald-400 rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.7)] backdrop-blur text-xs font-mono text-emerald-100 max-w-xs animate-bounce"
        >
          <div className="flex items-center gap-1.5 text-emerald-300 font-bold mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>EMERGENCY PACKET DELIVERED!</span>
          </div>
          <p className="text-slate-200 text-xs italic bg-slate-950/80 p-1.5 rounded border border-emerald-900/60 mb-1">
            "{transmission.lastDeliveredMessage.text}"
          </p>
          <div className="text-[10px] text-emerald-400 flex justify-between">
            <span>From: {transmission.lastDeliveredMessage.fromName}</span>
            <span>Hops: {transmission.lastDeliveredMessage.hops} (0% loss)</span>
          </div>
        </div>
      )}

      {/* Canvas Bottom Legend Bar */}
      <div className="absolute bottom-2 inset-x-2 flex flex-wrap items-center justify-between px-3 py-1.5 bg-slate-950/80 border border-slate-800/80 rounded-lg text-[11px] font-mono text-slate-400 backdrop-blur pointer-events-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Active (Online)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Battery Dead (Red)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
            <span>Out of Range (Grey)</span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-amber-400 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Sender (You)</span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-cyan-400 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <span>Target Dest</span>
          </div>
        </div>
        <div className="hidden sm:inline text-slate-500">
          Transmission Radius: ~50m Physical Wi-Fi/Bluetooth Ad-Hoc
        </div>
      </div>
    </div>
  );
};
