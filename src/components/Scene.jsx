import React, { Suspense, useRef } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { 
  OrbitControls, 
  PerspectiveCamera, 
  Environment, 
  Stars, 
  Sparkles,
  Float
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import ChristmasTree from './ChristmasTree';
import useStore from '../store';
import useStore from '../store';
import { useThree, useFrame } from '@react-three/fiber';

function AdaptiveCamera() {
  const { viewport } = useThree();
  const isPortrait = viewport.aspect < 1;
  const fov = isPortrait ? 60 : 45;
  const zPosition = isPortrait ? 25 : 20;

  return (
    <PerspectiveCamera 
      makeDefault 
      position={[0, 0, zPosition]} 
      fov={fov} 
    />
  );
}

export default function Scene() {
  const phase = useStore((state) => state.phase);
  const { hasStarted } = useStore();
  const groupRef = useRef();

  useFrame((state, delta) => {
    if (groupRef.current) {
      // Move tree from y=2.0 down to y=-1.0 when started
      const targetY = hasStarted ? -1.0 : 2.0;
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, delta * 1.5);
    }
  });

  return (
    <div className="w-full h-full bg-black">
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 45, position: [0, 0, 20] }}>
        <color attach="background" args={['#000']} />
        
        <Suspense fallback={null}>
          <AdaptiveCamera />
          <OrbitControls 
            enablePan={false} 
            maxDistance={40} 
            minDistance={10}
            autoRotate={phase === 'nebula'}
            autoRotateSpeed={0.5}
          />

          {/* Lights */}
          <ambientLight intensity={0.2} />
          <pointLight position={[10, 10, 10]} color="#fff7e6" intensity={1.5} />
          <pointLight position={[-10, 5, -5]} color="#d0e1f9" intensity={1} />
          <spotLight
            position={[0, 20, 0]}
            angle={0.3}
            penumbra={1}
            intensity={2}
            castShadow
            color="#fff"
          />

          {/* Environment */}
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          <Sparkles count={200} scale={20} size={2} speed={0.4} opacity={0.5} />
          
          <Environment preset="city" />

          {/* 3D Content */}
          <group ref={groupRef} position={[0, 2, 0]}>
            <ChristmasTree />
          </group>

          {/* Post Processing */}
          <EffectComposer disableNormalPass>
            <Bloom 
              luminanceThreshold={0.8} 
              mipmapBlur 
              intensity={1.5} 
              radius={0.4} 
            />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
