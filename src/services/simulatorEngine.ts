import { SimNode, SimEdge, NetworkDensity } from '../types/simulator';

// Initial default nodes specified in user request
export const INITIAL_SIM_NODES: SimNode[] = [
  {
    id: 'node-kaif',
    name: 'Kaif',
    label: 'Kaif_Phone',
    role: 'Student',
    status: 'active',
    battery: 92,
    rangeMeters: 55,
    deviceId: 'DEV-KAI-001',
    x: 18,
    y: 65,
    macAddress: '8C:85:90:E1:2A:44',
    signalStrengthDbm: -52,
    queuedPacketsCount: 0,
  },
  {
    id: 'node-shruti',
    name: 'Shruti',
    label: 'Shruti_Phone',
    role: 'Triage Medic',
    status: 'active',
    battery: 87,
    rangeMeters: 50,
    deviceId: 'DEV-SHR-491',
    x: 35,
    y: 42,
    macAddress: 'F4:D4:88:9C:12:09',
    signalStrengthDbm: -58,
    queuedPacketsCount: 0,
  },
  {
    id: 'node-swarali',
    name: 'Swarali',
    label: 'Swarali_Phone',
    role: 'Relay Rover',
    status: 'active',
    battery: 78,
    rangeMeters: 50,
    deviceId: 'DEV-SWA-312',
    x: 52,
    y: 62,
    macAddress: '3C:06:30:4A:BC:88',
    signalStrengthDbm: -63,
    queuedPacketsCount: 0,
  },
  {
    id: 'node-gauri',
    name: 'Gauri',
    label: 'Gauri_Phone',
    role: 'Campus Security',
    status: 'active',
    battery: 95,
    rangeMeters: 55,
    deviceId: 'DEV-GAU-704',
    x: 68,
    y: 38,
    macAddress: '68:FE:F7:55:18:2D',
    signalStrengthDbm: -56,
    queuedPacketsCount: 0,
  },
  {
    id: 'node-vinal',
    name: 'Vinal',
    label: 'Vinal_Phone',
    role: 'Staff Lead',
    status: 'active',
    battery: 84,
    rangeMeters: 50,
    deviceId: 'DEV-VIN-819',
    x: 84,
    y: 55,
    macAddress: 'A0:C5:89:D4:51:7E',
    signalStrengthDbm: -61,
    queuedPacketsCount: 0,
  },
  // Adjacent supporting peer nodes in campus zone
  {
    id: 'node-rohan',
    name: 'Rohan',
    label: 'Rohan_Phone',
    role: 'Student',
    status: 'active',
    battery: 64,
    rangeMeters: 45,
    deviceId: 'DEV-ROH-220',
    x: 32,
    y: 82,
    macAddress: '90:B6:86:14:02:4A',
    signalStrengthDbm: -72,
    queuedPacketsCount: 0,
  },
  {
    id: 'node-aarav',
    name: 'Aarav',
    label: 'Aarav_Phone',
    role: 'Lab Coordinator',
    status: 'active',
    battery: 79,
    rangeMeters: 50,
    deviceId: 'DEV-AAR-518',
    x: 52,
    y: 20,
    macAddress: 'AC:7F:3E:99:40:11',
    signalStrengthDbm: -68,
    queuedPacketsCount: 0,
  },
  {
    id: 'node-ananya',
    name: 'Ananya',
    label: 'Ananya_Phone',
    role: 'Student',
    status: 'active',
    battery: 90,
    rangeMeters: 48,
    deviceId: 'DEV-ANA-633',
    x: 72,
    y: 78,
    macAddress: '58:B0:35:88:27:FF',
    signalStrengthDbm: -65,
    queuedPacketsCount: 0,
  },
];

// Canvas coordinate to meters conversion factor (approx. 1 canvas unit = 1.3 meters)
const METERS_PER_PERCENT = 1.3;

export function calculateDistanceMeters(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.round(Math.sqrt(dx * dx + dy * dy) * METERS_PER_PERCENT);
}

// Check if two nodes can communicate based on their transmission ranges
export function canCommunicate(a: SimNode, b: SimNode): boolean {
  if (a.status !== 'active' || b.status !== 'active') return false;
  const distance = calculateDistanceMeters(a, b);
  // Maximum effective link is within the average transmission range of both devices
  const maxRange = Math.max(a.rangeMeters, b.rangeMeters);
  return distance <= maxRange;
}

