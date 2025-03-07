import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DragControls } from 'three/addons/controls/DragControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';



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
            //console.log(wireframeBox.position.y)
            snapCarrierTargetsArray.push(wireframeBox)
            scene.add(wireframeBox);
        }
    });
});


var draggableObjectsArray = [];
var snapPlateTargetsArray = [];
var snapCarrierTargetsArray = [];


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
    const draggableBox = new THREE.Box3().setFromObject(draggableObj);
    console.log("Draggable")
    //console.log(draggableObj)

    snapPlateTargetsArray.forEach(target => {
        const targetBox = createBoundingBox(target)
        if (draggableBox.intersectsBox(targetBox) & draggableObj.parent.userData.resource_type == "plate") {
            //visualizeBox3(targetBox)
            target.attach(draggableObj.parent)
            draggableBox.visible = true;
            console.log("target")
            //console.log(target)

            const targetCenter = new THREE.Vector3();
            const draggableCenter = new THREE.Vector3();

            targetBox.getCenter(targetCenter);
            draggableBox.getCenter(draggableCenter);

            const offset = new THREE.Vector3().subVectors(targetCenter, draggableCenter);
            offset.divideScalar(2)
            draggableObj.position.add(offset);


        }


    });

    snapCarrierTargetsArray.forEach(target => {
        const targetBox = createBoundingBox(target)
        if (draggableBox.intersectsBox(targetBox) & draggableObj.parent.userData.resource_type == "carrier") {
            //visualizeBox3(targetBox)
            target.attach(draggableObj.parent)
            draggableBox.visible = true;
            //console.log("target")
            //console.log(target)

            const targetCenter = new THREE.Vector3();
            const draggableCenter = new THREE.Vector3();

            //console.log("Position update")
            targetBox.getCenter(targetCenter);
            draggableBox.getCenter(draggableCenter);
            //console.log(draggableObj.position)
            const offset = new THREE.Vector3().subVectors(targetCenter, draggableCenter);
            offset.divideScalar(2)
            draggableObj.position.add(offset);
            //console.log(draggableObj.position)


        }


    });

}

function checkNonIntersectionAndDetach(draggableObj) {
    const parent = draggableObj.parent.parent;
    // Check if draggableObj is still intersecting with its parent
    if (snapPlateTargetsArray.includes(parent) || snapCarrierTargetsArray.includes(parent)) {
        scene.attach(draggableObj.parent)
        draggableObjectsArray.push(draggableObj)
    }
}


function setupDragControls(dragControls) {
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


const objLoader1 = new OBJLoader();
//const axesHelper = new THREE.AxesHelper(5); // The size can be adjusted to fit your scene scale
//scene.add(axesHelper);

// Dimensions for the wireframe box
const dimensionsVector = new THREE.Vector3(127 * 0.002, 5 * 0.002, 86 * 0.002);

// Translation vector from the FBL corner
const translationVector = new THREE.Vector3(4 * 0.002, 86.15 * 0.002, -8.5 * 0.002 - 86 * 0.002);

const shiny_material = new THREE.MeshPhongMaterial( { 
    color: 0x535353,
    specular: 0x050505,
    shininess: 100,
} ) 


objLoader1.load('models/PLT_CAR_L5AC_A00.obj', (object) => {
    object.scale.set(2, 2, 2);

    object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.material = shiny_material; // Muted salmon pink color
        }
    });


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

        snapPlateTargetsArray.push(wireframeMesh);  // Assuming snapTargetsArray is defined elsewhere
    }
    // Set position of the wireframe box
    //wireframeMesh.position.copy(object.position).add(translationVector);

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

        // Set color to a dark gray
        object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.material.color.set(0x535353); // Dark gray color
                // Uncomment below to set bounding box if createBoundingBox function is defined
                // child.userData.boundingBox = createBoundingBox(child);
            }
        });

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


        // Add the object to the scene
        const dragControls1 = new DragControls(draggableObjectsArray, camera, renderer.domElement);
        controls.recursive = false;

        // For draggable functionality, ensure only the main object is draggable
        //console.log(object)
        // Setup drag controls
        scene.add(object);
        draggableObjectsArray.push(object);
        //object.position.add(new THREE.Vector3(0, 0.1, 1));  // Translate the position by (0, -1, 0.1)
        console.log("scene")
        object.userData.boundingBox = createBoundingBox(object)
        //visualizeBox3(object.userData.boundingBox)
        //setupDragControls(dragControls1);
    });
})

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


        // Add the object to the scene
        const dragControls1 = new DragControls(draggableObjectsArray, camera, renderer.domElement);
        controls.recursive = false;

        // For draggable functionality, ensure only the main object is draggable
        //console.log(object)
        // Setup drag controls
        scene.add(object);
        draggableObjectsArray.push(object);
        //object.position.add(new THREE.Vector3(0, 0.1, 1));  // Translate the position by (0, -1, 0.1)
        console.log("scene")
        object.userData.boundingBox = createBoundingBox(object)
        //visualizeBox3(object.userData.boundingBox)
        //setupDragControls(dragControls1);
    });
})


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
    updateBoundingBoxes()


    renderer.render(scene, camera);
};

// Start the animation loop
animate();
