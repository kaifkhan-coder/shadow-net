import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  UserPen,
  Smartphone,
  Edit3,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  X,
  Check,
  Radio,
  Sparkles,
  Sliders,
  Shield,
  Search,
  Battery,
  Wifi,
  Tag,
} from 'lucide-react';
import { SimNode } from '../types/simulator';

interface EditUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: SimNode[];
  onUpdateNode: (nodeId: string, updates: Partial<SimNode>) => void;
  onUpdateAllNodes: (nodes: SimNode[]) => void;
  onResetToDefaults: () => void;
  onAddNewNode: (newNode: SimNode) => void;
  onDeleteNode: (nodeId: string) => void;
  activeUserId: string;
  onSelectActiveUser: (userId: string) => void;
  destUserId: string;
  onSelectDestUser: (userId: string) => void;
  targetEditNodeId?: string | null;
}

const PRESET_ROLES: SimNode['role'][] = [
  'Student',
  'Triage Medic',
  'Campus Security',
  'Relay Rover',
  'Lab Coordinator',
  'Staff Lead',
];

const PRESET_TEAM_PACKS = [
  {
    name: 'Campus Students (Default)',
    description: 'Shruti, Vinal, Swarali, Gauri, Kaif, Rohan, Aarav, Ananya',
    users: [
      { name: 'Kaif', label: 'Kaif_Phone', role: 'Student' as const },
      { name: 'Shruti', label: 'Shruti_Phone', role: 'Triage Medic' as const },
      { name: 'Swarali', label: 'Swarali_Phone', role: 'Relay Rover' as const },
      { name: 'Gauri', label: 'Gauri_Phone', role: 'Campus Security' as const },
      { name: 'Vinal', label: 'Vinal_Phone', role: 'Staff Lead' as const },
      { name: 'Rohan', label: 'Rohan_Phone', role: 'Student' as const },
      { name: 'Aarav', label: 'Aarav_Phone', role: 'Lab Coordinator' as const },
      { name: 'Ananya', label: 'Ananya_Phone', role: 'Relay Rover' as const },
    ],
  },
  {
    name: 'Search & Rescue Triage (SAR)',
    description: 'Tactical field callsigns: Apex-Lead, Raven-Medic, Echo-Rover, Sentinel-Watch, Base-HQ',
    users: [
      { name: 'Apex-Lead', label: 'Apex_Radio', role: 'Campus Security' as const },
      { name: 'Raven-Medic', label: 'Raven_Triage', role: 'Triage Medic' as const },
      { name: 'Echo-Rover', label: 'Echo_Mesh', role: 'Relay Rover' as const },
      { name: 'Sentinel', label: 'Sentinel_Gate', role: 'Campus Security' as const },
      { name: 'Base-HQ', label: 'Base_Command', role: 'Staff Lead' as const },
      { name: 'Bravo-Scout', label: 'Bravo_Node', role: 'Student' as const },
      { name: 'Omega-Relay', label: 'Omega_Bridge', role: 'Lab Coordinator' as const },
      { name: 'Delta-Unit', label: 'Delta_Mobile', role: 'Relay Rover' as const },
    ],
  },
  {
    name: 'Disaster Hospital Wing (ER)',
    description: 'ER-Doctor, Triage-Nurse, Trauma-Unit, Pharmacy-Lead, Ambulance-Relay',
    users: [
      { name: 'Dr. Evelyn', label: 'Evelyn_Tablet', role: 'Staff Lead' as const },
      { name: 'Nurse Clara', label: 'Clara_Handset', role: 'Triage Medic' as const },
      { name: 'Trauma Bay 1', label: 'Trauma_Unit1', role: 'Lab Coordinator' as const },
      { name: 'Runner Mark', label: 'Mark_Rover', role: 'Relay Rover' as const },
      { name: 'ER Dispatch', label: 'ER_Dispatch', role: 'Campus Security' as const },
      { name: 'Supply Tech', label: 'Supply_Node', role: 'Student' as const },
      { name: 'ICU Coord', label: 'ICU_Lead', role: 'Staff Lead' as const },
      { name: 'Staging Rover', label: 'Rover_Staging', role: 'Relay Rover' as const },
    ],
  },
];

