export type SimNodeStatus = 'active' | 'dead' | 'out_of_range';

export interface SimNode {
  id: string;
  name: string;
  label: string; // e.g. "Shruti_Phone"
  role: 'Student' | 'Triage Medic' | 'Campus Security' | 'Relay Rover' | 'Lab Coordinator' | 'Staff Lead';
  status: SimNodeStatus;
  battery: number; // 0 - 100
  rangeMeters: number; // e.g., 50 meters
  deviceId: string; // e.g., "DEV-SHR-491"
  x: number; // canvas percentage 0..100
  y: number; // canvas percentage 0..100
  macAddress: string;
  signalStrengthDbm: number; // -45 to -90
  queuedPacketsCount: number;
}

export interface SimEdge {
  fromId: string;
  toId: string;
  distanceMeters: number;
  rssiDbm: number;
  inPath: boolean;
  broken: boolean;
}

export interface TransmissionLogEntry {
  id: string;
  timestamp: string;
  type: 'INFO' | 'ROUTING' | 'HOP' | 'SUCCESS' | 'ERROR' | 'ALERT';
  message: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  hopNumber?: number;
}

export type TransmissionPhase = 
  | 'idle' 
  | 'discovering_rreq' 
  | 'returning_rrep' 
  | 'transmitting_data' 
  | 'success' 
  | 'failed' 
  | 'recalculating';

export interface TransmissionState {
  isTransmitting: boolean;
  isPaused: boolean;
  originId: string;
  destId: string;
  currentHopIndex: number;
  plannedPath: string[]; // sequence of node IDs
  activeEdge: { from: string; to: string } | null;
  messageText: string;
  status: 'idle' | 'routing' | 'success' | 'failed';
  phase: TransmissionPhase;
  failureReason?: string;
  failedNodeId?: string;
  packetProgress: number; // 0 to 1 for visual animation
  totalHops: number;
  deliveryLatencyMs: number;
  discoveryWaveRadius?: number; // for RREQ animation 0..100
  lastDeliveredMessage?: {
    text: string;
    fromName: string;
    toName: string;
    hops: number;
    timestamp: string;
  } | null;
}

export type NetworkDensity = 'Sparse' | 'Moderate' | 'Robust';

