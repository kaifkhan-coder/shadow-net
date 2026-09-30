import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Lock,
  Unlock,
  ShieldCheck,
  AlertTriangle,
  Radio,
  Share2,
  CheckCheck,
  Compass,
  Key,
  Flame,
  Droplets,
  CheckCircle2,
} from 'lucide-react';
import { MeshPacket, MeshNode, MeshPacketPriority } from '../types/mesh';
import { meshRouter } from '../services/meshRouter';
import { encryptTacticalPayload, decryptTacticalPayload } from '../services/crypto';

interface EmergencyCommsProps {
  localNode: MeshNode | null;
  nodes: MeshNode[];
  whisperTargetNodeId: string | null;
  onClearWhisperTarget: () => void;
}

const CHANNELS = [
  { id: '#emergency-sos', label: 'Emergency SOS', icon: '🚨' },
  { id: '#medical-triage', label: 'Medical Triage', icon: '🩺' },
  { id: '#infrastructure', label: 'Infrastructure & Shelter', icon: '⚡' },
];

export const EmergencyComms: React.FC<EmergencyCommsProps> = ({
  localNode,
  nodes,
  whisperTargetNodeId,
  onClearWhisperTarget,
}) => {
  const [activeChannel, setActiveChannel] = useState<string>('#emergency-sos');
  const [messages, setMessages] = useState<MeshPacket[]>(meshRouter.getHistory());
  const [inputText, setInputText] = useState('');
  const [priority, setPriority] = useState<MeshPacketPriority>('ROUTINE');
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [tacticalPassphrase, setTacticalPassphrase] = useState('SHADOW-MESH-SECURE');
  const [decryptedCache, setDecryptedCache] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Synchronize incoming packets
  useEffect(() => {
    setMessages(meshRouter.getHistory());
    const unsub = meshRouter.onPacket((pkt) => {
      setMessages(meshRouter.getHistory());
    });
    return unsub;
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChannel, whisperTargetNodeId]);

  // Determine current active filter
  const isDirectWhisper = Boolean(whisperTargetNodeId);
  const whisperTargetNode = nodes.find((n) => n.id === whisperTargetNodeId);

  const filteredMessages = messages.filter((m) => {
    if (isDirectWhisper) {
      return (
        (m.originNodeId === localNode?.id && m.targetNodeId === whisperTargetNodeId) ||
        (m.originNodeId === whisperTargetNodeId && (m.targetNodeId === localNode?.id || m.targetNodeId === 'BROADCAST'))
      );
    }
    return m.channel === activeChannel && m.targetNodeId === 'BROADCAST';
  });

  // Handle sending a message
  const handleSendMessage = async (customPayload?: string, customPriority?: MeshPacketPriority) => {
    const textToSend = (customPayload || inputText).trim();
    if (!textToSend || !localNode) return;

    let finalPayload = textToSend;
    let encryptedFlag = false;

    if (isEncrypted) {
      finalPayload = await encryptTacticalPayload(textToSend, tacticalPassphrase);
      encryptedFlag = true;
    }

    const pktPriority = customPriority || priority;
    const targetId = isDirectWhisper && whisperTargetNodeId ? whisperTargetNodeId : 'BROADCAST';

    await meshRouter.sendPacket({
      type: pktPriority === 'SOS' ? 'sos' : 'chat',
      targetNodeId: targetId,
      channel: isDirectWhisper ? 'DIRECT' : activeChannel,
      priority: pktPriority,
      payload: finalPayload,
      encrypted: encryptedFlag,
    });

    if (!customPayload) {
      setInputText('');
    }
    setMessages(meshRouter.getHistory());
  };

  // Attempt decryption of encrypted packet
  const handleDecryptMessage = async (packetId: string, ciphertext: string) => {
    const decrypted = await decryptTacticalPayload(ciphertext, tacticalPassphrase);
    setDecryptedCache((prev) => ({ ...prev, [packetId]: decrypted }));
  };

  // Quick emergency presets
  const presets = [
    {
      title: 'Water & Power Station',
      text: '[LOGISTICS] Potable drinking water and solar charging station available here. All safe.',
      priority: 'ROUTINE' as MeshPacketPriority,
    },
    {
      title: 'Road Blockage / Hazard',
      text: '[HAZARD REPORT] Main route collapsed/blocked. Impassable for emergency vehicles. Divert east.',
      priority: 'HIGH' as MeshPacketPriority,
    },
    {
      title: 'Triage Assistance Request',
      text: '[TRIAGE DISPATCH] Medical personnel requested. Two non-ambulatory injuries, first aid applied.',
      priority: 'HIGH' as MeshPacketPriority,
    },
  ];

  return (
    <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-57px)] overflow-hidden bg-[#06080d]">
      {/* Channels Sidebar */}
      <div className="w-full md:w-64 lg:w-72 bg-[#090d16] border-r border-slate-800 flex flex-col p-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <span className="text-xs font-semibold uppercase tracking-wider font-['Chakra_Petch'] text-slate-300">
            Micro-Routing Channels
          </span>
          <span className="text-[10px] font-mono text-cyan-400">P2P GOSSIP</span>
        </div>

        {/* Channel List */}
        <div className="mt-3 space-y-1">
          {CHANNELS.map((ch) => {
            const isActive = !isDirectWhisper && activeChannel === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => {
                  if (isDirectWhisper) onClearWhisperTarget();
                  setActiveChannel(ch.id);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition-colors ${
                  isActive
                    ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/60 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span>{ch.icon}</span>
                  <span className="truncate">{ch.label}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  {messages.filter((m) => m.channel === ch.id).length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Direct Whispers Section */}
        <div className="mt-5 pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider font-['Chakra_Petch'] text-slate-400 mb-2">
            <span>Direct Whispers</span>
            <Lock className="w-3 h-3 text-cyan-400" />
          </div>

          {isDirectWhisper && whisperTargetNode && (
            <div className="mb-2 p-2 rounded bg-cyan-950/50 border border-cyan-800/70 text-xs">
              <div className="flex items-center justify-between text-cyan-300">
                <span className="font-bold truncate">{whisperTargetNode.callsign}</span>
                <button
                  onClick={onClearWhisperTarget}
                  className="text-[10px] text-slate-400 hover:text-white"
                >
                  Exit
                </button>
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-0.5">{whisperTargetNode.id}</div>
            </div>
          )}

          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {nodes
              .filter((n) => n.id !== localNode?.id)
              .map((peer) => {
                const isSelected = isDirectWhisper && whisperTargetNodeId === peer.id;
                return (
                  <button
                    key={peer.id}
                    onClick={() => {
                      // Switch to direct whisper
                      if (whisperTargetNodeId === peer.id) {
                        onClearWhisperTarget();
                      } else {
                        onClearWhisperTarget();
                        setTimeout(() => onClearWhisperTarget(), 0);
                        // Handled by parent or set directly
                      }
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                      isSelected
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <span className="truncate">{peer.callsign}</span>
                    <span className="text-[10px] font-mono text-slate-500">{peer.batteryLevel}%</span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Security & Tactical Passphrase Box */}
        <div className="mt-auto pt-4 border-t border-slate-800 text-xs font-mono">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              AES Key
            </span>
            <button
              onClick={() => setIsEncrypted(!isEncrypted)}
              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                isEncrypted
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  : 'bg-slate-900 text-slate-400 border-slate-700'
              }`}
            >
              {isEncrypted ? 'ENCRYPTION ON' : 'PLAIN ENVELOPE'}
            </button>
          </div>
          <input
            type="password"
            value={tacticalPassphrase}
            onChange={(e) => setTacticalPassphrase(e.target.value)}
            placeholder="Tactical Mesh Passphrase"
            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-[11px] text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Main Message Stream */}
      <div className="flex-1 flex flex-col bg-[#06080d] overflow-hidden">
        {/* Stream Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#080c14] border-b border-slate-800 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-semibold uppercase tracking-wider font-['Chakra_Petch']">
              {isDirectWhisper
                ? `Direct Encrypted Link: ${whisperTargetNode?.callsign || 'Target'}`
                : activeChannel}
            </span>
            <span className="text-slate-600">·</span>
            <span>Zero-Internet Micro-Routing</span>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              ECDSA-Signed
            </span>
            <span className="text-slate-600">·</span>
            <span>Delay-Tolerant</span>
          </div>
        </div>

        {/* Quick Presets Strip */}
        <div className="flex items-center gap-2 px-5 py-2 bg-slate-900/40 border-b border-slate-800/80 overflow-x-auto">
          <span className="text-[10px] uppercase font-mono text-slate-500 whitespace-nowrap">
            Tactical Presets:
          </span>
          {presets.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(preset.text, preset.priority)}
              className="px-2.5 py-1 text-[11px] font-mono rounded bg-slate-900 hover:bg-cyan-950/40 border border-slate-700/80 hover:border-cyan-700 text-slate-300 whitespace-nowrap transition-colors"
            >
              {preset.title}
            </button>
          ))}
        </div>

        {/* Message Feed Area */}
        <div className="flex-1 p-5 overflow-y-auto space-y-3.5">
          {filteredMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 font-mono text-xs">
              <Radio className="w-8 h-8 text-slate-600 mb-2" />
              <span>No packets received on this channel yet.</span>
              <span className="text-[11px] text-slate-600 mt-1">
                Broadcast a situation report or test message to route across neighboring nodes.
              </span>
            </div>
          ) : (
            filteredMessages.map((pkt) => {
              const isFromMe = pkt.originNodeId === localNode?.id;
              const isSos = pkt.priority === 'SOS';
              const isHigh = pkt.priority === 'HIGH';
              const isCipher = pkt.encrypted;
              const decryptedText = decryptedCache[pkt.id];
              const displayPayload = decryptedText || pkt.payload;

              return (
                <div
                  key={pkt.id}
                  className={`flex flex-col p-3.5 rounded-lg border transition-all ${
                    isSos
                      ? 'bg-rose-950/30 border-rose-800/80 shadow-[0_0_12px_rgba(225,29,72,0.2)]'
                      : isHigh
                      ? 'bg-amber-950/20 border-amber-800/60'
                      : isFromMe
                      ? 'bg-cyan-950/30 border-cyan-800/50'
                      : 'bg-slate-900/50 border-slate-800'
                  }`}
                >
                  {/* Packet Header Metadata */}
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-semibold ${
                          isFromMe ? 'text-cyan-300' : isSos ? 'text-rose-400' : 'text-slate-200'
                        }`}
                      >
                        {pkt.originCallsign}
                      </span>
                      <span className="text-[10px] text-slate-500">[{pkt.originNodeId}]</span>

                      {isSos && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-900 text-rose-200 border border-rose-700 font-bold uppercase">
                          SOS BEACON
                        </span>
                      )}

                      {pkt.encrypted && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          AES-GCM
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{new Date(pkt.timestamp).toLocaleTimeString()}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400">
                        {pkt.hopCount === 0 ? 'Direct link' : `${pkt.hopCount} hop${pkt.hopCount > 1 ? 's' : ''}`}
                      </span>
                    </div>
                  </div>

                  {/* Packet Payload Content */}
                  <div className="mt-2 text-sm text-slate-200 leading-relaxed font-sans">
                    {isCipher && !decryptedText ? (
                      <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-slate-800 font-mono text-xs">
                        <span className="text-slate-400 truncate max-w-md">
                          🔒 Ciphertext: {pkt.payload.slice(0, 32)}...
                        </span>
                        <button
                          onClick={() => handleDecryptMessage(pkt.id, pkt.payload)}
                          className="px-2 py-1 text-[10px] rounded bg-cyan-900 text-cyan-200 hover:bg-cyan-800 transition-colors whitespace-nowrap"
                        >
                          Decrypt
                        </button>
                      </div>
                    ) : (
                      <p>{displayPayload}</p>
                    )}
                  </div>

                  {/* Packet Footer: Route History & Crypto Verification */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <div className="flex items-center gap-1 truncate">
                      <Share2 className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">
                        Route: {pkt.routeHistory.join(' → ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {pkt.tamperVerified ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          Verified
                        </span>
                      ) : (
                        <span className="text-amber-400">Unverified Sig</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Box */}
        <div className="p-4 bg-[#080c14] border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex flex-col gap-2.5"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isDirectWhisper
                    ? `Encrypted whisper to ${whisperTargetNode?.callsign || 'node'}...`
                    : `Broadcast packet to ${activeChannel}...`
                }
                className="flex-1 bg-slate-900 border border-slate-800 rounded px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:hover:bg-cyan-400 rounded transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Transmit
              </button>
            </div>

            {/* Input Controls Bar */}
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEncrypted}
                    onChange={(e) => setIsEncrypted(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>AES-GCM Encryption</span>
                </label>

                <div className="flex items-center gap-1 text-[11px]">
                  <span>Priority:</span>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as MeshPacketPriority)}
                    className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-slate-300 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="ROUTINE">Routine</option>
                    <option value="HIGH">High Priority</option>
                    <option value="SOS">Emergency SOS</option>
                  </select>
                </div>
              </div>

              <div className="text-[10px] text-slate-500">
                Epidemic Store-and-Forward Routing Active
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
