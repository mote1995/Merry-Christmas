import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const Snowflakes = () => {
    const pointsRef = useRef();
    const count = 200;
    
    const [positions, velocities] = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const vel = new Float32Array(count);
        
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 30;
            pos[i * 3 + 1] = Math.random() * 20 - 5;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
            vel[i] = 0.01 + Math.random() * 0.02;
        }
        
        return [pos, vel];
    }, []);
    
    useFrame(() => {
        if (!pointsRef.current) return;
        
        const pos = pointsRef.current.geometry.attributes.position.array;
        
        for (let i = 0; i < count; i++) {
            pos[i * 3 + 1] -= velocities[i];
            
            if (pos[i * 3 + 1] < -10) {
                pos[i * 3 + 1] = 10;
            }
        }
        
        pointsRef.current.geometry.attributes.position.needsUpdate = true;
    });
    
    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={count}
                    array={positions}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial 
                size={0.1} 
                color="#ffffff" 
                transparent 
                opacity={0.8}
                sizeAttenuation 
            />
        </points>
    );
};

export default Snowflakes;
