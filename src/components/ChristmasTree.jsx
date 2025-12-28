import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { generateTreePoints, generateSpiralPoints, generateNebulaPoints } from '../utils/geometry';
import useStore from '../store';

const PARTICLE_COUNT = 3000;
const SPARKLE_COUNT = 300;

// Scratch vectors for performance
const _v1 = new THREE.Vector3();
const _m1 = new THREE.Matrix4();
const _q1 = new THREE.Quaternion();
const _s1 = new THREE.Vector3();
const COLORS = [
  '#D4AF37', // Retro Gold
  '#FF0000', // Bright Red
  '#0047AB', // Cobalt Blue
  '#FF69B4', // Hot Pink
  '#C0C0C0', // Silver
  '#800020', // Burgundy
  '#5D8AA8', // Grey Blue
  '#E0BFB8', // Rose Pink
  '#F7E7CE', // Champagne
  '#FFD700', // Pure Gold
];

export default function ChristmasTree() {
  const { phase, setPhase, photos, gesture, focusedId, setFocusedId, handVelocityX, setKeyboardGrab, config } = useStore();
  const particlesRef = useRef();
  const sparklesRef = useRef();
  const ringRef = useRef();
  const photoGroupRef = useRef();
  const targetDirection = useRef(1); // 1 or -1
  
  // Base geometry points
  const treePoints = useMemo(() => generateTreePoints(PARTICLE_COUNT), []);
  const spiralPoints = useMemo(() => generateSpiralPoints(SPARKLE_COUNT, 10, 5, 8), []); // More turns for denser spiral
  const nebulaPoints = useMemo(() => generateNebulaPoints(PARTICLE_COUNT + SPARKLE_COUNT), []);

  // Positions and velocities for dynamic behavior
  const positions = useMemo(() => treePoints.map(p => p.clone()), [treePoints]);
  const velocities = useMemo(() => treePoints.map(() => new THREE.Vector3()), [treePoints]);
  
  const ornamentPositions = useMemo(() => spiralPoints.map(p => p.clone()), [spiralPoints]);

  const isTransitioning = useRef(false);

  useEffect(() => {
    // Phase logic based on gesture
    if (phase === 'tree' && gesture === 'open' && !isTransitioning.current) {
      setPhase('blooming');
    } else if (gesture === 'fist' && phase === 'blooming' && !isTransitioning.current) {
      // Trigger collapse animation
      isTransitioning.current = true;
      const tl = gsap.timeline({
        onComplete: () => {
          setPhase('tree');
          isTransitioning.current = false;
        }
      });

      // Smoothly collapse all particles and photos
      tl.to(transitionProgress.current, {
        pos: 0,
        duration: 1.5,
        ease: 'power3.inOut'
      }, 0);

      ornamentPositions.forEach((pos, i) => {
        tl.to(pos, {
          x: spiralPoints[i].x,
          y: spiralPoints[i].y,
          z: spiralPoints[i].z,
          duration: 1.7,
          ease: 'power3.inOut'
        }, 0);
      });
    }
  }, [gesture, phase]);

  const transitionProgress = useRef({ pos: 0 });
  const starRef = useRef();

  // Transition handling with GSAP (Blooming only)
  useEffect(() => {
    if (phase === 'blooming') {
      isTransitioning.current = true;
      const tl = gsap.timeline({
        onComplete: () => {
          isTransitioning.current = false;
        }
      });
      
      // High-performance progress animation
      tl.to(transitionProgress.current, {
        pos: 1,
        duration: 2,
        ease: 'expo.out'
      }, 0);

      // Animate ornaments to nebula outer ring
      ornamentPositions.forEach((pos, i) => {
        const target = nebulaPoints[PARTICLE_COUNT + i];
        tl.to(pos, {
          x: target.x,
          y: target.y,
          z: target.z,
          duration: 2.2,
          ease: 'expo.out'
        }, 0.1);
      });
    }
  }, [phase]);
  const releaseCount = useRef(0);
  const lastGesture = useRef('none');
  const rotationVelocity = useRef(0);
  const keysPressed = useRef(new Set());
  const isDragging = useRef(false);
  const lastMouseX = useRef(0);
  const lastMoveTime = useRef(0);

  // Drag and flick logic for mouse
  useEffect(() => {
    const handleDown = (e) => {
      isDragging.current = true;
      lastMouseX.current = e.clientX || (e.touches && e.touches[0].clientX);
      lastMoveTime.current = performance.now();
    };
    const handleMove = (e) => {
      if (!isDragging.current) return;
      const x = e.clientX || (e.touches && e.touches[0].clientX);
      const now = performance.now();
      const dt = now - lastMoveTime.current;
      if (dt > 10) {
        const dx = x - lastMouseX.current;
        // Apply direct rotation while dragging
        if (ringRef.current) ringRef.current.rotation.y += dx * 0.005;
        // Calculate velocity for flick
        rotationVelocity.current = dx / dt * 5.0; // Scaled velocity
        lastMouseX.current = x;
        lastMoveTime.current = now;
      }
    };
    const handleUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousedown', handleDown);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchstart', handleDown);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchstart', handleDown);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [phase]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      keysPressed.current.add(key);
      if (key === 'o') setPhase('blooming');
      if (key === 'f') setPhase('tree');
      if (key === 'p') setKeyboardGrab(true);
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      keysPressed.current.delete(key);
      if (key === 'p') setKeyboardGrab(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setPhase, setKeyboardGrab]);

  useFrame((state, delta) => {
    const { mouse, clock } = state;
    const mousePos = new THREE.Vector3(mouse.x * 10, mouse.y * 10, 0);

    // Keyboard Input
    if (keysPressed.current.has('a')) rotationVelocity.current -= 1.5;
    if (keysPressed.current.has('d')) rotationVelocity.current += 1.5;

    // Apply Friction / Decay
    if (!isDragging.current && gesture !== 'wave' && !keysPressed.current.has('a') && !keysPressed.current.has('d')) {
      rotationVelocity.current *= 0.96; // Slow down gradually
    }

    // Hand Wave Input
    if (gesture === 'wave') {
      const power = Math.abs(handVelocityX) > 0.005 ? handVelocityX * 15.0 : 0;
      rotationVelocity.current += power;
      // Cap max velocity
      rotationVelocity.current = THREE.MathUtils.clamp(rotationVelocity.current, -10, 10);
    }
    // Update Particles
    if (particlesRef.current) {
      const mesh = particlesRef.current;
      const dummy = new THREE.Object3D();
      const tempColor = new THREE.Color();

      positions.forEach((pos, i) => {
        // Interpolate position based on progress
        const treePos = treePoints[i];
        const nebulaPos = nebulaPoints[i];
        _v1.copy(treePos).lerp(nebulaPos, transitionProgress.current.pos);
        pos.copy(_v1);

        // Ripple effect logic (if phase is tree)
        if (phase === 'tree') {
          const dist = pos.distanceTo(mousePos);
          if (dist < 3) {
            const force = (3 - dist) / 3;
            const dir = pos.clone().sub(mousePos).normalize();
            pos.add(dir.multiplyScalar(force * 0.2));
          }
        }

        dummy.position.copy(pos);
        // Consistent scale for all phases
        const twinkle = Math.sin(clock.elapsedTime * 3 + i) * 0.2 + 0.8;
        dummy.scale.setScalar(0.05 * twinkle);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        // Multi-color tree particles
        const treePalette = config.palette.tree;
        tempColor.set(treePalette[i % treePalette.length]);
        mesh.setColorAt(i, tempColor);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // Update Sparkling Particles
    if (sparklesRef.current) {
      const mesh = sparklesRef.current;
      const dummy = new THREE.Object3D();
      const tempColor = new THREE.Color();
      const SPARKLE_PALETTE = ['#D4AF37', '#800020', '#5D8AA8', '#E0BFB8', '#F7E7CE'];

      ornamentPositions.forEach((pos, i) => {
        if (phase === 'tree') {
          const dist = pos.distanceTo(mousePos);
          if (dist < 4) {
            const force = (4 - dist) / 4;
            const dir = pos.clone().sub(mousePos).normalize();
            pos.add(dir.multiplyScalar(force * 0.15));
          }
          const origin = spiralPoints[i];
          pos.lerp(origin, 0.05);
        }

        dummy.position.copy(pos);
        
        // Intensified sparkling effect: Random flickering (reduced frequency)
        const flicker = clock.elapsedTime * 5 + i * 100;
        const scale = phase === 'blooming' ? 1.5 : 1.0;
        dummy.scale.setScalar((0.7 + Math.sin(flicker) * 0.6) * scale);
        
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        // Apply dreamlike colors from palette
        const palette = config.palette.ornaments;
        const colStr = palette[i % palette.length];
        tempColor.set(colStr);
        mesh.setColorAt(i, tempColor);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // Apply rotation separately
    if (ringRef.current && photoGroupRef.current) {
      // Ensure nebula stays stationary at origin
      ringRef.current.position.set(0, 0, 0);
      photoGroupRef.current.position.set(0, 0, 0);

      const baseRotation = phase === 'blooming' ? 0.1 : 0;
      // Stop rotation AND velocity drift if a photo is focused to prevent jitter
      if (focusedId) {
        rotationVelocity.current = 0; // Hard kill current momentum
      } else {
        ringRef.current.rotation.y += (baseRotation + rotationVelocity.current) * delta;
      }
    }

    // Unified Point-Up Selection
    const isPointUp = gesture === 'point_up';
    if (isPointUp) {
      if (!focusedId && photos.length > 0) {
        const randomIdx = Math.floor(Math.random() * photos.length);
        const selectedId = photos[randomIdx].id;
        console.log(`[Focus] Random Selection: ${selectedId}`);
        setFocusedId(selectedId);
      }
    }

    // Clear focus if fist detected or (blooming phase + wave/open)
    if (gesture === 'fist' || (phase === 'blooming' && (gesture === 'wave' || gesture === 'open'))) {
       setFocusedId(null);
    }

    lastGesture.current = gesture;
  });

  return (
    <group>
      {/* Little Star Top */}
      <mesh ref={starRef} position={[0, 5.5, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#FFE680" emissive="#FFD700" emissiveIntensity={5} />
        <pointLight intensity={2} color="#FFD700" />
      </mesh>

      {/* Shared Rotating Group for Nebula Phase Synchronization */}
      <group ref={ringRef}>
        {/* Pine Particles */}
        <instancedMesh ref={particlesRef} args={[null, null, PARTICLE_COUNT]}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshStandardMaterial 
            emissive={config.palette.tree[0]}
            emissiveIntensity={0.8} 
            roughness={0.4}
            metalness={0.2}
          />
        </instancedMesh>

        {/* Sparkling Decorations */}
        <instancedMesh ref={sparklesRef} args={[null, null, SPARKLE_COUNT]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshStandardMaterial 
            roughness={0.0} 
            metalness={1.0} 
            emissive="#ffffff"
            emissiveIntensity={0.5} 
          />
        </instancedMesh>
        
        {/* Photo Wall/Nebula - In its own group for independent rotation */}
        <group ref={photoGroupRef}>
          <PhotoWall />
        </group>
      </group>
    </group>
  );
}


function PhotoWall() {
  const { photos, sharedId } = useStore();
  
  // Filter out invalid blob URLs that don't belong to this session
  const validPhotos = React.useMemo(() => photos.filter(p => {
    const isInvalidLocal = (p.url.startsWith('blob:') || p.url.startsWith('data:')) && sharedId;
    return !isInvalidLocal;
  }), [photos, sharedId]);

  return (
    <group>
      {validPhotos.map((photo, i) => (
        <SmartPhoto key={photo.id} photo={photo} index={i} total={validPhotos.length} />
      ))}
    </group>
  );
}

function SmartPhoto({ photo, index, total }) {
  const meshRef = useRef();
  const { phase, gesture, focusedId, setFocusedId } = useStore();
  const texture = useTexture(photo.url);
  const isFocused = focusedId === photo.id;

  const targetPos = useMemo(() => {
    if (phase === 'tree') {
      // Ordered Bottom-to-Top Hanging - Restricted to lower 85% and strictly WITHIN radius 4.5
      const t = index / Math.max(total, 1);
      const h = 8.5 * (1 - Math.pow(t, 0.7)); 
      const r = ((10 - h) / 10) * 4.4 + 0.1; // Maximum radius 4.5
      const a = t * Math.PI * 2 * 3.5; 
      return new THREE.Vector3(Math.cos(a) * r, h - 5 - 0.5, Math.sin(a) * r);
    } else {
      // Hovering above the tilted nebula ring (raised to -1.5)
      const t = index / Math.max(total, 1);
      const r = 10 + (Math.random() - 0.5) * 2; 
      const a = t * Math.PI * 2;
      const tiltAngle = Math.PI * 0.03; // Match geometry.js subtler tilt
      
      let x = Math.cos(a) * r;
      let z = Math.sin(a) * r;
      let y = 1.6 + (Math.random() * 0.4) - 1.5; // Hovering 1.6 units above the raised ring (-1.5)
      
      const tiltedY = y * Math.cos(tiltAngle) - z * Math.sin(tiltAngle);
      const tiltedZ = y * Math.sin(tiltAngle) + z * Math.cos(tiltAngle);
      
      return new THREE.Vector3(x, tiltedY, tiltedZ);
    }
  }, [phase, index, total]);

  useFrame((state) => {
    if (isFocused) {
      // 1. FORCE PARENT SYNC
      meshRef.current.parent.updateMatrixWorld();
      
      // 2. CALCULATE TARGET IN WORLD SPACE
      const dist = 8;
      // We project the point relative to the camera
      _v1.set(0, 0, -dist).applyQuaternion(state.camera.quaternion).add(state.camera.position);
      
      // 3. LOCK POSITION IN WORLD SPACE THEN CONVERT
      // This ensures even if the parent moves, the photo pursues the world-point exactly
      const targetLocal = meshRef.current.parent.worldToLocal(_v1.clone());
      meshRef.current.position.lerp(targetLocal, 0.3);
      
      // 4. LOCK ORIENTATION
      const parentWorldQuat = new THREE.Quaternion();
      meshRef.current.parent.getWorldQuaternion(parentWorldQuat);
      const localFaceQuat = state.camera.quaternion.clone().multiply(parentWorldQuat.invert());
      meshRef.current.quaternion.slerp(localFaceQuat, 0.3);
      
      // 5. STABLE SCALE
      const vFOV = (state.camera.fov * Math.PI) / 180;
      const visibleHeight = 2 * Math.tan(vFOV / 2) * dist;
      const targetScale = visibleHeight * 0.7; 
      _s1.set(targetScale, targetScale, 1);
      meshRef.current.scale.lerp(_s1, 0.3);
      
    } else {
      meshRef.current.position.lerp(targetPos, 0.05);
      const baseScale = phase === 'tree' ? 1.0 : 1.5; 
      meshRef.current.scale.lerp(new THREE.Vector3(baseScale, baseScale, 1), 0.05);

      if (phase === 'blooming' || phase === 'tree') {
        meshRef.current.lookAt(state.camera.position);
      } else {
        meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime + index) * 0.2;
        meshRef.current.rotation.z = Math.cos(state.clock.elapsedTime * 0.5 + index) * 0.1;
      }
    }
  });

  return (
    <mesh 
      ref={meshRef} 
      renderOrder={isFocused ? 1000 : 0}
      userData={{ id: photo.id }}
      onClick={(e) => {
        e.stopPropagation();
        setFocusedId(isFocused ? null : photo.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'auto';
        // Removed auto-clear to prevent gesture flickering
      }}
    >
      <planeGeometry args={[1, 1, 1]} />
      <meshStandardMaterial map={texture} />
      {/* Polaroid Frame */}
      <group position={[0, -0.1, -0.01]} scale={[1.1, 1.4, 1]}>
        <mesh>
          <planeGeometry />
          <meshStandardMaterial color="white" />
        </mesh>
        {/* Hanging String (only on tree) */}
        {phase === 'tree' && (
          <mesh position={[0, 0.6, -0.01]} scale={[0.02, 0.5, 1]}>
            <planeGeometry />
            <meshStandardMaterial color="#D4AF37" />
          </mesh>
        )}
      </group>
    </mesh>
  );
}

