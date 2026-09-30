import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Radio,
  Zap,
  Activity,
  Play,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { globalAcousticModem } from '../services/acoustic';
import { meshRouter } from '../services/meshRouter';
import { MeshNode } from '../types/mesh';

interface AcousticModemViewProps {
  localNode: MeshNode | null;
}

export const AcousticModemView: React.FC<AcousticModemViewProps> = ({ localNode }) => {
  const [isListening, setIsListening] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [transmitProgress, setTransmitProgress] = useState(0);
  const [inputText, setInputText] = useState('SOS: APEX-SCOUT REQ WATER GR-4829');
  const [receivedAcousticPackets, setReceivedAcousticPackets] = useState<
    Array<{ text: string; timestamp: number }>
  >([]);
  const [detectedBit, setDetectedBit] = useState<{ bit: number; freq: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Setup acoustic callbacks
  const handleToggleListening = async () => {
    if (isListening) {
      globalAcousticModem.stopListening();
      setIsListening(false);
    } else {
      const started = await globalAcousticModem.startListening({
        onPacketReceived: (decodedText) => {
          setReceivedAcousticPackets((prev) => [
            { text: decodedText, timestamp: Date.now() },
            ...prev,
          ]);

          // Broadcast decoded packet into the mesh router!
          meshRouter.sendPacket({
            type: 'sos',
            channel: '#emergency-sos',
            priority: 'SOS',
            payload: `[ACOUSTIC AUDIO PACKET DECODED] ${decodedText}`,
          });
        },
        onBitDetected: (bit, freq) => {
          setDetectedBit({ bit, freq });
        },
        onSpectrumUpdate: (freqData) => {
          renderSpectrum(freqData);
        },
      });

      setIsListening(started);
    }
  };

  // Render FFT Audio Spectrum onto Canvas
  const renderSpectrum = (freqData: Uint8Array) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#06080d';
    ctx.fillRect(0, 0, width, height);

    // Draw baseline grid
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.15)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const barWidth = (width / freqData.length) * 2.5;
    let x = 0;

    for (let i = 0; i < freqData.length / 2; i++) {
      const barHeight = (freqData[i] / 255) * height;

      // Highlight target frequencies (1850Hz and 2250Hz bands)
      const isTargetBand = i > 35 && i < 60;
      ctx.fillStyle = isTargetBand ? '#06b6d4' : '#1e293b';

      ctx.fillRect(x, height - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }
  };

  const handleTransmitBurst = async () => {
    if (isTransmitting || !inputText.trim()) return;
    setIsTransmitting(true);
    setTransmitProgress(0);

    try {
      await globalAcousticModem.transmitPayload(inputText.trim(), (pct) => {
        setTransmitProgress(pct);
      });
    } finally {
      setIsTransmitting(false);
      setTransmitProgress(0);
    }
  };

  const handlePlayTestChirp = () => {
    globalAcousticModem.playAcousticPing(1850, 200);
    setTimeout(() => globalAcousticModem.playAcousticPing(2250, 200), 220);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      globalAcousticModem.stopListening();
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-57px)] overflow-hidden bg-[#06080d]">
      {/* Left: Spectrum Visualizer & Controls */}
      <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 p-6 overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold font-['Chakra_Petch'] text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Acoustic Sound-Modem Transceiver
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Physical audio-frequency air-gap for zero-radio and complete blackout scenarios.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayTestChirp}
              className="px-3 py-1.5 text-xs font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded transition-colors flex items-center gap-1.5"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Test Audio Tone
            </button>
          </div>
        </div>

        {/* Live FFT Audio Spectrum Canvas */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
            <span>Real-Time FFT Waterfall Spectrogram</span>
            <span className="text-cyan-400">Mark: 1850Hz · Space: 2250Hz</span>
          </div>

          <div className="relative border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
            <canvas
              ref={canvasRef}
              width={640}
              height={180}
              className="w-full h-44 block"
            />

            {!isListening && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[1px] text-xs font-mono text-slate-400">
                <MicOff className="w-6 h-6 text-slate-500 mb-2" />
                <span>Microphone demodulator inactive</span>
                <span className="text-[11px] text-slate-500 mt-0.5">
                  Click 'Listen on Mic' to monitor room audio for incoming acoustic packets
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Transceiver Mode Controls */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Audio Transmitter Box */}
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider font-['Chakra_Petch'] text-cyan-300">
                <span>FSK Acoustic Transmitter</span>
                <Volume2 className="w-4 h-4" />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Encodes data into audible sound waves played through your speaker.
              </p>

              <div className="mt-3">
                <label className="text-[10px] uppercase font-mono text-slate-500">
                  Micro-Packet String Payload:
                </label>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Emergency message payload"
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              {isTransmitting && (
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] font-mono text-cyan-400 mb-1">
                    <span>Modulating Sound Waves...</span>
                    <span>{transmitProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-150"
                      style={{ width: `${transmitProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleTransmitBurst}
              disabled={isTransmitting || !inputText.trim()}
              className="mt-4 w-full py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 rounded transition-colors flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {isTransmitting ? 'Transmitting Audio Burst...' : 'Transmit Audio Packet'}
            </button>
          </div>

          {/* Audio Receiver Demodulator Box */}
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider font-['Chakra_Petch'] text-cyan-300">
                <span>Acoustic Mic Listener</span>
                <Mic className="w-4 h-4" />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Listens via microphone for physical sound bursts from other devices.
              </p>

              <div className="mt-4 p-3 bg-slate-950/80 border border-slate-800/80 rounded text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Demodulator State:</span>
                  <span className={isListening ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                    {isListening ? '● LISTENING' : 'OFFLINE'}
                  </span>
                </div>
                {detectedBit && isListening && (
                  <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between text-cyan-300">
                    <span>Detected Bit: {detectedBit.bit}</span>
                    <span>{detectedBit.freq} Hz</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleToggleListening}
              className={`mt-4 w-full py-2.5 px-4 text-xs font-semibold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1.5 ${
                isListening
                  ? 'bg-rose-900 hover:bg-rose-800 text-rose-200 border border-rose-700'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-3.5 h-3.5" /> Stop Listening
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" /> Start Listening on Mic
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Right: Decoded Acoustic Transmissions Stream */}
      <div className="w-full lg:w-80 xl:w-96 flex flex-col bg-[#090d16] border-t lg:border-t-0 border-slate-800 p-5 overflow-y-auto">
        <div className="pb-3 border-b border-slate-800">
          <h2 className="text-sm font-semibold tracking-wider uppercase font-['Chakra_Petch'] text-slate-200">
            Acoustic Packet Log
          </h2>
          <div className="text-xs font-mono text-slate-500 mt-0.5">
            Decoded Sound Air-Gap Packets
          </div>
        </div>

        <div className="mt-4 space-y-3 flex-1 overflow-y-auto">
          {receivedAcousticPackets.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-slate-500">
              No acoustic packets detected yet. Transmit an audio burst or listen to an adjacent phone speaker.
            </div>
          ) : (
            receivedAcousticPackets.map((pkt, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg text-xs font-mono space-y-1"
              >
                <div className="flex items-center justify-between text-slate-500 text-[10px]">
                  <span>ACOUSTIC-AIRGAP</span>
                  <span>{new Date(pkt.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-slate-200 font-sans font-medium">{pkt.text}</div>
                <div className="text-emerald-400 text-[10px] flex items-center gap-1 mt-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Framed & Checksum Verified
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
