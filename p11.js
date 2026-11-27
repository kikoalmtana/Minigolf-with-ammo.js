import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

let camera, controls, scene, renderer;
const clock = new THREE.Clock();

// Mundo físico con Ammo
let physicsWorld;
const gravityConstant = 9.8;
let collisionConfiguration;
let dispatcher;
let broadphase;
let solver;
const margin = 0.05; //margen colisiones

// Objetos rígidos
const rigidBodies = [];

const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();

let transformAux1;

// ---------- Parámetros del terreno (heightfield) ----------
const terrainWidthExtents = 30;
const terrainDepthExtents = 30;
const terrainWidth = 128;
const terrainDepth = 128;
const terrainMaxHeight = 2;
const terrainMinHeight = -1;
let heightData = null;
let ammoHeightData = null;      
let terrainMesh;

// ---------- Parámetros del juego ----------
const ballRadius = 0.25;
const ballMass = 0.5;
let ball, ballBody;

const tee = new THREE.Vector2(-10, -10); 
const hole = new THREE.Vector2(9, 8);
const plateauHeight = 0.5;
const holeRadius = 1.3;
const holeDepth = 0.5;
let holeScored = false;

// ---------- Parámetros del golpeo ----------
const maxDrag = 4;
const maxImpulse = 10;
const minPower = 0.05;
const maxArrowLength = 4;
const stopSpeed = 0.3;

let aiming = false;
let aimArrow, dragLine;
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aimPoint = new THREE.Vector3();
const shotDir = new THREE.Vector3();
let shotPower = 0;

//Inicialización ammo
Ammo(Ammo).then(start);

function start() {
  //Datos de altura (antes de gráficos y física, ambos los usan)
  heightData = generateHeight(
    terrainWidth,
    terrainDepth,
    terrainMinHeight,
    terrainMaxHeight
  );
  //Elementos gráficos
  initGraphics();
  //Elementos del mundo físico
  initPhysics();
  //Objetos
  createObjects();
  //Eventos
  initInput();

  animationLoop();
}

function initGraphics() {
  //Cámara, escena, renderer y control de cámara
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.2,
    2000
  );
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfd1e5);
  camera.position.set(-18, 12, -18);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2, 0);
  controls.update();

  //Luces
  const ambientLight = new THREE.AmbientLight(0x707070);
  scene.add(ambientLight);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(-10, 18, 5);
  light.castShadow = true;
  const d = 22;
  light.shadow.camera.left = -d;
  light.shadow.camera.right = d;
  light.shadow.camera.top = d;
  light.shadow.camera.bottom = -d;
  light.shadow.camera.near = 2;
  light.shadow.camera.far = 80;
  light.shadow.mapSize.x = 2048;
  light.shadow.mapSize.y = 2048;
  scene.add(light);

  //Redimensión de la ventana
  window.addEventListener("resize", onWindowResize);
}

function initPhysics() {
  // Configuración Ammo
  // Colisiones
  collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
  // Gestor de colisiones convexas y cóncavas
  dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
  // Colisión fase amplia
  broadphase = new Ammo.btDbvtBroadphase();
  // Resuelve resricciones de reglas físicas como fuerzas, gravedad, etc.
  solver = new Ammo.btSequentialImpulseConstraintSolver();
  // Crea en mundo físico
  physicsWorld = new Ammo.btDiscreteDynamicsWorld(
    dispatcher,
    broadphase,
    solver,
    collisionConfiguration
  );
  // Establece gravedad
  physicsWorld.setGravity(new Ammo.btVector3(0, -gravityConstant, 0));

  transformAux1 = new Ammo.btTransform();
}

// ====================== TERRENO ======================

//Altura del campo de minigolf. Colinas suaves con zonas planas en salida y hoyo
function generateHeight(width, depth, minHeight, maxHeight) {
  const terrrain = new Float32Array(width * depth);
  let p = 0;

  for (let j = 0; j < depth; j++) {
    for (let i = 0; i < width; i++) {
      const x = (i / (width - 1) - 0.5) * terrainWidthExtents;
      const z = (j / (depth - 1) - 0.5) * terrainDepthExtents;

      let h = plateauHeight; // todo plano

      // Embudo del hoyo
      const dHole = Math.hypot(x - hole.x, z - hole.y);
      if (dHole < holeRadius) {
        h -= holeDepth * 0.5 * (1 + Math.cos((Math.PI * dHole) / holeRadius));
      }

      terrrain[p++] = THREE.MathUtils.clamp(h, minHeight, maxHeight);
    }
  }
  return terrrain;
}

