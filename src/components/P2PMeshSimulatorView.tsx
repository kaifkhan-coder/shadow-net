import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  INITIAL_SIM_NODES,
  computeGraphEdges,
  findShortestPath,
  calculateNetworkDensity,
  calculateAverageHopEfficiency,
  calculateDistanceMeters,
} from '../services/simulatorEngine';
import {
  SimNode,
  SimEdge,
  TransmissionLogEntry,
  TransmissionState,
} from '../types/simulator';
import { simAudio } from '../services/simSoundEffects';
import { SimulatorAnalyticsBar } from './SimulatorAnalyticsBar';
import { ActiveUserSwitcher } from './ActiveUserSwitcher';
import { SimulatorTopologyCanvas } from './SimulatorTopologyCanvas';
import { SimulatorMessageConsole } from './SimulatorMessageConsole';
import { SimulatorTerminalLog } from './SimulatorTerminalLog';
import { EditUsersModal } from './EditUsersModal';

const loadSavedNodes = (): SimNode[] => {
  try {
    const raw = localStorage.getItem('shadow_net_custom_sim_nodes');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load saved nodes from localStorage', e);
  }
  return INITIAL_SIM_NODES;
};

export const P2PMeshSimulatorView: React.FC = () => {
  // Nodes state with localStorage persistence
  const [nodes, setNodes] = useState<SimNode[]>(loadSavedNodes);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // User Directory Edit Modal state
  const [isEditUsersModalOpen, setIsEditUsersModalOpen] = useState<boolean>(false);
  const [targetEditNodeId, setTargetEditNodeId] = useState<string | null>(null);

  // Active Operator (Sender / Origin) & Destination
  const [originNodeId, setOriginNodeId] = useState<string>('node-kaif');
  const [destNodeId, setDestNodeId] = useState<string>('node-vinal');
  const [selectedMessage, setSelectedMessage] = useState<string>('Need Medical Aid at Block-C');
  const [customMessageText, setCustomMessageText] = useState<string>('');

  // Audio & Simulation Speed
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);

  // Terminal Logs state
  const [logs, setLogs] = useState<TransmissionLogEntry[]>([
    {
      id: 'log-init-1',
      timestamp: '00:00:01',
      type: 'ALERT',
      message: 'INFRASTRUCTURE CRASH DETECTED -> Central cellular base stations unreachable.',
    },
    {
      id: 'log-init-2',
      timestamp: '00:00:02',
      type: 'INFO',
      message: 'Shadow-Net P2P Protocol daemon engaged. Scanning local 2.4/5.0GHz ad-hoc radio spectrum.',
    },
    {
      id: 'log-init-3',
      timestamp: '00:00:03',
      type: 'ROUTING',
      message: 'Initial mesh topology discovered: 8 student smartphones registered in ad-hoc cluster.',
    },
  ]);

  // Transmission simulation state
  const [transmission, setTransmission] = useState<TransmissionState>({
    isTransmitting: false,
    isPaused: false,
    originId: 'node-kaif',
    destId: 'node-vinal',
    currentHopIndex: 0,
    plannedPath: [],
    activeEdge: null,
    messageText: 'Need Medical Aid at Block-C',
    status: 'idle',
    phase: 'idle',
    packetProgress: 0,
    totalHops: 0,
    deliveryLatencyMs: 0,
    discoveryWaveRadius: 0,
    lastDeliveredMessage: null,
  });

  // Analytics Metrics
  const [totalTransmissions, setTotalTransmissions] = useState<number>(0);
  const [successfulTransmissions, setSuccessfulTransmissions] = useState<number>(0);
  const [isChaosRunning, setIsChaosRunning] = useState<boolean>(false);

  // Animation & interval refs
  const animFrameRef = useRef<number | null>(null);
  const chaosIntervalRef = useRef<number | null>(null);
  const transmissionStateRef = useRef<TransmissionState>(transmission);
  const nodesRef = useRef<SimNode[]>(nodes);
  const simSpeedRef = useRef<number>(simSpeed);

  // Keep refs up-to-date for async timers
  useEffect(() => {
    transmissionStateRef.current = transmission;
  }, [transmission]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    simSpeedRef.current = simSpeed;
  }, [simSpeed]);

  useEffect(() => {
    simAudio.enabled = soundEnabled;
  }, [soundEnabled]);

  // Persist nodes changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('shadow_net_custom_sim_nodes', JSON.stringify(nodes));
    } catch (e) {
      console.warn('Failed to save nodes to localStorage', e);
    }
  }, [nodes]);

  // User Directory / Edit Name Handlers
  const handleOpenEditUsersModal = (nodeId?: string) => {
    setTargetEditNodeId(nodeId || null);
    setIsEditUsersModalOpen(true);
  };

  const handleUpdateNode = (nodeId: string, updates: Partial<SimNode>) => {
    const existing = nodes.find((n) => n.id === nodeId);
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, ...updates } : n))
    );
    const newName = updates.name || existing?.name || 'Node';
    const newLabel = updates.label || existing?.label || '';
    simAudio.playUserSwitch();
    addLog(
      'INFO',
      `[USER_UPDATED] User record updated: [${existing?.name}] → [${newName}] (${newLabel}, ${updates.role || existing?.role})`
    );
  };

  const handleUpdateNodeName = (nodeId: string, newName: string, newLabel?: string) => {
    handleUpdateNode(nodeId, {
      name: newName,
      label: newLabel || `${newName.replace(/\s+/g, '_')}_Phone`,
    });
  };

  const handleUpdateAllNodes = (updatedNodes: SimNode[]) => {
    setNodes(updatedNodes);
    simAudio.playUserSwitch();
    addLog(
      'ROUTING',
      `[DIRECTORY_UPDATED] Synchronized ${updatedNodes.length} user identities in ad-hoc mesh directory.`
    );
  };

  const handleResetToDefaults = () => {
    try {
      localStorage.removeItem('shadow_net_custom_sim_nodes');
    } catch (e) {
      console.warn(e);
    }
    setNodes(INITIAL_SIM_NODES);
    simAudio.playUserSwitch();
    addLog(
      'INFO',
      `[ROSTER_RESET] Restored default campus user roster: Kaif, Shruti, Swarali, Gauri, Vinal, Rohan, Aarav, Ananya.`
    );
  };

  const handleAddNewNode = (newNode: SimNode) => {
    setNodes((prev) => [...prev, newNode]);
    simAudio.playUserSwitch();
    addLog(
      'ROUTING',
      `[NODE_REGISTERED] New smartphone peer joined ad-hoc mesh: [${newNode.name}] (${newNode.label}, ${newNode.role}) at RF range ${newNode.rangeMeters}m.`
    );
  };

  const handleDeleteNode = (nodeId: string) => {
    const nodeToDelete = nodes.find((n) => n.id === nodeId);
    if (!nodeToDelete) return;
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    if (originNodeId === nodeId) {
      const remaining = nodes.filter((n) => n.id !== nodeId && n.status === 'active');
      if (remaining[0]) setOriginNodeId(remaining[0].id);
    }
    if (destNodeId === nodeId) {
      const remaining = nodes.filter((n) => n.id !== nodeId && n.id !== originNodeId);
      if (remaining[0]) setDestNodeId(remaining[0].id);
    }
    addLog('ALERT', `[NODE_REMOVED] User [${nodeToDelete.name}] (${nodeToDelete.label}) removed from mesh directory.`);
  };

  // Append entry to terminal log
  const addLog = useCallback(
    (type: TransmissionLogEntry['type'], message: string, extra?: Partial<TransmissionLogEntry>) => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: timeStr,
          type,
          message,
          ...extra,
        },
      ]);
    },
    []
  );

  // Real-time Candidate Route calculation between Active Operator and Destination
  const candidateRoute = useMemo(() => {
    return findShortestPath(nodes, originNodeId, destNodeId, true);
  }, [nodes, originNodeId, destNodeId]);

  // Compute edges dynamically based on node positions & statuses
  const edges = computeGraphEdges(nodes);

  // Analytics calculations
  const totalNodesCount = nodes.length;
  const activeNodesCount = nodes.filter((n) => n.status === 'active').length;
  const deadNodesCount = totalNodesCount - activeNodesCount;
  const { index: densityIndex, score: densityScore } = calculateNetworkDensity(nodes);
  const avgHopEfficiency = calculateAverageHopEfficiency(nodes);
  const successRatePercent =
    totalTransmissions > 0
      ? Math.round((successfulTransmissions / totalTransmissions) * 100)
      : 100;

  // Active Operator switching
  const handleSelectActiveUser = (userId: string) => {
    if (transmission.isTransmitting) return;
    setOriginNodeId(userId);
    simAudio.playUserSwitch();

    // If new origin was the destination, pick another node as target
    if (destNodeId === userId) {
      const otherNode = nodes.find((n) => n.id !== userId && n.status === 'active');
      if (otherNode) {
        setDestNodeId(otherNode.id);
      }
    }

    const targetNode = nodes.find((n) => n.id === userId);
    if (targetNode) {
      addLog(
        'ROUTING',
        `[OPERATOR_SWITCH] Active user switched to [${targetNode.name}] (${targetNode.label}, ${targetNode.role}). Re-computing ad-hoc routing table...`
      );
    }
  };

  const handleSelectDestUser = (userId: string) => {
    if (transmission.isTransmitting) return;
    setDestNodeId(userId);
    simAudio.playUserSwitch();
    const destNode = nodes.find((n) => n.id === userId);
    if (destNode) {
      addLog(
        'ROUTING',
        `[TARGET_SET] Destination target set to [${destNode.name}] (${destNode.label}). Discovering optimal micro-hops...`
      );
    }
  };

  // Click on a node cycles status: active -> dead -> out_of_range -> active
  const handleNodeClick = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n;
        const nextStatus: SimNode['status'] =
          n.status === 'active' ? 'dead' : n.status === 'dead' ? 'out_of_range' : 'active';
        return {
          ...n,
          status: nextStatus,
          battery: nextStatus === 'dead' ? 0 : nextStatus === 'active' && n.battery === 0 ? 85 : n.battery,
        };
      })
    );

    const targetNode = nodes.find((n) => n.id === nodeId);
    if (targetNode) {
      const nextStatus =
        targetNode.status === 'active' ? 'DEAD' : targetNode.status === 'dead' ? 'OUT OF RANGE' : 'ACTIVE';
      addLog('ALERT', `Node [${targetNode.label}] manual status toggled to -> ${nextStatus}`);

      // Check if this node is currently part of an active transmission!
      checkActiveTransmissionFailure(nodeId);
    }
  };

  const handleNodeStatusChange = (nodeId: string, newStatus: SimNode['status']) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, status: newStatus, battery: newStatus === 'dead' ? 0 : n.battery || 85 } : n))
    );
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (targetNode) {
      addLog('ALERT', `Node [${targetNode.label}] state changed to [${newStatus.toUpperCase()}]`);
      if (newStatus !== 'active') {
        checkActiveTransmissionFailure(nodeId);
      }
    }
  };

  const handleNodeDrag = (nodeId: string, x: number, y: number) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, x, y } : n))
    );
  };

  // FAIL-SAFE LOGIC: If a node dies or goes out of range during transmission
  const checkActiveTransmissionFailure = (changedNodeId: string) => {
    const curTx = transmissionStateRef.current;
    if (!curTx.isTransmitting) return;

    // Check if changed node is in remaining hops
    const remainingHops = curTx.plannedPath.slice(curTx.currentHopIndex);
    if (remainingHops.includes(changedNodeId)) {
      const failedNode = nodesRef.current.find((n) => n.id === changedNodeId);
      const failedName = failedNode ? failedNode.label : changedNodeId;

      simAudio.playRouteBroken();

      addLog(
        'ERROR',
        `[ROUTE_FAILED] Node [${failedName}] went offline during transmission! Graph connection severed.`
      );

      // Attempt dynamic reroute!
      addLog('ROUTING', `[RECALCULATING] Attempting ad-hoc micro-route recalculation around failed node...`);

      // Cancel current animation
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      // Compute alternative path from the current hop to destination
      const currentSenderId = curTx.plannedPath[curTx.currentHopIndex];
      const updatedNodes = nodesRef.current.map((n) => (n.id === changedNodeId ? { ...n, status: 'dead' as const } : n));
      const reroute = findShortestPath(updatedNodes, currentSenderId, curTx.destId, true);

      if (reroute.found && reroute.path.length > 1) {
        // Splice new path
        const newFullPath = [...curTx.plannedPath.slice(0, curTx.currentHopIndex), ...reroute.path];
        simAudio.playRerouteSuccess();
        addLog(
          'ROUTING',
          `[REROUTE_SUCCESS] Alternative ad-hoc path discovered: ${newFullPath.map((id) => nodesRef.current.find((n) => n.id === id)?.label).join(' -> ')}`
        );

        setTransmission((prev) => ({
          ...prev,
          plannedPath: newFullPath,
          failedNodeId: undefined,
          status: 'routing',
          phase: 'recalculating',
        }));

        // Resume transmission along new path
        setTimeout(() => {
          advanceTransmissionHop(curTx.currentHopIndex, newFullPath);
        }, 500 / simSpeedRef.current);
      } else {
        // Complete failure: Network Partitioned
        addLog(
          'ERROR',
          `[ROUTING_FATAL] Partition detected: No alternative peer-to-peer route exists to target [${nodesRef.current.find((n) => n.id === curTx.destId)?.label}]. Packet dropped!`
        );

        setTransmission((prev) => ({
          ...prev,
          isTransmitting: false,
          status: 'failed',
          phase: 'failed',
          failedNodeId: changedNodeId,
          activeEdge: null,
        }));
        setTotalTransmissions((prev) => prev + 1);
      }
    }
  };

  // Initiate multi-phase route discovery & message injection
  const handleInjectRoute = () => {
    if (originNodeId === destNodeId) {
      addLog('ALERT', 'Origin and destination must be different nodes.');
      return;
    }

    const origin = nodes.find((n) => n.id === originNodeId);
    const dest = nodes.find((n) => n.id === destNodeId);

    if (!origin || !dest) return;
    if (origin.status !== 'active') {
      addLog('ERROR', `Cannot transmit: Sender [${origin.label}] is currently [${origin.status.toUpperCase()}].`);
      return;
    }

    const messageText = selectedMessage === 'Custom Alert' ? customMessageText || 'Emergency Assistance' : selectedMessage;

    // Find shortest path using BFS/Dijkstra
    const { path, found } = findShortestPath(nodes, originNodeId, destNodeId, true);

    if (!found || path.length < 2) {
      simAudio.playRouteBroken();
      addLog(
        'ERROR',
        `[ROUTE_DISCOVERY_FAILED] No active physical RF path between [${origin.label}] and [${dest.label}]. Out of transmission range or intermediate nodes dead.`
      );
      setTotalTransmissions((prev) => prev + 1);
      return;
    }

    const pathLabels = path.map((id) => nodes.find((n) => n.id === id)?.label).join(' -> ');

    // PHASE 1: Route Request (RREQ) Ad-hoc Discovery Broadcast
    simAudio.playRouteDiscovery();
    addLog('INFO', `[00:01] INFRASTRUCTURE DEAD -> Initiating Ad-Hoc Route Discovery...`);
    addLog(
      'ROUTING',
      `[RREQ_BROADCAST] Node [${origin.label}] broadcasted Route Request (RREQ) packet searching for [${dest.label}]...`
    );

    setTransmission({
      isTransmitting: true,
      isPaused: false,
      originId: originNodeId,
      destId: destNodeId,
      currentHopIndex: 0,
      plannedPath: path,
      activeEdge: null,
      messageText,
      status: 'routing',
      phase: 'discovering_rreq',
      packetProgress: 0,
      totalHops: path.length - 1,
      deliveryLatencyMs: 0,
      discoveryWaveRadius: 35,
      lastDeliveredMessage: null,
    });

    const speed = simSpeedRef.current;

    // PHASE 2: Route Reply (RREP) confirmation
    setTimeout(() => {
      addLog(
        'ROUTING',
        `[RREP_CONFIRMED] Destination [${dest.label}] returned Route Reply (RREP). Multi-hop path locked: ${pathLabels}`
      );
      addLog('ROUTING', `[PACKET_ORIGIN] Created 256-byte encrypted emergency payload: "${messageText}"`);

      setTransmission((prev) => ({
        ...prev,
        phase: 'returning_rrep',
        discoveryWaveRadius: 0,
      }));

      // PHASE 3: Begin packet hopping
      setTimeout(() => {
        advanceTransmissionHop(0, path);
      }, 350 / speed);
    }, 450 / speed);
  };

  // Step through hops with animated particle
  const advanceTransmissionHop = (hopIndex: number, currentPath: string[]) => {
    const speed = simSpeedRef.current;

    if (hopIndex >= currentPath.length - 1) {
      // Reached destination!
      const destNode = nodesRef.current.find((n) => n.id === currentPath[currentPath.length - 1]);
      const originNode = nodesRef.current.find((n) => n.id === currentPath[0]);

      simAudio.playDeliverySuccess();

      addLog(
        'SUCCESS',
        `Packet arrived at Node [${destNode?.label}] -> Destination Node verified. Delivery Success (0% Packet Drop).`
      );

      const messageText = transmissionStateRef.current.messageText;

      setTransmission((prev) => ({
        ...prev,
        isTransmitting: false,
        status: 'success',
        phase: 'success',
        activeEdge: null,
        lastDeliveredMessage: {
          text: messageText,
          fromName: originNode?.name || 'Operator',
          toName: destNode?.name || 'Recipient',
          hops: currentPath.length - 1,
          timestamp: new Date().toLocaleTimeString(),
        },
      }));

      setTotalTransmissions((prev) => prev + 1);
      setSuccessfulTransmissions((prev) => prev + 1);
      return;
    }

    const uId = currentPath[hopIndex];
    const vId = currentPath[hopIndex + 1];
    const uNode = nodesRef.current.find((n) => n.id === uId);
    const vNode = nodesRef.current.find((n) => n.id === vId);

    // Verify both nodes are active before hopping
    if (!uNode || !vNode || uNode.status !== 'active' || vNode.status !== 'active') {
      simAudio.playRouteBroken();
      addLog('ERROR', `[ROUTE_FAILED] Node offline during hop attempt between [${uNode?.label}] and [${vNode?.label}].`);
      setTransmission((prev) => ({
        ...prev,
        isTransmitting: false,
        status: 'failed',
        phase: 'failed',
        failedNodeId: vNode?.status !== 'active' ? vId : uId,
        activeEdge: null,
      }));
      setTotalTransmissions((prev) => prev + 1);
      return;
    }

    const dist = calculateDistanceMeters(uNode, vNode);
    simAudio.playHop();

    addLog(
      'HOP',
      `[HOP ${hopIndex + 1}/${currentPath.length - 1}] Forwarding packet from [${uNode.label}] -> [${vNode.label}] (${dist}m range, RSSI: ${vNode.signalStrengthDbm} dBm).`
    );

    setTransmission((prev) => ({
      ...prev,
      phase: 'transmitting_data',
      currentHopIndex: hopIndex,
      activeEdge: { from: uId, to: vId },
      packetProgress: 0,
    }));

    // Animate packet progress along edge
    const startTime = performance.now();
    const duration = 650 / speed;

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(1, elapsed / duration);

      setTransmission((prev) => ({
        ...prev,
        packetProgress: progress,
      }));

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Hop complete, move to next hop
        setTimeout(() => {
          advanceTransmissionHop(hopIndex + 1, currentPath);
        }, 120 / speed);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  const handleStopTransmission = () => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setTransmission((prev) => ({
      ...prev,
      isTransmitting: false,
      status: 'idle',
      phase: 'idle',
      activeEdge: null,
    }));
    addLog('ALERT', 'Manual user abort triggered. Transmission halted.');
  };

  // Reset Network back to 100% active state
  const handleResetNetwork = () => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setNodes(INITIAL_SIM_NODES);
    setSelectedNodeId(null);
    setTransmission({
      isTransmitting: false,
      isPaused: false,
      originId: originNodeId,
      destId: destNodeId,
      currentHopIndex: 0,
      plannedPath: [],
      activeEdge: null,
      messageText: selectedMessage,
      status: 'idle',
      phase: 'idle',
      packetProgress: 0,
      totalHops: 0,
      deliveryLatencyMs: 0,
      lastDeliveredMessage: null,
    });
    addLog('INFO', 'Network topology reset. All student smartphone nodes restored to 100% battery & online.');
  };

  // Chaos Monkey stress test: randomly toggle node states
  const handleChaosMonkeyToggle = () => {
    if (isChaosRunning) {
      if (chaosIntervalRef.current !== null) {
        clearInterval(chaosIntervalRef.current);
        chaosIntervalRef.current = null;
      }
      setIsChaosRunning(false);
      addLog('INFO', 'Chaos Monkey stress test stopped.');
    } else {
      setIsChaosRunning(true);
      addLog('ALERT', '[CHAOS_MONKEY_ENGAGED] Simulating erratic campus battery discharges & roaming users...');

      chaosIntervalRef.current = window.setInterval(() => {
        setNodes((prev) => {
          const randomIndex = Math.floor(Math.random() * prev.length);
          const target = prev[randomIndex];
          const newStatus: SimNode['status'] =
            target.status === 'active' ? 'dead' : 'active';
          return prev.map((n, idx) =>
            idx === randomIndex
              ? {
                  ...n,
                  status: newStatus,
                  battery: newStatus === 'dead' ? 0 : 80 + Math.round(Math.random() * 20),
                }
              : n
          );
        });
      }, 3500);
    }
  };

  // Export logs to JSON
  const handleExportLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `shadow_net_evidence_log_${Date.now()}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const activeUserNode = nodes.find((n) => n.id === originNodeId);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-hidden bg-[#05070b]">
      {/* Component A: Top Analytics & Telemetry Bar */}
      <SimulatorAnalyticsBar
        totalNodesCount={totalNodesCount}
        activeNodesCount={activeNodesCount}
        deadNodesCount={deadNodesCount}
        densityIndex={densityIndex}
        densityScore={densityScore}
        avgHopEfficiency={avgHopEfficiency}
        totalTransmissions={totalTransmissions}
        successRatePercent={successRatePercent}
        onResetNetwork={handleResetNetwork}
        onChaosMonkeyToggle={handleChaosMonkeyToggle}
        isChaosRunning={isChaosRunning}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
        simSpeed={simSpeed}
        onChangeSimSpeed={setSimSpeed}
        activeUserNode={activeUserNode}
        onOpenEditUsersModal={() => handleOpenEditUsersModal()}
      />

      {/* Component A2: Interactive Real-Time Active Operator Switcher */}
      <ActiveUserSwitcher
        nodes={nodes}
        activeUserId={originNodeId}
        onSelectActiveUser={handleSelectActiveUser}
        destUserId={destNodeId}
        onSelectDestUser={handleSelectDestUser}
        candidatePath={candidateRoute.path}
        isTransmitting={transmission.isTransmitting}
        onOpenEditUsersModal={(nodeId) => handleOpenEditUsersModal(nodeId)}
      />

      {/* Main Split: Topology Canvas (The Visual Core) */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Component B: Interactive Network Topology Canvas */}
        <SimulatorTopologyCanvas
          nodes={nodes}
          edges={edges}
          transmission={transmission}
          candidatePath={candidateRoute.path}
          activeUserId={originNodeId}
          destUserId={destNodeId}
          onNodeClick={handleNodeClick}
          onNodeStatusChange={handleNodeStatusChange}
          onNodeDrag={handleNodeDrag}
          onSelectAsOrigin={handleSelectActiveUser}
          onSelectAsDest={handleSelectDestUser}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          onOpenEditUsersModal={(nodeId) => handleOpenEditUsersModal(nodeId)}
          onUpdateNodeName={handleUpdateNodeName}
        />

        {/* Component C: Message Transmission Console Dock */}
        <SimulatorMessageConsole
          nodes={nodes}
          originNodeId={originNodeId}
          destNodeId={destNodeId}
          selectedMessage={selectedMessage}
          customMessageText={customMessageText}
          candidatePath={candidateRoute.path}
          onOriginChange={handleSelectActiveUser}
          onDestChange={handleSelectDestUser}
          onMessageSelect={setSelectedMessage}
          onCustomMessageChange={setCustomMessageText}
          onInjectRoute={handleInjectRoute}
          onStopTransmission={handleStopTransmission}
          transmission={transmission}
        />

        {/* Component D: Live Routing Log Terminal (Network Evidence Log) */}
        <SimulatorTerminalLog
          logs={logs}
          onClearLogs={handleClearLogs}
          onExportLogs={handleExportLogs}
        />
      </div>

      {/* User Directory & Rename Modal */}
      <EditUsersModal
        isOpen={isEditUsersModalOpen}
        onClose={() => {
          setIsEditUsersModalOpen(false);
          setTargetEditNodeId(null);
        }}
        nodes={nodes}
        onUpdateNode={handleUpdateNode}
        onUpdateAllNodes={handleUpdateAllNodes}
        onResetToDefaults={handleResetToDefaults}
        onAddNewNode={handleAddNewNode}
        onDeleteNode={handleDeleteNode}
        activeUserId={originNodeId}
        onSelectActiveUser={handleSelectActiveUser}
        destUserId={destNodeId}
        onSelectDestUser={handleSelectDestUser}
        targetEditNodeId={targetEditNodeId}
      />
    </div>
  );
};
