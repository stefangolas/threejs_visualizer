import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DragControls } from 'three/addons/controls/DragControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

// Set up layers
const DRAGGABLE_LAYER = 0;
const SNAP_TARGET_LAYER = 1;

// Create scene
const scene = new THREE.Scene();

// Create camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);
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
}

// Create lights
const ambientLight = new THREE.AmbientLight(0xfcfcfc);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(1, 1, 1).normalize();
scene.add(directionalLight);

// Create an array to hold draggable objects
const draggableObjects = [];

// Helper function to create a bounding box
/* function createBoundingBox(object) {
    const boundingBox = new THREE.BoxHelper(object, 0xffff00); // Yellow color
    boundingBox.visible = true;

    object.add(boundingBox);
    
    return boundingBox;
}
 */

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

const boundingBoxMaterial = new THREE.LineBasicMaterial({ color: 0xffffff }); // White color
const box3 = new THREE.LineSegments(new THREE.EdgesGeometry(boundingBoxGeometry), boundingBoxMaterial);

function createBoundingBox(mesh) {
    const boundingBox = new THREE.Box3().setFromObject(mesh);
    return boundingBox;
}

function checkIntersectionAndSnap(draggableObj) {
    // Skip if this isn't a draggable object with a parent
    if (!draggableObj.parent) return;
    
    // Get the resource type
    const resourceType = draggableObj.parent.userData.resource_type;
    if (!resourceType) return;
    
    // Create a bounding box for the draggable object
    const draggableBox = new THREE.Box3().setFromObject(draggableObj.parent);
    
    // Find all intersecting targets
    const intersectingTargets = [];
    
    // Choose the appropriate target array based on resource type
    const targetArray = resourceType === "plate" ? snapPlateTargetsArray : 
                        resourceType === "carrier" ? snapCarrierTargetsArray : [];
    
    // Find all intersecting targets and calculate distances
    targetArray.forEach(target => {
        // Get the target's world position by creating a bounding box
        const targetBox = createBoundingBox(target);
        
        if (draggableBox.intersectsBox(targetBox)) {
            // Calculate centers
            const targetCenter = new THREE.Vector3();
            const draggableCenter = new THREE.Vector3();
            
            targetBox.getCenter(targetCenter);
            draggableBox.getCenter(draggableCenter);
            
            // Calculate distance between centers
            const distance = targetCenter.distanceTo(draggableCenter);
            
            intersectingTargets.push({
                target: target,
                distance: distance,
                center: targetCenter
            });
        }
    });
    
    // If we found intersecting targets, snap to the closest one
    if (intersectingTargets.length > 0) {
        // Sort by distance (closest first)
        intersectingTargets.sort((a, b) => a.distance - b.distance);
        
        // Get the closest target
        const closestTarget = intersectingTargets[0];
        
        // Store reference to the snap target
        draggableObj.parent.userData.snapTarget = closestTarget.target;
        
        // Get draggable center
        const draggableCenter = new THREE.Vector3();
        draggableBox.getCenter(draggableCenter);
        
        // Calculate precise world position difference
        const worldOffset = new THREE.Vector3().subVectors(closestTarget.center, draggableCenter);
        
        // Apply offset to draggable object's world position
        draggableObj.parent.position.add(worldOffset);
        
        // If this is a plate snapping to a carrier target, store the carrier reference
        if (resourceType === "plate" && closestTarget.target.parent && 
            closestTarget.target.parent.parent && 
            closestTarget.target.parent.parent.userData.resource_type === "carrier") {
            
            // Get the carrier object (parent of the target)
            const carrier = closestTarget.target.parent.parent;
            
            // Store the carrier reference and target on the plate
            draggableObj.parent.userData.attachedToCarrier = carrier;
            draggableObj.parent.userData.attachedToTarget = closestTarget.target;
            
            // Calculate and store the offset between the plate and the target
            const targetWorldPos = new THREE.Vector3();
            closestTarget.target.getWorldPosition(targetWorldPos);
            
            const plateWorldPos = new THREE.Vector3();
            draggableObj.parent.getWorldPosition(plateWorldPos);
            
            // Store the initial offset
            draggableObj.parent.userData.targetOffset = new THREE.Vector3().subVectors(plateWorldPos, targetWorldPos);
            
            console.log("Plate attached to carrier");
        }
        
        // Log the snap for debugging
        console.log(`Snapped ${resourceType} to target. Distance: ${closestTarget.distance.toFixed(4)}`);
        console.log(`Target center: (${closestTarget.center.x.toFixed(3)}, ${closestTarget.center.y.toFixed(3)}, ${closestTarget.center.z.toFixed(3)})`);
        console.log(`Object center before snap: (${draggableCenter.x.toFixed(3)}, ${draggableCenter.y.toFixed(3)}, ${draggableCenter.z.toFixed(3)})`);
        
        // Verify final position
        const finalBox = new THREE.Box3().setFromObject(draggableObj.parent);
        const finalCenter = new THREE.Vector3();
        finalBox.getCenter(finalCenter);
        console.log(`Object center after snap: (${finalCenter.x.toFixed(3)}, ${finalCenter.y.toFixed(3)}, ${finalCenter.z.toFixed(3)})`);
    }
}

