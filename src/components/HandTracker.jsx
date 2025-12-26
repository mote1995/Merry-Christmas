import React, { useRef, useEffect, useState } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import useStore from '../store';

export default function HandTracker() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const { isCameraOpen, toggleCamera, setGesture, setHandResults, setHandVelocityX, gesture } = useStore();
  const [ landmarker, setLandmarker] = useState(null);
  const [debugGesture, setDebugGesture] = useState('none');
  const [status, setStatus] = useState('Initializing...');

  // Draggable State
  const [camPos, setCamPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - camPos.x,
      y: e.clientY - camPos.y
    };
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isDragging) return;
      setCamPos({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    };
    const handlePointerUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging]);

  useEffect(() => {
    async function initMP() {
      const wasmRoots = [
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm",
        "https://fastly.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
      ];

      const modelUrl = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

      for (const root of wasmRoots) {
        try {
          console.log(`[HandTracker] Trying WASM root: ${root}`);
          const vision = await FilesetResolver.forVisionTasks(root);
          const hl = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: modelUrl,
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1,
            minHandDetectionConfidence: 0.3, // Lowered for better detection
            minHandPresenceConfidence: 0.3,
            minTrackingConfidence: 0.3
          });
          setLandmarker(hl);
          setStatus('Ready');
          console.log("[HandTracker] Landmarker Ready.");
          return;
        } catch (err) {
          console.warn(`[HandTracker] Failed to init from ${root}:`, err);
        }
      }
      setStatus('Error: Model Load Failed');
    }
    initMP();
  }, []);

  const lastVideoTime = useRef(-1);
  const requestRef = useRef();

  const predictWebcam = () => {
    if (!videoRef.current || !landmarker || !canvasRef.current || !isCameraOpen) return;
    
    let nowInMs = Date.now();
    if (videoRef.current.currentTime !== lastVideoTime.current && videoRef.current.readyState >= 2) {
      lastVideoTime.current = videoRef.current.currentTime;
      const results = landmarker.detectForVideo(videoRef.current, nowInMs);
      
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        const flippedLandmarks = landmarks.map(lm => ({ ...lm, x: 1 - lm.x }));
        
        setHandResults({ ...results, landmarks: [flippedLandmarks] });
        detectGesture(flippedLandmarks);
        drawHand(ctx, landmarks); 
      } else {
        setGesture('none');
        setDebugGesture('none');
        setHandResults(null);
      }
    }
    
    requestRef.current = window.requestAnimationFrame(predictWebcam);
  };

  useEffect(() => {
    if (isCameraOpen && landmarker && videoRef.current) {
      predictWebcam();
    }
    return () => {
      if (requestRef.current) window.cancelAnimationFrame(requestRef.current);
    };
  }, [isCameraOpen, landmarker]);

  useEffect(() => {
    if (isCameraOpen && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } } 
      }).then((stream) => {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
          videoRef.current.play();
        };
      }).catch(err => {
        console.error("Camera Access Error:", err);
        alert("Please allow camera access to use hand gestures.");
        toggleCamera();
      });
    } else if (!isCameraOpen && videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  }, [isCameraOpen]);

  const drawHand = (ctx, landmarks) => {
    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    
    const fingerBones = [
      [0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [0, 9, 10, 11, 12], [0, 13, 14, 15, 16], [0, 17, 18, 19, 20]
    ];

    // Thicker, brighter skeleton
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    
    fingerBones.forEach(bone => {
      ctx.beginPath();
      ctx.strokeStyle = '#00ffcc'; // Bright Cyan for bones
      bone.forEach((idx, i) => {
        const lm = landmarks[idx];
        if (i === 0) ctx.moveTo(lm.x * w, lm.y * h);
        else ctx.lineTo(lm.x * w, lm.y * h);
      });
      ctx.stroke();
    });

    landmarks.forEach((lm, i) => {
      ctx.beginPath();
      ctx.fillStyle = i === 4 || i === 8 ? '#ff0000' : '#ffffff'; // Red tips for Thumb/Index
      ctx.arc(lm.x * w, lm.y * h, i % 4 === 0 ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const waveBuffer = useRef([]);
  const gestureBuffer = useRef([]);

  const detectGesture = (landmarks) => {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const wrist = landmarks[0];
    const dist = (p1, p2) => Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2);
    const palmSize = dist(wrist, landmarks[5]) || 0.1;
    
    // Finger indices for counting
    const fingerIndices = [
      { tip: 8, mid: 6 },  // Index
      { tip: 12, mid: 10 }, // Middle
      { tip: 16, mid: 14 }, // Ring
      { tip: 20, mid: 18 }  // Pinky
    ];

    let extendedFingers = 0;
    fingerIndices.forEach(f => {
      const tipDist = dist(landmarks[f.tip], wrist);
      const midDist = dist(landmarks[f.mid], wrist);
      // Relaxed threshold: 1.1 instead of 1.25 to account for slight curls/tilt
      if (tipDist > midDist * 1.1) extendedFingers++;
    });

    // Special check for thumb
    const thumbDist = dist(landmarks[4], landmarks[2]);
    if (thumbDist > palmSize * 0.85) extendedFingers++;

    // Wave detection
    const prevX = waveBuffer.current.length > 0 ? waveBuffer.current[waveBuffer.current.length - 1] : wrist.x;
    waveBuffer.current.push(wrist.x);
    if (waveBuffer.current.length > 15) waveBuffer.current.shift();
    setHandVelocityX(wrist.x - prevX);
    const xRange = Math.max(...waveBuffer.current) - Math.min(...waveBuffer.current);

    let rawDetected = 'none';
    if (xRange > 0.08 && extendedFingers >= 3) rawDetected = 'wave';
    else if (extendedFingers >= 3) rawDetected = 'open';
    else if (extendedFingers === 0) rawDetected = 'fist';
    else if (extendedFingers === 1 || extendedFingers === 2) {
      // Point Up: Index finger tip (8) must be significantly higher (lower Y) than middle, ring, pinky
      const otherTips = [12, 16, 20]; // Ignore thumb (4) for the height check as it can be high
      const isIndexPointed = indexTip.y < landmarks[12].y - 0.08 && 
                             indexTip.y < landmarks[16].y - 0.08 &&
                             indexTip.y < landmarks[20].y - 0.08;
      
      if (isIndexPointed) rawDetected = 'point_up';
    }

    // Stability Buffer: Require 5 frames of consistency
    gestureBuffer.current.push(rawDetected);
    if (gestureBuffer.current.length > 5) gestureBuffer.current.shift();

    const allMatch = gestureBuffer.current.every(g => g === rawDetected);
    const isWave = rawDetected === 'wave';
    const { isKeyboardGrab } = useStore.getState();

    if (!isKeyboardGrab && (allMatch || (isWave && gestureBuffer.current.filter(g => g === 'wave').length >= 2))) {
      setGesture(rawDetected);
      setDebugGesture(`${rawDetected} (${extendedFingers})`);
    } else if (isKeyboardGrab) {
      setGesture('point_up');
      setDebugGesture('point_up (KEYBOARD)');
    }
  };

  return (
    <div 
      className="absolute top-4 right-12 z-50 cursor-move"
      style={{ transform: `translate(${camPos.x}px, ${camPos.y}px)` }}
      onPointerDown={handlePointerDown}
    >
      <div className={`relative w-40 h-30 sm:w-48 sm:h-36 bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden border border-white/20 transition-all ${isCameraOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted
          className="w-full h-full object-cover brightness-110 contrast-110"
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        <div className="absolute top-2 left-2 bg-black/50 text-[10px] px-2 py-0.5 rounded-full flex flex-col gap-0.5">
          <div className="flex gap-2">
            <span>HAND TRACKER</span>
            <span className="text-vintage-gold uppercase font-bold">{debugGesture}</span>
          </div>
          <span className="text-[7px] text-white/50">{status}</span>
        </div>
      </div>
    </div>
  );
}