//Altura del terreno en (x,z) por interpolación bilineal de heightData
function getHeightAt(x, z) {
  const fx = (x / terrainWidthExtents + 0.5) * (terrainWidth - 1);
  const fz = (z / terrainDepthExtents + 0.5) * (terrainDepth - 1);
  const i0 = THREE.MathUtils.clamp(Math.floor(fx), 0, terrainWidth - 2);
  const j0 = THREE.MathUtils.clamp(Math.floor(fz), 0, terrainDepth - 2);
  const tx = fx - i0;
  const tz = fz - j0;

  const h00 = heightData[j0 * terrainWidth + i0];
  const h10 = heightData[j0 * terrainWidth + i0 + 1];
  const h01 = heightData[(j0 + 1) * terrainWidth + i0];
  const h11 = heightData[(j0 + 1) * terrainWidth + i0 + 1];

  return (
    h00 * (1 - tx) * (1 - tz) +
    h10 * tx * (1 - tz) +
    h01 * (1 - tx) * tz +
    h11 * tx * tz
  );
}

//Malla gráfica del terreno
function createTerrainMesh() {
  const geometry = new THREE.PlaneGeometry(
    terrainWidthExtents,
    terrainDepthExtents,
    terrainWidth - 1,
    terrainDepth - 1
  );
  geometry.rotateX(-Math.PI / 2);

  //Modifica la componente y de cada vértice con la altura
  const vertices = geometry.attributes.position.array;
  for (let i = 0, j = 0, l = vertices.length; i < l; i++, j += 3) {
    vertices[j + 1] = heightData[i];
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhongMaterial({ color: 0x3a9d3a });
  terrainMesh = new THREE.Mesh(geometry, material);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);
}

//Forma física del terreno
function createTerrainShape() {
  const heightScale = 1; //no se usa con PHY_FLOAT
  const upAxis = 1; //eje y
  const hdt = "PHY_FLOAT";
  const flipQuadEdges = false;

  //Buffer en el heap de Ammo y copia de las alturas
  ammoHeightData = Ammo._malloc(4 * terrainWidth * terrainDepth);
  let p = 0;
  let p2 = 0;
  for (let j = 0; j < terrainDepth; j++) {
    for (let i = 0; i < terrainWidth; i++) {
      Ammo.HEAPF32[(ammoHeightData + p2) >> 2] = heightData[p];
      p++;
      p2 += 4; //4 bytes por float
    }
  }

  const heightFieldShape = new Ammo.btHeightfieldTerrainShape(
    terrainWidth,
    terrainDepth,
    ammoHeightData,
    heightScale,
    terrainMinHeight,
    terrainMaxHeight,
    upAxis,
    hdt,
    flipQuadEdges
  );

  //Escala horizontal
  const scaleX = terrainWidthExtents / (terrainWidth - 1);
  const scaleZ = terrainDepthExtents / (terrainDepth - 1);
  heightFieldShape.setLocalScaling(new Ammo.btVector3(scaleX, 1, scaleZ));
  heightFieldShape.setMargin(margin);

  return heightFieldShape;
}

//Cuerpo rígido estático del terreno
function createTerrainBody() {
  const groundShape = createTerrainShape();

  const groundTransform = new Ammo.btTransform();
  groundTransform.setIdentity();
  //Bullet recentra el heightfield en su caja envolvente, hay que desplazarlo
  groundTransform.setOrigin(
    new Ammo.btVector3(0, (terrainMaxHeight + terrainMinHeight) / 2, 0)
  );

  const groundMotionState = new Ammo.btDefaultMotionState(groundTransform);
  const groundBody = new Ammo.btRigidBody(
    new Ammo.btRigidBodyConstructionInfo(
      0,
      groundMotionState,
      groundShape,
      new Ammo.btVector3(0, 0, 0)
    )
  );
  groundBody.setFriction(0.8);
  groundBody.setRestitution(0.2);
  physicsWorld.addRigidBody(groundBody);
}

// ====================== OBJETOS ======================