export const EditUsersModal: React.FC<EditUsersModalProps> = ({
  isOpen,
  onClose,
  nodes,
  onUpdateNode,
  onUpdateAllNodes,
  onResetToDefaults,
  onAddNewNode,
  onDeleteNode,
  activeUserId,
  onSelectActiveUser,
  destUserId,
  onSelectDestUser,
  targetEditNodeId,
}) => {
  const [search, setSearch] = useState('');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(targetEditNodeId || null);
  const [editingName, setEditingName] = useState('');
  const [editingLabel, setEditingLabel] = useState('');
  const [editingRole, setEditingRole] = useState<SimNode['role']>('Student');
  const [editingRange, setEditingRange] = useState(50);
  const [autoSyncLabel, setAutoSyncLabel] = useState(true);

  // New Node Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newRole, setNewRole] = useState<SimNode['role']>('Student');

  if (!isOpen) return null;

  const startEditing = (node: SimNode) => {
    setEditingNodeId(node.id);
    setEditingName(node.name);
    setEditingLabel(node.label);
    setEditingRole(node.role);
    setEditingRange(node.rangeMeters);
  };

  const saveEdit = (nodeId: string) => {
    const trimmedName = editingName.trim();
    if (!trimmedName) return;

    let finalLabel = editingLabel.trim();
    if (!finalLabel) {
      finalLabel = `${trimmedName.replace(/\s+/g, '_')}_Phone`;
    }

    onUpdateNode(nodeId, {
      name: trimmedName,
      label: finalLabel,
      role: editingRole,
      rangeMeters: editingRange,
    });
    setEditingNodeId(null);
  };

  const handleApplyPreset = (presetIndex: number) => {
    const preset = PRESET_TEAM_PACKS[presetIndex];
    if (!preset) return;

    const updated = nodes.map((node, idx) => {
      if (idx < preset.users.length) {
        const pUser = preset.users[idx];
        return {
          ...node,
          name: pUser.name,
          label: pUser.label,
          role: pUser.role,
        };
      }
      return node;
    });

    onUpdateAllNodes(updated);
  };

  const handleCreateNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newName.trim();
    if (!trimmedName) return;

    const label = newLabel.trim() || `${trimmedName.replace(/\s+/g, '_')}_Phone`;
    const randomX = Math.round(20 + Math.random() * 60);
    const randomY = Math.round(25 + Math.random() * 55);
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const initials = trimmedName.slice(0, 3).toUpperCase();

    const newNode: SimNode = {
      id: `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      name: trimmedName,
      label,
      role: newRole,
      status: 'active',
      battery: 90,
      rangeMeters: 50,
      deviceId: `DEV-${initials}-${randomSuffix}`,
      x: randomX,
      y: randomY,
      macAddress: `02:5A:${Math.floor(Math.random() * 89 + 10)}:${Math.floor(Math.random() * 89 + 10)}:FF:${randomSuffix.toString().slice(0, 2)}`,
      signalStrengthDbm: -55,
      queuedPacketsCount: 0,
    };

    onAddNewNode(newNode);
    setNewName('');
    setNewLabel('');
    setShowAddForm(false);
  };

  const filteredNodes = nodes.filter(
    (n) =>
      n.name.toLowerCase().includes(search.toLowerCase()) ||
      n.label.toLowerCase().includes(search.toLowerCase()) ||
      n.role.toLowerCase().includes(search.toLowerCase()) ||
      n.deviceId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md font-mono select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#070b12] border-2 border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#0a101d] border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <UserPen className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-100 tracking-wide">
                  Mesh User Directory & Identity Manager
                </h2>
                <span className="text-[10px] uppercase font-extrabold bg-cyan-950 text-cyan-300 border border-cyan-700 px-2 py-0.5 rounded-full">
                  {nodes.length} Registered Nodes
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Rename users, change device callsigns, assign emergency roles, or add custom nodes to the P2P mesh.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar: Search + Preset Squads + Add Node */}
        <div className="p-4 bg-[#090e18] border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user by name, callsign, role, or ID..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Add New User</span>
            </button>

            <button
              onClick={onResetToDefaults}
              className="px-3 py-2 rounded-xl text-xs font-semibold border bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700 flex items-center gap-1.5 transition-colors"
              title="Reset all names back to Kaif, Shruti, Swarali, Gauri, Vinal, Rohan, Aarav, Ananya"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>

        {/* Quick Preset Squad Packs */}
        <div className="px-4 py-2.5 bg-[#060a12] border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-thin text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Quick Themes:
          </span>
          {PRESET_TEAM_PACKS.map((pack, idx) => (
            <button
              key={pack.name}
              onClick={() => handleApplyPreset(idx)}
              className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 text-[11px] shrink-0 font-medium transition-colors"
              title={pack.description}
            >
              {pack.name}
            </button>
          ))}
        </div>

        {/* Add User Drawer / Accordion */}
        {showAddForm && (
          <form
            onSubmit={handleCreateNewUser}
            className="p-4 bg-[#0a1220] border-b border-cyan-500/30 flex flex-col sm:flex-row items-end gap-3 text-xs animate-in slide-in-from-top-3 duration-200"
          >
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  User Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (autoSyncLabel) {
                      setNewLabel(`${e.target.value.replace(/\s+/g, '_')}_Phone`);
                    }
                  }}
                  placeholder="e.g. Maya, Liam, Squad-Leader"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Device Callsign / Label
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Maya_Phone"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Emergency Tactical Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as SimNode['role'])}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                >
                  {PRESET_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg flex items-center gap-1.5 shadow"
              >
                <Check className="w-4 h-4" />
                <span>Create User</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 text-slate-400 hover:text-white rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Node Roster Table / List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredNodes.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Users className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p>No user matched "{search}".</p>
            </div>
          ) : (
            filteredNodes.map((node) => {
              const isEditing = editingNodeId === node.id;
              const isCurrentOperator = node.id === activeUserId;
              const isCurrentDest = node.id === destUserId;

              return (
                <div
                  key={node.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isEditing
                      ? 'bg-slate-900/90 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                      : isCurrentOperator
                      ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-500/70'
                      : isCurrentDest
                      ? 'bg-cyan-950/20 border-cyan-500/40 hover:border-cyan-500/70'
                      : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  {isEditing ? (
                    /* Inline Editing Mode */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold text-cyan-300 pb-1.5 border-b border-slate-800">
                        <span className="flex items-center gap-1.5">
                          <Edit3 className="w-3.5 h-3.5" /> Editing User: {node.name}
                        </span>
                        <span className="text-[10px] text-slate-500">ID: {node.id}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        {/* Name Input */}
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                            User / Student Name
                          </label>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditingName(val);
                              if (autoSyncLabel) {
                                setEditingLabel(`${val.replace(/\s+/g, '_')}_Phone`);
                              }
                            }}
                            placeholder="e.g. Shruti"
                            className="w-full bg-slate-950 border border-cyan-500/60 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-cyan-400"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(node.id);
                              if (e.key === 'Escape') setEditingNodeId(null);
                            }}
                          />
                        </div>

                        {/* Device Label / Callsign */}
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 flex items-center justify-between">
                            <span>Device Callsign / Label</span>
                            <button
                              type="button"
                              onClick={() => setAutoSyncLabel(!autoSyncLabel)}
                              className={`text-[9px] ${autoSyncLabel ? 'text-cyan-400' : 'text-slate-600'}`}
                            >
                              {autoSyncLabel ? 'Auto-sync ON' : 'Auto-sync OFF'}
                            </button>
                          </label>
                          <input
                            type="text"
                            value={editingLabel}
                            onChange={(e) => {
                              setEditingLabel(e.target.value);
                              setAutoSyncLabel(false);
                            }}
                            placeholder="e.g. Shruti_Phone"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-400"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(node.id);
                            }}
                          />
                        </div>

                        {/* Role Selector */}
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                            Tactical Role
                          </label>
                          <select
                            value={editingRole}
                            onChange={(e) => setEditingRole(e.target.value as SimNode['role'])}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                          >
                            {PRESET_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Transmission Range Slider */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] uppercase font-bold text-slate-400">
                            Ad-Hoc Range:
                          </label>
                          <input
                            type="range"
                            min="25"
                            max="80"
                            step="5"
                            value={editingRange}
                            onChange={(e) => setEditingRange(Number(e.target.value))}
                            className="accent-cyan-400 w-32"
                          />
                          <span className="text-xs font-bold text-cyan-300">{editingRange} meters</span>
                        </div>

                        {/* Save / Cancel buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveEdit(node.id)}
                            className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-1 shadow"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save Changes</span>
                          </button>
                          <button
                            onClick={() => setEditingNodeId(null)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Display Mode */
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Avatar + Names + Role */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center border font-bold text-sm shrink-0 ${
                            node.status === 'active'
                              ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300'
                              : node.status === 'dead'
                              ? 'bg-rose-950/50 border-rose-500/50 text-rose-300'
                              : 'bg-slate-900 border-slate-700 text-slate-400'
                          }`}
                        >
                          {node.name.slice(0, 2).toUpperCase()}
                        </div>

                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-100">{node.name}</span>
                            <span className="text-xs text-cyan-400 font-mono bg-cyan-950/60 border border-cyan-800/80 px-1.5 py-0.5 rounded">
                              {node.label}
                            </span>
                            {isCurrentOperator && (
                              <span className="text-[9px] uppercase font-extrabold bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded shadow">
                                SENDER (YOU)
                              </span>
                            )}
                            {isCurrentDest && (
                              <span className="text-[9px] uppercase font-extrabold bg-cyan-500 text-slate-950 px-1.5 py-0.5 rounded shadow">
                                TARGET
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 mt-1 text-[11px] text-slate-400 flex-wrap">
                            <span className="text-slate-300 flex items-center gap-1 font-semibold">
                              <Shield className="w-3 h-3 text-cyan-400" />
                              {node.role}
                            </span>
                            <span>•</span>
                            <span className="text-slate-400">{node.deviceId}</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-medium">{node.rangeMeters}m range</span>
                            <span>•</span>
                            <span
                              className={`${
                                node.battery > 50
                                  ? 'text-emerald-400'
                                  : node.battery > 20
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {node.status === 'dead' ? 'Dead (0%)' : `${node.battery}% Bat`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Quick Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => onSelectActiveUser(node.id)}
                          disabled={isCurrentOperator}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-all ${
                            isCurrentOperator
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 cursor-default'
                              : 'bg-slate-900 hover:bg-amber-950/60 text-slate-300 hover:text-amber-200 border-slate-800 hover:border-amber-500/50'
                          }`}
                          title="Switch perspective to operate network as this user"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                          <span>{isCurrentOperator ? 'Sender' : 'Operate'}</span>
                        </button>

                        <button
                          onClick={() => startEditing(node)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500 flex items-center gap-1 transition-colors"
                          title="Change user name, callsign, and role"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Rename</span>
                        </button>

                        {nodes.length > 2 && (
                          <button
                            onClick={() => onDeleteNode(node.id)}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-700 transition-colors"
                            title="Remove user node from mesh"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer Note */}
        <div className="px-5 py-3 bg-[#0a101d] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Changes immediately update ad-hoc routing tables, canvas icons, and terminal telemetry.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
