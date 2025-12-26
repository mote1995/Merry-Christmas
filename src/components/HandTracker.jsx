import React, { useRef, useEffect, useState } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import useStore from '../store';

export default function HandTracker() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const { isCameraOpen, toggleCamera, setGesture, setHandResults, setHandVelocityX, gesture } = useStore();
  const [landmarker, setLandmarker] = useState(null);
  const [debugGesture, setDebugGesture] = useState('none');
  const [status, setStatus] = useState('Initializing...');

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
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
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

  useEffect(() => {
    if (isCameraOpen && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } } 
      }).then((stream) => {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
          videoRef.current.play();
          predictWebcam();
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

  let lastVideoTime = -1;
  const predictWebcam = () => {
    if (!videoRef.current || !landmarker || !canvasRef.current || !isCameraOpen) return;
    
    let nowInMs = Date.now();
    if (videoRef.current.currentTime !== lastVideoTime && videoRef.current.readyState >= 2) {
      lastVideoTime = videoRef.current.currentTime;
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
    
    window.requestAnimationFrame(predictWebcam);
  };

  const drawHand = (ctx, landmarks) => {
    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    
    const fingerBones = [
      [0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [0, 9, 10, 11, 12], [0, 13, 14, 15, 16], [0, 17, 18, 19, 20]
    ];

    ctx.strokeStyle = '#dfcc9d';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    fingerBones.forEach(bone => {
      ctx.beginPath();
      bone.forEach((idx, i) => {
        const lm = landmarks[idx];
        if (i === 0) ctx.moveTo(lm.x * w, lm.y * h);
        else ctx.lineTo(lm.x * w, lm.y * h);
      });
      ctx.stroke();
    });

    ctx.fillStyle = '#ffffff';
    landmarks.forEach(lm => {
      ctx.beginPath();
      ctx.arc(lm.x * w, lm.y * h, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const waveBuffer = useRef([]); 

  const detectGesture = (landmarks) => {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const wrist = landmarks[0];
    const dist = (p1, p2) => Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2);
    const palmSize = dist(wrist, landmarks[5]) || 0.1;
    
    const relAvgDist = ([4, 8, 12, 16, 20].reduce((sum, idx) => sum + dist(landmarks[idx], wrist), 0) / 5) / palmSize;
    
    const prevX = waveBuffer.current.length > 0 ? waveBuffer.current[waveBuffer.current.length - 1] : wrist.x;
    waveBuffer.current.push(wrist.x);
    if (waveBuffer.current.length > 15) waveBuffer.current.shift();
    setHandVelocityX(wrist.x - prevX);

    const xRange = Math.max(...waveBuffer.current) - Math.min(...waveBuffer.current);
    const isWaving = xRange > 0.1 && relAvgDist > 1.8;

    let detected = 'none';
    if (isWaving) detected = 'wave';
    else if (relAvgDist < 1.4) detected = 'fist';
    else if (relAvgDist > 2.0) detected = 'open';
    else if (dist(thumbTip, indexTip) / palmSize < 0.35) detected = 'pinch';
    
    setGesture(detected);
    setDebugGesture(detected);
  };

  return (
    <div className="absolute top-4 right-4 z-50">
      <div className={`relative w-48 h-36 bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden border border-white/20 transition-all ${isCameraOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
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
      <button 
        onClick={toggleCamera}
        className="mt-2 w-full px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-xs font-semibold hover:bg-white/20 transition-all"
      >
        {isCameraOpen ? 'CLOSE CAMERA' : 'OPEN CAMERA'}
      </button>
    </div>
  );
}
