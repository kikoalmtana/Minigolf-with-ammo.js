# Minigolf con ammo.js

## Juan Francisco Almeida Santana | (ULPGC / EII)

### Introducción

En este repositorio se encuentra el proyecto correspondiente a la entrega de la práctica de la semana 11 de Informática Gráfica (IG), asignatura impartida por la Escuela de Ingeniería Informática (EII) en la ULPGC.

Para este proyecto se ha creado un minijuego utilizando el motor de físicas ammo.js, que consiste en un minigolf de 3 niveles.

En este repositorio se encuentra el código del proyecto, un video demostración del resultado final del proyecto y en este README se encuentra la explicación del código paso a paso, mostrando el progrreso del proyecto y explicando las decisiones de proyecto.

![Enlace al video de YouTube (demo)]()

### Índice

1. ![Inicialización del proyecto y creación del terreno](#inicializacion-del-proyecto-y-creacion-del-terreno)
2. ![Creación de la pelota]()
3. ![Introduciendo la mecánica de golpear la pelota]()
4. ![Diseño de niveles]()
5. ![Resultado final]()
6. ![Referencias y conversaciones con IA]()

### Inicialización del proyecto y creación del terreno

Inicializamos este proyecto tomando de base el código del ![script_45_ammo.js](https://github.com/otsedom/otsedom.github.io/blob/main/IG/S11/code/script_45_ammo.js) del ejemplo del guión de la práctica de la semana 11 de IG

De este codigo podemos reciclar muchas de sus funciones como por ejemplo initGraphics o start con algunas modificaciones, y debemos añadir parametros y funciones para incializar el terreno.

En este punto nos vamos a centrar únicamente en lo que necesitamos para inicializar el terreno:

Lo primero es crear las variables necesarias para almacenar los diferentes datos del terreno considerando un primer nivel único

```js
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
const tee = new THREE.Vector2(-10, -10); 
const hole = new THREE.Vector2(9, 8);
const plateauHeight = 0.5;
const holeRadius = 1.3;
const holeDepth = 0.5;
let holeScored = false;
```

Con estas constantes y variables definimos desde el tamaño del campo y sus limites de altura a los datos del juego, como por ejemplo la ubicación de inicio y la ubicación del agujero, su radio y profundidad...

Posteriormente debemos modificar algunas funciones que existían en el código de partida

- En la función start ahora debe inicializar tambien el terreno y los objetos nuevos que se añaden a la escena (terreno y pelota)

- En la función initGrpahics se modificaran algunos valores de constantes que se inicializan en esta función para adaptarlos al nuevo escenario

- La función initPhysics se mantiene igual al código de partida (lo único relacionado a esta función que cambia es la gravedad, que se definia como 7,8 y se define ahora como 9.8), igual que createBoxWithPhysics y createRigidBody

- La función createObjects se modifica para utilizar las funciones que se implementarán para cargar el terreno y próximamente se usará para crear la pelota en la escena

Una vez tenemos las funciones básicas de ammo.js implementadas podemos empezar a implementar funciones para crear el terreno usando las constantes que hemos declarado, para ello se crean las siguietnes funciones:

- **generateHeight**: Esta función se encarga de calcular el terreno, crea un terreno plano y el hoyo en el terreno usando las posiciones predefinidas, y devuelve la altura de cada punto (x,z) en cada coordenada de la escena en un terreno de 128x128.

- **getHeightAt**: Devuelve la altura de una coordenada concreta en la escena, en un punto (x,z), es útil para por ejemplo, saber donde se encuentra el hoyo.

- **createTerrainMesh**: Es la función que construye la malla visible del terreno en la escena usando el resultado de generateHeight y colorea el terreno.

- **createTerrainShape:** Es la función que se encarga de que el suelo tenga colisiones, es decir, que la pelota caiga en el terreno y "colisione" con él, de forma que la pelota no cae.

- **createTerrainBody:** Esta función convierte la forma del terreno en un cuerpo rígido y estático dentro de la escena

- **createBorders:** Esta función levanta los muros alrededor del campo creando cajas estáticas con createBoxWithPhysics, de forma que si la pelota colisiona con ellos rebotará

Con esto tendríamos por ahora un escenario muy básico básico, plano, sin obstáculos y con un hoyo

<img src=".//readme_assets/campo.png" alt="campo básico" width="100%">

### Creando la pelota

Para jugar al minigolf hace falta una pelota y debe ser posible poder meterla en el hoyo, por ello vamos a crear funciones que nos ayuden a crear la pelota, lo primero es inicializar variables donde almacenar la pelota y sus datos:

```js

const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();

...

const ballRadius = 0.25;
const ballMass = 0.5;
let ball, ballBody;
```

La pelota se representa con dos objetos enlazados:

- **ball**: la malla de three.js. Solo sirve para dibujarla y su posición se actualiza en cada frame a partir de la física.
- **ballBody**: el cuerpo rígido de Ammo. Guarda la posición y velocidad reales y es el que se debe modificar para mover la pelota (si se cambia ball.position a mano, la física lo sobrescribe en el siguiente frame).

Por otro lado, pos y quat son vectores auxiliares que se reutilizan para pasar la posición y orientación al crear los objetos, no almacenan el estado de la pelota.

Una vez definimos las constantes donde almacenamos el objeto, necesitamos funciones que nos permitan:

- Crear una pelota
- Resetear el estado de la pelota (ponerla en su posición de origen)
- Comprobar si la pelota está en el hoyo o no

Para ello se implementan las siguientes funciones:

```js
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
```
Nota: en la función initInupt se ha añadido un eventListener que comprueba si se ha presionado la tecla "R" o "r" y si ese es el caso, resetea la posición de la bola.

Luego solo queda llamar en createObjects() a createBall() y al método checkHole() en animationLoop(), justo después de updatePhysics().

<img src=".//readme_assets/campo_y_bola.png" alt="bola añadida" width="100%">

### Introduciendo la mecánica de golpear la pelota

Ahora para mover la pelota, se va a implementar unaa mecanica con la que haciendo "click" sobre ella, y arrastrando en cualquier dirección, podemos definir una flecha con la que podemos indicar la dirección a la que empujar la pelota, y en función de su longitud, podemos indicar la fuerza con la que la queremos empujar.

Para ello en primer lugar vamos a definir diferentes oconstantes y variables que nos permitan implementar esta mecánica:

```js
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
```

Las primeras variables definen la distancia máxima de arrastre, el impulso máximo y mínimo, la longitud visual máxima de la flecha, respectivamente.

Nota: Se determina que la pelota se puede golpear si la velocidad a la que se desplaza es menor a stopSpeed:

```js
function ballIsHittable() {
    return ballBody.getLinearVelocity().length() < stopSpeed;
}
```

Luego se definen variables que indican si el jugador está apuntando o no (aiming), dos variables con las que vamos a construir la imagen visual de la flecha (aimArrow es la flecha que saldrá delante de la pelota y dragLine una línea que aparece por detrás).

Luego para poder definir la posición del raton dentro de la escena, son necesarias las siguientes variables:

- **aimPlane:** Define un plano a la altura de la bola con el que podemos saber donde "toca" el puntero en la escena 3D

- **aimPoint:** Es el punto 3D donde se encuentra el puntero, el valor de iamPoint se calcula con una función que convierte la posición 3D del ratón sobre el plano definido en aimPlane usando un rayo que desde la cámara, altraviesa el píxel donde está el puntero, calculando la posición del puntero como la intersección del rayo y el plano aimPlane

    ```js
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
    ```

- **shotDir:** Es la dirección en la que va a salir la bola, se calcula como la dirección contraria al arrastre

Con estas variables ya podemos definir funciones con las que podemos crear los eventos relacionados con esta mecánica, estos son hacer click sobre la pelota, arrastrar, y luego soltar:

- **Hacer click sobre la pelota**: Este evento tiene que detectar un click alrededor de la pelota usando la posición del cursor en la escena (aimPoint) y si se puede golpear la pelota, poner a true aiming y desactivar OrbitControls para que al arrastrar no se mueva la cámara:

    ```js
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
    ```

- **Arrastrar manteniendo el click sobre la pelota**: Es el siguiente evento en seguir, mientras se mantenga el click y se den las condiciones de golpeo (aiming == True) se recalculan continuamente la potencia en shotPower y dirección a la que se golpea la pelota en shotDir, además de la dirección y longitud de la flecha indicativa.

    Además, la flecha se colorea en función de la potencia del golpe (de verde a rojo)

    ```js
    function onPointerMove(event) {
        if (!aiming) return;
        if (!pointerToPlane(event)) return;

        // Vector de arrastre
        const drag = aimPoint.clone().sub(ball.position);
        drag.y = 0;

        const len = Math.min(drag.length(), maxDrag);
        shotPower = len / maxDrag; // 0..1

        // El golpe va en sentido contrario al arrastre
        if (drag.lengthSq() > 1e-6) shotDir.copy(drag).normalize().negate();

        // Flecha
        const origin = ball.position.clone();
        origin.y += 0.05;
        const arrowLen = Math.max(0.3, shotPower * maxArrowLength);
        aimArrow.position.copy(origin);
        aimArrow.setDirection(shotDir);
        aimArrow.setLength(arrowLen, Math.min(0.5, arrowLen * 0.4), 0.3);
        aimArrow.setColor(new THREE.Color().setHSL((1 - shotPower) / 3, 1, 0.5));

        // Línea de arrastre
        const end = origin.clone().addScaledVector(shotDir, -len);
        const p = dragLine.geometry.attributes.position;
        p.setXYZ(0, origin.x, origin.y, origin.z);
        p.setXYZ(1, end.x, end.y, end.z);
        p.needsUpdate = true;
    }
    ```

- **Soltar el click sobre la pelota y disparar**: En el momento en el que se suelte el click, se devuelve a su estado original aiming, se reactiva OrbitControls y se ocultan las flechas orientativas.

    Si la potencia es menor a minPower no se dispara, y si no, se dispara con la potencia calculada 

    ```js
    function onPointerUp() {
        if (!aiming) return;
        aiming = false;
        controls.enabled = true;
        aimArrow.visible = false;
        dragLine.visible = false;

        if (shotPower < minPower) return;

        const imp = shotPower * maxImpulse;
        ballBody.activate();
        ballBody.applyCentralImpulse(
            new Ammo.btVector3(shotDir.x * imp, 0, shotDir.z * imp)
        );
    }
    ```

Luego estos eventos se definen en initInput, donde ademas tenemos que inicializar los valores de aimArrow y dragLine, añadirlos a la escena y ocultarlas

```js
function initInput() {

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
```

Con esto ya podríamos golpear la pelota, y además, tendríamos un buen indicador visual del golpeo:

<img src=".//readme_assets/golpeo_pelota.gif" alt="golpeo" width="100%">

### Diseño de niveles

Una vez podemos jugar al minigolf en un terreno básico, deberíamos poder jugar diferentes niveles, cada vez más complicados y que requieran de golpear más veces la pelota, o con más precisión.

Las variables, hasta ahora constantes, que definen de forma precisa un nivel son:

- El punto de salida de la bola
- El punto donde se encuentra el hoyo
- El terreno
- Los posibles obstáculos o paredes

Para ello vamos a definir primero estos parámetros como variables en lugar de constantes, y vamos a definir una lista de niveles:

```js
// ---------- Parámetros del terreno (heightfield) ----------
...
let terrainShape;
let terrainBody;

// ---------- Parámetros del juego ----------
...

const tee = new THREE.Vector2(); 
const hole = new THREE.Vector2();
let holeRing;
let plateauHeight = 0.5;

// ---------- Niveles ----------
let currentLevel = 0;
let strokes = 0;
let totalStrokes = 0;
const levelObjects = []; //mallas (con cuerpo físico) del nivel
let hud;
const wallMaterial = new THREE.MeshPhongMaterial({ color: 0x8b5a2b });
const obstacleMaterial = new THREE.MeshPhongMaterial({ color: 0xb0623a });
const yAxis = new THREE.Vector3(0, 1, 0);
```

Hemos añadido una variable que guarda el cuerpo del terreno, a su vez que no inicializamos los valores de tee, hole, y plateauHeight, y hemos creado las variables y constantes que se usarán para los diferentes niveles.

Los niveles se van a diferenciar entre ellos por la posición de los obstáculos y por la posición de inicio y final de la bola y el hoyo, respectivamente.

Entonces lo primero que debemos hacer es implementar una función que nos permita crear muros en la escena: 

```js
// Muro recto entre dos puntos
function wall(x1, z1, x2, z2, { thickness = 0.5, height = 1} = {}) {
  return {
    kind: "wall",
    x1, z1, x2, z2,
    thickness,
    height
  };
}


// Varios muros encadenados
function walls(points, {closed = false, ...opts} = {}) {

  const out = [];

  for (let i = 0; i < points.length - 1; i++) {
    out.push(wall(
      ...points[i],
      ...points[i + 1],
      opts
    ));
  }

  if (closed && points.length > 2) {
    out.push(wall(
      ...points[points.length - 1],
      ...points[0],
      opts
    ));
  }

  return out;
}
```

La función wall nos permite definir los parámetros necesarios para crear 1 muro entre un punto A (x1, z1) y un punto B (x2, z2), por otro lado la función walls permite definir varios muros conectados entre ellos, siendo points una sucesión de puntos (por ejemplo un punto A, B y C) de forma que crea un muro entre 2 puntos consecutivos (uno de A a B y otro de B a C) creando un muro más largo con posibles curvas.

Por otro lado, para poder crear un muro necesitamos definirlo con createBoxWithPhysics y para ello vamos a crear una función que pueda recibir la salida de wall o walls y crear a partir de ellos los objetos:

```js
function createWall(data) {

  const {
    x1, z1,
    x2, z2,
    thickness,
    height
  } = data;

  // Vector que representa el muro
  const dx = x2 - x1;
  const dz = z2 - z1;

  // Longitud del muro
  const length = Math.hypot(dx, dz);

  // Centro del muro
  const x = (x1 + x2) / 2;
  const z = (z1 + z2) / 2;

  // Altura del centro del muro
  const y = getHeightAt(x, z) + height / 2;

  // Posición
  const position = new THREE.Vector3(x, y, z);

  // Rotación alrededor del eje Y
  const angle = -Math.atan2(dz, dx);

  const rotation = new THREE.Quaternion()
    .setFromAxisAngle(yAxis, angle);

  // Crear muro gráfico y físico
  const muro = createBoxWithPhysics(
    length,
    height,
    thickness,
    0,
    position,
    rotation,
    wallMaterial
  );

  muro.castShadow = true;
  muro.receiveShadow = true;

  muro.userData.physicsBody.setRestitution(0.6);

  // Guardar para poder eliminarlo al cambiar de nivel
  levelObjects.push(muro);
}
```

La ventaja que tiene esta implementación es que podemos crear muros para los niveles de una forma muy sencilla y cómoda. Esta función almacena los muros en levelObjects, por lo que debemos crear otra función que cree los objetos como tal en la escena.

```js
function createLevelObstacles(level) {

  for (const obstacle of level.obstacles) {

    switch (obstacle.kind) {

      case "wall":
        createWall(obstacle);
        break;

    }
  }
}
```

Con todo esto ya podemos empezar a definir los niveles, para ello vamos a crear una variable "Levels" que almacene todo lo que caracteriza a un nivel, aquí se muestra un ejemplo con el nivel 2:

```js
const levels = [
  {
    name: "Nivel 2",
    tee: [-11, -10],
    hole: [11, 10],
    terrain: {
      height: 0.5
    },
    obstacles: [
      wall(-12, -5, -2, -5),
      wall(2, -5, 12, -5),
      wall(-12, 0, -8, 0),
      wall(-4, 0, 12, 0),
      wall(-12, 5, 4, 5),
      wall(8, 5, 12, 5)
    ]
  }
]
```

Considerando que ahora la construcción del terreno va a ser dinámica, puesto a que va a cambiar el terreno en función del nivel, debemos hacer modificaciones que nos permitan usar variables globales en lugar de variables locales en la función createTerrainBody():

```js
function createTerrainBody() {
  terrainShape = createTerrainShape();

  const groundTransform = new Ammo.btTransform();
  groundTransform.setIdentity();
  //Bullet recentra el heightfield en su caja envolvente, hay que desplazarlo
  groundTransform.setOrigin(
    new Ammo.btVector3(0, (terrainMaxHeight + terrainMinHeight) / 2, 0)
  );

  const groundMotionState = new Ammo.btDefaultMotionState(groundTransform);

  terrainBody = new Ammo.btRigidBody(
    new Ammo.btRigidBodyConstructionInfo(
      0,
      groundMotionState,
      groundShape,
      new Ammo.btVector3(0, 0, 0)
    )
  );

  terrainBody.setFriction(0.8);
  terrainBody.setRestitution(0.2);

  physicsWorld.addRigidBody(terrainBody);
}
```

Hemos sustituido las constantes locales groundBody y groundShape por las variables terrainBody y terrainShape, precisamente para que sean variables en función del nivel.

Una vez tenemos todas las utilidades necesarias para poder crear un nivel con obstáculos a partir de los niveles definidos en Levels y hemos modificado lo que teníamos previamente para definir una escena básica, podemos implementar una función loadLevel que toma un nivel de Levels y actualiza los parámetros del nivel y crea el terreno gráfico y físico, mas los obstáculos

```js
function loadLevel(index) {

  const level = levels[index];

  // Actualizar parámetros del nivel
  tee.set(...level.tee);
  hole.set(...level.hole);

  plateauHeight = level.terrain.height;

  holeScored = false;

  // Generar alturas del terreno
  heightData = generateHeight(
    terrainWidth,
    terrainDepth,
    terrainMinHeight,
    terrainMaxHeight
  );

  // Crear terreno gráfico y físico
  createTerrainMesh();
  createTerrainBody();

  // Crear obstáculos
  createLevelObstacles(level);
}
```

Por último debemos modificar la función createObjects para que llame a loadLevel donde antes creaba el terreno gráfico y físico, además de pasar a usar la variable holeRing que definimos antes en vez de la constante aro

```js
function createObjects() {

  //Marca visual del hoyo (aro blanco) y de la salida
  holeRing  = new THREE.Mesh(
    new THREE.RingGeometry(holeRadius * 0.95, holeRadius, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  );
  holeRing.rotation.x = -Math.PI / 2;
  holeRing.position.set(
    hole.x,
    getHeightAt(hole.x, hole.y) + holeDepth + 0.02,
    hole.y
  );
  scene.add(holeRing);

  // Cargar nivel actual
  loadLevel(currentLevel);

  //Bordes del campo
  createBorders();

  //Bola
  createBall();
}
```

Con esto ya podríamos visualizar el nivel 1

<img src=".//readme_assets/nivel_1.gif" alt="nivel 1" width="100%">

### Pasar de nivel + HUD

Ahora que podemos jugar varios niveles es cuando podemos incluir una interfaz que nos indique el nivel en el que estamos, los golpeos que hemos realizado en cada nivel y durante la partida, y añadir una interfaz que nos permita cambiar de nivel una vez hemos completado el nivel.

Para actualizar el contador de golpeos sencillamente debemos ir a la funcion onPointerUp y cuando se golpea la pelota, incrementar los contadores strokes y totalStrokes

```js
function onPointerUp() {
  if (!aiming) return;
  aiming = false;
  controls.enabled = true;
  aimArrow.visible = false;
  dragLine.visible = false;

  if (shotPower < minPower) return;

  const imp = shotPower * maxImpulse;

  strokes += 1;
  totalStrokes += 1;

  ballBody.activate();
  ballBody.applyCentralImpulse(
    new Ammo.btVector3(shotDir.x * imp, 0, shotDir.z * imp)
  );
}
```

Para esta interfaz ya se encuentra la variable hud y vamos a definir dos funciones para la interfaz, una que la inicializa y una que la actualiza:

```js

function createHUD() {
  hud = document.createElement("div");

  hud.style.position = "fixed";
  hud.style.top = "20px";
  hud.style.left = "50%";
  hud.style.transform = "translateX(-50%)";

  hud.style.padding = "12px 28px";
  hud.style.background = "rgba(0, 0, 0, 0.75)";
  hud.style.border = "1px solid rgba(255, 255, 255, 0.25)";
  hud.style.borderRadius = "12px";

  hud.style.color = "white";
  hud.style.fontFamily = "Arial, sans-serif";
  hud.style.fontSize = "18px";
  hud.style.fontWeight = "bold";
  hud.style.textAlign = "center";

  // Evita que la interfaz interfiera con los controles del juego
  hud.style.pointerEvents = "none";

  document.body.appendChild(hud);

  updateHUD();
}

function updateHUD() {
  hud.textContent =
    `${levels[currentLevel].name}  |  ` +
    `Golpes: ${strokes}  |  ` +
    `Total: ${totalStrokes}`;
}

```

A la función createHUD se le llama en la función start, y llamaremos a updateHUD cada vez que golpeemos la pelota (es decir, en onPointerUp) y al cargar el nivel (en loadLevel).

Podemos comprobar que el jugador haya completado el nivel si el valor de holeScored == True, pero debemos implementar una interfaz que avise al jugador que ha terminado el nivel y que debe irse al siguiente, para ello vamos a implementar un modal que contiene esta información y que aparece cuando termina el nivel:

```js
let levelCompleteModal;
let levelCompleteShown = false;

...

function createLevelCompleteModal() {
  levelCompleteModal = document.createElement("div");

  // Fondo oscuro que cubre la pantalla
  Object.assign(levelCompleteModal.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    display: "none",
    justifyContent: "center",
    alignItems: "center",
    background: "rgba(0, 0, 0, 0.6)",
    zIndex: "1000"
  });

  // Contenedor de la ventana
  const panel = document.createElement("div");

  Object.assign(panel.style, {
    background: "#ffffff",
    padding: "35px 50px",
    borderRadius: "15px",
    textAlign: "center",
    fontFamily: "Arial, sans-serif",
    boxShadow: "0 5px 25px rgba(0,0,0,0.3)"
  });

  // Mensaje
  const title = document.createElement("h2");
  title.textContent = "¡Nivel superado!";
  title.style.color = "#333333";

  // Botón
  const button = document.createElement("button");
  button.textContent = "Siguiente nivel";

  Object.assign(button.style, {
    padding: "12px 25px",
    marginTop: "15px",
    border: "none",
    borderRadius: "8px",
    background: "#3a9d3a",
    color: "white",
    fontSize: "16px",
    fontWeight: "bold",
    cursor: "pointer"
  });

  // Acción del botón
  button.addEventListener("click", nextLevel);

  panel.appendChild(title);
  panel.appendChild(button);
  levelCompleteModal.appendChild(panel);

  document.body.appendChild(levelCompleteModal);
}

function showLevelCompleteModal() {
  levelCompleteModal.style.display = "flex";
}
```

Hemos definido una variable que contendrá el modal y un booleano que nos indica si se ha mostrado el modal al completar un nivel o no, y hemos declarado una función que inicializa el modal (createLevelCompleteModal) y otra que lo muestra al llamarlo (showLevelCompleteModal).

Este modal contiene un boton que llama a una función nextLevel() que se encarga de eliminar todos los objetos referentes al nivel actual y de cargar el siguiente nivel:

```js

function nextLevel() {
  // Comprobar si quedan niveles
  if (currentLevel >= levels.length - 1) {
    levelCompleteModal.style.display = "none";
    alert("¡Enhorabuena! Has completado todos los niveles.");
    return;
  }

  for (const object of levelObjects) {
    scene.remove(object);

    const body = object.userData.physicsBody;

    if (body) {
      physicsWorld.removeRigidBody(body);
    }

    object.geometry.dispose();
  }

  levelObjects.length = 0;

  currentLevel++;
  strokes = 0;

  levelCompleteModal.style.display = "none";
  levelCompleteShown = false;


  loadLevel(currentLevel);
  
  resetBall();
  updateHUD();
}
```

A la función createLevelCompleteModal la llamamos junto a createHUD en start, y a showLevelCompleteModal lo llamamos cuando el jugador haya completado el juego y no hayamos mostrado el modal

```js
function animationLoop() {
  requestAnimationFrame(animationLoop);

  const deltaTime = clock.getDelta();

  updatePhysics(deltaTime);
  checkHole();

  if (holeScored && !levelCompleteShown) {
    levelCompleteShown = true;
    showLevelCompleteModal();
  }

  renderer.render(scene, camera);
}
```

Y con esto podríamos pasar entre niveles una vez completamos uno, y concluiría el desarrollo del minijuego

