import {
  MeshNode,
  MeshPacket,
  MeshPacketPriority,
  RoutingEntry,
  StoreAndForwardBundle,
  ActiveTransmissionPulse,
  GeoLocation,
  SosDetails,
} from '../types/mesh';
import {
  initializeNodeCrypto,
  KeyPairBundle,
  signPacket,
  verifyPacketSignature,
  getPacketSignableString,
  encryptTacticalPayload,
  decryptTacticalPayload,
} from './crypto';
import { WebRtcLinkManager } from './webrtc';
import { globalAcousticModem } from './acoustic';

type PacketHandler = (packet: MeshPacket) => void;
type NodeUpdateHandler = (nodes: MeshNode[]) => void;
type PulseHandler = (pulse: ActiveTransmissionPulse) => void;

const BROADCAST_CHANNEL_NAME = 'shadow_net_emergency_mesh_v1';
const MAX_STORED_PACKETS = 200;
const BUNDLE_STORAGE_KEY = 'shadow_net_bundle_store';
const LOCAL_NODE_STORAGE_KEY = 'shadow_net_local_node_profile';

export class MeshRouter {
  public localNode: MeshNode | null = null;
  private cryptoBundle: KeyPairBundle | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  public webrtcManager: WebRtcLinkManager | null = null;

  private knownNodes = new Map<string, MeshNode>();
  private routingTable = new Map<string, RoutingEntry>();
  private seenPacketIds = new Set<string>();
  private packetHistory: MeshPacket[] = [];
  private bundleStore: StoreAndForwardBundle[] = [];

  private packetListeners = new Set<PacketHandler>();
  private nodeListeners = new Set<NodeUpdateHandler>();
  private pulseListeners = new Set<PulseHandler>();

  private beaconIntervalId: number | null = null;
  private simulationActive = true;
  private simulatedNodes: MeshNode[] = [];

  constructor() {
    this.loadBundleStore();
  }

  // Initialize the router and local cryptographic identity
  public async initialize(customCallsign?: string, customRole?: MeshNode['role']): Promise<MeshNode> {
    // Check saved profile or generate fresh
    let savedCallsign = customCallsign;
    let savedOperatorName = 'Scout-Alpha';
    let savedTeamId = 'SAR-Team-Echo';
    let savedBloodType = 'O+ POS';

    if (!savedCallsign) {
      const stored = localStorage.getItem(LOCAL_NODE_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          savedCallsign = parsed.callsign;
          if (parsed.operatorName) savedOperatorName = parsed.operatorName;
          if (parsed.teamId) savedTeamId = parsed.teamId;
          if (parsed.bloodType) savedBloodType = parsed.bloodType;
        } catch {}
      }
    }
    if (!savedCallsign) {
      const randSuffix = Math.floor(100 + Math.random() * 900);
      savedCallsign = `Apex-${randSuffix}`;
    }

