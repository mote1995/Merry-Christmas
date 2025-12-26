import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import useStore from '../store';
import gsap from 'gsap';

const SmartPhoto = ({ photo, index, totalPhotos, radius, isFocused, onFocus }) => {
    const meshRef = useRef();
    const { camera, size } = useThree();
    
    const angle = (index / totalPhotos) * Math.PI * 2;
    const baseX = Math.cos(angle) * radius;
    const baseZ = Math.sin(angle) * radius;
    
    const [x, setX] = React.useState(baseX);
    const [y, setY] = React.useState(0);
    const [z, setZ] = React.useState(baseZ);
    const [scale, setScale] = React.useState(1);
    
    // Detect if photo is landscape and rotate polaroid frame
    const isLandscape = photo.texture && photo.texture.image && 
                       photo.texture.image.width > photo.texture.image.height;
    
    useEffect(() => {
        if (isFocused) {
            // Calculate target scale to be 70% of screen height
            // Screen height in world units at z=5
            const vFOV = (camera.fov * Math.PI) / 180;
            const targetZ = 5;
            const height = 2 * Math.tan(vFOV / 2) * targetZ;
            const targetScale = (height * 0.7) / 1.5; // 70% of screen height, divided by default photo height
            
            // Animate to screen center, in front of camera
            gsap.to({ x: baseX, y: 0, z: baseZ, s: 1 }, {
                x: 0,
                y: 0,
                z: targetZ,
                s: targetScale,
                duration: 0.6,
                ease: "power2.out",
               onUpdate: function() {
                    setX(this.targets()[0].x);
                    setY(this.targets()[0].y);
                    setZ(this.targets()[0].z);
                    setScale(this.targets()[0].s);
                }
            });
        } else {
            // Return to ring position
            gsap.to({ x, y, z, s: scale }, {
                x: baseX,
                y: 0,
                z: baseZ,
                s: 1,
                duration: 0.6,
                ease: "power2.out",
                onUpdate: function() {
                    setX(this.targets()[0].x);
                    setY(this.targets()[0].y);
                    setZ(this.targets()[0].z);
                    setScale(this.targets()[0].s);
                }
            });
        }
    }, [isFocused, baseX, baseZ, camera, scale, x, y, z]);
    
    useFrame(() => {
        if (meshRef.current && isFocused) {
            // Look at camera when focused for perfect alignment
            meshRef.current.lookAt(camera.position);
        }
    });
    
    return (
        <group position={[x, y, z]} scale={scale} ref={meshRef}>
            {isFocused ? (
                // When focused, look at camera directly
                <mesh onClick={() => onFocus(null)}>
                    <planeGeometry args={[1.2, 1.5]} />
                    <meshStandardMaterial 
                        map={photo.texture} 
                        side={THREE.DoubleSide}
                    />
                </mesh>
            ) : (
                <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
                    <mesh onClick={() => onFocus(index)} rotation={isLandscape ? [0, 0, Math.PI / 2] : [0, 0, 0]}>
                        {/* Polaroid frame */}
                        <planeGeometry args={[1.2, 1.5]} />
                        <meshStandardMaterial color="#ffffff" />
                    </mesh>
                    <mesh position={[0, 0.05, 0.01]} rotation={isLandscape ? [0, 0, Math.PI / 2] : [0, 0, 0]}>
                        <planeGeometry args={[1.0, 1.0]} />
                        <meshStandardMaterial map={photo.texture} />
                    </mesh>
                    <Text 
                        position={[0, -0.6, 0.01]} 
                        fontSize={0.08} 
                        color="#333"
                        anchorX="center"
                    >
                        {photo.name || `Memory ${index + 1}`}
                    </Text>
                </Billboard>
            )}
        </group>
    );
};

