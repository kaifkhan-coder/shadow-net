import React, { useState } from 'react';
import {
  AlertTriangle,
  X,
  Radio,
  Flame,
  Droplets,
  Heart,
  Users,
  Compass,
  Zap,
} from 'lucide-react';
import { MeshNode, MeshPacket } from '../types/mesh';
import { meshRouter } from '../services/meshRouter';

interface EmergencySosModalProps {
  isOpen: boolean;
  onClose: () => void;
  localNode: MeshNode | null;
}

export const EmergencySosModal: React.FC<EmergencySosModalProps> = ({
  isOpen,
  onClose,
  localNode,
}) => {
  const [urgency, setUrgency] = useState<'critical' | 'severe' | 'moderate'>('critical');
  const [headcount, setHeadcount] = useState(2);
  const [medicalAttention, setMedicalAttention] = useState(true);
  const [notes, setNotes] = useState('Immediate casualty extraction required. First aid applied.');
  const [needs, setNeeds] = useState<string[]>([
    'Medical Supplies',
    'Potable Water',
  ]);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  if (!isOpen) return null;

  const toggleNeed = (need: string) => {
    setNeeds((prev) =>
      prev.includes(need) ? prev.filter((n) => n !== need) : [...prev, need]
    );
  };

  const handleBroadcastSos = async () => {
    if (!localNode) return;
    setIsBroadcasting(true);

    try {
      const payloadText = `[EMERGENCY SOS DISTRESS] Level: ${urgency.toUpperCase()} | Headcount: ${headcount} | Needs: ${needs.join(
        ', '
      )} | Location: ${localNode.coordinates.gridRef || 'GR-4829'} (${localNode.coordinates.lat?.toFixed(
        4
      )}, ${localNode.coordinates.lon?.toFixed(4)}) | Notes: ${notes}`;

      const sosPacket = await meshRouter.sendPacket({
        type: 'sos',
        channel: '#emergency-sos',
        priority: 'SOS',
        payload: payloadText,
        sosDetails: {
          urgency,
          headcount,
          needs,
          medicalAttention,
          suppliesNeeded: needs.join(', '),
        },
      });

      // Trigger automatic simulated emergency response
      meshRouter.simulateRelayResponse(sosPacket);

      setTimeout(() => {
        setIsBroadcasting(false);
        onClose();
      }, 700);
    } catch (e) {
      console.error(e);
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full max-w-lg bg-[#0c090d] border border-rose-900/80 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(225,29,72,0.3)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-rose-900/60 bg-rose-950/40">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
            <h3 className="text-base font-bold tracking-wider uppercase font-['Chakra_Petch'] text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Emergency SOS Mesh Flood
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-rose-400 hover:text-white hover:bg-rose-900/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto font-sans">
          {/* Urgency Severity */}
          <div>
            <label className="text-[10px] uppercase font-mono text-rose-400 tracking-wider">
              Triage Urgency Level
            </label>
            <div className="grid grid-cols-3 gap-2 mt-1.5 font-mono text-xs">
              <button
                type="button"
                onClick={() => setUrgency('critical')}
                className={`py-2 px-3 rounded border text-center font-bold transition-colors ${
                  urgency === 'critical'
                    ? 'bg-rose-900/90 text-white border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                CRITICAL
              </button>
              <button
                type="button"
                onClick={() => setUrgency('severe')}
                className={`py-2 px-3 rounded border text-center font-bold transition-colors ${
                  urgency === 'severe'
                    ? 'bg-amber-900/90 text-amber-200 border-amber-500'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                SEVERE
              </button>
              <button
                type="button"
                onClick={() => setUrgency('moderate')}
                className={`py-2 px-3 rounded border text-center font-bold transition-colors ${
                  urgency === 'moderate'
                    ? 'bg-blue-900/90 text-blue-200 border-blue-500'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                MODERATE
              </button>
            </div>
          </div>

          {/* Headcount */}
          <div className="flex items-center justify-between p-3 bg-slate-900/70 border border-slate-800 rounded-lg">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Persons Requiring Aid:</span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <button
                type="button"
                onClick={() => setHeadcount((c) => Math.max(1, c - 1))}
                className="w-7 h-7 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center justify-center font-bold"
              >
                -
              </button>
              <span className="text-base font-bold text-slate-100 w-6 text-center tabular-nums">
                {headcount}
              </span>
              <button
                type="button"
                onClick={() => setHeadcount((c) => c + 1)}
                className="w-7 h-7 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center justify-center font-bold"
              >
                +
              </button>
            </div>
          </div>

          {/* Primary Needs Checkboxes */}
          <div>
            <label className="text-[10px] uppercase font-mono text-rose-400 tracking-wider">
              Immediate Requirements
            </label>
            <div className="grid grid-cols-2 gap-2 mt-1.5 text-xs font-mono">
              {[
                'Medical Supplies',
                'Potable Water',
                'Hypothermia Warmth',
                'Structural Extraction',
                'Insulin / Rx',
                'Emergency Power',
              ].map((need) => {
                const checked = needs.includes(need);
                return (
                  <button
                    key={need}
                    type="button"
                    onClick={() => toggleNeed(need)}
                    className={`p-2 rounded border text-left transition-colors flex items-center justify-between ${
                      checked
                        ? 'bg-rose-950/60 text-rose-200 border-rose-700'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    <span>{need}</span>
                    <span className="text-xs">{checked ? '✓' : '+'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location & Tactical Coordinates */}
          <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs font-mono">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1 text-cyan-400">
                <Compass className="w-3.5 h-3.5" />
                Auto-Tagged Grid Anchor
              </span>
              <span className="text-slate-200 font-bold">
                {localNode?.coordinates.gridRef || 'GR-4829'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              LAT: {localNode?.coordinates.lat?.toFixed(4) || '37.7749'}° N · LON:{' '}
              {localNode?.coordinates.lon?.toFixed(4) || '-122.4194'}° W
            </div>
          </div>

          {/* Situation Notes */}
          <div>
            <label className="text-[10px] uppercase font-mono text-rose-400 tracking-wider">
              Field Situation Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full mt-1 bg-slate-950 border border-slate-800 rounded p-2 text-xs font-sans text-slate-200 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Submit Flood Button */}
          <button
            onClick={handleBroadcastSos}
            disabled={isBroadcasting}
            className="w-full py-3 px-4 text-xs font-bold uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-500 rounded transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(225,29,72,0.6)]"
          >
            <AlertTriangle className="w-4 h-4 animate-bounce" />
            {isBroadcasting
              ? 'Broadcasting High-Priority Flood...'
              : 'Flood SOS Beacon Across Entire Mesh (Max 7 Hops)'}
          </button>
        </div>
      </div>
    </div>
  );
};
