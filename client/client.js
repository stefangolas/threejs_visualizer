import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DragControls } from 'three/examples/jsm/controls/DragControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

// Set up layers
const DRAGGABLE_LAYER = 0;
const SNAP_TARGET_LAYER = 1;

// Create scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

// Create a small bright sphere
const sphereGeometry = new THREE.SphereGeometry(0.1, 32, 32);
const sphereMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1
});
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphere.position.set(0, 2, 0); // Start above the scene
scene.add(sphere);

// Variables for animation
let isAnimating = false;
let targetPosition = new THREE.Vector3();
const animationSpeed = 0.1;

// Function to send sphere position to server
async function sendSpherePosition(position) {
    try {
        const response = await fetch('/move-sphere', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                x: position.x,
                y: position.y,
                z: position.z
            }),
        });
        if (!response.ok) {
            throw new Error('Failed to send sphere position');
        }
    } catch (error) {
        console.error('Error sending sphere position:', error);
    }
}

// Function to fetch sphere position from server
async function fetchSpherePosition() {
    try {
        const response = await fetch('/sphere-position');
        if (!response.ok) {
            throw new Error('Failed to fetch sphere position');
        }
        const position = await response.json();
        targetPosition.set(position.x, position.y, position.z);
        isAnimating = true;
    } catch (error) {
        console.error('Error fetching sphere position:', error);
    }
}

// Set up periodic position fetching
setInterval(fetchSpherePosition, 1000);

// Click event handler
window.addEventListener('click', (event) => {
    // Convert click to normalized device coordinates
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );

    // Raycaster for converting 2D click to 3D position
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Get intersection with an invisible plane at y=0
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectionPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectionPoint);

    // Send the new position to the server
    sendSpherePosition(intersectionPoint);
});

// Create camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 8, 5);
camera.lookAt(scene.position);
scene.add(camera);

// Create renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create a container for position readouts
const readoutContainer = document.createElement('div');
readoutContainer.style.position = 'absolute';
readoutContainer.style.top = '10px';
readoutContainer.style.left = '10px';
readoutContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
readoutContainer.style.color = 'white';
readoutContainer.style.padding = '10px';
readoutContainer.style.fontFamily = 'monospace';
readoutContainer.style.fontSize = '12px';
readoutContainer.style.borderRadius = '5px';
readoutContainer.style.maxHeight = '300px';
readoutContainer.style.overflowY = 'auto';
readoutContainer.style.zIndex = '1000';
document.body.appendChild(readoutContainer);

// Function to update position readouts
function updatePositionReadouts() {
    readoutContainer.innerHTML = '<h3>Position Readouts</h3>';
    
    // Add plate centers
    readoutContainer.innerHTML += '<h4>Plate Centers:</h4>';
    const plateObjects = scene.children.filter(obj => obj.userData.resource_type === "plate");
    plateObjects.forEach((plate, index) => {
        const box = new THREE.Box3().setFromObject(plate);
        const center = new THREE.Vector3();
        box.getCenter(center);
        readoutContainer.innerHTML += `Plate ${index}: (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})<br>`;
    });
    
    // Add snap target centers
    readoutContainer.innerHTML += '<h4>Snap Target Centers:</h4>';
    snapPlateTargetsArray.forEach((target, index) => {
        const box = createBoundingBox(target);
        const center = new THREE.Vector3();
        box.getCenter(center);
        readoutContainer.innerHTML += `Target ${index}: (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})<br>`;
    });

    // Add grid visualization positions
    if (currentGridVisualization) {
        readoutContainer.innerHTML += '<h4>Grid Visualization:</h4>';
        
        // Get grid global position
        const gridGlobalPos = new THREE.Vector3();
        currentGridVisualization.getWorldPosition(gridGlobalPos);
        readoutContainer.innerHTML += `Global Position: (${gridGlobalPos.x.toFixed(3)}, ${gridGlobalPos.y.toFixed(3)}, ${gridGlobalPos.z.toFixed(3)})<br>`;
        
        // Get grid local position
        const gridLocalPos = currentGridVisualization.position;
        readoutContainer.innerHTML += `Local Position: (${gridLocalPos.x.toFixed(3)}, ${gridLocalPos.y.toFixed(3)}, ${gridLocalPos.z.toFixed(3)})<br>`;
        
        // Get parent plate position
        const parentPlate = currentGridVisualization.parent;
        if (parentPlate) {
            const plateWorldPos = new THREE.Vector3();
            parentPlate.getWorldPosition(plateWorldPos);
            readoutContainer.innerHTML += `Parent Plate Position: (${plateWorldPos.x.toFixed(3)}, ${plateWorldPos.y.toFixed(3)}, ${plateWorldPos.z.toFixed(3)})<br>`;
            
            // Calculate offset from parent plate
            const offset = new THREE.Vector3().subVectors(gridGlobalPos, plateWorldPos);
            readoutContainer.innerHTML += `Offset from Parent: (${offset.x.toFixed(3)}, ${offset.y.toFixed(3)}, ${offset.z.toFixed(3)})<br>`;
        }
    }
}

