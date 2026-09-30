import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  Tablet,
  Laptop,
  Radio,
  Compass,
  Navigation,
  Battery,
  ShieldCheck,
  Zap,
  Volume2,
  Share2,
  Users,
  QrCode,
  Flashlight,
  Vibrate,
  MapPin,
  Send,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  Sliders,
  AlertTriangle,
  UserCheck,
  Flame,
  Droplets,
  Heart,
} from 'lucide-react';
import { MeshNode, MeshPacketPriority } from '../types/mesh';
import { meshRouter } from '../services/meshRouter';

interface RealMobileUsersViewProps {
  nodes: MeshNode[];
  localNode: MeshNode | null;
  onSelectNodeForWhisper: (targetNodeId: string) => void;
  onOpenHandshakeModal: () => void;
}

export const RealMobileUsersView: React.FC<RealMobileUsersViewProps> = ({
  nodes,
  localNode,
  onSelectNodeForWhisper,
  onOpenHandshakeModal,
}) => {
  // Mobile Quick Onboarding QR
  const [appUrlQr, setAppUrlQr] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Live GPS Telemetry
  const [isGpsTracking, setIsGpsTracking] = useState(false);
  const [gpsData, setGpsData] = useState<{
    lat: number;
    lon: number;
    accuracy?: number;
    altitude?: number;
    speed?: number;
    gridRef?: string;
  } | null>(null);
  const gpsWatchIdRef = useRef<number | null>(null);

  // Live Compass / Orientation
  const [headingDeg, setHeadingDeg] = useState<number>(localNode?.heading ?? 0);
  const [isCompassActive, setIsCompassActive] = useState(false);

  // Hardware Torch / Strobe
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isStrobing, setIsStrobing] = useState(false);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const strobeIntervalRef = useRef<number | null>(null);

  // Operator Profile State
  const [operatorName, setOperatorName] = useState(localNode?.operatorName || 'Scout-Alpha');
  const [callsign, setCallsign] = useState(localNode?.callsign || 'Apex-Scout');
  const [teamId, setTeamId] = useState(localNode?.teamId || 'SAR-Team-Echo');
  const [bloodType, setBloodType] = useState(localNode?.bloodType || 'O+ POS');
  const [role, setRole] = useState<MeshNode['role']>(localNode?.role || 'mobile');
  const [isProfileSaved, setIsProfileSaved] = useState(false);

  // Directory filter: 'all' | 'real_mobile' | 'simulated'
  const [peerFilter, setPeerFilter] = useState<'real_mobile' | 'all' | 'simulated'>('real_mobile');
  const [searchQuery, setSearchQuery] = useState('');

  // Generate QR for connecting other mobile devices to this app instance
  useEffect(() => {
    const currentUrl = window.location.href;
    QRCode.toDataURL(currentUrl, {
      width: 260,
      margin: 1.5,
      color: {
        dark: '#080c14',
        light: '#38bdf8',
      },
    })
      .then((dataUrl) => setAppUrlQr(dataUrl))
      .catch((err) => console.warn('QR generation error:', err));
  }, []);

  // Sync profile when localNode is ready
  useEffect(() => {
    if (localNode) {
      if (localNode.callsign) setCallsign(localNode.callsign);
      if (localNode.operatorName) setOperatorName(localNode.operatorName);
      if (localNode.teamId) setTeamId(localNode.teamId);
      if (localNode.bloodType) setBloodType(localNode.bloodType);
      if (localNode.role) setRole(localNode.role);
    }
  }, [localNode]);

  // Clean up GPS and torch on unmount
  useEffect(() => {
    return () => {
      stopGpsTracking();
      stopTorchAndStrobe();
    };
  }, []);

  // Real GPS Geolocation Tracking
  const toggleGpsTracking = () => {
    if (isGpsTracking) {
      stopGpsTracking();
    } else {
      startGpsTracking();
    }
  };

  const startGpsTracking = () => {
    if (!('geolocation' in navigator)) {
      alert('Geolocation API not supported in this browser.');
      return;
    }

    setIsGpsTracking(true);
    gpsWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, altitude, speed } = pos.coords;
        // Calculate tactical grid reference
        const gridRef = `MGRS 10S-${Math.round(latitude * 100) % 1000}-${Math.round(Math.abs(longitude) * 100) % 1000}`;

        const data = {
          lat: latitude,
          lon: longitude,
          accuracy: accuracy ? Math.round(accuracy * 10) / 10 : undefined,
          altitude: altitude ? Math.round(altitude) : undefined,
          speed: speed ? Math.round(speed * 3.6) : undefined, // km/h
          gridRef,
        };
        setGpsData(data);

        // Update mesh router local node coordinates
        meshRouter.updateDeviceTelemetry({
          lat: latitude,
          lon: longitude,
          gridRef,
          gpsAccuracy: data.accuracy,
          altitude: data.altitude,
          speed: data.speed,
        });
      },
      (err) => {
        console.warn('GPS position error:', err);
        setIsGpsTracking(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );
  };

  const stopGpsTracking = () => {
    if (gpsWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
    setIsGpsTracking(false);
  };

  // Real Device Orientation / Digital Compass
  const toggleCompass = () => {
    if (isCompassActive) {
      window.removeEventListener('deviceorientation', handleOrientation);
      setIsCompassActive(false);
    } else {
      if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
        // iOS 13+ permission flow
        (DeviceOrientationEvent as any)
          .requestPermission()
          .then((res: string) => {
            if (res === 'granted') {
              window.addEventListener('deviceorientation', handleOrientation);
              setIsCompassActive(true);
            }
          })
          .catch(console.warn);
      } else {
        window.addEventListener('deviceorientation', handleOrientation);
        setIsCompassActive(true);
      }
    }
  };

  const handleOrientation = (e: DeviceOrientationEvent) => {
    let heading = e.alpha;
    // Check for webkitCompassHeading (iOS true magnetic north)
    if ((e as any).webkitCompassHeading !== undefined) {
      heading = (e as any).webkitCompassHeading;
    }
    if (heading !== null && heading !== undefined) {
      const rounded = Math.round(heading);
      setHeadingDeg(rounded);
      meshRouter.updateDeviceTelemetry({ heading: rounded });
    }
  };

  // Hardware Torch / Camera Flashlight
  const toggleTorch = async () => {
    if (isTorchOn) {
      stopTorchAndStrobe();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        const track = stream.getVideoTracks()[0];
        videoTrackRef.current = track;

        // Try applying torch capability
        const capabilities: any = track.getCapabilities?.();
        if (capabilities && capabilities.torch) {
          await (track as any).applyConstraints({ advanced: [{ torch: true }] });
          setIsTorchOn(true);
        } else {
          // Visual screen flash fallback
          setIsTorchOn(true);
        }
      } catch (e) {
        // Screen flashlight fallback
        setIsTorchOn(true);
      }
    }
  };

  const toggleStrobeSos = () => {
    if (isStrobing) {
      if (strobeIntervalRef.current !== null) {
        clearInterval(strobeIntervalRef.current);
        strobeIntervalRef.current = null;
      }
      setIsStrobing(false);
      stopTorchAndStrobe();
    } else {
      setIsStrobing(true);
      let state = false;
      strobeIntervalRef.current = window.setInterval(() => {
        state = !state;
        setIsTorchOn(state);
      }, 250);
    }
  };

  const stopTorchAndStrobe = () => {
    if (strobeIntervalRef.current !== null) {
      clearInterval(strobeIntervalRef.current);
      strobeIntervalRef.current = null;
    }
    if (videoTrackRef.current) {
      videoTrackRef.current.stop();
      videoTrackRef.current = null;
    }
    setIsTorchOn(false);
    setIsStrobing(false);
  };

  // Haptic Feedback Trigger
  const triggerHapticSos = () => {
    // SOS in Morse: 3 short, 3 long, 3 short
    meshRouter.triggerDeviceHaptic([150, 80, 150, 80, 150, 200, 350, 80, 350, 80, 350, 200, 150, 80, 150]);
  };

  // Save Operator Profile
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    meshRouter.updateOperatorProfile({
      callsign: callsign.trim(),
      role,
      operatorName: operatorName.trim(),
      teamId: teamId.trim(),
      bloodType: bloodType.trim(),
    });
    setIsProfileSaved(true);
    setTimeout(() => setIsProfileSaved(false), 2000);
  };

  // Copy app URL or trigger navigator.share
  const handleShareAppUrl = () => {
    const currentUrl = window.location.href;
    if (navigator.share) {
      navigator
        .share({
          title: 'Shadow-Net Emergency Mesh',
          text: 'Join encrypted zero-internet emergency micro-routing network:',
          url: currentUrl,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(currentUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  // Send a ping probe to a real peer
  const handlePingPeer = (targetNodeId: string) => {
    meshRouter.sendPacket({
      type: 'telemetry',
      targetNodeId,
      priority: 'ROUTINE',
      payload: `[OPERATOR PING] Heartbeat probe from ${localNode?.callsign} (${localNode?.operatorName})`,
    });
    meshRouter.triggerDeviceHaptic([100, 50, 100]);
  };

  // Filter nodes
  const filteredNodes = nodes.filter((n) => {
    if (peerFilter === 'real_mobile' && n.transport === 'simulated') return false;
    if (peerFilter === 'simulated' && n.transport !== 'simulated') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchCallsign = n.callsign.toLowerCase().includes(q);
      const matchOperator = n.operatorName?.toLowerCase().includes(q);
      const matchId = n.id.toLowerCase().includes(q);
      const matchRole = n.role.toLowerCase().includes(q);
      if (!matchCallsign && !matchOperator && !matchId && !matchRole) return false;
    }
    return true;
  });

  const realDevicesCount = nodes.filter((n) => n.transport !== 'simulated' || n.isLocal).length;

  const getDeviceIcon = (deviceType?: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="w-4 h-4 text-cyan-400" />;
      case 'tablet':
        return <Tablet className="w-4 h-4 text-purple-400" />;
      default:
        return <Laptop className="w-4 h-4 text-emerald-400" />;
    }
  };

  const getCardinalDirection = (deg: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(deg / 45) % 8;
    return directions[idx];
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-57px)] overflow-hidden bg-[#06080d]">
      {/* Screen Strobe Indicator for visual signaling */}
      {isTorchOn && (
        <div className="fixed inset-0 z-40 bg-white pointer-events-none opacity-85 transition-opacity" />
      )}

      {/* Left Column: Real Mobile Hardware & Operator Control Console */}
      <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 p-5 overflow-y-auto">
        {/* Header Ribbon */}
        <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-800 gap-3">
          <div>
            <h2 className="text-base font-bold font-['Chakra_Petch'] text-slate-100 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              Real Mobile Nodes & Field Operators
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live device hardware sensors, mobile GPS tracking, field operator credentials, and smartphone mesh pairing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 rounded flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              {realDevicesCount} Live Physical {realDevicesCount === 1 ? 'Node' : 'Nodes'}
            </span>
          </div>
        </div>

        {/* Section 1: Mobile Quick-Connect Hub (Scan QR on Mobile Phone) */}
        <div className="mt-5 p-4 bg-gradient-to-r from-slate-900/90 to-cyan-950/30 border border-slate-800 rounded-xl flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider font-['Chakra_Petch'] text-cyan-300">
                Instant Mobile Field Scout Onboarding
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Scan this QR with any iOS or Android smartphone camera to launch Shadow-Net directly on that phone. Both devices will automatically link into the decentralized emergency mesh.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleShareAppUrl}
                className="px-3 py-1.5 text-xs font-mono bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded flex items-center gap-1.5 transition-colors"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'URL Copied!' : 'Copy Mobile URL'}</span>
              </button>
              <button
                onClick={onOpenHandshakeModal}
                className="px-3 py-1.5 text-xs font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded flex items-center gap-1.5 transition-colors"
              >
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                Air-Gapped QR WebRTC Link
              </button>
            </div>
          </div>

          {/* QR Card */}
          {appUrlQr && (
            <div className="p-2.5 bg-slate-950 border border-cyan-500/40 rounded-xl shadow-lg shrink-0 flex flex-col items-center">
              <img
                src={appUrlQr}
                alt="Mobile Join QR"
                className="w-32 h-32 rounded-lg block"
              />
              <span className="text-[10px] font-mono text-cyan-400 mt-1 uppercase tracking-wider">
                Scan via Phone
              </span>
            </div>
          )}
        </div>

        {/* Section 2: Real Mobile Sensors & Tactical Hardware Controls */}
        <div className="mt-5">
          <div className="text-xs font-bold uppercase tracking-wider font-['Chakra_Petch'] text-slate-300 mb-3 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            Device Hardware Telemetry & Actuators
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Real GPS Geolocation Card */}
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-cyan-300 font-['Chakra_Petch']">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    High-Precision Mobile GPS
                  </div>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      isGpsTracking
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-slate-950 text-slate-500 border-slate-800'
                    }`}
                  >
                    {isGpsTracking ? 'LIVE SATELLITE FIX' : 'OFFLINE'}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Coordinates:</span>
                    <span className="text-slate-200">
                      {gpsData
                        ? `${gpsData.lat.toFixed(5)}° N, ${gpsData.lon.toFixed(5)}° W`
                        : `${localNode?.coordinates.lat?.toFixed(4) || '37.7749'}° N, ${localNode?.coordinates.lon?.toFixed(4) || '-122.4194'}° W`}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Tactical Grid Ref:</span>
                    <span className="text-cyan-300 font-bold">
                      {gpsData?.gridRef || localNode?.coordinates.gridRef || 'MGRS 10S-UF-482-911'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Fix Accuracy:</span>
                    <span className="text-emerald-400">
                      {gpsData?.accuracy ? `±${gpsData.accuracy} meters` : 'Cell / Wi-Fi Fallback'}
                    </span>
                  </div>
                  {gpsData?.altitude !== undefined && (
                    <div className="flex justify-between text-slate-400">
                      <span>Altitude / Speed:</span>
                      <span className="text-slate-200">
                        {gpsData.altitude}m ASL · {gpsData.speed || 0} km/h
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={toggleGpsTracking}
                className={`mt-4 w-full py-2 px-3 text-xs font-mono font-semibold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1.5 ${
                  isGpsTracking
                    ? 'bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800'
                    : 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                {isGpsTracking ? 'Stop GPS Tracking' : 'Acquire Real Device GPS Fix'}
              </button>
            </div>

            {/* Real Compass / Gyro Heading Card */}
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-cyan-300 font-['Chakra_Petch']">
                    <Compass className="w-4 h-4 text-amber-400" />
                    Magnetic Compass Orientation
                  </div>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      isCompassActive
                        ? 'bg-amber-950 text-amber-300 border-amber-800'
                        : 'bg-slate-950 text-slate-500 border-slate-800'
                    }`}
                  >
                    {isCompassActive ? 'GYRO ACTIVE' : 'STANDBY'}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="space-y-1 text-xs font-mono">
                    <div className="text-[10px] text-slate-500 uppercase">Azimuth Heading</div>
                    <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
                      {headingDeg.toString().padStart(3, '0')}° {getCardinalDirection(headingDeg)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Orientation sensor broadcasts heading to field map
                    </div>
                  </div>

                  {/* Compass Rose Visual Dial */}
                  <div className="relative w-16 h-16 rounded-full border border-slate-700 bg-slate-950 flex items-center justify-center">
                    <div
                      className="w-1 h-12 bg-transparent flex flex-col justify-between transition-transform duration-200"
                      style={{ transform: `rotate(${headingDeg}deg)` }}
                    >
                      <div className="w-1.5 h-4 bg-rose-500 rounded-t -ml-0.25" />
                      <div className="w-1.5 h-4 bg-slate-400 rounded-b -ml-0.25" />
                    </div>
                    <span className="absolute top-1 text-[8px] font-mono text-slate-500">N</span>
                  </div>
                </div>
              </div>

              <button
                onClick={toggleCompass}
                className="mt-4 w-full py-2 px-3 text-xs font-mono font-semibold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded transition-colors flex items-center justify-center gap-1.5"
              >
                <Compass className="w-3.5 h-3.5 text-amber-400" />
                {isCompassActive ? 'Disable Compass Sensor' : 'Enable Mobile Compass Sensor'}
              </button>
            </div>

            {/* Tactical Flashlight & Optical Strobe */}
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold uppercase text-cyan-300 font-['Chakra_Petch']">
                  <span className="flex items-center gap-1.5">
                    <Flashlight className="w-4 h-4 text-cyan-400" />
                    Hardware Torch / Optical SOS Strobe
                  </span>
                  {isStrobing && (
                    <span className="text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-800 px-1.5 py-0.5 rounded animate-pulse">
                      STROBING
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Activates your physical smartphone camera LED flash or screen strobe for night signaling and emergency visibility.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={toggleTorch}
                  className={`py-2 px-3 text-xs font-mono font-semibold uppercase rounded border transition-colors flex items-center justify-center gap-1 ${
                    isTorchOn
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  <Flashlight className="w-3.5 h-3.5" />
                  {isTorchOn ? 'Torch OFF' : 'Torch ON'}
                </button>

                <button
                  onClick={toggleStrobeSos}
                  className={`py-2 px-3 text-xs font-mono font-semibold uppercase rounded border transition-colors flex items-center justify-center gap-1 ${
                    isStrobing
                      ? 'bg-rose-600 text-white border-rose-500'
                      : 'bg-rose-950/60 hover:bg-rose-900 text-rose-300 border-rose-800'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  SOS Strobe
                </button>
              </div>
            </div>

            {/* Tactical Haptic Alerts Test */}
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold uppercase text-cyan-300 font-['Chakra_Petch']">
                  <span className="flex items-center gap-1.5">
                    <Vibrate className="w-4 h-4 text-cyan-400" />
                    Physical Device Haptic Vibration
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">TACTILE ALERTS</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Triggers physical phone vibrations for silent incoming emergency alerts and SOS transmissions.
                </p>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => meshRouter.triggerDeviceHaptic([100, 80, 100])}
                  className="flex-1 py-2 px-3 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded transition-colors flex items-center justify-center gap-1"
                >
                  <Vibrate className="w-3.5 h-3.5 text-cyan-400" />
                  Short Pulse
                </button>

                <button
                  onClick={triggerHapticSos}
                  className="flex-1 py-2 px-3 text-xs font-mono bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded transition-colors flex items-center justify-center gap-1"
                >
                  <Vibrate className="w-3.5 h-3.5 text-rose-400" />
                  Morse SOS Pattern
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Field Operator Profile Editor */}
        <div className="mt-6 p-4 bg-slate-900/40 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider font-['Chakra_Petch'] text-slate-200">
                Local Operator Mesh Identity Card
              </span>
            </div>
            {isProfileSaved && (
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Updated & Broadcasted!
              </span>
            )}
          </div>

          <form onSubmit={handleSaveProfile} className="mt-3.5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div>
                <label className="text-[10px] uppercase text-slate-400">Radio Callsign:</label>
                <input
                  type="text"
                  value={callsign}
                  onChange={(e) => setCallsign(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-slate-400">Operator Real Name / ID:</label>
                <input
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-slate-400">Squad / Unit ID:</label>
                <input
                  type="text"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-slate-400">Blood Type / Medical Tag:</label>
                <input
                  type="text"
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between pt-2 gap-3">
              <div className="flex items-center gap-2 text-xs font-mono w-full sm:w-auto">
                <span className="text-slate-400">Tactical Role:</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as MeshNode['role'])}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="mobile">Field Scout (Mobile)</option>
                  <option value="medical">Combat / Triage Medic</option>
                  <option value="relay">Mobile Rover Repeater</option>
                  <option value="shelter">Shelter Coordinator</option>
                  <option value="command">Tactical Command Lead</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded transition-colors flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
              >
                <Check className="w-3.5 h-3.5" />
                Broadcast Profile to Mesh
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Column: Live Directory of Connected Physical Operators */}
      <div className="w-full lg:w-96 xl:w-[440px] flex flex-col bg-[#090d16] border-t lg:border-t-0 border-slate-800 p-5 overflow-y-auto">
        <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-wider uppercase font-['Chakra_Petch'] text-slate-200">
              Active Mesh Directory
            </h2>
            <div className="text-xs font-mono text-slate-500 mt-0.5">
              Live Human Operators & Physical Hardware
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-0.5 text-xs font-mono">
            <button
              onClick={() => setPeerFilter('real_mobile')}
              className={`px-2 py-0.5 rounded transition-colors ${
                peerFilter === 'real_mobile'
                  ? 'bg-cyan-950 text-cyan-300 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Real Users
            </button>
            <button
              onClick={() => setPeerFilter('all')}
              className={`px-2 py-0.5 rounded transition-colors ${
                peerFilter === 'all'
                  ? 'bg-cyan-950 text-cyan-300 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Nodes
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="mt-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search operators, callsigns, roles..."
            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Peer List */}
        <div className="mt-4 space-y-3 flex-1 overflow-y-auto">
          {filteredNodes.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-slate-500">
              No matching nodes found. Scan the QR code with another mobile phone to join!
            </div>
          ) : (
            filteredNodes.map((peer) => {
              const isLocal = peer.id === localNode?.id;
              const isSim = peer.transport === 'simulated';

              return (
                <div
                  key={peer.id}
                  className={`p-3.5 rounded-lg border text-xs font-mono space-y-2.5 transition-all ${
                    isLocal
                      ? 'bg-cyan-950/40 border-cyan-800/80 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      {getDeviceIcon(peer.deviceType)}
                      <div className="flex flex-col truncate">
                        <span className="font-bold text-slate-100 truncate flex items-center gap-1.5">
                          {peer.callsign}
                          {isLocal && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-cyan-900 text-cyan-200 rounded font-normal">
                              YOU
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">
                          {peer.operatorName || (isSim ? 'Automated Repeater' : 'Field Scout')} · {peer.teamId || 'SAR Unit'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border uppercase ${
                        isSim
                          ? 'bg-slate-950 text-slate-500 border-slate-800'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      }`}
                    >
                      {isSim ? 'Simulated' : 'Physical'}
                    </span>
                  </div>

                  {/* Telemetry Strip */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/80 text-slate-400">
                    <div className="flex items-center gap-1">
                      <Battery className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{peer.batteryLevel}% Reserve</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>{peer.rssi} dBm ({peer.transport})</span>
                    </div>

                    <div className="flex items-center gap-1 truncate col-span-2 text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">
                        {peer.coordinates.gridRef || 'GR-4829'}
                        {peer.coordinates.lat ? ` (${peer.coordinates.lat.toFixed(3)}, ${peer.coordinates.lon?.toFixed(3)})` : ''}
                      </span>
                    </div>

                    {peer.bloodType && (
                      <div className="flex items-center gap-1 text-rose-400 col-span-2">
                        <Heart className="w-3.5 h-3.5 shrink-0" />
                        <span>Medical Tag: {peer.bloodType}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions for remote peers */}
                  {!isLocal && (
                    <div className="pt-1 flex items-center gap-2">
                      <button
                        onClick={() => onSelectNodeForWhisper(peer.id)}
                        className="flex-1 py-1.5 px-2 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/70 rounded text-[11px] flex items-center justify-center gap-1 transition-colors"
                      >
                        <Send className="w-3 h-3" />
                        Whisper
                      </button>

                      <button
                        onClick={() => handlePingPeer(peer.id)}
                        className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded text-[11px] flex items-center justify-center gap-1 transition-colors"
                        title="Transmit Ping / Haptic Probe"
                      >
                        <Zap className="w-3 h-3 text-amber-400" />
                        Ping
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
