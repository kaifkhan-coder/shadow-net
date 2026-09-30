/**
 * Serverless Zero-Internet WebRTC DataChannel Manager
 * Enables direct P2P mesh links between air-gapped physical devices via QR code / manual token exchange.
 */

export interface WebRtcHandshakeToken {
  type: 'offer' | 'answer';
  sdp: string;
  nodeId: string;
  callsign: string;
  timestamp: number;
}

export class WebRtcLinkManager {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private onMessageCallback: ((data: string) => void) | null = null;
  private onStateChangeCallback: ((state: 'connecting' | 'connected' | 'disconnected') => void) | null = null;
  private remoteNodeInfo: { nodeId: string; callsign: string } | null = null;

  constructor(
    private localNodeId: string,
    private localCallsign: string
  ) {}

  public setCallbacks(
    onMessage: (data: string) => void,
    onStateChange: (state: 'connecting' | 'connected' | 'disconnected') => void
  ) {
    this.onMessageCallback = onMessage;
    this.onStateChangeCallback = onStateChange;
  }

  // Create an Offer token for another node to scan
  public async createOffer(): Promise<string> {
    this.cleanup();

    // Use zero external STUN in pure offline mode or minimal default
    const pc = new RTCPeerConnection({
      iceServers: [],
      iceCandidatePoolSize: 0,
    });
    this.peerConnection = pc;

    // Create Data Channel
    const dc = pc.createDataChannel('shadow-mesh', {
      ordered: true,
    });
    this.setupDataChannel(dc);

    // Track state
    pc.oniceconnectionstatechange = () => {
      this.handleConnectionStateChange(pc.iceConnectionState);
    };

    // Create SDP Offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait briefly for local host ICE candidates to gather
    await this.waitForIceGatheringComplete(pc);

    const token: WebRtcHandshakeToken = {
      type: 'offer',
      sdp: pc.localDescription?.sdp || offer.sdp || '',
      nodeId: this.localNodeId,
      callsign: this.localCallsign,
      timestamp: Date.now(),
    };

    return btoa(JSON.stringify(token));
  }

  // Process an Offer from a remote node and generate an Answer token
  public async handleOfferAndCreateAnswer(offerTokenBase64: string): Promise<{ answerToken: string; remoteNode: { nodeId: string; callsign: string } }> {
    this.cleanup();

    const decodedStr = atob(offerTokenBase64.trim());
    const token: WebRtcHandshakeToken = JSON.parse(decodedStr);

    if (token.type !== 'offer') {
      throw new Error('Provided token is not an SDP Offer.');
    }

    this.remoteNodeInfo = {
      nodeId: token.nodeId,
      callsign: token.callsign,
    };

    const pc = new RTCPeerConnection({
      iceServers: [],
      iceCandidatePoolSize: 0,
    });
    this.peerConnection = pc;

    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };

    pc.oniceconnectionstatechange = () => {
      this.handleConnectionStateChange(pc.iceConnectionState);
    };

    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: token.sdp }));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await this.waitForIceGatheringComplete(pc);

    const answerToken: WebRtcHandshakeToken = {
      type: 'answer',
      sdp: pc.localDescription?.sdp || answer.sdp || '',
      nodeId: this.localNodeId,
      callsign: this.localCallsign,
      timestamp: Date.now(),
    };

    return {
      answerToken: btoa(JSON.stringify(answerToken)),
      remoteNode: this.remoteNodeInfo,
    };
  }

  // Finalize connection by consuming Answer token
  public async applyAnswer(answerTokenBase64: string): Promise<{ nodeId: string; callsign: string }> {
    if (!this.peerConnection) {
      throw new Error('No active peer connection to apply answer to.');
    }

    const decodedStr = atob(answerTokenBase64.trim());
    const token: WebRtcHandshakeToken = JSON.parse(decodedStr);

    if (token.type !== 'answer') {
      throw new Error('Provided token is not an SDP Answer.');
    }

    this.remoteNodeInfo = {
      nodeId: token.nodeId,
      callsign: token.callsign,
    };

    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription({ type: 'answer', sdp: token.sdp })
    );

    return this.remoteNodeInfo;
  }

  // Setup channel event handlers
  private setupDataChannel(dc: RTCDataChannel) {
    this.dataChannel = dc;

    dc.onopen = () => {
      if (this.onStateChangeCallback) this.onStateChangeCallback('connected');
    };

    dc.onclose = () => {
      if (this.onStateChangeCallback) this.onStateChangeCallback('disconnected');
    };

    dc.onmessage = (event) => {
      if (this.onMessageCallback && typeof event.data === 'string') {
        this.onMessageCallback(event.data);
      }
    };
  }

  private handleConnectionStateChange(state: RTCIceConnectionState) {
    if (!this.onStateChangeCallback) return;
    if (state === 'connected' || state === 'completed') {
      this.onStateChangeCallback('connected');
    } else if (state === 'checking') {
      this.onStateChangeCallback('connecting');
    } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
      this.onStateChangeCallback('disconnected');
    }
  }

  private waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };

      pc.addEventListener('icegatheringstatechange', checkState);
      // Fallback timeout in case ice candidates stall
      setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }, 1200);
    });
  }

  // Send packet across WebRTC link
  public send(dataStr: string): boolean {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(dataStr);
      return true;
    }
    return false;
  }

  public isConnected(): boolean {
    return this.dataChannel?.readyState === 'open';
  }

  public getRemoteNode() {
    return this.remoteNodeInfo;
  }

  public cleanup() {
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {}
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }
  }
}