function checkNonIntersectionAndDetach(draggableObj) {
    // If the object has a snap target, check if it's still intersecting
    if (draggableObj.parent.userData.snapTarget) {
        const draggableBox = new THREE.Box3().setFromObject(draggableObj);
        const targetBox = createBoundingBox(draggableObj.parent.userData.snapTarget);
        
        // If no longer intersecting, clear the snap target reference
        if (!draggableBox.intersectsBox(targetBox)) {
            // If this is a plate attached to a carrier, clear the references
            if (draggableObj.parent.userData.resource_type === "plate" && 
                draggableObj.parent.userData.attachedToCarrier) {
                
                // Clear the carrier and target references
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
    // Only allow dragging objects on the draggable layer
    dragControls.addEventListener('hoveron', function(event) {
        // Check if the object is in a snap target array or on the snap target layer
        if (event.object.layers.test(new THREE.Layers().set(SNAP_TARGET_LAYER)) ||
            snapPlateTargetsArray.includes(event.object) || 
            snapCarrierTargetsArray.includes(event.object)) {
            // Prevent dragging by setting the enabled property temporarily
            dragControls.enabled = false;
        }
    });

    dragControls.addEventListener('hoveroff', function() {
        // Re-enable drag controls
        dragControls.enabled = true;
    });

    dragControls.addEventListener('dragstart', function (event) {
        controls.enabled = false;
        event.object.material.opacity = 0.5; // Optional: make the object semi-transparent when dragging
    });

    dragControls.addEventListener('dragend', function (event) {
        controls.enabled = true;
        event.object.material.opacity = 1.0; // Restore opacity after dragging
        
        checkNonIntersectionAndDetach(event.object);
        checkIntersectionAndSnap(event.object);
    });
}

// Load MTL file
const mtlLoader = new MTLLoader();
mtlLoader.load('models/deck3.mtl', (materials) => {
    materials.preload();

    // Load OBJ file with materials
    const objLoader = new OBJLoader();
    objLoader.setMaterials(materials);
    objLoader.load('models/deck3.obj', (object) => {
        object.scale.set(2, 2, 2); // Scale the model uniformly
        object.rotation.y = Math.PI;

        // Set the object to the draggable layer
        setAsDraggable(object);

        scene.add(object);
        draggableObjects.push(object);

        // Wait for the model to be added to the scene
        object.updateMatrixWorld(true);

        // Compute the bounding box of the loaded object
        const boundingBox = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3();
        boundingBox.getSize(size);

        // The height of each wireframe box above the model
        const heightPerBox = size.x / 5;

        // Create wireframe boxes
        for (let i = 0; i < 5; i++) {
            const wireframeGeometry = new THREE.BoxGeometry(heightPerBox * 0.1, size.y / 2, size.z);
            const wireframeMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                wireframe: true,
                transparent: true,
                opacity: 0.0
            });
            const wireframeBox = new THREE.Mesh(wireframeGeometry, wireframeMaterial);

            // Position the boxes above the model, dividing the space equally along the z-axis
            wireframeBox.position.z = boundingBox.getCenter(new THREE.Vector3()).z;
            wireframeBox.position.y = boundingBox.getCenter(new THREE.Vector3()).y + size.y / 2 + 95 * 0.002;
            wireframeBox.position.x = boundingBox.max.x + heightPerBox * (i + 0.5) - size.x;
            
            // Set the wireframe box to the snap target layer
            setAsSnapTarget(wireframeBox);
            
            snapCarrierTargetsArray.push(wireframeBox);
            scene.add(wireframeBox);
        }
    });
});

const objLoader1 = new OBJLoader();
//const axesHelper = new THREE.AxesHelper(5); // The size can be adjusted to fit your scene scale
//scene.add(axesHelper);

// Dimensions for the wireframe box
const dimensionsVector = new THREE.Vector3(127 * 0.002, 5 * 0.002, 86 * 0.002);

// Translation vector from the FBL corner
const translationVector = new THREE.Vector3(4 * 0.002, 86.15 * 0.002, -8.5 * 0.002 - 86 * 0.002);

const shiny_material = new THREE.MeshPhongMaterial({ 
    color: 0x535353,
    specular: 0x050505,
    shininess: 100,
});

objLoader1.load('models/PLT_CAR_L5AC_A00.obj', (object) => {
    object.scale.set(2, 2, 2);

    object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.material = shiny_material; // Muted salmon pink color
        }
    });

    // Set the object to the draggable layer
    setAsDraggable(object);

    // Add the object to the scene
    const dragControls1 = new DragControls(draggableObjectsArray, camera, renderer.domElement);
    controls.recursive = false;
    const incrementZ = -96 * 0.002;  // Calculate the increment value outside the loop for efficiency

    for (let i = 0; i < 5; i++) {
        const wireframeGeometry = new THREE.BoxGeometry(dimensionsVector.x, dimensionsVector.y, dimensionsVector.z);
        const wireframeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, opacity: 0.0, transparent: true });
        const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
        const halfDimensions = new THREE.Vector3(dimensionsVector.x / 2, dimensionsVector.y / 2, dimensionsVector.z / 2);
        const finalTranslation = new THREE.Vector3().addVectors(translationVector, halfDimensions);

        // Modify the z-coordinate of finalTranslation by the increment multiplied by the iteration index
        finalTranslation.z += incrementZ * i;

        // Set position of the wireframe box
        wireframeMesh.position.copy(object.position).add(finalTranslation);
        wireframeMesh.userData.boundingBox = createBoundingBox(wireframeMesh);  // Assuming createBoundingBox is defined elsewhere
        object.children[0].add(wireframeMesh);  // Assuming the object has at least one child and it's safe to add to it
        wireframeMesh.visible = true;
        
        // Set the wireframe mesh to the snap target layer
        setAsSnapTarget(wireframeMesh);
        
        snapPlateTargetsArray.push(wireframeMesh);  // Assuming snapTargetsArray is defined elsewhere
    }

    // Add translated wireframe box with specific dimensions
    object.userData.resource_type = "carrier";

    // For draggable functionality, ensure only the main object is draggable
    //console.log(object)
    // Setup drag controls
    scene.add(object);
    draggableObjectsArray.push(object);
    object.position.add(new THREE.Vector3(0, 0.1, 1));  // Translate the position by (0, -1, 0.1)

    setupDragControls(dragControls1);
});

