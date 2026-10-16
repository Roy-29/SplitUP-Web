import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { isTursoConfigured, tursoJoinGroupByCode } from '../lib/turso';
import './Modal.css';

/**
 * Robust parser to extract the join code from either:
 * - A full URL: https://splitupweb.vercel.app/join/SP8921
 * - A relative URL: /join/SP8921
 * - A query param: ?code=SP8921
 * - A plain alphanumeric join code: SP8921
 */
function extractJoinCodeFromText(rawText) {
  if (!rawText) return '';
  const trimmed = rawText.trim();

  // Pattern 1: URL with /join/:code
  const urlMatch = trimmed.match(/join\/([a-zA-Z0-9]{4,8})/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1].toUpperCase();
  }

  // Pattern 2: Query param code=XYZ
  const queryMatch = trimmed.match(/[?&]code=([a-zA-Z0-9]{4,8})/i);
  if (queryMatch && queryMatch[1]) {
    return queryMatch[1].toUpperCase();
  }

  // Pattern 3: Clean alphanumeric 4 to 8 characters
  const cleanAlpha = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleanAlpha.length >= 4 && cleanAlpha.length <= 8) {
    return cleanAlpha;
  }

  return cleanAlpha;
}

export default function JoinGroupModal({ isOpen, onClose, onSuccess, currentUser, initialCode = '' }) {
  const [activeTab, setActiveTab] = useState(() => initialCode ? 'MANUAL' : 'SCAN');
  const [joinCode, setJoinCode] = useState(() => initialCode ? initialCode.toUpperCase() : '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [availableCameras, setAvailableCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);

  // Sync initialCode prop if provided
  useEffect(() => {
    if (initialCode) {
      setJoinCode(initialCode.toUpperCase());
      setActiveTab('MANUAL');
    }
  }, [initialCode]);

  // Handle Join Submission
  const executeJoin = async (codeToJoin) => {
    setError('');
    setSuccessMsg('');

    const trimmed = (codeToJoin || joinCode).trim().toUpperCase();
    if (trimmed.length < 4) {
      setError('Please enter a valid Join Code (e.g. SP8921).');
      return;
    }

    setIsLoading(true);

    try {
      if (isTursoConfigured) {
        const result = await tursoJoinGroupByCode(trimmed, currentUser);
        if (result.alreadyMember) {
          setSuccessMsg(`You are already a member of "${result.name}"!`);
        } else {
          setSuccessMsg(`Successfully joined "${result.name}"!`);
        }
        setTimeout(() => {
          setIsLoading(false);
          setJoinCode('');
          setSuccessMsg('');
          onSuccess?.();
          onClose();
        }, 1200);
      } else {
        setError('Turso database is not connected.');
        setIsLoading(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to join group. Please check the code.');
      setIsLoading(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    executeJoin(joinCode);
  };

  // Safe scanner shutdown helper
  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
    setIsTorchOn(false);
    setTorchSupported(false);
  };

  // Start live camera QR scanner (defaults to rear/back camera on mobile)
  const startScanner = async (targetCameraOrIndex = null) => {
    setCameraError('');
    setError('');

    try {
      await stopScanner();

      const qrRegionId = 'qr-reader';
      const qrElement = document.getElementById(qrRegionId);
      if (!qrElement) return;

      const html5QrCode = new Html5Qrcode(qrRegionId);
      html5QrCodeRef.current = html5QrCode;

      // Check available cameras first
      let cameras = [];
      try {
        cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          setAvailableCameras(cameras);
        }
      } catch (err) {
        console.warn('Could not enumerate cameras prior to start:', err);
      }

      // Determine camera target:
      // 1. Explicit camera index from Flip Camera
      // 2. Explicit device ID
      // 3. Otherwise prioritize the back/rear camera ({ facingMode: "environment" } or back camera label)
      let cameraConfig;
      if (typeof targetCameraOrIndex === 'number' && cameras.length > 0) {
        const selected = cameras[targetCameraOrIndex % cameras.length];
        cameraConfig = selected.id;
        setCurrentCameraIndex(targetCameraOrIndex % cameras.length);
      } else if (typeof targetCameraOrIndex === 'string') {
        cameraConfig = targetCameraOrIndex;
      } else {
        const backIdx = cameras.findIndex((c) =>
          /back|rear|environment|world|facet/i.test(c.label || '')
        );

        if (backIdx !== -1) {
          cameraConfig = cameras[backIdx].id;
          setCurrentCameraIndex(backIdx);
        } else {
          // Default to environment facingMode for mobile rear camera
          cameraConfig = { facingMode: 'environment' };
        }
      }

      const config = {
        fps: 10,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0,
      };

      const onScanSuccess = (decodedText) => {
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }

        const parsed = extractJoinCodeFromText(decodedText);
        if (parsed) {
          setJoinCode(parsed);
          stopScanner();
          executeJoin(parsed);
        }
      };

      const onScanFailure = () => {
        // QR Code not in frame yet - silent
      };

      try {
        await html5QrCode.start(cameraConfig, config, onScanSuccess, onScanFailure);
      } catch (startErr) {
        // Fallback: if facingMode: "environment" fails on a device without a rear camera
        if (typeof cameraConfig === 'object' && cameraConfig.facingMode) {
          const fallbackList = cameras.length > 0 ? cameras : await Html5Qrcode.getCameras().catch(() => []);
          if (fallbackList && fallbackList.length > 0) {
            await html5QrCode.start(fallbackList[0].id, config, onScanSuccess, onScanFailure);
          } else {
            throw startErr;
          }
        } else {
          throw startErr;
        }
      }

      setIsScanning(true);

      // Post-start: refresh camera list with granted permissions to detect active device & enable flipping
      try {
        const freshCameras = await Html5Qrcode.getCameras();
        if (freshCameras && freshCameras.length > 0) {
          setAvailableCameras(freshCameras);
          const trackSettings = html5QrCode.getRunningTrackSettings?.();
          const activeId = trackSettings?.deviceId;
          if (activeId) {
            const foundIdx = freshCameras.findIndex((c) => c.id === activeId);
            if (foundIdx !== -1) {
              setCurrentCameraIndex(foundIdx);
            }
          }
        }
      } catch (camErr) {
        console.warn('Could not refresh camera list post-start:', camErr);
      }

      // Check for torch capability
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if (capabilities && capabilities.torch) {
          setTorchSupported(true);
        } else {
          setTorchSupported(false);
        }
      } catch {
        setTorchSupported(false);
      }
    } catch (err) {
      console.warn('Camera scan initialization failed:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access in your browser settings or enter the code manually.'
          : 'Unable to start camera. Please check your camera permissions or upload a QR image.'
      );
      setIsScanning(false);
    }
  };

  // Start or stop scanner based on modal state & active tab
  useEffect(() => {
    let timer;
    if (isOpen && activeTab === 'SCAN') {
      // Small delay to ensure the DOM element #qr-reader is mounted
      timer = setTimeout(() => {
        startScanner();
      }, 250);
    } else {
      stopScanner();
    }

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, activeTab]);

  // Flip Camera
  const handleFlipCamera = async () => {
    if (availableCameras.length <= 1) return;
    const nextIndex = (currentCameraIndex + 1) % availableCameras.length;
    setCurrentCameraIndex(nextIndex);
    await startScanner(nextIndex);
  };

  // Toggle Torch
  const handleToggleTorch = async () => {
    if (!html5QrCodeRef.current || !torchSupported) return;
    try {
      const nextState = !isTorchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState }]
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn('Torch toggle error:', err);
    }
  };

  // Fallback: Scan QR from Image File
  const handleFileScan = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setError('');
    setIsLoading(true);

    try {
      await stopScanner();
      const html5QrCode = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = html5QrCode;

      const decodedText = await html5QrCode.scanFile(file, true);
      const parsed = extractJoinCodeFromText(decodedText);

      if (parsed) {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        setJoinCode(parsed);
        executeJoin(parsed);
      } else {
        setError('Could not find a valid SplitUP join code in this image.');
      }
    } catch (err) {
      console.warn('File QR scan error:', err);
      setError('Could not scan the image file. Please verify it contains a clear QR code.');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay animate-fade-in" onClick={() => { stopScanner(); onClose(); }}>
      <div 
        className="modal-content glass-panel" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '440px' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div 
              style={{ 
                background: 'rgba(108, 92, 231, 0.15)', 
                color: 'var(--accent-primary)', 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}
            >
              <i className="ph ph-sign-in" style={{ fontSize: '1.25rem' }}></i>
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Join a Group</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '2px 0 0' }}>
                Scan QR code or enter 6-character code
              </p>
            </div>
          </div>
          <button 
            type="button" 
            className="btn-icon" 
            onClick={() => { stopScanner(); onClose(); }} 
            style={{ width: '32px', height: '32px' }}
          >
            <i className="ph ph-x"></i>
          </button>
        </div>

        {/* Status / Alert Messages */}
        {error && (
          <div className="error-message" style={{ marginBottom: '16px' }}>
            {error}
          </div>
        )}
        {successMsg && (
          <div style={{ color: 'var(--success)', background: 'rgba(0, 184, 148, 0.1)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.88rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="ph ph-check-circle" style={{ fontSize: '1.1rem' }}></i>
            {successMsg}
          </div>
        )}

        {/* Tab Switcher: Scan vs Manual */}
        <div className="qr-tabs">
          <button
            type="button"
            className={`qr-tab-btn ${activeTab === 'SCAN' ? 'active' : ''}`}
            onClick={() => setActiveTab('SCAN')}
          >
            <i className="ph ph-camera"></i>
            Scan QR Code
          </button>
          <button
            type="button"
            className={`qr-tab-btn ${activeTab === 'MANUAL' ? 'active' : ''}`}
            onClick={() => setActiveTab('MANUAL')}
          >
            <i className="ph ph-keyboard"></i>
            Enter Code
          </button>
        </div>

        {/* TAB 1: Live Camera Scanner */}
        {activeTab === 'SCAN' && (
          <div className="modal-body" style={{ textAlign: 'center', overflowY: 'auto' }}>
            {cameraError ? (
              <div 
                style={{ 
                  background: 'rgba(255, 118, 117, 0.1)', 
                  border: '1px solid rgba(255, 118, 117, 0.25)', 
                  padding: '16px', 
                  borderRadius: '12px',
                  marginBottom: '16px' 
                }}
              >
                <i className="ph ph-video-camera-slash" style={{ fontSize: '2rem', color: 'var(--danger)', marginBottom: '8px', display: 'block' }}></i>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                  {cameraError}
                </p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={() => startScanner()}
                    style={{ fontSize: '0.82rem' }}
                  >
                    <i className="ph ph-arrow-counter-clockwise"></i> Try Again
                  </button>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={() => fileInputRef.current?.click()}
                    style={{ fontSize: '0.82rem' }}
                  >
                    <i className="ph ph-image"></i> Upload Photo
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="qr-scanner-wrapper">
                  <div id="qr-reader"></div>
                  {isScanning && (
                    <div className="qr-scanner-overlay">
                      <div className="qr-scan-frame">
                        <div className="qr-laser-line"></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Camera controls toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
                  {availableCameras.length > 1 && (
                    <button 
                      type="button" 
                      className="btn-secondary" 
                      onClick={handleFlipCamera}
                      style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      title="Switch camera"
                    >
                      <i className="ph ph-camera-rotate"></i> Flip Camera
                    </button>
                  )}

                  {torchSupported && (
                    <button 
                      type="button" 
                      className="btn-secondary" 
                      onClick={handleToggleTorch}
                      style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px', color: isTorchOn ? 'var(--warning)' : 'inherit' }}
                      title="Toggle Flashlight"
                    >
                      <i className="ph ph-flashlight"></i> {isTorchOn ? 'Flash On' : 'Flash'}
                    </button>
                  )}

                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={() => fileInputRef.current?.click()}
                    style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    title="Upload QR code screenshot"
                  >
                    <i className="ph ph-upload-simple"></i> Upload QR
                  </button>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  Point your camera at a friend's SplitUP QR code to join automatically.
                </p>
              </div>
            )}

            {/* Hidden file input for gallery fallback */}
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              onChange={handleFileScan} 
              style={{ display: 'none' }} 
            />
          </div>
        )}

        {/* TAB 2: Manual Code Input */}
        {activeTab === 'MANUAL' && (
          <form onSubmit={handleManualSubmit} className="modal-form">
            <div className="form-group">
              <label>Group Join Code</label>
              <input 
                type="text" 
                placeholder="e.g. SP8921" 
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={8}
                required
                style={{ 
                  letterSpacing: '3px', 
                  fontSize: '1.25rem', 
                  fontWeight: 'bold', 
                  textAlign: 'center',
                  textTransform: 'uppercase'
                }}
                autoFocus
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Ask the group creator to share their 6-character code found on the group card.
              </span>
            </div>

            <div className="modal-footer" style={{ marginTop: '16px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => { stopScanner(); onClose(); }} 
                disabled={isLoading}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={isLoading}>
                {isLoading ? 'Joining...' : 'Join Group'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