const Nebula = ({ visible }) => {
    const groupRef = useRef();
    const pointsRef = useRef();
    const { camera } = useThree();
    const phase = useStore((state) => state.phase);
    const gesture = useStore((state) => state.gesture);
    const photos = useStore((state) => state.photos);
    const targetPhotoId = useStore((state) => state.targetPhotoId);
    const setTargetPhotoId = useStore((state) => state.setTargetPhotoId);
    
    const [rotation, setRotation] = React.useState(0);
    const [focusedIndex, setFocusedIndex] = React.useState(null);
    const [lastGesture, setLastGesture] = React.useState('None');
    
    const photoCount = Math.max(photos.length, 24);
    const radius = 8;
    
    // Generate placeholder photos if needed
    const displayPhotos = useMemo(() => {
        const result = [...photos];
        while (result.length < 24) {
            // Create placeholder
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            const hue = (result.length * 25) % 360;
            ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
            ctx.fillRect(0, 0, 512, 512);
            ctx.fillStyle = '#fff';
            ctx.font = '48px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`Memory ${result.length + 1}`, 256, 256);
            
            const texture = new THREE.CanvasTexture(canvas);
            result.push({
                id: `placeholder-${result.length}`,
                texture,
                name: `Memory ${result.length + 1}`
            });
        }
        return result;
    }, [photos]);
    
    // Find nearest photo to screen center
    const findNearestPhotoToCenter = () => {
        if (!groupRef.current) return 0;
        
        const cameraDirection = new THREE.Vector3(0, 0, -1);
        cameraDirection.applyQuaternion(camera.quaternion);
        
        let minAngle = Infinity;
        let nearestIndex = 0;
        
        displayPhotos.forEach((photo, i) => {
            const angle = (i / displayPhotos.length) * Math.PI * 2;
            const photoPos = new THREE.Vector3(
                Math.cos(angle + groupRef.current.rotation.y) * radius,
                0,
                Math.sin(angle + groupRef.current.rotation.y) * radius
            );
            
            const dirToPhoto = photoPos.clone().sub(camera.position).normalize();
            const angleDiff = cameraDirection.angleTo(dirToPhoto);
            
            if (angleDiff < minAngle) {
                minAngle = angleDiff;
                nearestIndex = i;
            }
        });
        
        return nearestIndex;
    };
    
    // Handle gestures
    useEffect(() => {
        if (phase !== 'nebula') return;
        
        // Detect gesture change
        if (gesture !== lastGesture) {
            setLastGesture(gesture);
            
            if (gesture === 'Open_Palm') {
                // Rotate ring
                setRotation(r => r + 0.5);
            } else if (gesture === 'Pinch') {
                // Focus on nearest photo
                if (focusedIndex === null) {
                    const nearest = findNearestPhotoToCenter();
                    console.log("Focusing on photo", nearest);
                    setFocusedIndex(nearest);
                } else {
                    // Unfocus
                    setFocusedIndex(null);
                }
            }
        }
    }, [gesture, phase, focusedIndex, lastGesture]);

    useFrame((state, delta) => {
        if (!visible || phase !== 'nebula') return;
        // Gentle rotation when not focused
        if (groupRef.current && focusedIndex === null) {
            groupRef.current.rotation.y += delta * 0.05;
        }
    });

    if (!visible && phase !== 'nebula') return null;

    return (
        <group ref={groupRef} rotation={[0, rotation, 0]}>
             {/* Ring of Photos */}
             {displayPhotos.map((photo, i) => (
                 <SmartPhoto 
                     key={photo.id} 
                     photo={photo} 
                     index={i} 
                     totalPhotos={displayPhotos.length}
                     radius={radius}
                     isFocused={focusedIndex === i}
                     onFocus={setFocusedIndex}
                 />
             ))}
             
             {/* Nebula particles */}
             <points>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={500}
                        array={new Float32Array(500 * 3).map((_, i) => {
                            const angle = Math.random() * Math.PI * 2;
                            const r = radius + (Math.random() - 0.5) * 3;
                            if (i % 3 === 0) return Math.cos(angle) * r;
                            if (i % 3 === 1) return (Math.random() - 0.5) * 0.8;
                            return Math.sin(angle) * r;
                        })}
                        itemSize={3}
                    />
                </bufferGeometry>
                <pointsMaterial size={0.05} color="#ffd700" transparent opacity={0.6} />
             </points>
        </group>
    );
};

export default Nebula;
