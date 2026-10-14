/**
 * Architectural 3D Interactive Model Viewer
 * Neth Media Solutions - Rajagiriya House Plan (Lot 1, 4.34 Perches)
 * Interactive Three.js WebGL Engine
 *
 * Orientation (Updated per user specification):
 * - Facing the house from Bandaranayakapura Road (looking South into the lot):
 *   * LEFT (West): Main Wooden Entrance Door, Room 1 (11' x 9') with floor-to-ceiling window, Rooms 2, 3, 4
 *   * RIGHT (East): 12ft Motorized Roller Shutter Gate, Car Park & Driveway (13' 6" x 29' 6"), Rear Staircase
 * - 1st Floor Facade:
 *   * LEFT: Vertical architectural timber slat louvers
 *   * RIGHT: Glass sliding balcony doors with warm interior illumination
 * - Rooftop:
 *   * Left: Pergola open-air lounge terrace
 *   * Right rear: Water Tanks (2 x 1000L)
 *   * Right front: Solar Panel Array
 */

class House3DViewer {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container #${containerId} not found`);
      return;
    }

    this.options = Object.assign({
      explodedGap: 14,
      isNight: false,
      autoRotate: false
    }, options);

    this.currentFloor = 'all'; // 'all', 'gf', 'f1', 'roof', 'exploded'
    this.isNight = false;
    this.autoRotate = false;
    this.isWireframe = false;
    this.explodedFactor = 0;
    this.targetExplodedFactor = 0;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.clickableObjects = [];

    this.initScene();
    this.initLights();
    this.buildHouseModel();
    this.initInteraction();
    this.animate();

    window.addEventListener('resize', () => this.onWindowResize());
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1220);
    this.scene.fog = new THREE.FogExp2(0x0c1220, 0.012);

    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 550;

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 500);

    // Default Camera Position: Straight in front from the road facing the house
    // At (X: 0, Y: 15, Z: 46), Left is LEFT (Rooms/Door) and Right is RIGHT (Roller Gate/Car Park)
    this.camera.position.set(0, 15, 46);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.container.appendChild(this.renderer.domElement);

    // Orbit Controls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 160;
    this.controls.target.set(0, 11, 0);
  }

  initLights() {
    this.lightsGroup = new THREE.Group();
    this.scene.add(this.lightsGroup);

    // Ambient / Hemisphere Light
    this.hemiLight = new THREE.HemisphereLight(0xddeeff, 0x1f2937, 0.75);
    this.hemiLight.position.set(0, 50, 0);
    this.lightsGroup.add(this.hemiLight);

    // Main Sun Directional Light
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.35);
    this.sunLight.position.set(25, 50, 40);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 160;
    const d = 36;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.lightsGroup.add(this.sunLight);

    // Soft Fill Light
    this.fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.45);
    this.fillLight.position.set(-30, 25, -25);
    this.lightsGroup.add(this.fillLight);

    // Interior Warm Lights
    this.interiorLights = [];
    const interiorPositions = [
      { x: -6.5, y: 5.5, z: 14 },   // GF Room 1 (Left)
      { x: -6.5, y: 5.5, z: 5 },    // GF Room 2 (Left)
      { x: -6.5, y: 5.5, z: -4 },   // GF Room 3 (Left)
      { x: -6.5, y: 5.5, z: -14 },  // GF Room 4 (Left)
      { x: 6.5, y: 7.5, z: 5 },     // Car park (Right)
      { x: 0, y: 16.5, z: 0 },      // 1st Floor Corridor
      { x: -6.5, y: 16.5, z: 12 },  // 1st Floor Left (Louver Room)
      { x: 6.5, y: 16.5, z: 12 },   // 1st Floor Right (Balcony Suite)
      { x: 0, y: 22.5, z: -12 }     // Roof Headroom
    ];

    interiorPositions.forEach(pos => {
      const pLight = new THREE.PointLight(0xffaa44, 0.6, 24, 1.8);
      pLight.position.set(pos.x, pos.y, pos.z);
      this.lightsGroup.add(pLight);
      this.interiorLights.push(pLight);
    });

    // Night Accent Facade Uplights
    this.facadeSpot1 = new THREE.SpotLight(0x38bdf8, 0, 40, Math.PI / 4, 0.4);
    this.facadeSpot1.position.set(-14, 0.5, 25);
    this.facadeSpot1.target.position.set(-6, 12, 19.5);
    this.scene.add(this.facadeSpot1);
    this.scene.add(this.facadeSpot1.target);

    this.facadeSpot2 = new THREE.SpotLight(0xf59e0b, 0, 40, Math.PI / 4, 0.4);
    this.facadeSpot2.position.set(14, 0.5, 25);
    this.facadeSpot2.target.position.set(6, 12, 19.5);
    this.scene.add(this.facadeSpot2);
    this.scene.add(this.facadeSpot2.target);
  }

  buildHouseModel() {
    this.houseGroup = new THREE.Group();
    this.scene.add(this.houseGroup);

    // Materials Palette
    this.materials = {
      wallWhite: new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.85, metalness: 0.05 }),
      wallDark: new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.6, metalness: 0.2 }),
      accentWood: new THREE.MeshStandardMaterial({ color: 0xc27838, roughness: 0.65, metalness: 0.1 }),
      doorWood: new THREE.MeshStandardMaterial({ color: 0x4a2c16, roughness: 0.55, metalness: 0.1 }),
      concreteSlab: new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.9, metalness: 0.05 }),
      pavingTile: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8, metalness: 0.15 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0xbae6fd,
        transmission: 0.88,
        opacity: 0.92,
        transparent: true,
        roughness: 0.05,
        ior: 1.5,
        reflectivity: 0.9
      }),
      darkAluminum: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.8 }),
      rollerGate: new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.45, metalness: 0.7 }),
      solarBlue: new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.2, metalness: 0.85 }),
      grass: new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.95 }),
      roadAsphalt: new THREE.MeshStandardMaterial({ color: 0x181e2b, roughness: 0.92 }),
      carSilver: new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.25, metalness: 0.9 }),
      waterTank: new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5, metalness: 0.2 })
    };

    this.buildSurroundings();
    this.buildGroundFloor();
    this.buildFirstFloor();
    this.buildRooftop();
  }

  buildSurroundings() {
    this.surroundingsGroup = new THREE.Group();
    this.houseGroup.add(this.surroundingsGroup);

    // Front Road (Bandaranayakapura Road - North)
    const roadGeo = new THREE.PlaneGeometry(80, 26);
    const roadMesh = new THREE.Mesh(roadGeo, this.materials.roadAsphalt);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.set(0, -0.05, 33);
    roadMesh.receiveShadow = true;
    this.surroundingsGroup.add(roadMesh);

    // Road White Center Line
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    for (let x = -35; x <= 35; x += 10) {
      const stripeGeo = new THREE.PlaneGeometry(5, 0.4);
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, -0.03, 33);
      this.surroundingsGroup.add(stripe);
    }

    // Pavement Sidewalk Curb & Tiles
    const sidewalkGeo = new THREE.BoxGeometry(60, 0.35, 3.5);
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 });
    const sidewalk = new THREE.Mesh(sidewalkGeo, sidewalkMat);
    sidewalk.position.set(0, 0.15, 21.5);
    sidewalk.receiveShadow = true;
    this.surroundingsGroup.add(sidewalk);

    // Lot 1 Site Base (4.34 Perch, 26.6ft wide x 40.2ft deep)
    const lotGeo = new THREE.BoxGeometry(26.6, 0.4, 40.2);
    const lotMesh = new THREE.Mesh(lotGeo, this.materials.concreteSlab);
    lotMesh.position.set(0, 0.1, 0);
    lotMesh.receiveShadow = true;
    this.surroundingsGroup.add(lotMesh);

    // Perimeter Boundary Walls
    const wallHeight = 5.5;
    const wallThick = 0.5;

    // Rear wall (South)
    const rearWall = new THREE.Mesh(new THREE.BoxGeometry(26.6, wallHeight, wallThick), this.materials.wallWhite);
    rearWall.position.set(0, wallHeight / 2 + 0.2, -20.1);
    rearWall.castShadow = true;
    this.surroundingsGroup.add(rearWall);

    // Right wall (East)
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, 40.2), this.materials.wallWhite);
    rightWall.position.set(13.1, wallHeight / 2 + 0.2, 0);
    rightWall.castShadow = true;
    this.surroundingsGroup.add(rightWall);

    // Left wall (West)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, 40.2), this.materials.wallWhite);
    leftWall.position.set(-13.1, wallHeight / 2 + 0.2, 0);
    leftWall.castShadow = true;
    this.surroundingsGroup.add(leftWall);

    // FRONT ROAD ORIENTATION MARKERS ON PAVEMENT (Swapped: Left = Rooms, Right = Gate)
    this.createRoadTextIndicators();

    // Trees
    this.addTree(-18, 0, 15);
    this.addTree(18, 0, 15);
    this.addTree(18, 0, -10);
  }

  createRoadTextIndicators() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⮜ වම් පස (LEFT): පිවිසුම & කාමර (12\' 6")  |  දකුණු පස (RIGHT): ගේට්ටුව & Car Park (13\' 6") ⮞', 512, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const signGeo = new THREE.PlaneGeometry(32, 4);
    const signMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.95 });
    const signMesh = new THREE.Mesh(signGeo, signMat);
    signMesh.rotation.x = -Math.PI / 2;
    signMesh.position.set(0, 0.05, 27);
    this.surroundingsGroup.add(signMesh);
  }

  addTree(x, y, z) {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, y, z);

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.5, 6, 8),
      new THREE.MeshStandardMaterial({ color: 0x5b3a29, roughness: 0.9 })
    );
    trunk.position.y = 3;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    const leaves1 = new THREE.Mesh(
      new THREE.DodecahedronGeometry(2.6, 1),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 })
    );
    leaves1.position.y = 7;
    leaves1.castShadow = true;
    treeGroup.add(leaves1);

    const leaves2 = new THREE.Mesh(
      new THREE.DodecahedronGeometry(2.1, 1),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.85 })
    );
    leaves2.position.y = 9;
    leaves2.castShadow = true;
    treeGroup.add(leaves2);

    this.surroundingsGroup.add(treeGroup);
  }

  buildGroundFloor() {
    this.gfGroup = new THREE.Group();
    this.houseGroup.add(this.gfGroup);

    const gfHeight = 10.5;
    const baseElevation = 0.3;

    // RIGHT SIDE: Driveway & Car Park (13' 6" wide x 39' deep: X from -0.5 to 13)
    const drivewayGeo = new THREE.BoxGeometry(13.5, 0.15, 39);
    const driveway = new THREE.Mesh(drivewayGeo, this.materials.pavingTile);
    driveway.position.set(6.5, baseElevation + 0.08, 0);
    driveway.receiveShadow = true;
    this.gfGroup.add(driveway);

    // FRONT RIGHT: 12 FT MOTORIZED ROLLER SHUTTER GATE (Now on Right side)
    this.buildFrontRollerGate(baseElevation, gfHeight);

    // Parked Car in the Car Porch (Silver Audi Sedan parked on the Right Driveway)
    this.buildCar(6.5, baseElevation + 0.15, 6);

    // LEFT SIDE: Floor for Rooms 1, 2, 3, 4 (12' 6" wide x 39' deep: X from -13 to 0.5)
    const roomFloorGeo = new THREE.BoxGeometry(12.5, 0.25, 39);
    const roomFloor = new THREE.Mesh(roomFloorGeo, this.materials.concreteSlab);
    roomFloor.position.set(-6.5, baseElevation + 0.12, 0);
    roomFloor.receiveShadow = true;
    this.gfGroup.add(roomFloor);

    // Columns dividing Driveway and Rooms (Along center)
    const colGeo = new THREE.BoxGeometry(0.85, gfHeight, 1.0);
    const colPositions = [
      [0.45, 18], [0.45, 8.5], [0.45, -1], [0.45, -10.5], [0.45, -19]
    ];
    colPositions.forEach(([cx, cz]) => {
      const col = new THREE.Mesh(colGeo, this.materials.wallWhite);
      col.position.set(cx, baseElevation + gfHeight / 2, cz);
      col.castShadow = true;
      this.gfGroup.add(col);
    });

    // FRONT LEFT FACADE: Main Entrance Door, Room 1 Floor-to-Ceiling Window & Planter Box (Now on Left side)
    this.buildFrontLeftFacade(baseElevation, gfHeight);

    // 4 Distinct Rooms on Left Side (11' x 9' each)
    // Room 1 (Front Left: z from 9.5 to 19)
    this.buildGFRoom("කාමරය 1 (Office / Bed Room 1)", -6.5, baseElevation, 14.25, 12, gfHeight, 9, "11' 0\" x 9' 0\" (Office / Bed Room)");

    // Room 2 (Mid-Front Left: z from 0 to 9.5)
    this.buildGFRoom("කාමරය 2 (Bed Room 2)", -6.5, baseElevation, 4.75, 12, gfHeight, 9, "11' 0\" x 9' 0\" (Bed Room)");

    // Room 3 (Mid-Rear Left: z from -9.5 to 0)
    this.buildGFRoom("කාමරය 3 (Bed Room 3)", -6.5, baseElevation, -4.75, 12, gfHeight, 9, "11' 0\" x 9' 0\" (Bed Room)");

    // Room 4 (Rear Left: z from -19 to -9.5)
    this.buildGFRoom("කාමරය 4 (Bed Room 4 / Kitchen)", -6.5, baseElevation, -14.25, 12, gfHeight, 9, "11' 0\" x 9' 0\" (Bed Room / Kitchen)");

    // REAR RIGHT: Staircase (13'6" x 9'6", z from -19 to -9.5 - Now at Rear Right)
    this.buildStaircase(6.5, baseElevation, -14.25, 12, gfHeight, 9);
  }

  buildFrontRollerGate(baseY, height) {
    const gateGroup = new THREE.Group();
    gateGroup.position.set(6.5, baseY, 19.5); // Right side

    // Left & Right Gate Pillars
    const pillarGeo = new THREE.BoxGeometry(0.8, height, 0.8);
    const pLeft = new THREE.Mesh(pillarGeo, this.materials.darkAluminum);
    pLeft.position.set(-6.1, height / 2, 0);
    pLeft.castShadow = true;
    gateGroup.add(pLeft);

    const pRight = new THREE.Mesh(pillarGeo, this.materials.darkAluminum);
    pRight.position.set(6.1, height / 2, 0);
    pRight.castShadow = true;
    gateGroup.add(pRight);

    // Overhead Header Beam & Shutter Box
    const headerGeo = new THREE.BoxGeometry(13.2, 1.4, 1.2);
    const headerBeam = new THREE.Mesh(headerGeo, this.materials.wallDark);
    headerBeam.position.set(0, height - 0.7, 0);
    headerBeam.castShadow = true;
    gateGroup.add(headerBeam);

    // Motorized Roller Shutter Drum & Partial Raised Curtain (Open to Car Park)
    const curtainGeo = new THREE.BoxGeometry(11.8, 2.2, 0.2);
    const curtain = new THREE.Mesh(curtainGeo, this.materials.rollerGate);
    curtain.position.set(0, height - 1.8, 0);
    curtain.castShadow = true;
    gateGroup.add(curtain);

    // Interactive Hitbox for Gate
    const gateHit = new THREE.Mesh(new THREE.BoxGeometry(13, height, 2), new THREE.MeshBasicMaterial({ visible: false }));
    gateHit.position.set(0, height / 2, 0);
    gateHit.userData = {
      type: 'gate',
      floor: 'Ground Floor (දකුණුපස ප්‍රධාන පිවිසුම)',
      name: 'දකුණු පස ප්‍රධාන රෝලර් ගේට්ටුව (12 FT Roller Gate)',
      dimensions: 'පළල 12\' 0" x උස 8\' 6" (Clearance)',
      highlights: 'බණ්ඩාරනායකපුර ප්‍රධාන පාරට සෘජුව මුහුණලා දකුණු පසින් පිහිටුවා ඇති අතර වාහන 2කට සහ යතුරුපැදි සඳහා Car Park & Driveway වෙත සෘජු ප්‍රවේශය සලසයි.'
    };
    gateGroup.add(gateHit);
    this.clickableObjects.push(gateHit);

    this.gfGroup.add(gateGroup);
  }

  buildFrontLeftFacade(baseY, height) {
    const facadeGroup = new THREE.Group();
    facadeGroup.position.set(-6.5, baseY, 19.5); // Left side

    const wallMat = this.materials.wallWhite;

    // Wall Pier on the Right of Door (towards center)
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, height, 0.4), wallMat);
    p1.position.set(5.6, height / 2, 0);
    p1.castShadow = true;
    facadeGroup.add(p1);

    // Modern Luxury Front Entrance Door (Wood with Black Handle, close to center)
    const doorGroup = new THREE.Group();
    doorGroup.position.set(3.2, 0, 0);

    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(3.6, 7.8, 0.2), this.materials.doorWood);
    doorMesh.position.set(0, 3.9, 0);
    doorMesh.castShadow = true;
    doorGroup.add(doorMesh);

    // Door Frame
    const dFrame = new THREE.Mesh(new THREE.BoxGeometry(3.8, 8.0, 0.35), this.materials.darkAluminum);
    dFrame.position.set(0, 4.0, 0);
    doorGroup.add(dFrame);

    // Long Vertical Black Modern Pull Handle
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 3.2, 8),
      this.materials.darkAluminum
    );
    handle.position.set(-1.4, 3.8, 0.18);
    doorGroup.add(handle);

    // Wall space above door
    const overDoor = new THREE.Mesh(new THREE.BoxGeometry(3.8, height - 8.0, 0.4), wallMat);
    overDoor.position.set(0, 8.0 + (height - 8.0) / 2, 0);
    doorGroup.add(overDoor);

    facadeGroup.add(doorGroup);

    // Modern Double-Pane Floor-to-Ceiling Window for Room 1 (towards left boundary)
    const winGroup = new THREE.Group();
    winGroup.position.set(-2.4, 0, 0);

    // Window Glass
    const winGlass = new THREE.Mesh(new THREE.BoxGeometry(5.2, 7.4, 0.15), this.materials.glass);
    winGlass.position.set(0, 4.2, 0);
    winGroup.add(winGlass);

    // Window Black Frame
    const winFrame = new THREE.Mesh(new THREE.BoxGeometry(5.4, 7.6, 0.3), this.materials.darkAluminum);
    winFrame.position.set(0, 4.2, 0);
    winGroup.add(winFrame);

    // Window Center Mullion
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.12, 7.6, 0.32), this.materials.darkAluminum);
    mullion.position.set(0, 4.2, 0);
    winGroup.add(mullion);

    // Wall around and above window
    const winTopWall = new THREE.Mesh(new THREE.BoxGeometry(5.4, height - 8.0, 0.4), wallMat);
    winTopWall.position.set(0, 8.0 + (height - 8.0) / 2, 0);
    winGroup.add(winTopWall);

    const winLeftWall = new THREE.Mesh(new THREE.BoxGeometry(1.8, height, 0.4), wallMat);
    winLeftWall.position.set(-3.6, height / 2, 0);
    winGroup.add(winLeftWall);

    // Modern Planter Box with Greenery in front of window
    const planter = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.2, 1.4), this.materials.wallDark);
    planter.position.set(0, 0.6, 0.9);
    planter.castShadow = true;
    winGroup.add(planter);

    // Tropical Foliage inside planter
    for (let px = -2.2; px <= 2.2; px += 0.8) {
      const plant = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.65, 1),
        new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 })
      );
      plant.position.set(px, 1.6, 0.9);
      plant.castShadow = true;
      winGroup.add(plant);
    }

    facadeGroup.add(winGroup);

    this.gfGroup.add(facadeGroup);
  }

  buildGFRoom(name, cx, baseY, cz, w, h, d, dimDesc) {
    const roomGroup = new THREE.Group();
    roomGroup.position.set(cx, baseY, cz);

    const wallMat = this.materials.wallWhite;
    const wt = 0.4;

    // Partition Back Wall
    const bw = new THREE.Mesh(new THREE.BoxGeometry(w, h, wt), wallMat);
    bw.position.set(0, h / 2, -d / 2 + wt / 2);
    bw.castShadow = true;
    roomGroup.add(bw);

    // Right wall with door to driveway/corridor (since driveway is on Right)
    const rw1 = new THREE.Mesh(new THREE.BoxGeometry(wt, h, d * 0.55), wallMat);
    rw1.position.set(w / 2 - wt / 2, h / 2, -d * 0.2);
    rw1.castShadow = true;
    roomGroup.add(rw1);

    // Left exterior wall (towards left boundary)
    const lw = new THREE.Mesh(new THREE.BoxGeometry(wt, h, d), wallMat);
    lw.position.set(-w / 2 + wt / 2, h / 2, 0);
    lw.castShadow = true;
    roomGroup.add(lw);

    // Architectural Furniture
    const bed = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.2, 6.2), new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.8 }));
    bed.position.set(-2, 0.6, -1);
    roomGroup.add(bed);

    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.8, 1.5), new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 }));
    desk.position.set(2, 0.9, 2);
    roomGroup.add(desk);

    // Interactive Hitbox
    const hitBox = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    hitBox.position.set(0, h / 2, 0);
    hitBox.userData = {
      type: 'room',
      floor: 'Ground Floor (වම් පස කාමර)',
      name: name,
      dimensions: dimDesc,
      highlights: 'ස්වාධීන පිවිසුම, ස්වභාවික වාතාශ්‍රය සහ නගර සභා නීතිරීතිවලට අනුකූල ශක්තිමත් කොන්ක්‍රීට් කණු සැකැස්ම.'
    };
    roomGroup.add(hitBox);
    this.clickableObjects.push(hitBox);

    this.gfGroup.add(roomGroup);
  }

  buildStaircase(cx, baseY, cz, w, h, d) {
    const stairGroup = new THREE.Group();
    stairGroup.position.set(cx, baseY, cz); // Now at Right Rear

    const numSteps = 16;
    const stepHeight = h / numSteps;
    const stepDepth = (d * 0.8) / (numSteps / 2);
    const stepWidth = 4.2;

    const stairMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });

    // Flight 1
    for (let i = 0; i < 8; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth), stairMat);
      step.position.set(2.5, (i + 0.5) * stepHeight, (i - 4) * stepDepth);
      step.castShadow = true;
      stairGroup.add(step);
    }

    // Mid Landing
    const landing = new THREE.Mesh(new THREE.BoxGeometry(stepWidth * 2.2, stepHeight, 4.5), stairMat);
    landing.position.set(0, 8 * stepHeight, 3.5);
    landing.castShadow = true;
    stairGroup.add(landing);

    // Flight 2
    for (let i = 0; i < 8; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth), stairMat);
      step.position.set(-2.5, (8 + i + 0.5) * stepHeight, (3 - i) * stepDepth);
      step.castShadow = true;
      stairGroup.add(step);
    }

    // Handrail
    const railMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });
    const railPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, h + 3, 8), railMat);
    railPost.position.set(0, (h + 3) / 2, 0);
    stairGroup.add(railPost);

    // Interactive hitbox
    const hitBox = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    hitBox.position.set(0, h / 2, 0);
    hitBox.userData = {
      type: 'stair',
      floor: 'Ground to 1st Floor (දකුණුපස පිටුපස)',
      name: 'පසුපස ප්‍රධාන පඩි පෙළ (Rear Staircase)',
      dimensions: '13\' 6" x 9\' 6" (Flight පළල 4\' 0")',
      highlights: 'පළමු මහලේ මැද කොරිඩෝවට සහ වහල ස්ලැබ් එකට සෘජුවම සම්බන්ධ වේ. යට කොටස Store හෝ Washroom එකක් සඳහා යොදාගත හැක.'
    };
    stairGroup.add(hitBox);
    this.clickableObjects.push(hitBox);

    this.gfGroup.add(stairGroup);
  }

  buildCar(x, y, z) {
    const carGroup = new THREE.Group();
    carGroup.position.set(x, y, z); // On Right Driveway

    const bodyLower = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.8, 13.5), this.materials.carSilver);
    bodyLower.position.set(0, 1.4, 0);
    bodyLower.castShadow = true;
    carGroup.add(bodyLower);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.5, 7.5), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 }));
    cabin.position.set(0, 2.9, -0.6);
    cabin.castShadow = true;
    carGroup.add(cabin);

    const wheelGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.7, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
    const wheelPositions = [
      [-3.0, 0.85, 4.2], [3.0, 0.85, 4.2],
      [-3.0, 0.85, -4.2], [3.0, 0.85, -4.2]
    ];
    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      wheel.castShadow = true;
      carGroup.add(wheel);
    });

    const lightGeo = new THREE.BoxGeometry(1.2, 0.4, 0.2);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hl1 = new THREE.Mesh(lightGeo, lightMat);
    hl1.position.set(-2, 1.6, 6.8);
    const hl2 = new THREE.Mesh(lightGeo, lightMat);
    hl2.position.set(2, 1.6, 6.8);
    carGroup.add(hl1);
    carGroup.add(hl2);

    this.gfGroup.add(carGroup);
  }

  buildFirstFloor() {
    this.f1Group = new THREE.Group();
    this.houseGroup.add(this.f1Group);

    this.f1BaseY = 10.8;
    this.f1Height = 10.5;

    // Floor Slab (5" thickness) covering full 26' x 39' + Front 3.5' Balcony
    const slabGeo = new THREE.BoxGeometry(26.2, 0.5, 42.5);
    const slab = new THREE.Mesh(slabGeo, this.materials.concreteSlab);
    slab.position.set(0, this.f1BaseY, 1.75);
    slab.castShadow = true;
    slab.receiveShadow = true;
    this.f1Group.add(slab);

    const wt = 0.4;

    // Front Modern Balcony (Full 26ft width) with Frameless Tempered Glass
    const balconyGlass = new THREE.Mesh(
      new THREE.BoxGeometry(26.2, 3.5, 0.15),
      this.materials.glass
    );
    balconyGlass.position.set(0, this.f1BaseY + 2.0, 22.8);
    this.f1Group.add(balconyGlass);

    // Balcony Stainless Steel Handrail Cap
    const handrail = new THREE.Mesh(
      new THREE.BoxGeometry(26.2, 0.2, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 })
    );
    handrail.position.set(0, this.f1BaseY + 3.8, 22.8);
    this.f1Group.add(handrail);

    // Facade frame vertical posts
    const fLeft = new THREE.Mesh(new THREE.BoxGeometry(1.2, this.f1Height, 3.5), this.materials.wallWhite);
    fLeft.position.set(-12.8, this.f1BaseY + this.f1Height / 2, 21.0);
    this.f1Group.add(fLeft);

    const fRight = new THREE.Mesh(new THREE.BoxGeometry(1.2, this.f1Height, 3.5), this.materials.wallWhite);
    fRight.position.set(12.8, this.f1BaseY + this.f1Height / 2, 21.0);
    this.f1Group.add(fRight);

    // Top fascia beam
    const fTop = new THREE.Mesh(new THREE.BoxGeometry(26.6, 1.6, 3.5), this.materials.wallWhite);
    fTop.position.set(0, this.f1BaseY + this.f1Height - 0.2, 21.0);
    this.f1Group.add(fTop);

    // 1ST FLOOR FACADE SWAPPED:
    // RIGHT (X > 0): Glass Sliding Balcony Doors (Above the Roller Gate on Right side)
    const frontWindow = new THREE.Mesh(
      new THREE.BoxGeometry(10.5, this.f1Height - 2.4, 0.2),
      this.materials.glass
    );
    frontWindow.position.set(6.5, this.f1BaseY + this.f1Height / 2 - 0.5, 19.8);
    this.f1Group.add(frontWindow);

    const winFrame = new THREE.Mesh(
      new THREE.BoxGeometry(10.8, this.f1Height - 2.2, 0.35),
      this.materials.darkAluminum
    );
    winFrame.position.set(6.5, this.f1BaseY + this.f1Height / 2 - 0.5, 19.8);
    this.f1Group.add(winFrame);

    // LEFT (X < 0): Vertical Architectural Timber Slat Feature Wall (Above Rooms on Left side)
    const louverGroup = new THREE.Group();
    const numLouvers = 16;
    for (let i = 0; i < numLouvers; i++) {
      const louver = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, this.f1Height - 2.0, 0.45),
        this.materials.accentWood
      );
      louver.position.set(-11.6 + i * 0.68, this.f1BaseY + this.f1Height / 2 - 0.4, 19.8);
      louver.castShadow = true;
      louverGroup.add(louver);
    }
    const louverBack = new THREE.Mesh(
      new THREE.BoxGeometry(11.2, this.f1Height - 2.0, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x27272a })
    );
    louverBack.position.set(-6.6, this.f1BaseY + this.f1Height / 2 - 0.4, 19.6);
    louverGroup.add(louverBack);
    this.f1Group.add(louverGroup);

    // Side Exterior Walls (Left & Right)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wt, this.f1Height, 39), this.materials.wallWhite);
    leftWall.position.set(-13, this.f1BaseY + this.f1Height / 2, 0);
    leftWall.castShadow = true;
    this.f1Group.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wt, this.f1Height, 39), this.materials.wallWhite);
    rightWall.position.set(13, this.f1BaseY + this.f1Height / 2, 0);
    rightWall.castShadow = true;
    this.f1Group.add(rightWall);

    // Rear Wall
    const rearWall = new THREE.Mesh(new THREE.BoxGeometry(26, this.f1Height, wt), this.materials.wallWhite);
    rearWall.position.set(0, this.f1BaseY + this.f1Height / 2, -19.5);
    rearWall.castShadow = true;
    this.f1Group.add(rearWall);

    // 3 FT Central Corridor & Partitions
    const corrWallGeo = new THREE.BoxGeometry(wt, this.f1Height, 39);
    const corrLeft = new THREE.Mesh(corrWallGeo, this.materials.wallWhite);
    corrLeft.position.set(-1.6, this.f1BaseY + this.f1Height / 2, 0);
    corrLeft.castShadow = true;
    this.f1Group.add(corrLeft);

    const corrRight = new THREE.Mesh(corrWallGeo, this.materials.wallWhite);
    corrRight.position.set(1.6, this.f1BaseY + this.f1Height / 2, 0);
    corrRight.castShadow = true;
    this.f1Group.add(corrRight);

    // Room Partitions
    const roomZCoords = [14.25, 4.75, -4.75, -14.25];
    const partitionGeo = new THREE.BoxGeometry(11.2, this.f1Height, wt);

    [-9.5, 0, 9.5].forEach(pz => {
      const pLeft = new THREE.Mesh(partitionGeo, this.materials.wallWhite);
      pLeft.position.set(-7.2, this.f1BaseY + this.f1Height / 2, pz);
      pLeft.castShadow = true;
      this.f1Group.add(pLeft);

      const pRight = new THREE.Mesh(partitionGeo, this.materials.wallWhite);
      pRight.position.set(7.2, this.f1BaseY + this.f1Height / 2, pz);
      pRight.castShadow = true;
      this.f1Group.add(pRight);
    });

    // 8 Room Interactive Hitboxes
    roomZCoords.forEach((rz, idx) => {
      const leftHit = new THREE.Mesh(new THREE.BoxGeometry(11, this.f1Height, 8.8), new THREE.MeshBasicMaterial({ visible: false }));
      leftHit.position.set(-7.2, this.f1BaseY + this.f1Height / 2, rz);
      leftHit.userData = {
        type: 'room',
        floor: 'First Floor (වම්පස කාමර 4)',
        name: `පළමු මහල - කාමරය ${idx + 1} (වම්පස)`,
        dimensions: '11\' 0" x 9\' 0" (99 sq.ft)',
        highlights: 'මැද අඩි 3 කොරිඩෝවෙන් සෘජු ප්‍රවේශය. ස්වභාවික ආලෝකය සහ වාතාශ්‍රය.'
      };
      this.f1Group.add(leftHit);
      this.clickableObjects.push(leftHit);

      const rightHit = new THREE.Mesh(new THREE.BoxGeometry(11, this.f1Height, 8.8), new THREE.MeshBasicMaterial({ visible: false }));
      rightHit.position.set(7.2, this.f1BaseY + this.f1Height / 2, rz);
      rightHit.userData = {
        type: 'room',
        floor: 'First Floor (දකුණුපස කාමර 4)',
        name: `පළමු මහල - කාමරය ${idx + 5} (දකුණුපස)`,
        dimensions: '11\' 0" x 9\' 0" (99 sq.ft)',
        highlights: 'පඩි පෙළට කාමර අහිමි නොවී සම්පූර්ණ කාමර 8 කින් යුත් ඉහළ ආදායම් ලැබිය හැකි සැලැස්ම. ඉදිරිපස කාමරය Balcony එකට විවෘත වේ.'
      };
      this.f1Group.add(rightHit);
      this.clickableObjects.push(rightHit);
    });
  }

  buildRooftop() {
    this.roofGroup = new THREE.Group();
    this.houseGroup.add(this.roofGroup);

    this.roofBaseY = 21.6;

    // Roof Slab (5" thickness) covering 26' x 39'
    const roofSlabGeo = new THREE.BoxGeometry(26.4, 0.5, 39.4);
    const roofSlab = new THREE.Mesh(roofSlabGeo, this.materials.concreteSlab);
    roofSlab.position.set(0, this.roofBaseY, 0);
    roofSlab.castShadow = true;
    roofSlab.receiveShadow = true;
    this.roofGroup.add(roofSlab);

    // 3.5' Parapet Safety Wall
    const parapetHeight = 3.5;
    const wt = 0.45;
    const parapetMat = this.materials.wallWhite;

    const pFront = new THREE.Mesh(new THREE.BoxGeometry(26.4, parapetHeight, wt), parapetMat);
    pFront.position.set(0, this.roofBaseY + parapetHeight / 2, 19.5);
    pFront.castShadow = true;
    this.roofGroup.add(pFront);

    const pRear = new THREE.Mesh(new THREE.BoxGeometry(26.4, parapetHeight, wt), parapetMat);
    pRear.position.set(0, this.roofBaseY + parapetHeight / 2, -19.5);
    pRear.castShadow = true;
    this.roofGroup.add(pRear);

    const pLeft = new THREE.Mesh(new THREE.BoxGeometry(wt, parapetHeight, 39.4), parapetMat);
    pLeft.position.set(-13, this.roofBaseY + parapetHeight / 2, 0);
    pLeft.castShadow = true;
    this.roofGroup.add(pLeft);

    const pRight = new THREE.Mesh(new THREE.BoxGeometry(wt, parapetHeight, 39.4), parapetMat);
    pRight.position.set(13, this.roofBaseY + parapetHeight / 2, 0);
    pRight.castShadow = true;
    this.roofGroup.add(pRight);

    // Center/Rear Staircase Head-Room Structure
    const hrGroup = new THREE.Group();
    hrGroup.position.set(0, this.roofBaseY, -14.5);

    const hrWalls = new THREE.Mesh(new THREE.BoxGeometry(8, 8.5, 9.5), this.materials.wallDark);
    hrWalls.position.set(0, 4.25, 0);
    hrWalls.castShadow = true;
    hrGroup.add(hrWalls);

    // Door out to Rooftop Terrace
    const hrDoor = new THREE.Mesh(new THREE.BoxGeometry(3.2, 6.8, 0.2), this.materials.darkAluminum);
    hrDoor.position.set(0, 3.4, 4.8);
    hrGroup.add(hrDoor);
    this.roofGroup.add(hrGroup);

    // Water Tanks (2 x 1000L) on REAR RIGHT (Above the Driveway/Staircase side)
    const tankStand = new THREE.Mesh(new THREE.BoxGeometry(6.5, 3.0, 4), this.materials.concreteSlab);
    tankStand.position.set(8.5, this.roofBaseY + 1.5, -15.5);
    tankStand.castShadow = true;
    this.roofGroup.add(tankStand);

    const tankGeo = new THREE.CylinderGeometry(1.3, 1.3, 3.8, 16);
    const tank1 = new THREE.Mesh(tankGeo, this.materials.waterTank);
    tank1.position.set(7.2, this.roofBaseY + 4.9, -15.5);
    tank1.castShadow = true;
    const tank2 = new THREE.Mesh(tankGeo, this.materials.waterTank);
    tank2.position.set(9.8, this.roofBaseY + 4.9, -15.5);
    tank2.castShadow = true;
    this.roofGroup.add(tank1);
    this.roofGroup.add(tank2);

    // Solar Panel Arrays on FRONT RIGHT
    const solarGroup = new THREE.Group();
    solarGroup.position.set(6.5, this.roofBaseY + 1.2, 8);
    solarGroup.rotation.x = -Math.PI / 10;

    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.15, 3.2), this.materials.solarBlue);
        panel.position.set(-2.6 + c * 5.2, 0, -2.0 + r * 3.8);
        panel.castShadow = true;
        solarGroup.add(panel);

        const pFrame = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.2, 3.4), this.materials.darkAluminum);
        pFrame.position.set(-2.6 + c * 5.2, -0.05, -2.0 + r * 3.8);
        solarGroup.add(pFrame);
      }
    }
    this.roofGroup.add(solarGroup);

    // Rooftop Terrace Pergola / Lounging Area on LEFT Side
    const pergola = new THREE.Group();
    pergola.position.set(-5.5, this.roofBaseY, 0);
    const postGeo = new THREE.BoxGeometry(0.5, 8.5, 0.5);
    const pMat = this.materials.accentWood;
    [[-4.5, 4], [4.5, 4], [-4.5, -4], [4.5, -4]].forEach(([px, pz]) => {
      const p = new THREE.Mesh(postGeo, pMat);
      p.position.set(px, 4.25, pz);
      p.castShadow = true;
      pergola.add(p);
    });
    for (let i = -4.2; i <= 4.2; i += 1.4) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.55, 9), pMat);
      slat.position.set(i, 8.5, 0);
      slat.castShadow = true;
      pergola.add(slat);
    }
    this.roofGroup.add(pergola);

    // Rooftop Hitbox
    const hitBox = new THREE.Mesh(new THREE.BoxGeometry(26, 6, 39), new THREE.MeshBasicMaterial({ visible: false }));
    hitBox.position.set(0, this.roofBaseY + 3, 0);
    hitBox.userData = {
      type: 'roof',
      floor: 'Rooftop Slab Level',
      name: 'විවෘත වහල ස්ලැබ් එක (Rooftop Open Terrace)',
      dimensions: '26\' 0" x 39\' 0" (~1,000 sq.ft)',
      highlights: 'සූර්ය පැනල (Solar Grid), වතුර ටැංකි (Water Tanks), Pergola Lounge සහ අඩි 3.5 ආරක්ෂිත Parapet Wall.'
    };
    this.roofGroup.add(hitBox);
    this.clickableObjects.push(hitBox);
  }

  initInteraction() {
    this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.renderer.domElement.addEventListener('click', (e) => this.onMouseClick(e));
  }

  onMouseMove(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.clickableObjects);

    if (intersects.length > 0) {
      this.renderer.domElement.style.cursor = 'pointer';
    } else {
      this.renderer.domElement.style.cursor = 'default';
    }
  }

  onMouseClick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.clickableObjects);

    if (intersects.length > 0) {
      const data = intersects[0].object.userData;
      this.showRoomTooltip(data);
    }
  }

  showRoomTooltip(data) {
    const tooltip = document.getElementById('house3dTooltip');
    if (!tooltip) return;

    document.getElementById('ttFloor').innerText = data.floor || 'Architectural Zone';
    document.getElementById('ttTitle').innerText = data.name || 'Details';
    document.getElementById('ttDim').innerText = data.dimensions || '';
    document.getElementById('ttNotes').innerText = data.highlights || '';

    tooltip.classList.add('visible');
  }

  setFloorView(floor) {
    this.currentFloor = floor;

    if (floor === 'exploded') {
      this.targetExplodedFactor = 1;
      this.gfGroup.visible = true;
      this.f1Group.visible = true;
      this.roofGroup.visible = true;
    } else {
      this.targetExplodedFactor = 0;
      if (floor === 'all') {
        this.gfGroup.visible = true;
        this.f1Group.visible = true;
        this.roofGroup.visible = true;
      } else if (floor === 'gf') {
        this.gfGroup.visible = true;
        this.f1Group.visible = false;
        this.roofGroup.visible = false;
      } else if (floor === 'f1') {
        this.gfGroup.visible = false;
        this.f1Group.visible = true;
        this.roofGroup.visible = false;
      } else if (floor === 'roof') {
        this.gfGroup.visible = false;
        this.f1Group.visible = false;
        this.roofGroup.visible = true;
      }
    }
  }

  setCameraPreset(preset) {
    const duration = 1000;
    let targetPos = new THREE.Vector3();
    let targetLook = new THREE.Vector3(0, 11, 0);

    switch (preset) {
      case 'front':
        // Straight front view: Left is Entrance/Rooms, Right is Roller Gate/Car Park
        targetPos.set(0, 14, 46);
        targetLook.set(0, 10, 8);
        break;
      case 'iso':
        // Front-Right Isometric view (facing towards the Gate on the right)
        targetPos.set(28, 24, 42);
        targetLook.set(0, 11, 0);
        break;
      case 'iso_left':
        // Front-Left Isometric view (facing towards the Rooms on the left)
        targetPos.set(-28, 24, 42);
        targetLook.set(0, 11, 0);
        break;
      case 'top':
        // Top Plan view (Top = Road, Left = Rooms, Right = Gate/Car Park)
        targetPos.set(0, 72, 1);
        targetLook.set(0, 5, 0);
        break;
      case 'driveway':
        // Close-up on the Right Driveway & Roller Gate
        targetPos.set(14, 9, 32);
        targetLook.set(6, 6, 6);
        break;
      case 'roof':
        targetPos.set(0, 36, -8);
        targetLook.set(0, 22, 2);
        break;
      default:
        targetPos.set(0, 15, 46);
        targetLook.set(0, 11, 0);
    }

    this.animateCamera(targetPos, targetLook, duration);
  }

  animateCamera(toPos, toLook, duration) {
    const startPos = this.camera.position.clone();
    const startLook = this.controls.target.clone();
    const startTime = performance.now();

    const updateCam = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 0.5 - Math.cos(progress * Math.PI) / 2;

      this.camera.position.lerpVectors(startPos, toPos, ease);
      this.controls.target.lerpVectors(startLook, toLook, ease);
      this.controls.update();

      if (progress < 1) {
        requestAnimationFrame(updateCam);
      }
    };

    requestAnimationFrame(updateCam);
  }

  toggleDayNight(isNight) {
    this.isNight = isNight;
    if (this.isNight) {
      this.scene.background = new THREE.Color(0x060912);
      this.scene.fog.color = new THREE.Color(0x060912);
      this.hemiLight.intensity = 0.18;
      this.sunLight.intensity = 0.1;
      this.fillLight.intensity = 0.05;
      this.facadeSpot1.intensity = 3.5;
      this.facadeSpot2.intensity = 3.5;
      this.interiorLights.forEach(l => l.intensity = 1.4);
    } else {
      this.scene.background = new THREE.Color(0x0c1220);
      this.scene.fog.color = new THREE.Color(0x0c1220);
      this.hemiLight.intensity = 0.75;
      this.sunLight.intensity = 1.35;
      this.fillLight.intensity = 0.45;
      this.facadeSpot1.intensity = 0;
      this.facadeSpot2.intensity = 0;
      this.interiorLights.forEach(l => l.intensity = 0.6);
    }
  }

  toggleAutoRotate(enable) {
    this.autoRotate = enable;
    this.controls.autoRotate = enable;
    this.controls.autoRotateSpeed = 1.8;
  }

  toggleWireframe(enable) {
    this.isWireframe = enable;
    for (let key in this.materials) {
      if (this.materials[key].wireframe !== undefined) {
        this.materials[key].wireframe = enable;
      }
    }
  }

  onWindowResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (Math.abs(this.explodedFactor - this.targetExplodedFactor) > 0.001) {
      this.explodedFactor += (this.targetExplodedFactor - this.explodedFactor) * 0.08;
      const gap = 12 * this.explodedFactor;
      this.f1Group.position.y = gap;
      this.roofGroup.position.y = gap * 2.2;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

// Global hook
window.House3DViewer = House3DViewer;