// Store circle grid configuration
const gridConfig = {
    rows: 8,
    cols: 12,
    x_offset: -0.005,
    z_offset: 0.004,
    y_offset: 0.02,
    radius: 3.25 * 0.004,
    spacing: 9.5 * 0.004,
    positions: []
};

// Calculate and store circle positions
for (let row = 0; row < gridConfig.rows; row++) {
    for (let col = 0; col < gridConfig.cols; col++) {
        gridConfig.positions.push({
            x: (col - (gridConfig.cols - 1) / 2) * gridConfig.spacing + gridConfig.x_offset,
            z: (row - (gridConfig.rows - 1) / 2) * gridConfig.spacing + gridConfig.z_offset,
            y: gridConfig.y_offset
        });
    }
}

let currentGridVisualization = null;

// Function to remove current grid visualization
function removeGridVisualization() {
    if (currentGridVisualization) {
        // Remove from parent plate instead of scene
        if (currentGridVisualization.parent) {
            currentGridVisualization.parent.remove(currentGridVisualization);
        }
        currentGridVisualization = null;
    }
}

// Create lights
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(1, 1, 1).normalize();
scene.add(directionalLight);

const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.7);
directionalLight2.position.set(-1, 0.5, -1).normalize();
scene.add(directionalLight2);

const pointLight = new THREE.PointLight(0xffffff, 0.5);
pointLight.position.set(0, 5, 0);
scene.add(pointLight);

// Enable shadows
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
directionalLight.castShadow = true;

// Create an array to hold draggable objects
const draggableObjects = [];

var draggableObjectsArray = [];
var snapPlateTargetsArray = [];
var snapCarrierTargetsArray = [];

// Function to set an object to the draggable layer
function setAsDraggable(object) {
    object.traverse(child => {
        child.layers.set(DRAGGABLE_LAYER);
    });
    object.layers.set(DRAGGABLE_LAYER);
}

// Function to set an object to the snap target layer
function setAsSnapTarget(object) {
    object.traverse(child => {
        child.layers.set(SNAP_TARGET_LAYER);
    });
    object.layers.set(SNAP_TARGET_LAYER);
}

function updateBoundingBoxes() {
    snapPlateTargetsArray.forEach(mesh => {
        mesh.userData.boundingBox = createBoundingBox(mesh);
    });
}

let isDraggingObject = false;

// Create a box geometry with dimensions x = 127, y = 86, z = 20
const boundingBoxGeometry = new THREE.BoxGeometry(127 * 0.004, 20 * 0.004, 86 * 0.004);

const boundingBoxMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
const box3 = new THREE.LineSegments(new THREE.EdgesGeometry(boundingBoxGeometry), boundingBoxMaterial);

function createBoundingBox(mesh) {
    const boundingBox = new THREE.Box3().setFromObject(mesh);
    return boundingBox;
}

