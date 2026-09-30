import React, { useState, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { MeshTopology } from './components/MeshTopology';
import { EmergencyComms } from './components/EmergencyComms';
import { FieldGrid } from './components/FieldGrid';
import { AcousticModemView } from './components/AcousticModemView';
import { PacketSniffer } from './components/PacketSniffer';
import { RealMobileUsersView } from './components/RealMobileUsersView';
import { P2PMeshSimulatorView } from './components/P2PMeshSimulatorView';
import { EmergencySosModal } from './components/EmergencySosModal';
import { AirGappedHandshakeModal } from './components/AirGappedHandshakeModal';
import { MeshNode, TacticalTheme, ActiveTransmissionPulse } from './types/mesh';
import { meshRouter } from './services/meshRouter';

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'topology' | 'comms' | 'grid' | 'acoustic' | 'sniffer' | 'mobile'>('simulator');
  const [localNode, setLocalNode] = useState<MeshNode | null>(null);
  const [nodes, setNodes] = useState<MeshNode[]>([]);
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);
  const [isHandshakeModalOpen, setIsHandshakeModalOpen] = useState(false);
  const [whisperTargetNodeId, setWhisperTargetNodeId] = useState<string | null>(null);
  const [tacticalTheme, setTacticalTheme] = useState<TacticalTheme>('tactical');
  const [activePulses, setActivePulses] = useState<ActiveTransmissionPulse[]>([]);

  // Initialize router
  useEffect(() => {
    meshRouter.initialize().then((node) => {
      setLocalNode(node);
    });

    const unsubNodes = meshRouter.onNodesUpdated((updated) => {
      setNodes([...updated]);
      if (meshRouter.localNode) {
        setLocalNode({ ...meshRouter.localNode });
      }
    });

    const unsubPulse = meshRouter.onPulse((pulse) => {
      setActivePulses((prev) => [...prev, pulse]);
      // Remove pulse after animation duration
      setTimeout(() => {
        setActivePulses((prev) => prev.filter((p) => p.id !== pulse.id));
      }, 1600);
    });

    return () => {
      unsubNodes();
      unsubPulse();
    };
  }, []);

  // Handle switching to Comms with specific direct peer
  const handleSelectNodeForWhisper = (targetId: string) => {
    setWhisperTargetNodeId(targetId);
    setActiveTab('comms');
  };

  const handleClearWhisperTarget = () => {
    setWhisperTargetNodeId(null);
  };

  return (
    <div
      className={`min-h-screen flex flex-col bg-[#05070b] text-slate-100 ${
        tacticalTheme === 'crimson_night' ? 'hue-rotate-[320deg] saturate-150 contrast-125' : ''
      }`}
    >
      {/* Top Bar Navigation Contract */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        localNode={localNode}
        onOpenSosModal={() => setIsSosModalOpen(true)}
        onOpenHandshakeModal={() => setIsHandshakeModalOpen(true)}
        tacticalTheme={tacticalTheme}
        setTacticalTheme={setTacticalTheme}
        connectedPeersCount={nodes.filter((n) => n.id !== localNode?.id).length}
        realPeersCount={nodes.filter((n) => n.transport !== 'simulated' || n.isLocal).length}
      />

      {/* Main Viewport Stage */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {activeTab === 'simulator' && (
          <P2PMeshSimulatorView />
        )}

        {activeTab === 'topology' && (
          <MeshTopology
            nodes={nodes}
            localNode={localNode}
            onSelectNodeForWhisper={handleSelectNodeForWhisper}
            activePulses={activePulses}
          />
        )}

        {activeTab === 'mobile' && (
          <RealMobileUsersView
            nodes={nodes}
            localNode={localNode}
            onSelectNodeForWhisper={handleSelectNodeForWhisper}
            onOpenHandshakeModal={() => setIsHandshakeModalOpen(true)}
          />
        )}

        {activeTab === 'comms' && (
          <EmergencyComms
            localNode={localNode}
            nodes={nodes}
            whisperTargetNodeId={whisperTargetNodeId}
            onClearWhisperTarget={handleClearWhisperTarget}
          />
        )}

        {activeTab === 'grid' && (
          <FieldGrid
            nodes={nodes}
            localNode={localNode}
          />
        )}

        {activeTab === 'acoustic' && (
          <AcousticModemView
            localNode={localNode}
          />
        )}

        {activeTab === 'sniffer' && (
          <PacketSniffer />
        )}
      </main>

      {/* Emergency SOS Flood Modal */}
      <EmergencySosModal
        isOpen={isSosModalOpen}
        onClose={() => setIsSosModalOpen(false)}
        localNode={localNode}
      />

      {/* Air-Gapped WebRTC QR Pairing Modal */}
      <AirGappedHandshakeModal
        isOpen={isHandshakeModalOpen}
        onClose={() => setIsHandshakeModalOpen(false)}
        localNode={localNode}
      />
    </div>
  );
}