function createObjects() {
  //Terreno: gráfico + física
  createTerrainMesh();
  createTerrainBody();

  //Bordes del campo
  createBorders();

  //Marca visual del hoyo (aro blanco) y de la salida
  const aro = new THREE.Mesh(
    new THREE.RingGeometry(holeRadius * 0.95, holeRadius, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  );
  aro.rotation.x = -Math.PI / 2;
  aro.position.set(
    hole.x,
    getHeightAt(hole.x, hole.y) + holeDepth + 0.02,
    hole.y
  );
  scene.add(aro);

  //Bola
  createBall();
}

//Cuatro muros alrededor del campo
function createBorders() {
  const grosor = 1;
  const alto = terrainMaxHeight - terrainMinHeight;
  const yc = (terrainMaxHeight + terrainMinHeight) / 2;
  const hx = terrainWidthExtents / 2 + grosor / 2;
  const hz = terrainDepthExtents / 2 + grosor / 2;
  const largoX = terrainWidthExtents + 2 * grosor;
  const largoZ = terrainDepthExtents + 2 * grosor;
  const mat = new THREE.MeshPhongMaterial({ color: 0x8b5a2b });
  quat.set(0, 0, 0, 1);

  const muros = [
    [largoX, alto, grosor, 0, yc, hz],
    [largoX, alto, grosor, 0, yc, -hz],
    [grosor, alto, largoZ, hx, yc, 0],
    [grosor, alto, largoZ, -hx, yc, 0],
  ];

  for (const [sx, sy, sz, x, y, z] of muros) {
    pos.set(x, y, z);
    const muro = createBoxWithPhysics(sx, sy, sz, 0, pos, quat, mat);
    muro.castShadow = true;
    muro.receiveShadow = true;
    muro.userData.physicsBody.setRestitution(0.6);
  }
}

function createBoxWithPhysics(sx, sy, sz, mass, pos, quat, material) {
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz, 1, 1, 1),
    material
  );
  const shape = new Ammo.btBoxShape(
    new Ammo.btVector3(sx * 0.5, sy * 0.5, sz * 0.5)
  );
  shape.setMargin(margin);

  createRigidBody(object, shape, mass, pos, quat);

  return object;
}

//Creación de cuerpo rígido, con masa, sujeto a fuerzas, colisiones...
function createRigidBody(object, physicsShape, mass, pos, quat, vel, angVel) {
  if (pos) {
    object.position.copy(pos);
  } else {
    pos = object.position;
  }
  if (quat) {
    object.quaternion.copy(quat);
  } else {
    quat = object.quaternion;
  }
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
  transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
  const motionState = new Ammo.btDefaultMotionState(transform);
  const localInertia = new Ammo.btVector3(0, 0, 0);
  physicsShape.calculateLocalInertia(mass, localInertia);
  const rbInfo = new Ammo.btRigidBodyConstructionInfo(
    mass,
    motionState,
    physicsShape,
    localInertia
  );
  const body = new Ammo.btRigidBody(rbInfo);

  body.setFriction(0.5);

  if (vel) {
    body.setLinearVelocity(new Ammo.btVector3(vel.x, vel.y, vel.z));
  }
  if (angVel) {
    body.setAngularVelocity(new Ammo.btVector3(angVel.x, angVel.y, angVel.z));
  }

  //Enlaza primitiva gráfica con física
  object.userData.physicsBody = body;

  scene.add(object);
  if (mass > 0) {
    rigidBodies.push(object);
    // Evita que el cuerpo se "duerma" (útil mientras no haya controles)
    body.setActivationState(4);
  }
  physicsWorld.addRigidBody(body);

  return body;
}

//Bola de golf
function createBall() {
  ball = new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius, 24, 16),
    new THREE.MeshPhongMaterial({ color: 0xffffff })
  );
  ball.castShadow = true;
  ball.receiveShadow = true;

  const ballShape = new Ammo.btSphereShape(ballRadius);
  ballShape.setMargin(margin);

  pos.set(tee.x, getHeightAt(tee.x, tee.y) + ballRadius + 0.02, tee.y);
  quat.set(0, 0, 0, 1);
  ballBody = createRigidBody(ball, ballShape, ballMass, pos, quat);

  //Para que la bola acabe parándose
  ballBody.setFriction(0.6);
  ballBody.setRestitution(0.5);
  ballBody.setRollingFriction(0.05);
  ballBody.setDamping(0.25, 0.5); //lineal, angular
}

//Coloca de nuevo la bola en la salida
function resetBall() {
  const t = new Ammo.btTransform();
  t.setIdentity();
  t.setOrigin(
    new Ammo.btVector3(
      tee.x,
      getHeightAt(tee.x, tee.y) + ballRadius + 0.02,
      tee.y
    )
  );
  t.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
  ballBody.setWorldTransform(t);
  ballBody.getMotionState().setWorldTransform(t);
  ballBody.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
  ballBody.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
  ballBody.activate();
  holeScored = false;
}

