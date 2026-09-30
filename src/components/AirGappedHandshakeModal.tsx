import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Camera,
  Copy,
  Check,
  X,
  Radio,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { meshRouter } from '../services/meshRouter';
import { MeshNode } from '../types/mesh';

interface AirGappedHandshakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  localNode: MeshNode | null;
}

export const AirGappedHandshakeModal: React.FC<AirGappedHandshakeModalProps> = ({
  isOpen,
  onClose,
  localNode,
}) => {
  const [tab, setTab] = useState<'create_offer' | 'scan_offer' | 'apply_answer'>('create_offer');
  const [offerToken, setOfferToken] = useState('');
  const [answerToken, setAnswerToken] = useState('');
  const [remoteTokenInput, setRemoteTokenInput] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Generate Offer when modal opens on create_offer tab
  useEffect(() => {
    if (isOpen && tab === 'create_offer' && meshRouter.webrtcManager) {
      generateOffer();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, tab]);

  const generateOffer = async () => {
    setStatusMessage('Generating WebRTC SDP Offer...');
    try {
      if (!meshRouter.webrtcManager) return;
      const token = await meshRouter.webrtcManager.createOffer();
      setOfferToken(token);

      // Render QR Code
      const dataUrl = await QRCode.toDataURL(token, {
        width: 280,
        margin: 1,
        color: {
          dark: '#080c14',
          light: '#38bdf8',
        },
      });
      setQrCodeDataUrl(dataUrl);
      setStatusMessage('Offer QR ready for peer to scan');
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Consume remote Offer and generate Answer
  const handleProcessOffer = async () => {
    if (!remoteTokenInput.trim() || !meshRouter.webrtcManager) return;
    setStatusMessage('Processing Offer and generating Answer...');

    try {
      const { answerToken: ans, remoteNode } = await meshRouter.webrtcManager.handleOfferAndCreateAnswer(
        remoteTokenInput.trim()
      );
      setAnswerToken(ans);

      // Render Answer QR
      const dataUrl = await QRCode.toDataURL(ans, {
        width: 280,
        margin: 1,
        color: {
          dark: '#080c14',
          light: '#34d399',
        },
      });
      setQrCodeDataUrl(dataUrl);
      setTab('apply_answer');
      setStatusMessage(`Answer created for ${remoteNode.callsign}. Show QR to peer.`);
    } catch (err: any) {
      setStatusMessage(`Failed: ${err.message}`);
    }
  };

  // Finalize pairing on Device 1 by consuming Device 2's Answer
  const handleApplyAnswer = async () => {
    if (!remoteTokenInput.trim() || !meshRouter.webrtcManager) return;
    setStatusMessage('Connecting direct P2P link...');

    try {
      const remote = await meshRouter.webrtcManager.applyAnswer(remoteTokenInput.trim());
      setStatusMessage(`SUCCESS: Direct P2P WebRTC link established with ${remote.callsign}!`);
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      setStatusMessage(`Failed: ${err.message}`);
    }
  };

  // Start Camera viewfinder
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (e) {
      setStatusMessage('Camera access unavailable. Use manual token paste below.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#090d16] border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-[#06080d]">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold tracking-wider uppercase font-['Chakra_Petch'] text-slate-100">
              Air-Gapped QR WebRTC Handshake
            </h3>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Workflow Tabs */}
        <div className="grid grid-cols-3 border-b border-slate-800 text-xs font-mono">
          <button
            onClick={() => {
              stopCamera();
              setTab('create_offer');
            }}
            className={`py-2.5 text-center transition-colors ${
              tab === 'create_offer'
                ? 'bg-cyan-950/60 text-cyan-300 border-b-2 border-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Create Offer
          </button>
          <button
            onClick={() => {
              stopCamera();
              setTab('scan_offer');
            }}
            className={`py-2.5 text-center transition-colors ${
              tab === 'scan_offer'
                ? 'bg-cyan-950/60 text-cyan-300 border-b-2 border-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Scan & Answer
          </button>
          <button
            onClick={() => {
              stopCamera();
              setTab('apply_answer');
            }}
            className={`py-2.5 text-center transition-colors ${
              tab === 'apply_answer'
                ? 'bg-cyan-950/60 text-cyan-300 border-b-2 border-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            3. Connect
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto max-h-[75vh] space-y-4">
          {tab === 'create_offer' && (
            <div className="flex flex-col items-center text-center">
              <p className="text-xs text-slate-400 mb-3">
                Point peer device camera at this QR code, or copy the handshake token to connect without internet.
              </p>

              {qrCodeDataUrl ? (
                <div className="p-3 bg-cyan-950/40 border border-cyan-500/50 rounded-xl shadow-lg">
                  <img
                    src={qrCodeDataUrl}
                    alt="Handshake QR"
                    className="w-56 h-56 rounded-lg block"
                  />
                </div>
              ) : (
                <div className="w-56 h-56 rounded-lg bg-slate-900 flex items-center justify-center text-slate-500 font-mono text-xs">
                  Generating QR...
                </div>
              )}

              {/* Copy Token Button */}
              <div className="mt-4 w-full flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={offerToken}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-400 font-mono truncate"
                />
                <button
                  onClick={() => handleCopy(offerToken)}
                  className="px-3 py-1.5 text-xs font-mono bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded flex items-center gap-1"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="mt-3 text-[11px] font-mono text-slate-500">
                After peer scans or pastes this, switch to Step 3 to paste their Answer.
              </div>
            </div>
          )}

          {tab === 'scan_offer' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                On the receiving device: scan the initiator's QR code or paste their token to generate an Answer.
              </p>

              {/* Camera Scanner Viewfinder */}
              <div className="relative border border-slate-800 rounded-lg overflow-hidden bg-black h-48 flex items-center justify-center">
                {isCameraActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 text-xs font-mono">
                    <Camera className="w-8 h-8 mb-2 text-slate-600" />
                    <span>Camera Viewfinder Inactive</span>
                  </div>
                )}

                <button
                  onClick={isCameraActive ? stopCamera : startCamera}
                  className="absolute bottom-2 right-2 px-2.5 py-1 text-[11px] font-mono rounded bg-slate-900/90 text-cyan-300 border border-slate-700"
                >
                  {isCameraActive ? 'Stop Camera' : 'Open Camera Viewfinder'}
                </button>
              </div>

              {/* Manual Token Paste */}
              <div>
                <label className="text-[10px] uppercase font-mono text-slate-500">
                  Or Paste Remote Device Offer Token:
                </label>
                <textarea
                  rows={3}
                  value={remoteTokenInput}
                  onChange={(e) => setRemoteTokenInput(e.target.value)}
                  placeholder="Paste base64 offer token here..."
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                onClick={handleProcessOffer}
                disabled={!remoteTokenInput.trim()}
                className="w-full py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 rounded transition-colors flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                Generate WebRTC Answer Token
              </button>
            </div>
          )}

          {tab === 'apply_answer' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Show the Answer QR to the initiating device, or paste the final Answer token on Device 1 to complete the zero-server link.
              </p>

              {answerToken && qrCodeDataUrl && (
                <div className="flex flex-col items-center">
                  <div className="p-2 bg-emerald-950/40 border border-emerald-500/50 rounded-lg">
                    <img
                      src={qrCodeDataUrl}
                      alt="Answer QR"
                      className="w-48 h-48 rounded block"
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-2 w-full">
                    <input
                      type="text"
                      readOnly
                      value={answerToken}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs font-mono text-slate-400 truncate"
                    />
                    <button
                      onClick={() => handleCopy(answerToken)}
                      className="px-2.5 py-1 text-xs font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 rounded"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <label className="text-[10px] uppercase font-mono text-slate-500">
                  On Initiator: Paste Received Answer Token:
                </label>
                <textarea
                  rows={2}
                  value={remoteTokenInput}
                  onChange={(e) => setRemoteTokenInput(e.target.value)}
                  placeholder="Paste Answer token here..."
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                onClick={handleApplyAnswer}
                disabled={!remoteTokenInput.trim()}
                className="w-full py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 rounded transition-colors flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Finalize Direct Link
              </button>
            </div>
          )}

          {/* Status Message Footer */}
          {statusMessage && (
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-300 flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
