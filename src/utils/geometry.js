import * as THREE from 'three';

/**
 * Generates points in a cone shape for the Christmas tree.
 */
export const generateTreePoints = (count, height = 10, radius = 5) => {
  const points = [];
  for (let i = 0; i < count; i++) {
    // Adjusted distribution for slightly denser top:
    // Changing power from 1/3 (perfectly uniform volume) to 1/2.2 (slightly top-biased)
    const h = height * (1 - Math.pow(Math.random(), 1 / 2.2));
    
    // Radius at this height
    const r = ((height - h) / height) * radius;
    const angle = Math.random() * Math.PI * 2;
    
    // Squareroot distribution for radius within the circle cross-section
    const x = Math.cos(angle) * r * Math.pow(Math.random(), 0.5);
    const y = h - height / 2;
    const z = Math.sin(angle) * r * Math.pow(Math.random(), 0.5);
    
    points.push(new THREE.Vector3(x, y, z));
  }
  return points;
};

/**
 * Generates points in a large ring/nebula shape.
 */
export const generateNebulaPoints = (count, radius = 10, thickness = 0.5) => {
  const points = [];
  const tiltAngle = Math.PI * 0.03; // Very subtle tilt (~5 degrees)
  
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const currentThickness = thickness * (Math.random() + 0.2); 
    
    const radialOffset = (Math.random() - 0.5) * currentThickness;
    const r = radius + radialOffset;
    
    // Initial flat ring position
    let x = Math.cos(angle) * r;
    let z = Math.sin(angle) * r;
    let y = (Math.random() - 0.5) * currentThickness - 1.5; 
    
    // Apply tilt (Rotation around X axis)
    const tiltedY = y * Math.cos(tiltAngle) - z * Math.sin(tiltAngle);
    const tiltedZ = y * Math.sin(tiltAngle) + z * Math.cos(tiltAngle);
    
    points.push(new THREE.Vector3(x, tiltedY, tiltedZ));
  }
  return points;
};


/**
 * Generates points for a spiral ornament distribution.
 */
export const generateSpiralPoints = (count, height = 10, radius = 5, turns = 5) => {
  const points = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    // Adjusted distribution for denser top on spiral:
    // Changing from sqrt(1-t) to (1-t)^(1/1.6) to bias points upwards
    const h = height * (1 - Math.pow(1 - t, 1 / 1.6));
    
    const r = ((height - h) / height) * radius;
    const angle = (h / height) * Math.PI * 2 * turns;
    
    const x = Math.cos(angle) * r;
    const y = h - height / 2;
    const z = Math.sin(angle) * r;
    
    points.push(new THREE.Vector3(x, y, z));
  }
  return points;
};