// Load the second OBJ file
const objLoader2 = new OBJLoader();
const numberOfInstances = 5; // Define the number of instances you want to load

for (let i = 0; i < numberOfInstances; i++) {
    objLoader2.load('models/plate.obj', (object) => {
        object.scale.set(2, 2, 2);

        // Set color to salmon
        object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.material.color.set(0xFA8072); // Salmon color
                // Uncomment below to set bounding box if createBoundingBox function is defined
                // child.userData.boundingBox = createBoundingBox(child);
            }
        });

        // Set the object to the draggable layer
        setAsDraggable(object);

        // Adjusting position to avoid overlap, e.g., spaced along the x-axis
        object.position.x = i * 0.1; // Space them out by 5 units along the x-axis

        console.log("User data:");
        //console.log(object.userData);
        object.userData.resource_type = "plate";
        //console.log(object.userData);
        //console.log(object);

        draggableObjectsArray.push(object);
        scene.add(object);
        object.userData.boundingBox = createBoundingBox(object); // Calculate and store the bounding box if createBoundingBox is defined
    });
}

const mtlLoader1 = new MTLLoader();
mtlLoader1.load('models/gripper.mtl', (materials) => {
    materials.preload();

    const objLoader4 = new OBJLoader();
    objLoader4.load('models/gripper.obj', (object) => {
        object.scale.set(0.005, 0.005, 0.005);

/*         object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.material.color.set(0x707065); // Muted salmon pink color
            }
        });
 */        object.rotation.y = 3*Math.PI / 2;

        // Set the object to the draggable layer
        setAsDraggable(object);

        // Add the object to the scene
        const dragControls1 = new DragControls(draggableObjectsArray, camera, renderer.domElement);
        controls.recursive = false;

        // For draggable functionality, ensure only the main object is draggable
        //console.log(object)
        // Setup drag controls
        scene.add(object);
        draggableObjectsArray.push(object);
        //object.position.add(new THREE.Vector3(0, 0.1, 1));  // Translate the position by (0, -1, 0.1)
        console.log("scene");
        object.userData.boundingBox = createBoundingBox(object);
        //visualizeBox3(object.userData.boundingBox)
        //setupDragControls(dragControls1);
    });
});