// Compute all candidate wireless peer edges
export function computeGraphEdges(nodes: SimNode[]): SimEdge[] {
  const edges: SimEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dist = calculateDistanceMeters(a, b);
      const inRange = dist <= Math.max(a.rangeMeters, b.rangeMeters);

      if (inRange) {
        // Calculate estimated RSSI
        const rssi = Math.round(-40 - (dist / 1.2));
        edges.push({
          fromId: a.id,
          toId: b.id,
          distanceMeters: dist,
          rssiDbm: Math.max(-95, rssi),
          inPath: false,
          broken: a.status !== 'active' || b.status !== 'active',
        });
      }
    }
  }
  return edges;
}

// Breadth-First-Search / Dijkstra shortest hop routing algorithm
export function findShortestPath(
  nodes: SimNode[],
  originId: string,
  destId: string,
  requireAllActive: boolean = true
): { path: string[]; found: boolean } {
  if (originId === destId) return { path: [originId], found: true };

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const originNode = nodeMap.get(originId);
  const destNode = nodeMap.get(destId);

  if (!originNode || !destNode) return { path: [], found: false };
  if (requireAllActive && (originNode.status !== 'active' || destNode.status !== 'active')) {
    return { path: [], found: false };
  }

  // Build Adjacency List
  const adj = new Map<string, Array<{ id: string; weight: number }>>();
  for (const node of nodes) {
    adj.set(node.id, []);
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const u = nodes[i];
      const v = nodes[j];
      const dist = calculateDistanceMeters(u, v);
      const reachable = dist <= Math.max(u.rangeMeters, v.rangeMeters);

      if (reachable) {
        if (!requireAllActive || (u.status === 'active' && v.status === 'active')) {
          adj.get(u.id)!.push({ id: v.id, weight: dist });
          adj.get(v.id)!.push({ id: u.id, weight: dist });
        }
      }
    }
  }

  // Dijkstra / BFS for shortest hop path
  const queue: string[] = [originId];
  const visited = new Set<string>([originId]);
  const parent = new Map<string, string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === destId) {
      // Reconstruct path
      const path: string[] = [];
      let curr: string | undefined = destId;
      while (curr) {
        path.unshift(curr);
        curr = parent.get(curr);
      }
      return { path, found: true };
    }

    const neighbors = adj.get(current) || [];
    // Sort neighbors by shortest distance
    neighbors.sort((a, b) => a.weight - b.weight);

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.id)) {
        visited.add(neighbor.id);
        parent.set(neighbor.id, current);
        queue.push(neighbor.id);
      }
    }
  }

  return { path: [], found: false };
}

// Compute Network Density Index
export function calculateNetworkDensity(nodes: SimNode[]): { index: NetworkDensity; score: number } {
  const activeNodes = nodes.filter((n) => n.status === 'active');
  if (activeNodes.length <= 3) return { index: 'Sparse', score: 32 };

  let totalActiveEdges = 0;
  for (let i = 0; i < activeNodes.length; i++) {
    for (let j = i + 1; j < activeNodes.length; j++) {
      if (canCommunicate(activeNodes[i], activeNodes[j])) {
        totalActiveEdges++;
      }
    }
  }

  const possibleEdges = (activeNodes.length * (activeNodes.length - 1)) / 2;
  const ratio = possibleEdges > 0 ? totalActiveEdges / possibleEdges : 0;

  if (activeNodes.length >= 6 && ratio >= 0.3) {
    return { index: 'Robust', score: Math.round(ratio * 100) };
  } else if (activeNodes.length >= 4 && ratio >= 0.18) {
    return { index: 'Moderate', score: Math.round(ratio * 100) };
  }
  return { index: 'Sparse', score: Math.round(ratio * 100) };
}

// Calculate Average Hop Efficiency across all active pairs
export function calculateAverageHopEfficiency(nodes: SimNode[]): number {
  const active = nodes.filter((n) => n.status === 'active');
  if (active.length < 2) return 1.0;

  let totalHops = 0;
  let reachablePairs = 0;

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const res = findShortestPath(nodes, active[i].id, active[j].id, true);
      if (res.found && res.path.length > 1) {
        totalHops += res.path.length - 1;
        reachablePairs++;
      }
    }
  }

  if (reachablePairs === 0) return 0;
  return Number((totalHops / reachablePairs).toFixed(1));
}