function checkIntersectionAndSnap(draggableObj) {
    if (!draggableObj.parent) return;
    
    const resourceType = draggableObj.parent.userData.resource_type;
    if (!resourceType) return;
    
    const draggableBox = new THREE.Box3().setFromObject(draggableObj.parent);
    const intersectingTargets = [];
    
    const targetArray = resourceType === "plate" ? snapPlateTargetsArray : 
                        resourceType === "carrier" ? snapCarrierTargetsArray : [];
    
    targetArray.forEach(target => {
        const targetBox = createBoundingBox(target);
        
        if (draggableBox.intersectsBox(targetBox)) {
            const targetCenter = new THREE.Vector3();
            const draggableCenter = new THREE.Vector3();
            
            targetBox.getCenter(targetCenter);
            draggableBox.getCenter(draggableCenter);
            
            const distance = targetCenter.distanceTo(draggableCenter);
            
            intersectingTargets.push({
                target: target,
                distance: distance,
                center: targetCenter
            });
        }
    });
    
    if (intersectingTargets.length > 0) {
        intersectingTargets.sort((a, b) => a.distance - b.distance);
        const closestTarget = intersectingTargets[0];
        
        draggableObj.parent.userData.snapTarget = closestTarget.target;
        
        const draggableCenter = new THREE.Vector3();
        draggableBox.getCenter(draggableCenter);
        
        const worldOffset = new THREE.Vector3().subVectors(closestTarget.center, draggableCenter);
        draggableObj.parent.position.add(worldOffset);
        
        if (resourceType === "plate" && closestTarget.target.parent && 
            closestTarget.target.parent.parent && 
            closestTarget.target.parent.parent.userData.resource_type === "carrier") {
            
            const carrier = closestTarget.target.parent.parent;
            
            draggableObj.parent.userData.attachedToCarrier = carrier;
            draggableObj.parent.userData.attachedToTarget = closestTarget.target;
            
            const targetWorldPos = new THREE.Vector3();
            closestTarget.target.getWorldPosition(targetWorldPos);
            
            const plateWorldPos = new THREE.Vector3();
            draggableObj.parent.getWorldPosition(plateWorldPos);
            
            draggableObj.parent.userData.targetOffset = new THREE.Vector3().subVectors(plateWorldPos, targetWorldPos);
            
            console.log("Plate attached to carrier");
        }
        
        console.log(`Snapped ${resourceType} to target. Distance: ${closestTarget.distance.toFixed(4)}`);
    }
}

function checkNonIntersectionAndDetach(draggableObj) {
    if (draggableObj.parent.userData.snapTarget) {
        const draggableBox = new THREE.Box3().setFromObject(draggableObj);
        const targetBox = createBoundingBox(draggableObj.parent.userData.snapTarget);
        
        if (!draggableBox.intersectsBox(targetBox)) {
            if (draggableObj.parent.userData.resource_type === "plate" && 
                draggableObj.parent.userData.attachedToCarrier) {
                
                draggableObj.parent.userData.attachedToCarrier = null;
                draggableObj.parent.userData.attachedToTarget = null;
                draggableObj.parent.userData.targetOffset = null;
                
                console.log("Plate detached from carrier");
            }
            
            draggableObj.parent.userData.snapTarget = null;
            console.log("Detached from snap target");
        }
    }
}

function setupDragControls(dragControls) {
    dragControls.addEventListener('hoveron', function(event) {
        if (event.object.layers.test(new THREE.Layers().set(SNAP_TARGET_LAYER)) ||
            snapPlateTargetsArray.includes(event.object) || 
            snapCarrierTargetsArray.includes(event.object)) {
            dragControls.enabled = false;
        }
    });

    dragControls.addEventListener('hoveroff', function() {
        dragControls.enabled = true;
    });

    dragControls.addEventListener('dragstart', function (event) {
        console.log("DragStart:", event.object);

        controls.enabled = false;
        event.object.material.opacity = 0.5;
        removeGridVisualization();
        currentGridVisualization = createGridVisualizationFromMesh(event.object);
    });

    dragControls.addEventListener('dragend', function (event) {
        controls.enabled = true;
        event.object.material.opacity = 1.0;
        
        checkNonIntersectionAndDetach(event.object);
        checkIntersectionAndSnap(event.object);

        // Create new grid visualization after drag
        if (event.object.parent && event.object.parent.userData.resource_type === "plate") {
            // Grid is already added as child of plate, no need to add to scene
            
            // Log positions for debugging
            const gridWorldPos = new THREE.Vector3();
            //currentGridVisualization.getWorldPosition(gridWorldPos);
            const plateWorldPos = new THREE.Vector3();
            event.object.parent.getWorldPosition(plateWorldPos);
            console.log('Grid World Position:', gridWorldPos);
            console.log('Plate World Position:', plateWorldPos);
            removeGridVisualization();
            currentGridVisualization = createGridVisualizationFromMesh(event.object);
        }
    });
}

