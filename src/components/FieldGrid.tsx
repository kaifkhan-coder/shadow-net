import React, { useState } from 'react';
import {
  Compass,
  MapPin,
  Navigation,
  Radio,
  Zap,
  Droplets,
  Shield,
  AlertTriangle,
  Layers,
  Crosshair,
} from 'lucide-react';
import { MeshNode } from '../types/mesh';
import { meshRouter } from '../services/meshRouter';

interface FieldGridProps {
  nodes: MeshNode[];
  localNode: MeshNode | null;
}

interface TacticalPOI {
  id: string;
  name: string;
  type: 'water' | 'medical' | 'power' | 'hazard' | 'evac';
  x: number; // 0..100
  y: number; // 0..100
  notes: string;
  capacity?: string;
}

export const FieldGrid: React.FC<FieldGridProps> = ({ nodes, localNode }) => {
  const [selectedTarget, setSelectedTarget] = useState<{
    id: string;
    name: string;
    x: number;
    y: number;
    type: string;
  } | null>(null);

  const [pois, setPois] = useState<TacticalPOI[]>([
    {
      id: 'poi-1',
      name: 'Central Water Depot',
      type: 'water',
      x: 35,
      y: 40,
      notes: 'Gravity-fed potable storage tank, 8,000L remaining.',
      capacity: '8000L',
    },
    {
      id: 'poi-2',
      name: 'Civic Center Solar Array',
      type: 'power',
      x: 68,
      y: 30,
      notes: 'Active 24kW solar microgrid with 120V charging banks.',
      capacity: '24kW',
    },
    {
      id: 'poi-3',
      name: 'Pier 14 Evac Zone',
      type: 'evac',
      x: 85,
      y: 65,
      notes: 'Designated maritime emergency evacuation point.',
    },
    {
      id: 'poi-4',
      name: 'Bridge Collapse Debris',
      type: 'hazard',
      x: 52,
      y: 58,
      notes: 'Structural failure on overpass. Zero vehicular transit.',
    },
  ]);

  const [newPoiName, setNewPoiName] = useState('');
  const [newPoiType, setNewPoiType] = useState<TacticalPOI['type']>('water');
  const [isAddingPoi, setIsAddingPoi] = useState(false);

  // Calculate compass azimuth & distance from local node to selected target
  const getTacticalMetrics = () => {
    if (!localNode || !selectedTarget) return null;

    const dx = selectedTarget.x - localNode.coordinates.x;
    const dy = -(selectedTarget.y - localNode.coordinates.y); // Invert Y for Cartesian

    let angleDeg = Math.atan2(dx, dy) * (180 / Math.PI);
    if (angleDeg < 0) angleDeg += 360;

    // Estimate range in meters (1% roughly 50m in field scale)
    const distMeters = Math.round(Math.hypot(dx, dy) * 45);

    return {
      azimuthDeg: Math.round(angleDeg),
      distMeters,
      distKm: (distMeters / 1000).toFixed(2),
    };
  };

  const metrics = getTacticalMetrics();

  // Handle clicking on map to add waypoint
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingPoi) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));

    if (newPoiName.trim()) {
      const newPoint: TacticalPOI = {
        id: `poi-${Date.now()}`,
        name: newPoiName.trim(),
        type: newPoiType,
        x,
        y,
        notes: 'Field waypoint added by scout.',
      };
      setPois((prev) => [...prev, newPoint]);
      setNewPoiName('');
      setIsAddingPoi(false);
      setSelectedTarget(newPoint);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-57px)] overflow-hidden bg-[#06080d]">
      {/* Tactical Vector Grid Canvas */}
      <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 relative select-none">
        {/* Header HUD */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-[#080c14] border-b border-slate-800 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-cyan-400 font-semibold uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5" />
              Offline Tactical Field Grid
            </span>
            <span className="text-slate-600">·</span>
            <span>MGRS / Dead Reckoning</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddingPoi(!isAddingPoi)}
              className={`px-2.5 py-1 rounded text-xs transition-colors border ${
                isAddingPoi
                  ? 'bg-amber-950 text-amber-300 border-amber-700'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
              }`}
            >
              {isAddingPoi ? 'Click Grid to Place...' : '+ Mark Waypoint'}
            </button>
          </div>
        </div>

        {/* Tactical Grid Map Stage */}
        <div
          onClick={handleMapClick}
          className="flex-1 relative tactical-radar-grid overflow-hidden cursor-crosshair"
          style={{ minHeight: '400px' }}
        >
          {/* Compass Rings & Reticle */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
            <circle cx="50%" cy="50%" r="20%" fill="none" stroke="#0ea5e9" strokeWidth="0.8" />
            <circle cx="50%" cy="50%" r="40%" fill="none" stroke="#0ea5e9" strokeWidth="0.8" />
            <circle cx="50%" cy="50%" r="60%" fill="none" stroke="#0ea5e9" strokeWidth="0.8" />
            <line x1="50%" y1="0%" x2="50%" y2="100%" stroke="#0ea5e9" strokeWidth="0.5" strokeDasharray="4 4" />
            <line x1="0%" y1="50%" x2="100%" y2="50%" stroke="#0ea5e9" strokeWidth="0.5" strokeDasharray="4 4" />
          </svg>

          {/* Selected Bearing Line */}
          {localNode && selectedTarget && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <line
                x1={`${localNode.coordinates.x}%`}
                y1={`${localNode.coordinates.y}%`}
                x2={`${selectedTarget.x}%`}
                y2={`${selectedTarget.y}%`}
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="5 3"
              />
            </svg>
          )}

          {/* Render Mesh Nodes on Grid */}
          {nodes.map((node) => {
            const isLocal = node.id === localNode?.id;
            return (
              <div
                key={node.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTarget({
                    id: node.id,
                    name: node.callsign,
                    x: node.coordinates.x,
                    y: node.coordinates.y,
                    type: node.role,
                  });
                }}
                style={{
                  left: `${node.coordinates.x}%`,
                  top: `${node.coordinates.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute cursor-pointer flex flex-col items-center group z-10"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center border shadow-md ${
                    isLocal
                      ? 'bg-cyan-500 text-slate-950 border-white ring-4 ring-cyan-500/30'
                      : 'bg-slate-900 text-cyan-300 border-cyan-500/60'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-mono mt-1 px-1 rounded bg-black/80 text-slate-300 whitespace-nowrap">
                  {node.callsign}
                </span>
              </div>
            );
          })}

          {/* Render Tactical POIs */}
          {pois.map((poi) => (
            <div
              key={poi.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTarget({
                  id: poi.id,
                  name: poi.name,
                  x: poi.x,
                  y: poi.y,
                  type: poi.type,
                });
              }}
              style={{
                left: `${poi.x}%`,
                top: `${poi.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute cursor-pointer flex flex-col items-center group z-10"
            >
              <div
                className={`w-7 h-7 rounded-md flex items-center justify-center border shadow-md ${
                  poi.type === 'water'
                    ? 'bg-blue-950 border-blue-500 text-blue-300'
                    : poi.type === 'power'
                    ? 'bg-amber-950 border-amber-500 text-amber-300'
                    : poi.type === 'hazard'
                    ? 'bg-rose-950 border-rose-500 text-rose-300'
                    : 'bg-emerald-950 border-emerald-500 text-emerald-300'
                }`}
              >
                {poi.type === 'water' ? (
                  <Droplets className="w-3.5 h-3.5" />
                ) : poi.type === 'power' ? (
                  <Zap className="w-3.5 h-3.5" />
                ) : poi.type === 'hazard' ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <MapPin className="w-3.5 h-3.5" />
                )}
              </div>
              <span className="text-[10px] font-mono mt-1 px-1 rounded bg-black/80 text-slate-300 whitespace-nowrap">
                {poi.name}
              </span>
            </div>
          ))}
        </div>

        {/* Grid Coordinates Footer Ribbon */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-[#080c14] border-t border-slate-800 text-xs font-mono text-slate-400">
          <span>Grid Ref: 10S-UF-482-911</span>
          <span>Tactical Scale: 1 unit ≈ 45m</span>
          <span>True North: 000°</span>
        </div>
      </div>

      {/* Right Column: Azimuth Navigation Computer */}
      <div className="w-full lg:w-80 xl:w-96 flex flex-col bg-[#090d16] border-t lg:border-t-0 border-slate-800 p-5 overflow-y-auto">
        <div className="pb-3 border-b border-slate-800">
          <h2 className="text-sm font-semibold tracking-wider uppercase font-['Chakra_Petch'] text-slate-200">
            Dead-Reckoning Azimuth
          </h2>
          <div className="text-xs font-mono text-slate-500 mt-0.5">
            Compass Bearing & Field Range
          </div>
        </div>

        {/* Selected Target HUD */}
        {selectedTarget && metrics ? (
          <div className="mt-4 space-y-4">
            <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-lg">
              <div className="text-[10px] uppercase font-mono text-slate-500">Target Selected</div>
              <h3 className="text-base font-bold text-slate-100 font-['Chakra_Petch'] mt-0.5">
                {selectedTarget.name}
              </h3>
              <div className="text-xs font-mono text-cyan-400 mt-0.5">
                GRID [{selectedTarget.x.toFixed(1)}, {selectedTarget.y.toFixed(1)}]
              </div>
            </div>

            {/* Large Bearing Indicator */}
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg text-center">
              <div className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">
                Magnetic Compass Heading
              </div>
              <div className="text-3xl font-mono font-bold text-amber-400 mt-1 tabular-nums">
                {metrics.azimuthDeg.toString().padStart(3, '0')}°
              </div>
              <div className="text-xs font-mono text-slate-400 mt-1">
                Estimated Range: <span className="text-slate-200 font-bold">{metrics.distKm} km</span> ({metrics.distMeters} m)
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <button
                onClick={() => {
                  meshRouter.sendPacket({
                    type: 'chat',
                    channel: '#infrastructure',
                    priority: 'ROUTINE',
                    payload: `[WAYPOINT BROADCAST] Heading to ${selectedTarget.name} (Azimuth: ${metrics.azimuthDeg}°, Distance: ${metrics.distKm}km).`,
                  });
                }}
                className="w-full py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-slate-900 bg-amber-400 hover:bg-amber-300 rounded transition-colors flex items-center justify-center gap-1.5"
              >
                <Navigation className="w-3.5 h-3.5" />
                Broadcast Route Intent
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs font-mono text-slate-500 mt-4">
            Click any mesh peer or tactical resource on the grid to calculate compass bearing and distance.
          </div>
        )}

        {/* Waypoint Creator Box */}
        {isAddingPoi && (
          <div className="mt-5 p-3.5 bg-slate-900/90 border border-amber-800/80 rounded-lg text-xs font-mono space-y-2.5">
            <div className="text-amber-400 font-bold">New Waypoint Marker</div>
            <input
              type="text"
              value={newPoiName}
              onChange={(e) => setNewPoiName(e.target.value)}
              placeholder="e.g. Clean Spring, Generator 3"
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none focus:border-amber-500"
            />
            <div className="flex gap-2">
              <select
                value={newPoiType}
                onChange={(e) => setNewPoiType(e.target.value as any)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-300"
              >
                <option value="water">Potable Water</option>
                <option value="power">Power Station</option>
                <option value="medical">Medical Triage</option>
                <option value="hazard">Hazard / Blockade</option>
                <option value="evac">Evacuation Point</option>
              </select>
            </div>
            <div className="text-[10px] text-slate-400">
              Then click on the grid map to anchor the coordinates.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
