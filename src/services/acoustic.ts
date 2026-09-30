/**
 * Acoustic Sound-Modem Transceiver (Web Audio API)
 * Emergency air-gapped data transmission via physical sound waves (FSK Audio Modem)
 * for situations where RF, cellular, and Wi-Fi networks are completely disrupted.
 */

// Audio FSK Modulation Parameters
const FREQ_MARK = 1850;   // 1850 Hz represents binary '1'
const FREQ_SPACE = 2250;  // 2250 Hz represents binary '0'
const FREQ_SYNC = 1500;   // 1500 Hz preamble alert chirp
const BIT_DURATION_SEC = 0.045; // ~22 baud, reliable across laptop/phone speakers & mics

export interface AcousticDemodulatorCallbacks {
  onPacketReceived: (decodedText: string) => void;
  onBitDetected?: (bit: number, freq: number) => void;
  onSpectrumUpdate?: (frequencyData: Uint8Array) => void;
}

export class AcousticModem {
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private isListening = false;
  private listenIntervalId: number | null = null;
  private isTransmitting = false;

  // Initialize or get active AudioContext
  private getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Transmit a string payload as physical sound waves through the speaker
  public async transmitPayload(payloadStr: string, onProgress?: (percent: number) => void): Promise<void> {
    if (this.isTransmitting) return;
    this.isTransmitting = true;

    try {
      const ctx = this.getAudioContext();
      const textEncoder = new TextEncoder();
      const rawBytes = textEncoder.encode(payloadStr);

      // Frame format: [0xAA, 0x55, length, ...bytes, checksum]
      const frame: number[] = [0xaa, 0x55, rawBytes.length];
      let checksum = 0;
      for (let i = 0; i < rawBytes.length; i++) {
        frame.push(rawBytes[i]);
        checksum = (checksum + rawBytes[i]) & 0xff;
      }
      frame.push(checksum);

      // Convert frame bytes into bit array
      const bits: number[] = [];
      for (const byte of frame) {
        for (let b = 7; b >= 0; b--) {
          bits.push((byte >> b) & 1);
        }
      }

      const totalBits = bits.length;
      const startTime = ctx.currentTime + 0.1;

      // Master gain
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.001, startTime);
      gainNode.connect(ctx.destination);

      // Preamble sweep: 1500Hz -> 2300Hz
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.connect(gainNode);

      // Fade in
      gainNode.gain.exponentialRampToValueAtTime(0.25, startTime + 0.05);

      // Preamble chirp
      osc.frequency.setValueAtTime(FREQ_SYNC, startTime);
      osc.frequency.exponentialRampToValueAtTime(FREQ_SPACE, startTime + 0.18);

      let currentTime = startTime + 0.22;

      // Modulate each bit via FSK
      for (let i = 0; i < bits.length; i++) {
        const bit = bits[i];
        const freq = bit === 1 ? FREQ_MARK : FREQ_SPACE;
        osc.frequency.setValueAtTime(freq, currentTime);
        currentTime += BIT_DURATION_SEC;
      }

      // Fade out
      gainNode.gain.setValueAtTime(0.25, currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, currentTime + 0.08);

      osc.start(startTime);
      osc.stop(currentTime + 0.1);

      // Track progress timer
      const totalDurationMs = (currentTime + 0.1 - startTime) * 1000;
      const startMs = Date.now();

      await new Promise<void>((resolve) => {
        const timer = setInterval(() => {
          const elapsed = Date.now() - startMs;
          const p = Math.min(100, Math.round((elapsed / totalDurationMs) * 100));
          if (onProgress) onProgress(p);

          if (elapsed >= totalDurationMs) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    } finally {
      this.isTransmitting = false;
      if (onProgress) onProgress(100);
    }
  }

  // Play a brief audible acoustic ping
  public playAcousticPing(freq = 1760, durationMs = 180): void {
    try {
      const ctx = this.getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch (e) {
      console.warn('Audio ping error:', e);
    }
  }

  // Start listening to acoustic microphone for incoming FSK data & spectrum
  public async startListening(callbacks: AcousticDemodulatorCallbacks): Promise<boolean> {
    if (this.isListening) return true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.micStream = stream;
      const ctx = this.getAudioContext();
      const source = ctx.createMediaStreamSource(stream);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);

      this.analyser = analyser;
      this.isListening = true;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const sampleRate = ctx.sampleRate;
      const hzPerBin = sampleRate / analyser.fftSize;

      // Bin indexes for Mark (1850Hz) and Space (2250Hz)
      const markBin = Math.round(FREQ_MARK / hzPerBin);
      const spaceBin = Math.round(FREQ_SPACE / hzPerBin);

      let bitBuffer: number[] = [];
      let lastPreambleDetectedAt = 0;

      this.listenIntervalId = window.setInterval(() => {
        if (!this.analyser || !this.isListening) return;

        analyser.getByteFrequencyData(dataArray);

        if (callbacks.onSpectrumUpdate) {
          callbacks.onSpectrumUpdate(dataArray);
        }

        // Detect energy in Mark vs Space bands
        const markEnergy = (dataArray[markBin - 1] + dataArray[markBin] + dataArray[markBin + 1]) / 3;
        const spaceEnergy = (dataArray[spaceBin - 1] + dataArray[spaceBin] + dataArray[spaceBin + 1]) / 3;

        // If sufficient acoustic signal above ambient threshold
        if (markEnergy > 90 || spaceEnergy > 90) {
          const bit = markEnergy > spaceEnergy ? 1 : 0;
          bitBuffer.push(bit);

          if (callbacks.onBitDetected) {
            callbacks.onBitDetected(bit, bit === 1 ? FREQ_MARK : FREQ_SPACE);
          }

          // Keep bit buffer bounded
          if (bitBuffer.length > 512) {
            bitBuffer.shift();
          }

          // Scan for preamble 0xAA 0x55 (10101010 01010101)
          if (bitBuffer.length >= 24) {
            this.tryDecodeFrame(bitBuffer, callbacks);
          }
        }
      }, 40);

      return true;
    } catch (err) {
      console.warn('Microphone permission or audio error:', err);
      this.isListening = false;
      return false;
    }
  }

  // Attempt to parse binary frame from received bits
  private tryDecodeFrame(bitBuffer: number[], callbacks: AcousticDemodulatorCallbacks): void {
    // Quick search for preamble
    for (let i = 0; i <= bitBuffer.length - 24; i++) {
      let b1 = 0;
      let b2 = 0;
      for (let j = 0; j < 8; j++) b1 = (b1 << 1) | bitBuffer[i + j];
      for (let j = 0; j < 8; j++) b2 = (b2 << 1) | bitBuffer[i + 8 + j];

      if (b1 === 0xaa && b2 === 0x55) {
        // Found preamble
        let len = 0;
        for (let j = 0; j < 8; j++) len = (len << 1) | bitBuffer[i + 16 + j];

        const neededBits = 24 + (len + 1) * 8;
        if (bitBuffer.length >= i + neededBits) {
          const payloadBytes: number[] = [];
          for (let p = 0; p < len; p++) {
            let byteVal = 0;
            const offset = i + 24 + p * 8;
            for (let j = 0; j < 8; j++) byteVal = (byteVal << 1) | bitBuffer[offset + j];
            payloadBytes.push(byteVal);
          }

          // Checksum
          let expectedSum = 0;
          for (let p = 0; p < len; p++) expectedSum = (expectedSum + payloadBytes[p]) & 0xff;
          let actualSum = 0;
          const sumOffset = i + 24 + len * 8;
          for (let j = 0; j < 8; j++) actualSum = (actualSum << 1) | bitBuffer[sumOffset + j];

          if (expectedSum === actualSum && len > 0) {
            try {
              const decoder = new TextDecoder();
              const text = decoder.decode(new Uint8Array(payloadBytes));
              callbacks.onPacketReceived(text);
              // Clear decoded bits to prevent duplicate triggers
              bitBuffer.splice(0, i + neededBits);
              break;
            } catch (e) {
              // Non-fatal parse attempt
            }
          }
        }
      }
    }
  }

  // Stop listening
  public stopListening(): void {
    this.isListening = false;
    if (this.listenIntervalId !== null) {
      clearInterval(this.listenIntervalId);
      this.listenIntervalId = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
  }

  public getActiveState() {
    return {
      isListening: this.isListening,
      isTransmitting: this.isTransmitting,
    };
  }
}

export const globalAcousticModem = new AcousticModem();