// Load MTL file
const mtlLoader = new MTLLoader();
mtlLoader.load('models/deck3.mtl', (materials) => {
    materials.preload();

    const objLoader = new OBJLoader();
    objLoader.setMaterials(materials);
    objLoader.load('models/deck3.obj', (object) => {
        object.scale.set(2, 2, 2);
        object.rotation.y = Math.PI;

        setAsDraggable(object);

        scene.add(object);
        draggableObjects.push(object);

        object.updateMatrixWorld(true);

        const boundingBox = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3();
        boundingBox.getSize(size);

        const heightPerBox = size.x / 5;

        for (let i = 0; i < 5; i++) {
            const wireframeGeometry = new THREE.BoxGeometry(heightPerBox * 0.1, size.y / 2, size.z);
            const wireframeMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                wireframe: true,
                transparent: true,
                opacity: 0.0
            });
            const wireframeBox = new THREE.Mesh(wireframeGeometry, wireframeMaterial);

            wireframeBox.position.z = boundingBox.getCenter(new THREE.Vector3()).z;
            wireframeBox.position.y = boundingBox.getCenter(new THREE.Vector3()).y + size.y / 2 + 95 * 0.002;
            wireframeBox.position.x = boundingBox.max.x + heightPerBox * (i + 0.5) - size.x;
            
            setAsSnapTarget(wireframeBox);
            
            snapCarrierTargetsArray.push(wireframeBox);
            scene.add(wireframeBox);
        }
    });
});

const objLoader1 = new OBJLoader();

const dimensionsVector = new THREE.Vector3(127 * 0.002, 5 * 0.002, 86 * 0.002);
const translationVector = new THREE.Vector3(4 * 0.002, 86.15 * 0.002, -8.5 * 0.002 - 86 * 0.002);

const metalMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x888888,
    metalness: 0.9,
    roughness: 0.2,
    envMapIntensity: 1.0
});

const shinyPlasticMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x535353,
    metalness: 0.1,
    roughness: 0.2,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2
});

const mattePlasticMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x535353,
    metalness: 0.0,
    roughness: 0.9
});

const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.0,
    roughness: 0.0,
    transmission: 0.9,
    transparent: true,
    opacity: 0.3
});

const envMapSize = 256;
const envMapRenderTarget = new THREE.WebGLCubeRenderTarget(envMapSize);
const envMapCamera = new THREE.CubeCamera(0.1, 1000, envMapRenderTarget);
scene.add(envMapCamera);

const envScene = new THREE.Scene();
envScene.background = new THREE.Color(0x444444);

const envSphereGeometry = new THREE.SphereGeometry(100, 16, 16);
const envSphereMaterial = new THREE.MeshBasicMaterial({ color: 0x888888 });
const envSphere = new THREE.Mesh(envSphereGeometry, envSphereMaterial);
envScene.add(envSphere);

envMapCamera.update(renderer, envScene);
scene.environment = envMapRenderTarget.texture;

function createGridVisualizationFromMesh(mesh) {
    if (!mesh) return null;

    // 1. Update transforms so we get fresh world positions
    mesh.updateMatrixWorld(true);

    // 2. Compute the bounding box center of the mesh in world space
    const box = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    box.getCenter(center); // World-space center of the mesh

    // 3. Create the grid group at that world position
    const gridGroup = new THREE.Group();
    gridGroup.position.copy(center);

    const circleGeometry = new THREE.CircleGeometry(gridConfig.radius, 32);
    const circleMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x4287f5,
        metalness: 0.4,
        roughness: 0.2,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
    });

    gridConfig.positions.forEach(pos => {
        const circle = new THREE.Mesh(circleGeometry, circleMaterial);
        circle.position.set(pos.x, pos.y, pos.z);
        circle.rotation.x = -Math.PI / 2;
        gridGroup.add(circle);
    });

    // 4. Add the grid directly to the scene (not as a child of the mesh)
    scene.add(gridGroup);

    return gridGroup;
}