const mtlLoader4 = new MTLLoader();
mtlLoader4.load('models/gripper.mtl', (materials) => {
    materials.preload();

    const objLoader4 = new OBJLoader();
    objLoader4.load('models/transfer_station.obj', (object) => {
        object.scale.set(0.004, 0.004, 0.004);

/*         object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.material.color.set(0x707065); // Muted salmon pink color
            }
        });
 */        

        // Set the object to the draggable layer
        setAsDraggable(object);

        // Add the object to the scene
        const dragControls1 = new DragControls(draggableObjectsArray, camera, renderer.domElement);
        controls.recursive = false;

        // For draggable functionality, ensure only the main object is draggable
        //console.log(object)
        // Setup drag controls
        scene.add(object);
        draggableObjectsArray.push(object);
        //object.position.add(new THREE.Vector3(0, 0.1, 1));  // Translate the position by (0, -1, 0.1)
        console.log("scene");
        object.userData.boundingBox = createBoundingBox(object);
        //visualizeBox3(object.userData.boundingBox)
        //setupDragControls(dragControls1);
    });
});

// Add OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.screenSpacePanning = false;
controls.maxPolarAngle = Math.PI / 2;

// Handle window resize
window.addEventListener('resize', () => {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;

    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(newWidth, newHeight);
});

// Animation loop
const animate = () => {
    requestAnimationFrame(animate);

    if (!isDraggingObject) {
        controls.update();
    }
    
    // Update positions of plates attached to carriers
    scene.children.forEach(obj => {
        if (obj.userData.resource_type === "plate" && 
            obj.userData.attachedToCarrier && 
            obj.userData.attachedToTarget) {
            
            // Get the world position of the target
            const targetWorldPos = new THREE.Vector3();
            obj.userData.attachedToTarget.getWorldPosition(targetWorldPos);
            
            // If there's a stored offset, apply it
            if (obj.userData.targetOffset) {
                obj.position.copy(targetWorldPos).add(obj.userData.targetOffset);
            } else {
                // Otherwise just match the target position
                obj.position.copy(targetWorldPos);
            }
        }
    });
    
    updateBoundingBoxes();
    updatePositionReadouts();

    renderer.render(scene, camera);
};

// Start the animation loop
animate();