//La bola está en el hoyo si está cerca del centro del embudo y en el fondo
function checkHole() {
  if (holeScored) return;
  const dx = ball.position.x - hole.x;
  const dz = ball.position.z - hole.y;
  const dist = Math.hypot(dx, dz);
  const fondo = getHeightAt(hole.x, hole.y) + ballRadius;

  if (dist < 0.5 && ball.position.y < fondo + 0.15) {
    holeScored = true;
  }

  //Si la bola se sale del campo
  if (ball.position.y < terrainMinHeight - 5) resetBall();
}

// ====================== GOLPEO DE LA BOLA ======================

function pointerToPlane(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const m = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(m, camera);
  aimPlane.constant = -ball.position.y;
  return ray.ray.intersectPlane(aimPlane, aimPoint) !== null;
}

function ballIsHittable() {
  return ballBody.getLinearVelocity().length() < stopSpeed;
}

function onPointerDown(event) {
  if (!ballIsHittable()) return;

  const rect = renderer.domElement.getBoundingClientRect();
  const m = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(m, camera);
  if (ray.ray.distanceToPoint(ball.position) > 0.8) return;

  aiming = true;
  controls.enabled = false;
  aimArrow.visible = true;
  dragLine.visible = true;
  onPointerMove(event);
}

function onPointerMove(event) {
  if (!aiming) return;
  if (!pointerToPlane(event)) return;

  // Vector de arrastre (bola → puntero), solo en horizontal
  const drag = aimPoint.clone().sub(ball.position);
  drag.y = 0;

  const len = Math.min(drag.length(), maxDrag);
  shotPower = len / maxDrag; // 0..1

  // El golpe va en sentido contrario al arrastre
  if (drag.lengthSq() > 1e-6) {
    shotDir.copy(drag).normalize().negate();
  }

  // Flecha: dirección, longitud y color (verde → rojo) según la potencia
  const origin = ball.position.clone();
  origin.y += 0.05;
  const arrowLen = Math.max(0.3, shotPower * maxArrowLength);
  aimArrow.position.copy(origin);
  aimArrow.setDirection(shotDir);
  aimArrow.setLength(arrowLen, Math.min(0.5, arrowLen * 0.4), 0.3);
  aimArrow.setColor(new THREE.Color().setHSL((1 - shotPower) / 3, 1, 0.5));

  // Línea de arrastre (limitada a maxDrag)
  const end = origin
    .clone()
    .addScaledVector(shotDir, -len);
  const p = dragLine.geometry.attributes.position;
  p.setXYZ(0, origin.x, origin.y, origin.z);
  p.setXYZ(1, end.x, end.y, end.z);
  p.needsUpdate = true;
}

function onPointerUp() {
  if (!aiming) return;
  aiming = false;
  controls.enabled = true;
  aimArrow.visible = false;
  dragLine.visible = false;

  if (shotPower < minPower) {
    return; // arrastre demasiado corto: se cancela
  }

  const imp = shotPower * maxImpulse;
  ballBody.activate();
  ballBody.applyCentralImpulse(
    new Ammo.btVector3(shotDir.x * imp, 0, shotDir.z * imp)
  );
}

// ====================== EVENTOS ======================

function initInput() {
  // Flecha de dirección/potencia
  aimArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(),
    1,
    0x00ff00,
    0.4,
    0.3
  );
  aimArrow.visible = false;
  scene.add(aimArrow);

  // Línea de "tirachinas" desde la bola hasta el punto de arrastre
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);
  dragLine = new THREE.Line(
    lineGeo,
    new THREE.LineBasicMaterial({ color: 0xffffff })
  );
  dragLine.frustumCulled = false;
  dragLine.visible = false;
  scene.add(dragLine);

  const canvas = renderer.domElement;
  canvas.style.touchAction = "none"; // para que funcione también en táctil

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  window.addEventListener("keydown", function (event) {
    if (event.key === "r" || event.key === "R") resetBall();
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ====================== BUCLE ======================

function animationLoop() {
  requestAnimationFrame(animationLoop);

  const deltaTime = clock.getDelta();
  updatePhysics(deltaTime);
  checkHole();

  renderer.render(scene, camera);
}

function updatePhysics(deltaTime) {
  physicsWorld.stepSimulation(deltaTime, 10);

  for (let i = 0, il = rigidBodies.length; i < il; i++) {
    const objThree = rigidBodies[i];
    const objPhys = objThree.userData.physicsBody;
    const ms = objPhys.getMotionState();
    if (ms) {
      ms.getWorldTransform(transformAux1);
      const p = transformAux1.getOrigin();
      const q = transformAux1.getRotation();
      objThree.position.set(p.x(), p.y(), p.z());
      objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());
    }
  }
}