objLoader1.load('models/PLT_CAR_L5AC_A00.obj', (object) => {
    object.scale.set(2, 2, 2);

    object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.material = metalMaterial;
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    setAsDraggable(object);

    const dragControls1 = new DragControls(draggableObjectsArray, camera, renderer.domElement);
    controls.recursive = false;
    const incrementZ = -96 * 0.002;

    for (let i = 0; i < 5; i++) {
        const wireframeGeometry = new THREE.BoxGeometry(dimensionsVector.x, dimensionsVector.y, dimensionsVector.z);
        const wireframeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, opacity: 0.0, transparent: true });
        const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
        const halfDimensions = new THREE.Vector3(dimensionsVector.x / 2, dimensionsVector.y / 2, dimensionsVector.z / 2);
        const finalTranslation = new THREE.Vector3().addVectors(translationVector, halfDimensions);

        finalTranslation.z += incrementZ * i;

        wireframeMesh.position.copy(object.position).add(finalTranslation);
        wireframeMesh.userData.boundingBox = createBoundingBox(wireframeMesh);
        object.children[0].add(wireframeMesh);
        wireframeMesh.visible = true;
        
        setAsSnapTarget(wireframeMesh);
        snapPlateTargetsArray.push(wireframeMesh);
    }

    object.userData.resource_type = "carrier";

    scene.add(object);
    draggableObjectsArray.push(object);
    object.position.add(new THREE.Vector3(0, 0.1, 1));

    setupDragControls(dragControls1);
});

const objLoader2 = new OBJLoader();
const numberOfInstances = 5;

const createPlateMaterial = (index) => {
    const hue = 0.05 + (index * 0.02);
    const color = new THREE.Color().setHSL(hue, 0.8, 0.7);
    
    return new THREE.MeshPhysicalMaterial({ 
        color: color,
        metalness: 0.0,
        roughness: 0.3,
        clearcoat: 0.5,
        clearcoatRoughness: 0.2,
        transmission: 0.2,
        transparent: true
    });
};

for (let i = 0; i < numberOfInstances; i++) {
    objLoader2.load('models/plate.obj', (object) => {
        object.scale.set(2, 2, 2);

        const plateMaterial = createPlateMaterial(i);
        
        object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.material = plateMaterial;
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        setAsDraggable(object);
        object.position.x = i * 0.1;
        object.userData.resource_type = "plate";
        object.userData.gridConfig = { ...gridConfig };

        draggableObjectsArray.push(object);
        scene.add(object);
        object.userData.boundingBox = createBoundingBox(object);
    });
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.screenSpacePanning = false;
controls.maxPolarAngle = Math.PI / 2;

window.addEventListener('resize', () => {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;

    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(newWidth, newHeight);
});

const animate = () => {
    requestAnimationFrame(animate);

    if (!isDraggingObject) {
        controls.update();
    }
    
    // Animate sphere movement
    if (isAnimating) {
        // Calculate direction and distance
        const direction = targetPosition.clone().sub(sphere.position);
        const distance = direction.length();
        
        if (distance > 0.01) {
            // Move towards target
            sphere.position.lerp(targetPosition, animationSpeed);
        } else {
            isAnimating = false;
        }
    }
    
    scene.children.forEach(obj => {
        if (obj.userData.resource_type === "plate" && 
            obj.userData.attachedToCarrier && 
            obj.userData.attachedToTarget) {
            
            const targetWorldPos = new THREE.Vector3();
            obj.userData.attachedToTarget.getWorldPosition(targetWorldPos);
            
            if (obj.userData.targetOffset) {
                obj.position.copy(targetWorldPos).add(obj.userData.targetOffset);
            } else {
                obj.position.copy(targetWorldPos);
            }
        }
    });
    
    const time = Date.now() * 0.001;
    pointLight.position.x = Math.sin(time) * 5;
    pointLight.position.z = Math.cos(time) * 5;
    
    updateBoundingBoxes();
    updatePositionReadouts();

    renderer.render(scene, camera);
};

animate();

// Make loadModel function available globally
window.loadModel = function(modelPath) {
    const objLoader = new OBJLoader();
    objLoader.load(modelPath, (object) => {
        object.scale.set(2, 2, 2);
        scene.add(object);
    });
};
