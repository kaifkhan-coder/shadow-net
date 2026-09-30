export type NodeRole = 'mobile' | 'relay' | 'shelter' | 'medical' | 'command';

export type MeshPacketPriority = 'SOS' | 'HIGH' | 'ROUTINE';

export type PacketType = 'chat' | 'sos' | 'beacon' | 'ack' | 'telemetry' | 'route_announcement';

export interface GeoLocation {
  lat: number;
  lon: number;
  gridRef?: string;
  altitude?: number;
}

export interface SosDetails {
  urgency: 'critical' | 'severe' | 'moderate';
  headcount: number;
  needs: string[];
  medicalAttention: boolean;
  suppliesNeeded: string;
}

export interface MeshPacket {
  id: string;
  version: number;
  type: PacketType;
  originNodeId: string;
  originCallsign: string;
  targetNodeId: string; // "BROADCAST" or specific Node ID
  channel: string; // e.g. '#emergency-sos', '#medical-triage', '#infrastructure', 'DIRECT'
  priority: MeshPacketPriority;
  hopCount: number;
  maxHops: number;
  ttl: number; // expiry epoch in ms
  timestamp: number;
  routeHistory: string[];
  payload: string;
  encrypted: boolean;
  signature?: string;
  publicKey?: string; // base64 export for verification
  tamperVerified?: boolean;
  location?: GeoLocation;
  sosDetails?: SosDetails;
  sizeBytes?: number;
}

export interface MeshNode {
  id: string;
  callsign: string;
  role: NodeRole;
  fingerprint: string;
  batteryLevel: number;
  isLocal: boolean;
  transport: 'broadcast' | 'webrtc' | 'acoustic' | 'simulated';
  rssi: number; // in dBm (-100 to -40)
  lastSeen: number;
  status: 'online' | 'relay_only' | 'degraded' | 'offline';
  coordinates: {
    x: number; // canvas percentage 0..100
    y: number; // canvas percentage 0..100
    lat?: number;
    lon?: number;
    gridRef?: string;
  };
  storedBundlesCount: number;
  relayedPacketsCount: number;
  peerConnectionState?: 'connected' | 'connecting' | 'disconnected' | 'none';
  isRealDevice?: boolean;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  userAgent?: string;
  operatorName?: string;
  teamId?: string;
  bloodType?: string;
  heading?: number;
  gpsAccuracy?: number;
  altitude?: number;
  speed?: number;
  torchActive?: boolean;
}

export interface RoutingEntry {
  destinationNodeId: string;
  nextHopNodeId: string;
  hopDistance: number;
  signalRssi: number;
  transport: string;
  updatedAt: number;
}

export interface StoreAndForwardBundle {
  packet: MeshPacket;
  receivedAt: number;
  forwardAttempts: number;
  delivered: boolean;
  ackReceived: boolean;
}

export type TacticalTheme = 'tactical' | 'crimson_night' | 'amber_hud';

export interface ActiveTransmissionPulse {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  progress: number; // 0..1
  priority: MeshPacketPriority;
  timestamp: number;
}