    // Detect device type
    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTablet = typeof navigator !== 'undefined' && (/iPad|Tablet/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && isMobile));
    const deviceType: 'mobile' | 'tablet' | 'desktop' = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

    this.cryptoBundle = await initializeNodeCrypto(savedCallsign);

    const localNode: MeshNode = {
      id: this.cryptoBundle.nodeId,
      callsign: savedCallsign,
      role: customRole || 'mobile',
      fingerprint: this.cryptoBundle.fingerprint,
      batteryLevel: 94,
      isLocal: true,
      transport: 'broadcast',
      rssi: -45,
      lastSeen: Date.now(),
      status: 'online',
      coordinates: {
        x: 48,
        y: 52,
        lat: 37.7749 + (Math.random() - 0.5) * 0.04,
        lon: -122.4194 + (Math.random() - 0.5) * 0.04,
        gridRef: 'GR-4829',
      },
      storedBundlesCount: this.bundleStore.length,
      relayedPacketsCount: 0,
      peerConnectionState: 'none',
      isRealDevice: true,
      deviceType,
      operatorName: savedOperatorName,
      teamId: savedTeamId,
      bloodType: savedBloodType,
      heading: 45,
      gpsAccuracy: 3.5,
    };

    // Try reading device battery if supported
    if ('getBattery' in navigator) {
      try {
        const battery: any = await (navigator as any).getBattery();
        localNode.batteryLevel = Math.round(battery.level * 100);
      } catch {}
    }

    this.localNode = localNode;
    this.knownNodes.set(localNode.id, localNode);

    // Save profile
    localStorage.setItem(LOCAL_NODE_STORAGE_KEY, JSON.stringify({
      callsign: localNode.callsign,
      role: localNode.role,
      operatorName: localNode.operatorName,
      teamId: localNode.teamId,
      bloodType: localNode.bloodType,
    }));

    // Initialize WebRTC
    this.webrtcManager = new WebRtcLinkManager(localNode.id, localNode.callsign);
    this.webrtcManager.setCallbacks(
      (data) => this.handleRawWirePacket(data, 'webrtc'),
      (state) => {
        if (this.localNode) {
          this.localNode.peerConnectionState = state;
          this.notifyNodeListeners();
        }
      }
    );

    // Setup inter-tab BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      this.broadcastChannel.onmessage = (event) => {
        this.handleRawWirePacket(event.data, 'broadcast');
      };
    }

    // Storage event fallback for older / cross-context sync
    window.addEventListener('storage', (event) => {
      if (event.key === 'shadow_net_cross_tab_wire' && event.newValue) {
        this.handleRawWirePacket(event.newValue, 'broadcast');
      }
    });

    // Seed default simulated emergency nodes
    this.initSimulatedFleet();

    // Start periodic heartbeats
    this.startBeaconHeartbeat();

    this.notifyNodeListeners();
    return localNode;
  }

  // Seed realistic emergency mesh nodes in range
  private initSimulatedFleet() {
    this.simulatedNodes = [
      {
        id: 'NODE-RELAY-TOWER-01',
        callsign: 'Water-Tower-Repeater',
        role: 'relay',
        fingerprint: 'SHA256:7B88...1A2C',
        batteryLevel: 100, // Solar-backed
        isLocal: false,
        transport: 'simulated',
        rssi: -58,
        lastSeen: Date.now(),
        status: 'online',
        coordinates: {
          x: 25,
          y: 28,
          lat: 37.7850,
          lon: -122.4280,
          gridRef: 'GR-2528',
        },
        storedBundlesCount: 12,
        relayedPacketsCount: 148,
      },
      {
        id: 'NODE-SHELTER-BASE',
        callsign: 'Metro-Civic-Shelter',
        role: 'shelter',
        fingerprint: 'SHA256:C943...FE99',
        batteryLevel: 88,
        isLocal: false,
        transport: 'simulated',
        rssi: -72,
        lastSeen: Date.now(),
        status: 'online',
        coordinates: {
          x: 75,
          y: 35,
          lat: 37.7690,
          lon: -122.4050,
          gridRef: 'GR-7535',
        },
        storedBundlesCount: 34,
        relayedPacketsCount: 89,
      },
      {
        id: 'NODE-MEDIC-VAN-04',
        callsign: 'Triage-Mobile-04',
        role: 'medical',
        fingerprint: 'SHA256:11A3...D8B0',
        batteryLevel: 72,
        isLocal: false,
        transport: 'simulated',
        rssi: -66,
        lastSeen: Date.now(),
        status: 'online',
        coordinates: {
          x: 32,
          y: 72,
          lat: 37.7610,
          lon: -122.4350,
          gridRef: 'GR-3272',
        },
        storedBundlesCount: 8,
        relayedPacketsCount: 52,
      },
      {
        id: 'NODE-COMMAND-DEFENSE',
        callsign: 'Civil-Defense-Tactical',
        role: 'command',
        fingerprint: 'SHA256:E410...09FA',
        batteryLevel: 95,
        isLocal: false,
        transport: 'simulated',
        rssi: -84,
        lastSeen: Date.now(),
        status: 'online',
        coordinates: {
          x: 82,
          y: 78,
          lat: 37.7550,
          lon: -122.3980,
          gridRef: 'GR-8278',
        },
        storedBundlesCount: 19,
        relayedPacketsCount: 210,
      },
    ];

    for (const simNode of this.simulatedNodes) {
      this.knownNodes.set(simNode.id, simNode);
      this.routingTable.set(simNode.id, {
        destinationNodeId: simNode.id,
        nextHopNodeId: simNode.id,
        hopDistance: 1,
        signalRssi: simNode.rssi,
        transport: 'simulated',
        updatedAt: Date.now(),
      });
    }
  }

  // Periodic node beacon heartbeat broadcast
  private startBeaconHeartbeat() {
    if (this.beaconIntervalId !== null) clearInterval(this.beaconIntervalId);

    // Heartbeat every 8 seconds
    this.beaconIntervalId = window.setInterval(() => {
      this.broadcastBeacon();
      this.simulateFleetTick();
    }, 8000);

    // Initial beacon immediate
    setTimeout(() => this.broadcastBeacon(), 500);
  }

  // Emit beacon to discover and refresh peer topology
  public broadcastBeacon() {
    if (!this.localNode) return;

    const beaconPacket: MeshPacket = {
      id: `beacon-${this.localNode.id}-${Date.now()}`,
      version: 1,
      type: 'beacon',
      originNodeId: this.localNode.id,
      originCallsign: this.localNode.callsign,
      targetNodeId: 'BROADCAST',
      channel: '#mesh-discovery',
      priority: 'ROUTINE',
      hopCount: 0,
      maxHops: 3,
      ttl: Date.now() + 30000,
      timestamp: Date.now(),
      routeHistory: [this.localNode.id],
      payload: JSON.stringify({
        role: this.localNode.role,
        battery: this.localNode.batteryLevel,
        fingerprint: this.localNode.fingerprint,
        publicKey: this.cryptoBundle?.publicKeyBase64,
        coordinates: this.localNode.coordinates,
        bundlesCount: this.bundleStore.length,
        isRealDevice: true,
        deviceType: this.localNode.deviceType,
        operatorName: this.localNode.operatorName,
        teamId: this.localNode.teamId,
        bloodType: this.localNode.bloodType,
        heading: this.localNode.heading,
        gpsAccuracy: this.localNode.gpsAccuracy,
        altitude: this.localNode.altitude,
        speed: this.localNode.speed,
      }),
      encrypted: false,
    };

    this.sendPacket(beaconPacket, false);
  }

  // Send packet into the mesh
  public async sendPacket(
    packet: Partial<MeshPacket> & { payload: string },
    recordInHistory = true
  ): Promise<MeshPacket> {
    if (!this.localNode || !this.cryptoBundle) {
      throw new Error('Mesh router not initialized');
    }

    const fullPacket: MeshPacket = {
      id: packet.id || `pkt-${Math.random().toString(36).slice(2, 9)}-${Date.now()}`,
      version: 1,
      type: packet.type || 'chat',
      originNodeId: this.localNode.id,
      originCallsign: this.localNode.callsign,
      targetNodeId: packet.targetNodeId || 'BROADCAST',
      channel: packet.channel || '#emergency-sos',
      priority: packet.priority || 'ROUTINE',
      hopCount: 0,
      maxHops: packet.priority === 'SOS' ? 7 : 4,
      ttl: packet.ttl || Date.now() + (packet.priority === 'SOS' ? 3600000 : 1800000), // 1 hour for SOS
      timestamp: Date.now(),
      routeHistory: [this.localNode.id],
      payload: packet.payload,
      encrypted: packet.encrypted || false,
      publicKey: this.cryptoBundle.publicKeyBase64,
      location: packet.location || (this.localNode.coordinates.lat !== undefined ? {
        lat: this.localNode.coordinates.lat,
        lon: this.localNode.coordinates.lon ?? -122.4194,
        gridRef: this.localNode.coordinates.gridRef,
      } : undefined),
      sosDetails: packet.sosDetails,
    };

    // Calculate canonical signable string & sign
    const signable = getPacketSignableString(fullPacket);
    fullPacket.signature = await signPacket(this.cryptoBundle.signingKeyPair.privateKey, signable);
    fullPacket.tamperVerified = true;

    // Track as seen locally
    this.seenPacketIds.add(fullPacket.id);

    if (recordInHistory && fullPacket.type !== 'beacon') {
      this.addPacketToHistory(fullPacket);
    }

    // Transmit across available physical zero-internet channels
    this.transmitAcrossTransports(fullPacket);

    // If SOS priority, also queue sound modem ping
    if (fullPacket.priority === 'SOS') {
      globalAcousticModem.playAcousticPing(1900, 250);
    }

    return fullPacket;
  }

  // Transmit packet across BroadcastChannel, WebRTC, and localStorage
  private transmitAcrossTransports(packet: MeshPacket) {
    const rawWire = JSON.stringify(packet);

    // 1. BroadcastChannel (fast local inter-tab)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(rawWire);
      } catch (e) {
        console.warn('BroadcastChannel send error:', e);
      }
    }

    // 2. Storage event fallback
    try {
      localStorage.setItem('shadow_net_cross_tab_wire', `${Date.now()}_${rawWire}`);
    } catch {}

    // 3. Serverless WebRTC DataChannel (if direct device link open)
    if (this.webrtcManager?.isConnected()) {
      this.webrtcManager.send(rawWire);
    }

    // Visual pulse emission
    this.emitTransmissionPulse(packet.originNodeId, packet.targetNodeId, packet.priority);
  }

  // Process incoming wire packet from any transport
  private async handleRawWirePacket(rawWire: string, transport: 'broadcast' | 'webrtc' | 'acoustic' | 'simulated') {
    try {
      // In case of localStorage prefix
      let jsonStr = rawWire;
      const underscoreIndex = rawWire.indexOf('_{"id"');
      if (underscoreIndex !== -1) {
        jsonStr = rawWire.slice(underscoreIndex + 1);
      }

      const packet: MeshPacket = JSON.parse(jsonStr);
      if (!packet.id || !packet.originNodeId) return;

      // Drop duplicate packet if already received
      if (this.seenPacketIds.has(packet.id)) {
        return;
      }
      this.seenPacketIds.add(packet.id);

      // Check TTL
      if (Date.now() > packet.ttl) {
        return;
      }

      // Verify origin signature if public key is present
      if (packet.publicKey && packet.signature) {
        const signable = getPacketSignableString(packet);
        const valid = await verifyPacketSignature(packet.publicKey, packet.signature, signable);
        packet.tamperVerified = valid;
      } else {
        packet.tamperVerified = false;
      }

      // Handle Beacon / Node Discovery
      if (packet.type === 'beacon') {
        this.handlePeerBeacon(packet, transport);
        return;
      }

      // Update sender in routing table
      this.updateRoutingEntry(packet.originNodeId, packet.routeHistory[packet.routeHistory.length - 1], packet.hopCount, transport);

      // Trigger pulse animation
      const prevHop = packet.routeHistory[packet.routeHistory.length - 1] || packet.originNodeId;
      const currentTarget = packet.targetNodeId === 'BROADCAST' ? (this.localNode?.id || 'LOCAL') : packet.targetNodeId;
      this.emitTransmissionPulse(prevHop, currentTarget, packet.priority);

      // Check if this packet is meant for us or broadcast
      const isForUs = packet.targetNodeId === 'BROADCAST' || packet.targetNodeId === this.localNode?.id;

      if (isForUs) {
        this.addPacketToHistory(packet);
        this.notifyPacketListeners(packet);

        // Sound alert for SOS
        if (packet.priority === 'SOS') {
          globalAcousticModem.playAcousticPing(2200, 300);
        }
      }

      // Forwarding / Relay decision (Store-and-Forward Micro-Routing)
      if (packet.hopCount < packet.maxHops && packet.originNodeId !== this.localNode?.id) {
        this.relayPacket(packet);
      }
    } catch (err) {
      console.warn('Packet processing failed:', err);
    }
  }

  // Micro-Routing Relay Step
  private relayPacket(packet: MeshPacket) {
    if (!this.localNode) return;

    // Create forwarded clone
    const forwarded: MeshPacket = {
      ...packet,
      hopCount: packet.hopCount + 1,
      routeHistory: [...packet.routeHistory, this.localNode.id],
    };

    // Store in bundle store for delay-tolerant forwarding
    this.saveBundle(forwarded);

    if (this.localNode) {
      this.localNode.relayedPacketsCount += 1;
      this.notifyNodeListeners();
    }

    // Delay slight randomized jitter (20-120ms) to avoid RF collision
    const jitterMs = 20 + Math.random() * 100;
    setTimeout(() => {
      this.transmitAcrossTransports(forwarded);
    }, jitterMs);
  }

  // Update Peer Node registry on beacon
  private handlePeerBeacon(packet: MeshPacket, transport: 'broadcast' | 'webrtc' | 'acoustic' | 'simulated') {
    if (packet.originNodeId === this.localNode?.id) return;

    try {
      const info = JSON.parse(packet.payload);
      const existing = this.knownNodes.get(packet.originNodeId);

      const updatedNode: MeshNode = {
        id: packet.originNodeId,
        callsign: packet.originCallsign || (existing ? existing.callsign : 'Unknown Node'),
        role: info.role || 'mobile',
        fingerprint: info.fingerprint || (packet.publicKey ? `SHA256:${packet.publicKey.slice(0, 8)}` : 'UNKNOWN'),
        batteryLevel: info.battery ?? 85,
        isLocal: false,
        transport: transport,
        rssi: transport === 'broadcast' ? -42 : transport === 'webrtc' ? -50 : -75,
        lastSeen: Date.now(),
        status: 'online',
        coordinates: info.coordinates || existing?.coordinates || {
          x: 20 + Math.random() * 60,
          y: 20 + Math.random() * 60,
        },
        storedBundlesCount: info.bundlesCount || 0,
        relayedPacketsCount: existing?.relayedPacketsCount || 0,
        isRealDevice: info.isRealDevice ?? (transport !== 'simulated'),
        deviceType: info.deviceType || (transport === 'simulated' ? 'desktop' : 'mobile'),
        operatorName: info.operatorName || (existing ? existing.operatorName : undefined),
        teamId: info.teamId || (existing ? existing.teamId : undefined),
        bloodType: info.bloodType || (existing ? existing.bloodType : undefined),
        heading: info.heading ?? (existing ? existing.heading : undefined),
        gpsAccuracy: info.gpsAccuracy ?? (existing ? existing.gpsAccuracy : undefined),
        altitude: info.altitude ?? (existing ? existing.altitude : undefined),
        speed: info.speed ?? (existing ? existing.speed : undefined),
      };

      this.knownNodes.set(packet.originNodeId, updatedNode);
      this.updateRoutingEntry(packet.originNodeId, packet.originNodeId, packet.hopCount + 1, transport);
      this.notifyNodeListeners();
    } catch (e) {
      // Beacon parse fallback
    }
  }

  private updateRoutingEntry(destination: string, nextHop: string, hopDistance: number, transport: string) {
    this.routingTable.set(destination, {
      destinationNodeId: destination,
      nextHopNodeId: nextHop,
      hopDistance,
      signalRssi: -55 - hopDistance * 10,
      transport,
      updatedAt: Date.now(),
    });
  }

  private addPacketToHistory(packet: MeshPacket) {
    this.packetHistory.unshift(packet);
    if (this.packetHistory.length > MAX_STORED_PACKETS) {
      this.packetHistory.pop();
    }
  }

  // Store-and-Forward Bundle persistence
  private saveBundle(packet: MeshPacket) {
    const existingIndex = this.bundleStore.findIndex((b) => b.packet.id === packet.id);
    if (existingIndex >= 0) {
      this.bundleStore[existingIndex].forwardAttempts += 1;
    } else {
      this.bundleStore.push({
        packet,
        receivedAt: Date.now(),
        forwardAttempts: 1,
        delivered: false,
        ackReceived: false,
      });
      if (this.bundleStore.length > 50) this.bundleStore.shift();
    }

    if (this.localNode) {
      this.localNode.storedBundlesCount = this.bundleStore.length;
    }

    try {
      localStorage.setItem(BUNDLE_STORAGE_KEY, JSON.stringify(this.bundleStore.slice(-20)));
    } catch {}
  }

  private loadBundleStore() {
    try {
      const stored = localStorage.getItem(BUNDLE_STORAGE_KEY);
      if (stored) {
        this.bundleStore = JSON.parse(stored);
      }
    } catch {}
  }

  // Simulated fleet autonomous responses and ping bounces
  private simulateFleetTick() {
    if (!this.simulationActive) return;

    // Small random telemetry fluctuation for realism
    for (const sim of this.simulatedNodes) {
      sim.lastSeen = Date.now();
      // Minor RSSI drift
      sim.rssi = Math.max(-95, Math.min(-45, sim.rssi + (Math.random() > 0.5 ? 1 : -1)));
    }
  }

  // Trigger simulated node reaction to an SOS packet
  public simulateRelayResponse(sosPacket: MeshPacket) {
    if (!this.simulationActive) return;

    // Shelter Base or Medic responds after a few seconds
    setTimeout(() => {
      const responder = this.simulatedNodes.find((n) => n.role === 'shelter' || n.role === 'medical') || this.simulatedNodes[0];
      if (!responder) return;

      const ackPacket: MeshPacket = {
        id: `ack-${Date.now()}`,
        version: 1,
        type: 'chat',
        originNodeId: responder.id,
        originCallsign: responder.callsign,
        targetNodeId: 'BROADCAST',
        channel: sosPacket.channel,
        priority: 'HIGH',
        hopCount: 1,
        maxHops: 4,
        ttl: Date.now() + 600000,
        timestamp: Date.now(),
        routeHistory: [responder.id, 'NODE-RELAY-TOWER-01'],
        payload: `[ROUTED ACK via Relay Tower] SOS Received from ${sosPacket.originCallsign}. Dispatching emergency mobile triage unit. Maintain position if safe.`,
        encrypted: false,
        tamperVerified: true,
      };

      this.addPacketToHistory(ackPacket);
      this.notifyPacketListeners(ackPacket);
      this.emitTransmissionPulse(responder.id, this.localNode?.id || 'BROADCAST', 'HIGH');
    }, 2400);
  }

  // Animation pulse event emitter
  private emitTransmissionPulse(from: string, to: string, priority: MeshPacketPriority) {
    const pulse: ActiveTransmissionPulse = {
      id: `pulse-${Math.random()}`,
      fromNodeId: from,
      toNodeId: to,
      progress: 0,
      priority,
      timestamp: Date.now(),
    };

    for (const listener of this.pulseListeners) {
      listener(pulse);
    }
  }

  // Event Subscriptions
  public onPacket(handler: PacketHandler): () => void {
    this.packetListeners.add(handler);
    return () => {
      this.packetListeners.delete(handler);
    };
  }

  public onNodesUpdated(handler: NodeUpdateHandler): () => void {
    this.nodeListeners.add(handler);
    handler(this.getNodes());
    return () => {
      this.nodeListeners.delete(handler);
    };
  }

  public onPulse(handler: PulseHandler): () => void {
    this.pulseListeners.add(handler);
    return () => {
      this.pulseListeners.delete(handler);
    };
  }

  private notifyPacketListeners(packet: MeshPacket) {
    for (const listener of this.packetListeners) {
      listener(packet);
    }
  }

  private notifyNodeListeners() {
    const nodes = this.getNodes();
    for (const listener of this.nodeListeners) {
      listener(nodes);
    }
  }

  public getNodes(): MeshNode[] {
    return Array.from(this.knownNodes.values());
  }

  public getRoutingTable(): RoutingEntry[] {
    return Array.from(this.routingTable.values());
  }

  public getHistory(): MeshPacket[] {
    return [...this.packetHistory];
  }

  public getBundleStore(): StoreAndForwardBundle[] {
    return [...this.bundleStore];
  }

  public toggleSimulation(active: boolean) {
    this.simulationActive = active;
    if (!active) {
      for (const sim of this.simulatedNodes) {
        this.knownNodes.delete(sim.id);
      }
    } else {
      this.initSimulatedFleet();
    }
    this.notifyNodeListeners();
  }

  public isSimulationActive() {
    return this.simulationActive;
  }

  public updateLocalCallsign(callsign: string, role: MeshNode['role']) {
    if (!this.localNode) return;
    this.localNode.callsign = callsign;
    this.localNode.role = role;
    this.saveLocalProfile();
    this.broadcastBeacon();
    this.notifyNodeListeners();
  }

  public updateOperatorProfile(profile: {
    callsign?: string;
    role?: MeshNode['role'];
    operatorName?: string;
    teamId?: string;
    bloodType?: string;
  }) {
    if (!this.localNode) return;
    if (profile.callsign) this.localNode.callsign = profile.callsign;
    if (profile.role) this.localNode.role = profile.role;
    if (profile.operatorName !== undefined) this.localNode.operatorName = profile.operatorName;
    if (profile.teamId !== undefined) this.localNode.teamId = profile.teamId;
    if (profile.bloodType !== undefined) this.localNode.bloodType = profile.bloodType;

    this.saveLocalProfile();
    this.broadcastBeacon();
    this.notifyNodeListeners();
  }

  private saveLocalProfile() {
    if (!this.localNode) return;
    try {
      localStorage.setItem(
        LOCAL_NODE_STORAGE_KEY,
        JSON.stringify({
          callsign: this.localNode.callsign,
          role: this.localNode.role,
          operatorName: this.localNode.operatorName,
          teamId: this.localNode.teamId,
          bloodType: this.localNode.bloodType,
        })
      );
    } catch {}
  }

  public updateDeviceTelemetry(telemetry: {
    heading?: number;
    gpsAccuracy?: number;
    altitude?: number;
    speed?: number;
    batteryLevel?: number;
    lat?: number;
    lon?: number;
    gridRef?: string;
  }) {
    if (!this.localNode) return;
    if (telemetry.heading !== undefined) this.localNode.heading = telemetry.heading;
    if (telemetry.gpsAccuracy !== undefined) this.localNode.gpsAccuracy = telemetry.gpsAccuracy;
    if (telemetry.altitude !== undefined) this.localNode.altitude = telemetry.altitude;
    if (telemetry.speed !== undefined) this.localNode.speed = telemetry.speed;
    if (telemetry.batteryLevel !== undefined) this.localNode.batteryLevel = telemetry.batteryLevel;
    if (telemetry.lat !== undefined) this.localNode.coordinates.lat = telemetry.lat;
    if (telemetry.lon !== undefined) this.localNode.coordinates.lon = telemetry.lon;
    if (telemetry.gridRef !== undefined) this.localNode.coordinates.gridRef = telemetry.gridRef;

    this.broadcastBeacon();
    this.notifyNodeListeners();
  }

  public triggerDeviceHaptic(pattern: number[] = [120, 80, 120]) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  }

  public updateLocalCoordinates(x: number, y: number, gridRef?: string) {
    if (!this.localNode) return;
    this.localNode.coordinates.x = x;
    this.localNode.coordinates.y = y;
    if (gridRef) this.localNode.coordinates.gridRef = gridRef;
    this.broadcastBeacon();
    this.notifyNodeListeners();
  }
}

// Global Singleton Router Instance
export const meshRouter = new MeshRouter();
