import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

// ─── palette matching medu3d.com visual identity ───────────────────────────
const PIECE_COLORS = [
  '#c0392b','#e67e22','#f1c40f','#27ae60','#16a085',
  '#2980b9','#8e44ad','#e91e63','#ff5722','#00bcd4',
  '#8bc34a','#ff9800','#5c6bc0','#795548','#26c6da'
];

// ─── ViewerPage ─────────────────────────────────────────────────────────────
export default function ViewerPage({ onBack }) {
  // React state for UI panels (what renders in the sidebar)
  const [pieceList, setPieceList]       = useState([]);
  const [annList, setAnnList]           = useState([]);
  const [msrList, setMsrList]           = useState([]);
  const [activeMode, setActiveMode]     = useState('orbit');
  const [modelName, setModelName]       = useState('Sin modelo');
  const [showWelcome, setShowWelcome]   = useState(true);
  const [loading, setLoading]           = useState(false);
  const [loadMsg, setLoadMsg]           = useState('Cargando...');
  const [shiftHint, setShiftHint]       = useState(false);
  const [modeHint, setModeHint]         = useState('');
  const [msrStep, setMsrStep]           = useState('');
  const [clipState, setClipState]       = useState({ x:false, y:false, z:false });
  const [clipValues, setClipValues]     = useState({ x:0, y:0, z:0 });
  const [selectedIdx, setSelectedIdx]   = useState(null);
  const [sessionBanner, setSessionBanner] = useState(false);
  const [annModal, setAnnModal]         = useState(null); // { x, y }
  const [msrModal, setMsrModal]         = useState(null); // { x, y, dist }
  const [presMode, setPresMode]         = useState(false);
  const [autoRotate, setAutoRotate]     = useState(false);
  const [darkMode, setDarkMode]           = useState(true);

  // DOM refs
  const canvasRef    = useRef(null);
  const vcCanvasRef  = useRef(null);
  const viewportRef  = useRef(null);
  const fileInputRef = useRef(null);
  const sessionInputRef = useRef(null);
  const annTextRef   = useRef(null);
  const autoSaveRef  = useRef(null);

  // Warn before closing tab
  useEffect(() => {
    const handler = (e) => {
      if (pieceList.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pieceList.length]);

  // Autosave reminder every 20 minutes
  useEffect(() => {
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    autoSaveRef.current = setInterval(() => {
      if (pieceList.length > 0) {
        const save = window.confirm('Han pasado 20 minutos. Guarda tu sesion para no perder el trabajo.');
        if (save) {
          const tr = threeRef.current;
          const data = {
            version: 2, savedAt: new Date().toISOString(),
            pieces: tr.pieces.map(p => ({ name: p.name, color: p.color, visible: p.visible, opacity: p.opacity })),
            annotations: tr.annotations.map(a => ({ point: [a.point.x,a.point.y,a.point.z], text: a.text, id: a.id })),
            measurements: tr.measurements.map(m => ({ p1: m.p1, p2: m.p2, dist: m.dist, mid: m.mid, id: m.id })),
            annCounter: tr.annCounter, msrCounter: tr.msrCounter,
          };
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob); a.download = `medu3d-autosave-${Date.now()}.json`; a.click();
        }
      }
    }, 20 * 60 * 1000);
    return () => clearInterval(autoSaveRef.current);
  }, [pieceList.length]);

  // Update renderer background on darkMode toggle
  useEffect(() => {
    threeRef.current.renderer?.setClearColor(darkMode ? 0x060b14 : 0xf0f2f5);
  }, [darkMode]);


  // Three.js state held in refs (not React state, no re-renders needed)
  const threeRef = useRef({
    renderer: null, scene: null, camera: null,
    vcRenderer: null, vcScene: null, vcCam: null, cubeGroup: null, vcFaceMeshes: [],
    modelGroup: null, msrGroup: null,
    clipPlanes: null, raycaster: null, mouse: null,
    orb: null,
    pieces: [],       // { name, mesh, visible, color, opacity }
    annotations: [],  // { point, text, label(DOM), id }
    measurements: [], // { p1,p2,dist,mid,lineLabel(DOM),id }
    annCounter: 0, msrCounter: 0, colorIdx: 0,
    boundsCenter: null, boundsSize: 1,
    pendingPoint: null, msrPoint1: null, pendingMsrData: null,
    shiftDown: false,
    vcDrag: { btn:-1, startX:0, startY:0, lastX:0, lastY:0, moved:false },
    orbBtn: -1, orbLastX:0, orbLastY:0,
    autoRotate: false,
    stlLoader: null,
    animFrameId: null,
  });

  // ─── helpers exposed to event handlers via callbacks ──────────────────────
  const t = threeRef.current; // shorthand, stable ref

  // Sync React piece list from t.pieces
  const syncPieceList = useCallback(() => {
    setPieceList(t.pieces.map((p, i) => ({
      name: p.name, visible: p.visible, color: p.color, opacity: p.opacity, idx: i,
      selected: i === t.selectedIdx
    })));
  }, []);

  const syncAnnList = useCallback(() => {
    setAnnList(t.annotations.map(a => ({ id: a.id, text: a.text })));
  }, []);

  const syncMsrList = useCallback(() => {
    setMsrList(t.measurements.map(m => ({ id: m.id, dist: m.dist })));
  }, []);

  // ─── Three.js init ────────────────────────────────────────────────────────
  useEffect(() => {
    const tr = threeRef.current;
    const canvas   = canvasRef.current;
    const vcCanvas = vcCanvasRef.current;
    const viewport = viewportRef.current;

    // Main renderer
    tr.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, stencil: true });
    tr.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    tr.renderer.localClippingEnabled = true;
    tr.renderer.setClearColor(0x060b14);
    threeRef.current._darkMode = true;

    tr.scene  = new THREE.Scene();
    tr.camera = new THREE.PerspectiveCamera(42, 1, 0.01, 10000);
    tr.camera.position.set(0, 0, 8);
    tr.camera.up.set(0, 1, 0);

    tr.scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const kl = new THREE.DirectionalLight(0xffffff, 1.1); kl.position.set(5,8,6); tr.scene.add(kl);
    const fl = new THREE.DirectionalLight(0x7799cc, 0.5); fl.position.set(-5,-2,-4); tr.scene.add(fl);
    const rl = new THREE.DirectionalLight(0xffffff, 0.25); rl.position.set(0,-6,4); tr.scene.add(rl);

    tr.modelGroup = new THREE.Group(); tr.scene.add(tr.modelGroup);
    tr.msrGroup   = new THREE.Group(); tr.scene.add(tr.msrGroup);
    tr.capGroup   = new THREE.Group(); tr.scene.add(tr.capGroup);

    tr.clipPlanes = {
      x: new THREE.Plane(new THREE.Vector3(-1,0,0), 0),
      y: new THREE.Plane(new THREE.Vector3(0,-1,0), 0),
      z: new THREE.Plane(new THREE.Vector3(0,0,-1), 0),
    };
    tr.raycaster = new THREE.Raycaster();
    tr.mouse     = new THREE.Vector2();
    tr.boundsCenter = new THREE.Vector3();
    tr.stlLoader = new STLLoader();

    // ViewCube renderer
    tr.vcRenderer = new THREE.WebGLRenderer({ canvas: vcCanvas, antialias: true, alpha: true });
    tr.vcRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    tr.vcRenderer.setSize(96, 96);
    tr.vcRenderer.setClearColor(0x000000, 0);
    tr.vcScene = new THREE.Scene();
    tr.vcCam   = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    tr.vcCam.position.set(2.8, 2.8, 2.8); tr.vcCam.lookAt(0, 0, 0);

    const faceData = [
      { dir: new THREE.Vector3( 1,0,0), label:'R',  col:0x1a3a5c, rot:[0, Math.PI/2, 0] },
      { dir: new THREE.Vector3(-1,0,0), label:'L',  col:0x1a3a5c, rot:[0,-Math.PI/2, 0] },
      { dir: new THREE.Vector3( 0,1,0), label:'T',  col:0x0e4d8a, rot:[-Math.PI/2, 0, 0] },
      { dir: new THREE.Vector3( 0,-1,0),label:'B',  col:0x0e4d8a, rot:[ Math.PI/2, 0, 0] },
      { dir: new THREE.Vector3( 0,0,1), label:'F',  col:0xd64830, rot:[0, 0, 0] },
      { dir: new THREE.Vector3( 0,0,-1),label:'Bk', col:0x1a3a5c, rot:[0, Math.PI, 0] },
    ];
    const offsets = [
      new THREE.Vector3(.5,0,0), new THREE.Vector3(-.5,0,0),
      new THREE.Vector3(0,.5,0), new THREE.Vector3(0,-.5,0),
      new THREE.Vector3(0,0,.5), new THREE.Vector3(0,0,-.5),
    ];
    tr.cubeGroup = new THREE.Group(); tr.vcScene.add(tr.cubeGroup); tr.vcFaceMeshes = [];

    faceData.forEach((fd, i) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.9),
        new THREE.MeshBasicMaterial({ color: fd.col, side: THREE.FrontSide })
      );
      mesh.position.copy(offsets[i]);
      mesh.rotation.set(...fd.rot);
      mesh.userData.faceDir = fd.dir.clone();
      tr.cubeGroup.add(mesh); tr.vcFaceMeshes.push(mesh);

      const tc = document.createElement('canvas'); tc.width = 64; tc.height = 64;
      const ctx = tc.getContext('2d');
      ctx.font = 'bold 18px Montserrat,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillText(fd.label, 32, 32);
      const lm = new THREE.Mesh(
        new THREE.PlaneGeometry(0.78, 0.78),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(tc), transparent: true, depthWrite: false })
      );
      lm.position.copy(offsets[i]).multiplyScalar(1.002);
      lm.rotation.set(...fd.rot);
      tr.cubeGroup.add(lm);
    });
    tr.cubeGroup.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),
      new THREE.LineBasicMaterial({ color: 0x3d7cc9 })
    ));
    tr.vcScene.add(new THREE.AmbientLight(0xffffff, 1));

    // ── orbit helpers ──────────────────────────────────────────────────────
    function rotateH(dx) {
      const angle = -dx * 0.006;
      const up = tr.camera.up.clone().normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(up, angle);
      const offset = tr.camera.position.clone().sub(tr.orb.target);
      offset.applyQuaternion(q);
      tr.camera.position.copy(tr.orb.target.clone().add(offset));
      tr.camera.lookAt(tr.orb.target);
    }
    function rotateV(dy) {
      const angle = -dy * 0.006;
      const offset = tr.camera.position.clone().sub(tr.orb.target);
      const viewDir = offset.clone().normalize().negate();
      const right = new THREE.Vector3().crossVectors(viewDir, tr.camera.up).normalize();
      const upDot = offset.clone().normalize().dot(tr.camera.up.clone().normalize());
      if ((upDot > 0.98 && angle > 0) || (upDot < -0.98 && angle < 0)) return;
      const q = new THREE.Quaternion().setFromAxisAngle(right, angle);
      offset.applyQuaternion(q);
      tr.camera.up.applyQuaternion(q).normalize();
      tr.camera.position.copy(tr.orb.target.clone().add(offset));
      tr.camera.lookAt(tr.orb.target);
    }
    function pan(dx, dy) {
      const dist = tr.camera.position.clone().sub(tr.orb.target).length();
      const speed = dist * 0.001;
      const right = new THREE.Vector3().crossVectors(
        tr.camera.getWorldDirection(new THREE.Vector3()), tr.camera.up
      ).normalize();
      const delta = right.clone().multiplyScalar(-dx * speed)
        .add(tr.camera.up.clone().normalize().multiplyScalar(dy * speed));
      tr.orb.target.add(delta); tr.camera.position.add(delta);
    }
    function zoom(factor) {
      const offset = tr.camera.position.clone().sub(tr.orb.target);
      const newLen = Math.max(0.01, offset.length() * factor);
      tr.camera.position.copy(tr.orb.target.clone().add(offset.normalize().multiplyScalar(newLen)));
    }
    function snapTo(dir) {
      const dist = tr.camera.position.clone().sub(tr.orb.target).length();
      tr.camera.position.copy(tr.orb.target.clone().add(dir.clone().normalize().multiplyScalar(dist)));
      if (Math.abs(dir.y) > 0.99) tr.camera.up.set(0, 0, dir.y > 0 ? -1 : 1);
      else tr.camera.up.set(0, 1, 0);
      tr.camera.lookAt(tr.orb.target);
    }

    tr.orb = { target: new THREE.Vector3(), rotateH, rotateV, pan, zoom, snapTo };

    // ── resize ─────────────────────────────────────────────────────────────
    function handleResize() {
      if (!viewport) return;
      const w = viewport.clientWidth, h = viewport.clientHeight;
      tr.renderer.setSize(w, h, false);
      tr.camera.aspect = w / h;
      tr.camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', handleResize);
    handleResize();

    // ── bounds / clipping ──────────────────────────────────────────────────
    function computeBounds() {
      const box = new THREE.Box3();
      tr.pieces.forEach(p => {
        const gb = new THREE.Box3().setFromBufferAttribute(p.mesh.geometry.attributes.position);
        box.union(gb);
      });
      if (!box.isEmpty()) {
        box.getCenter(tr.boundsCenter);
        const sv = new THREE.Vector3(); box.getSize(sv);
        tr.boundsSize = Math.max(sv.x, sv.y, sv.z);
      }
    }
    tr.computeBounds = computeBounds;

    function updateClipping(cs, cv) {
      computeBounds();
      const active = [];
      ['x','y','z'].forEach(ax => {
        if (!cs[ax]) return;
        const offset = (-0.55 + ((cv[ax]+100)/200)*1.1) * tr.boundsSize;
        if (ax === 'x') { tr.clipPlanes.x.constant = tr.boundsCenter.x + offset; active.push(tr.clipPlanes.x); }
        if (ax === 'y') { tr.clipPlanes.y.constant = tr.boundsCenter.y + offset; active.push(tr.clipPlanes.y); }
        if (ax === 'z') { tr.clipPlanes.z.constant = tr.boundsCenter.z + offset; active.push(tr.clipPlanes.z); }
      });

      // Apply clipping planes to meshes with stencil write
      tr.pieces.forEach(p => {
        p.mesh.material.clippingPlanes = active;
        p.mesh.material.stencilWrite = active.length > 0;
        p.mesh.material.stencilFunc = THREE.AlwaysStencilFunc;
        p.mesh.material.stencilZPass = THREE.ReplaceStencilOp;
        p.mesh.renderOrder = 1;
        p.mesh.material.needsUpdate = true;
      });

      // Rebuild cap planes (one per active clip plane)
      while (tr.capGroup.children.length) tr.capGroup.remove(tr.capGroup.children[0]);
      active.forEach((plane, pi) => {
        // One cap mesh per piece, colored to match the piece
        tr.pieces.forEach(p => {
          if (!p.visible) return;
          const capGeo = new THREE.PlaneGeometry(tr.boundsSize * 4, tr.boundsSize * 4);
          // Orient the cap plane to be coplanar with the clip plane
          const capMesh = new THREE.Mesh(capGeo, new THREE.MeshBasicMaterial({
            color: new THREE.Color(p.color),
            stencilWrite: true,
            stencilRef: 0,
            stencilFunc: THREE.NotEqualStencilFunc,
            stencilFail: THREE.ReplaceStencilOp,
            stencilZFail: THREE.ReplaceStencilOp,
            stencilZPass: THREE.ReplaceStencilOp,
            clippingPlanes: active.filter((_,j) => j !== pi),
            depthWrite: false,
            side: THREE.DoubleSide,
          }));
          // Align cap to the clip plane
          const n = plane.normal.clone();
          capMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), n);
          capMesh.position.copy(n.clone().multiplyScalar(-plane.constant));
          capMesh.renderOrder = 2;
          tr.capGroup.add(capMesh);
        });
      });
    }
    tr.updateClipping = updateClipping;

    function fitCamera() {
      computeBounds();
      const dist = tr.boundsSize * 2.2;
      tr.orb.target.copy(tr.boundsCenter);
      tr.camera.position.copy(tr.boundsCenter.clone().add(new THREE.Vector3(0, 0, dist)));
      tr.camera.up.set(0, 1, 0);
      tr.camera.lookAt(tr.orb.target);
      tr.camera.near = dist * 0.001; tr.camera.far = dist * 100;
      tr.camera.updateProjectionMatrix();
    }
    tr.fitCamera = fitCamera;

    function applyExplosion(t_val) {
      computeBounds();
      if (tr.pieces.length === 0) return;

      // Compute each piece's center
      const centers = tr.pieces.map(p => {
        const gb = new THREE.Box3().setFromBufferAttribute(p.mesh.geometry.attributes.position);
        const c = new THREE.Vector3(); gb.getCenter(c); return c;
      });

      // Detect dominant axis: which axis has the most variance among piece centers?
      const axes = ['x','y','z'];
      const variance = {};
      axes.forEach(ax => {
        const vals = centers.map(c => c[ax]);
        const mean = vals.reduce((a,b) => a+b, 0) / vals.length;
        variance[ax] = vals.reduce((s,v) => s + (v-mean)**2, 0) / vals.length;
      });
      const maxVar = Math.max(variance.x, variance.y, variance.z);
      const totalVar = variance.x + variance.y + variance.z;
      // If one axis holds >60% of variance, treat as linear model (spine, etc.)
      const isLinear = maxVar / (totalVar || 1) > 0.60;

      tr.pieces.forEach((p, i) => {
        const pc = centers[i];
        let dir;
        if (isLinear) {
          // Explode along the dominant axis only
          const domAx = axes.reduce((a,b) => variance[a] > variance[b] ? a : b);
          dir = new THREE.Vector3();
          dir[domAx] = pc[domAx] - tr.boundsCenter[domAx];
        } else {
          // Radial explosion from center (original behavior)
          dir = pc.clone().sub(tr.boundsCenter);
        }
        if (dir.length() < 0.001) { p.mesh.position.set(0,0,0); return; }
        p.mesh.position.copy(dir.normalize().multiplyScalar(t_val * tr.boundsSize * 0.8));
      });
    }
    tr.applyExplosion = applyExplosion;

    // ── label update ───────────────────────────────────────────────────────
    function updateLabels() {
      const w = viewport.clientWidth, h = viewport.clientHeight;
      tr.annotations.forEach(a => {
        const pos = a.point.clone().project(tr.camera);
        a.label.style.left = ((pos.x*.5+.5)*w)+'px';
        a.label.style.top  = ((-.5*pos.y+.5)*h)+'px';
        a.label.style.opacity = pos.z < 1 ? '1' : '0';
      });
      tr.measurements.forEach(m => {
        if (!m.lineLabel || !m.mid) return;
        const pos = new THREE.Vector3(...m.mid).project(tr.camera);
        m.lineLabel.style.left = ((pos.x*.5+.5)*w)+'px';
        m.lineLabel.style.top  = ((-.5*pos.y+.5)*h)+'px';
        m.lineLabel.style.opacity = pos.z < 1 ? '1' : '0';
      });
      if (tr.pendingMsrData?.lineLabel && tr.pendingMsrData?.mid) {
        const pos2 = tr.pendingMsrData.mid.clone().project(tr.camera);
        tr.pendingMsrData.lineLabel.style.left = ((pos2.x*.5+.5)*w)+'px';
        tr.pendingMsrData.lineLabel.style.top  = ((-.5*pos2.y+.5)*h)+'px';
        tr.pendingMsrData.lineLabel.style.opacity = pos2.z < 1 ? '1' : '0';
      }
    }

    // ── render loop ────────────────────────────────────────────────────────
    function animate() {
      tr.animFrameId = requestAnimationFrame(animate);
      if (tr.autoRotate) rotateH(1.2);
      tr.renderer.render(tr.scene, tr.camera);
      // sync cube
      tr.cubeGroup.quaternion.copy(tr.camera.quaternion).invert();
      tr.vcRenderer.render(tr.vcScene, tr.vcCam);
      updateLabels();
    }
    animate();

    // ── canvas mouse events ────────────────────────────────────────────────
    function onCanvasMouseDown(e) {
      // Only orbit mode handles canvas drag
      if (tr.currentMode !== 'orbit') return;
      e.preventDefault();
      tr.orbBtn = e.button;
      tr.orbLastX = e.clientX;
      tr.orbLastY = e.clientY;
    }
    function onDocMouseMove(e) {
      // Orbit drag
      if (tr.currentMode === 'orbit' && tr.orbBtn !== -1) {
        if (e.buttons === 0) { tr.orbBtn = -1; return; }
        const dx = e.clientX - tr.orbLastX, dy = e.clientY - tr.orbLastY;
        tr.orbLastX = e.clientX; tr.orbLastY = e.clientY;
        if (tr.orbBtn === 0) {
          if (tr.shiftDown) { rotateH(dx); rotateV(dy); }
          else rotateH(dx);
        } else if (tr.orbBtn === 2) {
          pan(dx, dy);
        }
      }
      // ViewCube drag
      const vc = tr.vcDrag;
      if (vc.btn !== -1) {
        if (e.buttons === 0) { vc.btn = -1; return; }
        const dx = e.clientX - vc.lastX, dy = e.clientY - vc.lastY;
        vc.lastX = e.clientX; vc.lastY = e.clientY;
        if (Math.abs(e.clientX-vc.startX) > 3 || Math.abs(e.clientY-vc.startY) > 3) vc.moved = true;
        if (vc.moved && vc.btn === 0) { rotateH(dx); rotateV(dy); }
      }
    }
    function onDocMouseUp(e) {
      tr.orbBtn = -1;
      const vc = tr.vcDrag;
      if (vc.btn !== -1) {
        if (!vc.moved) {
          const rect = vcCanvas.getBoundingClientRect();
          const mx = ((e.clientX-rect.left)/96)*2-1;
          const my = -((e.clientY-rect.top)/96)*2+1;
          const vRay = new THREE.Raycaster();
          vRay.setFromCamera(new THREE.Vector2(mx,my), tr.vcCam);
          const hits = vRay.intersectObjects(tr.vcFaceMeshes);
          if (hits.length) snapTo(hits[0].object.userData.faceDir);
        }
        vc.btn = -1;
      }
    }
    function onCanvasWheel(e) {
      if (tr.currentMode !== 'orbit') return;
      e.preventDefault();
      zoom(e.deltaY > 0 ? 1.1 : 0.9);
    }
    function onCanvasDblClick(e) {
      if (tr.currentMode !== 'orbit') return;
      const rect = canvas.getBoundingClientRect();
      tr.mouse.x = ((e.clientX-rect.left)/rect.width)*2-1;
      tr.mouse.y = -((e.clientY-rect.top)/rect.height)*2+1;
      tr.raycaster.setFromCamera(tr.mouse, tr.camera);
      const meshes = tr.pieces.filter(p => p.visible).map(p => p.mesh);
      const hits = tr.raycaster.intersectObjects(meshes, true);
      if (!hits.length) return;
      tr.pieces.forEach((p, i) => { if (p.mesh === hits[0].object) tr.selectedIdx = i; });
      syncPieceList();
      tr.orb.target.copy(hits[0].point);
      tr.camera.lookAt(tr.orb.target);
    }
    function onCanvasClick(e) {
      if (tr.currentMode === 'ann') handleAnnClick(e);
      else if (tr.currentMode === 'msr') handleMsrClick(e);
    }

    // ── annotation / measurement hit ──────────────────────────────────────
    function getHitPoint(e) {
      const rect = canvas.getBoundingClientRect();
      tr.mouse.x = ((e.clientX-rect.left)/rect.width)*2-1;
      tr.mouse.y = -((e.clientY-rect.top)/rect.height)*2+1;
      tr.raycaster.setFromCamera(tr.mouse, tr.camera);
      const hits = tr.raycaster.intersectObjects(tr.pieces.filter(p=>p.visible).map(p=>p.mesh), true);
      return hits.length ? hits[0].point.clone() : null;
    }
    function handleAnnClick(e) {
      const pt = getHitPoint(e); if (!pt) return;
      tr.pendingPoint = pt;
      const vp = viewport.getBoundingClientRect();
      setAnnModal({
        x: Math.min(e.clientX - vp.left + 12, vp.width - 248),
        y: Math.min(e.clientY - vp.top  + 12, vp.height - 160),
      });
    }
    function handleMsrClick(e) {
      const pt = getHitPoint(e); if (!pt) return;
      if (!tr.msrPoint1) {
        tr.msrPoint1 = pt;
        const m1 = createMarker(pt); tr.msrGroup.add(m1);
        setMsrStep('Clic en el segundo punto');
        tr.pendingMsrData = { m1 };
      } else {
        const p2 = pt, dist = tr.msrPoint1.distanceTo(p2);
        const m2 = createMarker(p2); tr.msrGroup.add(m2);
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([tr.msrPoint1.clone(), p2.clone()]),
          new THREE.LineBasicMaterial({ color: 0x2980b9 })
        );
        tr.msrGroup.add(line);
        const mid = tr.msrPoint1.clone().add(p2).multiplyScalar(0.5);
        const ll = document.createElement('div');
        ll.className = 'viewer-msr-label';
        ll.textContent = dist.toFixed(2) + ' mm';
        viewport.appendChild(ll);
        tr.pendingMsrData = { p1: tr.msrPoint1.clone(), p2, dist, mid, lineLabel: ll, m1: tr.pendingMsrData.m1, m2, line };
        const vp = viewport.getBoundingClientRect();
        setMsrModal({
          x: Math.min(e.clientX - vp.left + 12, vp.width - 248),
          y: Math.min(e.clientY - vp.top  + 12, vp.height - 200),
          dist,
        });
        setMsrStep('');
        tr.msrPoint1 = null;
      }
    }

    function createMarker(pos) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(tr.boundsSize * 0.004, 0.002), 10, 10),
        new THREE.MeshBasicMaterial({ color: 0x2980b9, depthTest: false })
      );
      m.position.copy(pos); return m;
    }
    tr.createMarker = createMarker;
    tr.getHitPoint = getHitPoint;

    // Keyboard
    function onKeyDown(e) {
      if (e.key === 'Shift') { tr.shiftDown = true; if (tr.currentMode === 'orbit') setShiftHint(true); }
      if (e.key === 'Escape') {
        setAnnModal(null); setMsrModal(null); tr.msrPoint1 = null;
        setCurrentMode('orbit');
      }
    }
    function onKeyUp(e) {
      if (e.key === 'Shift') { tr.shiftDown = false; setShiftHint(false); }
    }

    function setCurrentMode(mode) {
      tr.currentMode = mode;
      setActiveMode(mode);
      if (mode === 'ann') setModeHint('Modo anotacion - clic en el modelo');
      else if (mode === 'msr') { setModeHint(''); setMsrStep('Clic en el primer punto'); }
      else { setModeHint(''); setMsrStep(''); }
    }
    tr.setCurrentMode = setCurrentMode;
    tr.currentMode = 'orbit';

    // ViewCube mouse
    function onVCMouseDown(e) {
      e.stopPropagation();
      tr.vcDrag.btn = e.button; tr.vcDrag.moved = false;
      tr.vcDrag.startX = tr.vcDrag.lastX = e.clientX;
      tr.vcDrag.startY = tr.vcDrag.lastY = e.clientY;
    }

    canvas.addEventListener('mousedown', onCanvasMouseDown);
    canvas.addEventListener('wheel', onCanvasWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('dblclick', onCanvasDblClick);
    canvas.addEventListener('click', onCanvasClick);
    vcCanvas.addEventListener('mousedown', onVCMouseDown);
    document.addEventListener('mousemove', onDocMouseMove);
    document.addEventListener('mouseup', onDocMouseUp);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Store refs to handlers for cleanup
    tr._handlers = { handleResize, onCanvasMouseDown, onCanvasWheel, onCanvasDblClick, onCanvasClick, onVCMouseDown, onDocMouseMove, onDocMouseUp, onKeyDown, onKeyUp };
    tr._setCurrentMode = setCurrentMode;
    tr.syncPieceList = syncPieceList;
    tr.syncAnnList   = syncAnnList;
    tr.syncMsrList   = syncMsrList;

    return () => {
      cancelAnimationFrame(tr.animFrameId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousemove', onDocMouseMove);
      document.removeEventListener('mouseup', onDocMouseUp);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      tr.renderer?.dispose();
      tr.vcRenderer?.dispose();
      tr.annotations.forEach(a => a.label?.remove());
      tr.measurements.forEach(m => m.lineLabel?.remove());
    };
  }, []); // run once

  // ─── React->Three.js bridge for clips/explosion ───────────────────────────
  useEffect(() => {
    threeRef.current.updateClipping?.(clipState, clipValues);
  }, [clipState, clipValues]);

  // ─── add/remove pieces ────────────────────────────────────────────────────
  function addPiece(name, geometry, color, visible = true, opacity = 1) {
    const tr = threeRef.current;
    color = color || PIECE_COLORS[tr.colorIdx++ % PIECE_COLORS.length];
    geometry.computeVertexNormals();
    const mat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(color), specular: new THREE.Color(0x222222), shininess: 35,
      side: THREE.DoubleSide, clippingPlanes: [], transparent: opacity < 1, opacity,
      stencilWrite: false, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc,
      stencilZPass: THREE.ReplaceStencilOp,
    });
    const mesh = new THREE.Mesh(geometry, mat); mesh.visible = visible;
    tr.modelGroup.add(mesh);
    tr.pieces.push({ name, mesh, visible, color, opacity });
    tr.syncPieceList?.();
  }

  function removePiece(idx) {
    const tr = threeRef.current;
    const p = tr.pieces[idx];
    tr.modelGroup.remove(p.mesh);
    p.mesh.geometry.dispose(); p.mesh.material.dispose();
    tr.pieces.splice(idx, 1);
    tr.syncPieceList?.();
    tr.updateClipping?.(clipState, clipValues);
  }

  // ─── file loading ─────────────────────────────────────────────────────────
  function loadFiles(files) {
    if (!files.length) return;
    setShowWelcome(false);
    setLoading(true); setLoadMsg(`Cargando ${files.length} archivo${files.length > 1 ? 's' : ''}...`);
    let done = 0;
    const names = [];
    files.forEach(file => {
      const name = file.name.replace(/\.stl$/i, '');
      names.push(name);
      const reader = new FileReader();
      reader.onload = e => {
        try { addPiece(name, threeRef.current.stlLoader.parse(e.target.result)); } catch(err) { console.error(err); }
        if (++done === files.length) {
          setLoading(false);
          threeRef.current.fitCamera?.();
          threeRef.current.updateClipping?.(clipState, clipValues);
          setModelName(names.length === 1 ? names[0] : `${names.length} piezas`);
        }
      };
      reader.onerror = () => { if (++done === files.length) { setLoading(false); threeRef.current.fitCamera?.(); } };
      reader.readAsArrayBuffer(file);
    });
  }

  function loadDemo() {
    const tr = threeRef.current;
    setShowWelcome(false);
    setLoading(true); setLoadMsg('Cargando logo Medu3D...');
    // Clear scene
    while (tr.pieces.length) {
      tr.modelGroup.remove(tr.pieces[0].mesh);
      tr.pieces[0].mesh.geometry.dispose(); tr.pieces[0].mesh.material.dispose();
      tr.pieces.shift();
    }
    tr.annotations.forEach(a => a.label?.remove()); tr.annotations = [];
    tr.measurements.forEach(m => m.lineLabel?.remove()); tr.measurements = [];
    tr.annCounter = 0; tr.msrCounter = 0; tr.colorIdx = 0;
    setAnnList([]); setMsrList([]); setModelName('Medu3D — Logo');

    setTimeout(() => {
      let g;
      const NAVY  = '#0b3c73';
      const CORAL = '#d64830';
      const depth = 0.32;

      // ── "M" — construida con 3 cajas formando la letra ─────────────
      // Pierna izquierda
      g = new THREE.BoxGeometry(0.22, 1.4, depth);
      g.translate(-0.72, 0, 0);
      addPiece('M — pierna izquierda', g, NAVY);

      // Pierna derecha
      g = new THREE.BoxGeometry(0.22, 1.4, depth);
      g.translate(0.72, 0, 0);
      addPiece('M — pierna derecha', g, NAVY);

      // Diagonal izquierda
      g = new THREE.BoxGeometry(0.22, 0.82, depth);
      g.translate(-0.36, 0.22, 0);
      addPiece('M — diagonal izquierda', g, NAVY);

      // Diagonal derecha
      g = new THREE.BoxGeometry(0.22, 0.82, depth);
      g.translate(0.36, 0.22, 0);
      addPiece('M — diagonal derecha', g, NAVY);

      // Punta central V
      g = new THREE.BoxGeometry(0.22, 0.44, depth);
      g.translate(0, -0.12, 0);
      addPiece('M — centro', g, NAVY);

      // ── "3" ─────────────────────────────────────────────────────────
      const ox = 2.1; // offset X para separar del M

      // Barra superior
      g = new THREE.BoxGeometry(0.64, 0.22, depth);
      g.translate(ox, 0.59, 0);
      addPiece('3 — barra superior', g, CORAL);

      // Barra media
      g = new THREE.BoxGeometry(0.54, 0.20, depth);
      g.translate(ox + 0.05, 0.0, 0);
      addPiece('3 — barra media', g, CORAL);

      // Barra inferior
      g = new THREE.BoxGeometry(0.64, 0.22, depth);
      g.translate(ox, -0.59, 0);
      addPiece('3 — barra inferior', g, CORAL);

      // Curva superior derecha
      g = new THREE.CylinderGeometry(0.20, 0.20, depth, 16, 1, false, 0, Math.PI);
      g.rotateX(Math.PI / 2);
      g.rotateZ(-Math.PI / 2);
      g.translate(ox + 0.10, 0.305, 0);
      addPiece('3 — curva superior', g, CORAL);

      // Curva inferior derecha
      g = new THREE.CylinderGeometry(0.20, 0.20, depth, 16, 1, false, 0, Math.PI);
      g.rotateX(Math.PI / 2);
      g.rotateZ(-Math.PI / 2);
      g.translate(ox + 0.10, -0.305, 0);
      addPiece('3 — curva inferior', g, CORAL);

      // ── "D" ─────────────────────────────────────────────────────────
      const ox2 = ox + 1.1;

      // Barra vertical izquierda
      g = new THREE.BoxGeometry(0.22, 1.4, depth);
      g.translate(ox2 - 0.22, 0, 0);
      addPiece('D — barra vertical', g, NAVY);

      // Curva derecha (medio cilindro)
      g = new THREE.CylinderGeometry(0.54, 0.54, depth, 20, 1, false, -Math.PI / 2, Math.PI);
      g.rotateX(Math.PI / 2);
      g.translate(ox2 - 0.14, 0, 0);
      addPiece('D — curva exterior', g, NAVY);

      // Interior hueco (tapa con color más oscuro para dar profundidad)
      g = new THREE.CylinderGeometry(0.35, 0.35, depth + 0.02, 20, 1, false, -Math.PI / 2, Math.PI);
      g.rotateX(Math.PI / 2);
      g.translate(ox2 - 0.14, 0, 0);
      addPiece('D — interior', g, '#071e3d');

      setLoading(false);
      tr.fitCamera?.();
      tr.updateClipping?.(clipState, clipValues);
      tr.applyExplosion?.(0);
    }, 300);
  }

  // ─── session save/load ────────────────────────────────────────────────────
  function saveSession() {
    const tr = threeRef.current;
    const data = {
      version: 2, savedAt: new Date().toISOString(),
      pieces: tr.pieces.map(p => ({ name: p.name, color: p.color, visible: p.visible, opacity: p.opacity })),
      annotations: tr.annotations.map(a => ({ point: [a.point.x,a.point.y,a.point.z], text: a.text, id: a.id })),
      measurements: tr.measurements.map(m => ({ p1: m.p1, p2: m.p2, dist: m.dist, mid: m.mid, id: m.id })),
      annCounter: tr.annCounter, msrCounter: tr.msrCounter,
      camera: { position: [tr.camera.position.x,tr.camera.position.y,tr.camera.position.z], target: [tr.orb.target.x,tr.orb.target.y,tr.orb.target.z] },
      clipState, clipValues,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `medu3d-sesion-${Date.now()}.json`; a.click();
  }

  function restoreSession(data) {
    const tr = threeRef.current;
    if (!data?.version) return;
    data.pieces?.forEach(pd => {
      const found = tr.pieces.find(p => p.name === pd.name);
      if (found) {
        found.color = pd.color; found.mesh.material.color.set(pd.color);
        found.visible = pd.visible; found.mesh.visible = pd.visible;
        found.opacity = pd.opacity; found.mesh.material.opacity = pd.opacity;
        found.mesh.material.transparent = pd.opacity < 1; found.mesh.material.needsUpdate = true;
      }
    });
    tr.syncPieceList?.();
    tr.annotations.forEach(a => a.label?.remove()); tr.annotations = [];
    data.annotations?.forEach(ad => {
      const label = document.createElement('div'); label.className = 'viewer-ann-label';
      label.textContent = ad.id; viewportRef.current?.appendChild(label);
      tr.annotations.push({ point: new THREE.Vector3(...ad.point), text: ad.text, label, id: ad.id });
    });
    if (data.annCounter) tr.annCounter = data.annCounter; tr.syncAnnList?.();
    tr.measurements.forEach(m => m.lineLabel?.remove()); tr.measurements = [];
    data.measurements?.forEach(md => {
      const ll = document.createElement('div'); ll.className = 'viewer-msr-label';
      ll.textContent = md.dist.toFixed(2) + ' mm'; viewportRef.current?.appendChild(ll);
      // Recreate 3D geometry
      const p1v = new THREE.Vector3(...md.p1);
      const p2v = new THREE.Vector3(...md.p2);
      const m1 = tr.createMarker(p1v); tr.msrGroup.add(m1);
      const m2 = tr.createMarker(p2v); tr.msrGroup.add(m2);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([p1v, p2v]),
        new THREE.LineBasicMaterial({ color: 0x2980b9 })
      );
      tr.msrGroup.add(line);
      tr.measurements.push({ p1: md.p1, p2: md.p2, dist: md.dist, mid: md.mid, id: md.id, lineLabel: ll, m1, m2, line });
    });
    if (data.msrCounter) tr.msrCounter = data.msrCounter; tr.syncMsrList?.();
    if (data.camera) {
      tr.camera.position.set(...data.camera.position);
      tr.orb.target.set(...data.camera.target);
      tr.camera.up.set(0,1,0); tr.camera.lookAt(tr.orb.target);
    }
    if (data.clipState) {
      setClipState(data.clipState);
      setClipValues(data.clipValues || { x:0, y:0, z:0 });
    }
    setSessionBanner(true); setTimeout(() => setSessionBanner(false), 3000);
  }

  // ─── annotation save ──────────────────────────────────────────────────────
  function saveAnnotation() {
    const text = annTextRef.current?.value?.trim(); if (!text) { setAnnModal(null); return; }
    const tr = threeRef.current; if (!tr.pendingPoint) { setAnnModal(null); return; }
    tr.annCounter++;
    const label = document.createElement('div'); label.className = 'viewer-ann-label';
    label.textContent = tr.annCounter; viewportRef.current?.appendChild(label);
    tr.annotations.push({ point: tr.pendingPoint.clone(), text, label, id: tr.annCounter });
    tr.pendingPoint = null; setAnnModal(null); tr.syncAnnList?.();
  }

  function saveMeasurement() {
    const tr = threeRef.current; if (!tr.pendingMsrData?.p1) return;
    tr.msrCounter++;
    const d = tr.pendingMsrData;
    tr.measurements.push({ p1:[d.p1.x,d.p1.y,d.p1.z], p2:[d.p2.x,d.p2.y,d.p2.z], dist: d.dist, mid:[d.mid.x,d.mid.y,d.mid.z], id: tr.msrCounter, lineLabel: d.lineLabel });
    tr.pendingMsrData = null; setMsrModal(null); tr.syncMsrList?.();
    tr._setCurrentMode?.('msr');
  }

  function discardMeasurement() {
    const tr = threeRef.current;
    if (tr.pendingMsrData) {
      ['m1','m2','line'].forEach(k => { if (tr.pendingMsrData[k]) tr.msrGroup.remove(tr.pendingMsrData[k]); });
      tr.pendingMsrData.lineLabel?.remove(); tr.pendingMsrData = null;
    }
    setMsrModal(null); tr._setCurrentMode?.('msr');
  }

  // ─── mode switching from React ─────────────────────────────────────────────
  function switchMode(mode) {
    threeRef.current._setCurrentMode?.(mode);
  }

  // ─── SVG icons ────────────────────────────────────────────────────────────
  const icons = {
    orbit: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/></svg>,
    ann:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    msr:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="3" y2="18"/><line x1="21" y1="6" x2="21" y2="18"/></svg>,
    fit:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2M16 4h2a2 2 0 012 2v2M16 20h2a2 2 0 002-2v-2"/></svg>,
    eye:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    eyeOff:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
    hideAll:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
    showAll:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    pres:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
    save:  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
    load:  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
    png:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
    del:   <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>,
    back:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>,
  };

  // ─── render ───────────────────────────────────────────────────────────────
  const s = makeStyles(darkMode);

  return (
    <div style={s.root}>
      {/* inject label styles once */}
      <style>{`
        .viewer-ann-label {
          position:absolute;width:20px;height:20px;border-radius:50%;
          background:#d64830;color:white;font-size:9px;font-weight:800;
          display:flex;align-items:center;justify-content:center;
          pointer-events:none;transform:translate(-50%,-50%);
          border:2px solid rgba(255,255,255,0.9);
          box-shadow:0 2px 10px rgba(0,0,0,0.7);font-family:Montserrat,sans-serif;
          transition:opacity 0.2s;
        }
        .viewer-msr-label {
          position:absolute;pointer-events:none;transform:translate(-50%,-50%);
          background:rgba(11,21,37,0.92);border:1px solid #2980b9;border-radius:5px;
          padding:3px 8px;font-size:10px;font-weight:700;color:white;
          font-family:'JetBrains Mono',monospace;white-space:nowrap;
          transition:opacity 0.2s;
        }
      `}</style>

      {/* HEADER */}
      {!presMode && (
        <header style={s.header}>
          {onBack && (
            <button onClick={onBack} style={s.backBtn} title="Volver al sitio">
              {icons.back}
            </button>
          )}
          <span style={s.logoTxt}>Medu<b style={{color:'#d64830'}}>3D</b></span>
          <span style={s.badge}>VIEWER</span>
          <div style={s.hdiv}/>
          <span style={s.hdrSub}>{modelName}</span>
          <div style={{flex:1}}/>
          <button style={s.hbtn} onClick={saveSession}>{icons.save} Guardar sesion</button>
          <button style={s.hbtn} onClick={() => sessionInputRef.current?.click()}>{icons.load} Cargar sesion</button>
          <input type="file" ref={sessionInputRef} accept=".json" style={{display:'none'}}
            onChange={e => { const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=ev=>{try{restoreSession(JSON.parse(ev.target.result));}catch{alert('Archivo invalido.')}}; r.readAsText(f); e.target.value=''; }}/>
          <button style={s.hbtn} onClick={() => { threeRef.current.renderer?.render(threeRef.current.scene, threeRef.current.camera); const a=document.createElement('a');a.href=canvasRef.current?.toDataURL('image/png');a.download=`medu3d-${Date.now()}.png`;a.click(); }}>{icons.png} Exportar PNG</button>
          <div style={s.hdiv}/>
          <button style={s.primaryBtn} onClick={() => fileInputRef.current?.click()}>+ Cargar STL</button>
          <input type="file" ref={fileInputRef} multiple accept=".stl" style={{display:'none'}}
            onChange={e => { loadFiles(Array.from(e.target.files)); e.target.value=''; }}/>
          <span style={s.demoLnk} onClick={loadDemo}>Logo Medu3D</span>
          <div style={s.hdiv}/>
          <button
            style={{...s.hbtn, gap:5}}
            onClick={() => setDarkMode(d => !d)}
            title={darkMode ? 'Modo claro' : 'Modo oscuro'}>
            {darkMode
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"/></svg>
            }
            {darkMode ? 'Claro' : 'Oscuro'}
          </button>
        </header>
      )}

      <div style={s.main}>
        {/* SIDEBAR */}
        {!presMode && (
          <div style={s.sidebar}>
            {/* Pieces */}
            <div style={s.secHdr}>
              <span>PIEZAS</span>
              <span style={s.cnt}>{pieceList.length}</span>
            </div>
            <div style={s.piecesWrap}>
              {pieceList.length === 0
                ? <p style={s.emptyHint}>Carga archivos STL o<br/>o carga el logo Medu3D</p>
                : pieceList.map((p, i) => (
                  <div key={i} style={{...s.piece, ...(selectedIdx===i?s.pieceSel:{}), ...(!p.visible?s.pieceHid:{})}}
                    onClick={() => { threeRef.current.selectedIdx = i; setSelectedIdx(i); }}>
                    <div style={s.pieceRow}>
                      <button style={s.visBtn} onClick={e => { e.stopPropagation(); const tr=threeRef.current; tr.pieces[i].visible=!tr.pieces[i].visible; tr.pieces[i].mesh.visible=tr.pieces[i].visible; tr.syncPieceList?.(); }}>
                        {p.visible ? icons.eye : icons.eyeOff}
                      </button>
                      <div style={{position:'relative',flexShrink:0}}>
                        <div style={{...s.clrDot,background:p.color}} onClick={e => { e.stopPropagation(); e.currentTarget.nextSibling?.click(); }}/>
                        <input type="color" defaultValue={p.color} style={{position:'absolute',opacity:0,pointerEvents:'none',width:1,height:1,top:0,left:0}}
                          onChange={e => { const tr=threeRef.current; tr.pieces[i].color=e.target.value; tr.pieces[i].mesh.material.color.set(e.target.value); tr.syncPieceList?.(); }}/>
                      </div>
                      <span style={s.pieceName} title={p.name}>{p.name}</span>
                      <button style={s.delBtn} onClick={e => { e.stopPropagation(); removePiece(i); }}>{icons.del}</button>
                    </div>
                    {selectedIdx === i && (
                      <div style={s.opRow}>
                        <span style={s.opLbl}>Opacidad</span>
                        <input type="range" min="5" max="100" defaultValue={Math.round(p.opacity*100)} style={s.opSl}
                          onChange={e => { const v=parseFloat(e.target.value)/100; const tr=threeRef.current; tr.pieces[i].opacity=v; tr.pieces[i].mesh.material.opacity=v; tr.pieces[i].mesh.material.transparent=v<1; tr.pieces[i].mesh.material.needsUpdate=true; tr.syncPieceList?.(); }}/>
                        <span style={s.opVal}>{Math.round(p.opacity*100)}%</span>
                      </div>
                    )}
                  </div>
                ))
              }
            </div>

            {/* Annotations */}
            <div style={s.secHdr}>
              <span>ANOTACIONES</span><span style={s.cnt}>{annList.length}</span>
            </div>
            <div style={s.sideScroll}>
              {annList.length === 0
                ? <p style={s.emptyHint}>Herramienta activa<br/>+ clic en el modelo</p>
                : annList.map((a, i) => (
                  <div key={a.id} style={s.listItem}>
                    <div style={s.annNum}>{a.id}</div>
                    <div style={s.itemTxt}>{a.text}</div>
                    <button style={s.itemDel} onClick={() => { const tr=threeRef.current; tr.annotations[i]?.label?.remove(); tr.annotations.splice(i,1); tr.syncAnnList?.(); }}>{icons.del}</button>
                  </div>
                ))
              }
            </div>

            {/* Measurements */}
            <div style={s.secHdr}>
              <span>MEDICIONES</span><span style={s.cnt}>{msrList.length}</span>
            </div>
            <div style={s.sideScroll}>
              {msrList.length === 0
                ? <p style={s.emptyHint}>Herramienta activa<br/>+ clic en dos puntos</p>
                : msrList.map((m, i) => (
                  <div key={m.id} style={s.listItem}>
                    <div style={s.msrNum}>{m.id}</div>
                    <div style={s.itemTxt}><b style={{color:'#5dade2',fontFamily:'monospace'}}>{m.dist.toFixed(2)} mm</b></div>
                    <button style={s.itemDel} onClick={() => { const tr=threeRef.current; tr.measurements[i]?.lineLabel?.remove(); tr.measurements.splice(i,1); tr.syncMsrList?.(); }}>{icons.del}</button>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* VIEWPORT */}
        <div ref={viewportRef} style={{...s.viewport, cursor: activeMode==='ann'?'crosshair':activeMode==='msr'?'cell':'default'}}
          onDragOver={e => e.preventDefault()}
          onDragLeave={() => {}}
          onDrop={e => { e.preventDefault(); loadFiles(Array.from(e.dataTransfer.files).filter(f=>f.name.toLowerCase().endsWith('.stl'))); }}>

          <canvas ref={canvasRef} style={s.canvas}/>

          {/* Toolbar */}
          <div style={s.toolbar}>
            {[
              { id:'orbit', icon:icons.orbit, tip:'Orbitar' },
              { id:'ann',   icon:icons.ann,   tip:'Anotar (ESC vuelve)' },
              { id:'msr',   icon:icons.msr,   tip:'Medir (ESC vuelve)' },
            ].map(btn => (
              <button key={btn.id} style={{...s.tool, ...(activeMode===btn.id?s.toolActive:{})}}
                onClick={() => switchMode(btn.id)} title={btn.tip}>{btn.icon}</button>
            ))}
            <div style={{height:5}}/>
            <button style={s.tool} onClick={() => threeRef.current.fitCamera?.()} title="Centrar camara">{icons.fit}</button>
            <button style={s.tool} onClick={() => { threeRef.current.pieces.forEach(p=>{p.visible=false;p.mesh.visible=false;}); threeRef.current.syncPieceList?.(); }} title="Ocultar todo">{icons.hideAll}</button>
            <button style={s.tool} onClick={() => { threeRef.current.pieces.forEach(p=>{p.visible=true;p.mesh.visible=true;}); threeRef.current.syncPieceList?.(); }} title="Mostrar todo">{icons.showAll}</button>
            <div style={{height:5}}/>
            <button style={{...s.tool,...(presMode?s.toolActive:{})}} onClick={() => { setPresMode(v=>!v); setTimeout(()=>{const w=viewportRef.current?.clientWidth,h=viewportRef.current?.clientHeight;if(w&&h){threeRef.current.renderer?.setSize(w,h,false);threeRef.current.camera.aspect=w/h;threeRef.current.camera.updateProjectionMatrix();}},50); }} title="Presentacion">{icons.pres}</button>
          </div>

          {/* Shift hint */}
          {shiftHint && <div style={s.shiftHint}>Orbita libre activa</div>}
          {modeHint   && <div style={s.modeHint}>{modeHint}</div>}
          {msrStep    && <div style={s.msrStep}>{msrStep}</div>}

          {/* Session banner */}
          {sessionBanner && <div style={s.sessionBanner}>Sesion restaurada</div>}

          {/* Ann modal */}
          {annModal && (
            <div style={{...s.modal, left:annModal.x, top:annModal.y}}>
              <h4 style={s.modalH4}>Nueva anotacion</h4>
              <textarea ref={annTextRef} style={s.modalTA} placeholder="Escribe tu nota..." autoFocus/>
              <div style={s.modalRow}>
                <button style={s.mbtnCancel} onClick={() => { threeRef.current.pendingPoint=null; setAnnModal(null); }}>Cancelar</button>
                <button style={s.mbtnSave} onClick={saveAnnotation}>Guardar</button>
              </div>
            </div>
          )}

          {/* Msr modal */}
          {msrModal && (
            <div style={{...s.modal, left:msrModal.x, top:msrModal.y}}>
              <h4 style={s.modalH4}>Medicion</h4>
              <div style={s.msrDist}>{msrModal.dist.toFixed(2)}<span style={{fontSize:12,color:'#3d5f80'}}> mm</span></div>
              <p style={{fontSize:11,color:'#3d5f80',lineHeight:1.7,marginBottom:10}}>Si el modelo viene de DICOM a escala real, la distancia es en milimetros.</p>
              <div style={s.modalRow}>
                <button style={s.mbtnCancel} onClick={discardMeasurement}>Descartar</button>
                <button style={s.mbtnSave} onClick={saveMeasurement}>Guardar</button>
              </div>
            </div>
          )}

          {/* ViewCube */}
          <div style={s.vcWrap}
            onMouseDown={e => { const vc=threeRef.current.vcDrag; vc.btn=e.button; vc.moved=false; vc.startX=vc.lastX=e.clientX; vc.startY=vc.lastY=e.clientY; e.stopPropagation(); }}>
            <canvas ref={vcCanvasRef} width="96" height="96" style={s.vcCanvas}/>
          </div>

          {/* Hint */}
          {!presMode && (
            <div style={s.hint}>
              <b>Arrastrar</b> orbitar<br/>
              <b>Shift+arrastrar</b> libre<br/>
              <b>Clic der</b> mover &nbsp; <b>Scroll</b> zoom<br/>
              <b>Dbl clic</b> enfocar &nbsp; <b>ESC</b> orbitar
            </div>
          )}

          {/* Presentation overlay */}
          {presMode && (
            <div style={s.presOverlay}>
              <span style={{fontSize:12,fontWeight:800,color:'rgba(255,255,255,0.5)'}}>Medu<b style={{color:'#d64830'}}>3D</b></span>
              <button style={s.presBtn} onClick={() => { setAutoRotate(v=>!v); threeRef.current.autoRotate=!threeRef.current.autoRotate; }}>
                Auto-rotar: {autoRotate?'ON':'OFF'}
              </button>
              <button style={s.presBtn} onClick={() => setPresMode(false)}>Salir</button>
            </div>
          )}

          {/* Welcome */}
          {showWelcome && (
            <div style={s.welcome}>
              <div style={{fontSize:40,opacity:0.18}}>&#9829;</div>
              <div style={{fontSize:24,fontWeight:800,color:'white',letterSpacing:-0.5}}>Medu<b style={{color:'#d64830'}}>3D</b> Viewer</div>
              <div style={{fontSize:12,color:'#3d5f80',textAlign:'center',lineHeight:1.9,maxWidth:320}}>
                Carga tus archivos STL para explorar la anatomia con<br/>
                <b style={{color:'#c2d5ee'}}>visibilidad, opacidad, anotaciones, mediciones y cortes</b>
              </div>
              <button style={s.wlcBtn} onClick={() => fileInputRef.current?.click()}>Cargar archivos STL</button>
              <span style={s.wlcDemo} onClick={loadDemo}>Ver logo Medu3D</span>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={s.loadingOverlay}>
              <div style={s.spinner}/>
              <span style={{fontSize:11,color:'#3d5f80'}}>{loadMsg}</span>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM */}
      {!presMode && (
        <div style={s.bottom}>
          <span style={s.botLbl}>CORTE DE SECCION</span>
          {(['x','y','z']).map(ax => (
            <div key={ax} style={{display:'flex',alignItems:'center',gap:7}}>
              <button style={{...s.clipTog,...(clipState[ax]?s.clipTogOn:{})}}
                onClick={() => setClipState(cs => ({...cs,[ax]:!cs[ax]}))}/>
              <span style={{fontSize:10,fontWeight:800,color:'white',width:9}}>{ax.toUpperCase()}</span>
              <input type="range" min="-100" max="100" value={clipValues[ax]} disabled={!clipState[ax]}
                style={{WebkitAppearance:'none',width:88,height:3,borderRadius:2,background:'#182d47',outline:'none',cursor:clipState[ax]?'pointer':'not-allowed',opacity:clipState[ax]?1:0.3}}
                onChange={e => setClipValues(cv => ({...cv,[ax]:parseFloat(e.target.value)}))}/>
              <span style={{fontSize:9,fontFamily:'monospace',color:'#3d5f80',minWidth:24}}>{clipState[ax]?clipValues[ax]:'--'}</span>
            </div>
          ))}
          <div style={s.botDiv}/>
          <span style={s.botLbl}>EXPLOSION</span>
          <input type="range" min="0" max="100" defaultValue="0" style={{WebkitAppearance:'none',width:110,height:3,borderRadius:2,background:'#182d47',outline:'none',cursor:'pointer'}}
            onChange={e => threeRef.current.applyExplosion?.(parseFloat(e.target.value)/100)}/>
        </div>
      )}
    </div>
  );
}

// ─── styles (inline, no external CSS dependency) ─────────────────────────────
const makeStyles = (dark) => {
  const bg      = dark ? '#060b14' : '#f0f2f5';
  const bg2     = dark ? '#0b1525' : '#ffffff';
  const bg3     = dark ? '#0f1e35' : '#eef1f6';
  const border  = dark ? '#182d47' : '#d8dde6';
  const fg      = dark ? '#c2d5ee' : '#15172a';
  const fg2     = dark ? '#3d5f80' : '#6b7a96';
  const logoM   = dark ? 'white'   : '#0b3c73';
  return {
  root:      { display:'flex', flexDirection:'column', height:'100vh', background:bg, color:fg, fontFamily:"'Montserrat',sans-serif", overflow:'hidden' },
  header:    { display:'flex', alignItems:'center', gap:12, padding:'0 16px', height:50, background:bg2, borderBottom:`1px solid ${border}`, flexShrink:0, userSelect:'none' },
  logoTxt:   { fontWeight:800, fontSize:16, color:logoM, letterSpacing:-0.5 },
  badge:     { fontSize:8, fontWeight:800, background:'#d64830', color:'white', padding:'2px 6px', borderRadius:3, letterSpacing:1.5 },
  hdiv:      { width:1, height:22, background:border },
  hdrSub:    { fontSize:10, color:fg2 },
  hbtn:      { display:'flex', alignItems:'center', gap:6, padding:'6px 13px', border:`1px solid ${border}`, background:'transparent', color:fg, borderRadius:6, fontFamily:"'Montserrat',sans-serif", fontSize:10, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' },
  primaryBtn:{ padding:'7px 16px', background:'#0b3c73', border:'none', color:'white', borderRadius:6, fontFamily:"'Montserrat',sans-serif", fontSize:11, fontWeight:700, cursor:'pointer' },
  backBtn:   { background:'none', border:'none', color:fg2, cursor:'pointer', padding:'4px 6px', display:'flex', alignItems:'center' },
  demoLnk:   { fontSize:11, color:fg2, cursor:'pointer', textDecoration:'underline', padding:4, whiteSpace:'nowrap' },
  main:      { display:'flex', flex:1, overflow:'hidden' },
  sidebar:   { width:260, minWidth:260, background:bg2, borderRight:`1px solid ${border}`, display:'flex', flexDirection:'column', overflow:'hidden' },
  secHdr:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 13px', borderBottom:`1px solid ${border}`, fontSize:9, fontWeight:700, letterSpacing:1.8, color:fg2, textTransform:'uppercase', flexShrink:0 },
  cnt:       { fontSize:10, fontWeight:700, color:fg, letterSpacing:0, textTransform:'none', background:bg3, padding:'1px 7px', borderRadius:10, border:`1px solid ${border}` },
  piecesWrap:{ flex:1, overflowY:'auto', padding:6, minHeight:0 },
  sideScroll:{ overflowY:'auto', maxHeight:160, padding:6 },
  piece:     { borderRadius:7, marginBottom:3, background:bg3, cursor:'pointer', border:'1px solid transparent', transition:'border-color 0.15s' },
  pieceSel:  { borderColor:'#d64830', background:'rgba(214,72,48,0.12)' },
  pieceHid:  { opacity:0.32 },
  pieceRow:  { display:'flex', alignItems:'center', gap:7, padding:'7px 8px' },
  visBtn:    { background:'none', border:'none', cursor:'pointer', padding:0, color:fg2, lineHeight:1, flexShrink:0 },
  clrDot:    { width:11, height:11, borderRadius:3, cursor:'pointer', border:'1px solid rgba(0,0,0,0.15)', transition:'transform 0.15s' },
  pieceName: { fontSize:11, fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:fg },
  delBtn:    { background:'none', border:'none', cursor:'pointer', color:'transparent', lineHeight:1, padding:0, transition:'color 0.15s' },
  opRow:     { display:'flex', alignItems:'center', gap:8, padding:'0 8px 7px 36px' },
  opLbl:     { fontSize:9, color:fg2, whiteSpace:'nowrap', fontWeight:600 },
  opSl:      { WebkitAppearance:'none', flex:1, height:3, borderRadius:2, background:border, outline:'none', cursor:'pointer' },
  opVal:     { fontSize:9, fontFamily:'monospace', color:fg2, minWidth:28 },
  emptyHint: { padding:'20px 13px', textAlign:'center', fontSize:11, color:fg2, lineHeight:1.8 },
  listItem:  { display:'flex', alignItems:'flex-start', gap:7, padding:'7px 8px', borderRadius:7, marginBottom:3, background:bg3 },
  annNum:    { width:17, height:17, borderRadius:'50%', background:'#d64830', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:'white', flexShrink:0 },
  msrNum:    { width:17, height:17, borderRadius:'50%', background:'#0b3c73', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:'white', flexShrink:0 },
  itemTxt:   { flex:1, fontSize:11, color:fg, lineHeight:1.5, wordBreak:'break-word' },
  itemDel:   { background:'none', border:'none', cursor:'pointer', color:fg2, fontSize:13, padding:0, lineHeight:1 },
  viewport:  { flex:1, position:'relative', overflow:'hidden' },
  canvas:    { display:'block' },
  toolbar:   { position:'absolute', top:14, left:14, display:'flex', flexDirection:'column', gap:4, zIndex:5 },
  tool:      { width:34, height:34, borderRadius:8, background: dark ? 'rgba(11,21,37,0.92)' : 'rgba(255,255,255,0.92)', border:`1px solid ${border}`, color:fg2, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' },
  toolActive:{ background:'#d64830', borderColor:'#d64830', color:'white' },
  shiftHint: { position:'absolute', top:14, left:'50%', transform:'translateX(-50%)', zIndex:10, background:'rgba(11,61,115,0.92)', border:'1px solid #0b3c73', borderRadius:8, padding:'6px 14px', fontSize:10, fontWeight:700, color:'white', pointerEvents:'none' },
  modeHint:  { position:'absolute', top:14, left:'50%', transform:'translateX(-50%)', zIndex:10, background:'rgba(214,72,48,0.18)', border:'1px solid #d64830', borderRadius:8, padding:'6px 14px', fontSize:10, fontWeight:700, color:'#d64830', pointerEvents:'none' },
  msrStep:   { position:'absolute', top:60, left:'50%', transform:'translateX(-50%)', zIndex:10, background:'rgba(11,61,115,0.92)', border:'1px solid #0b3c73', borderRadius:8, padding:'7px 16px', fontSize:11, fontWeight:700, color:'white' },
  sessionBanner:{ position:'absolute', top:12, right:12, zIndex:15, background:'rgba(39,174,96,0.15)', border:'1px solid rgba(39,174,96,0.4)', borderRadius:8, padding:'8px 14px', fontSize:11, color:'#2ecc71', fontWeight:600 },
  modal:     { position:'absolute', zIndex:25, background:bg2, border:`1px solid ${border}`, borderRadius:10, padding:14, width:230, boxShadow:'0 12px 40px rgba(0,0,0,0.7)' },
  modalH4:   { fontSize:11, fontWeight:700, marginBottom:9, color:fg },
  modalTA:   { width:'100%', height:68, background:bg, border:`1px solid ${border}`, borderRadius:7, padding:8, fontFamily:"'Montserrat',sans-serif", fontSize:11, color:fg, resize:'none', outline:'none', marginBottom:9 },
  msrDist:   { fontSize:20, fontWeight:800, color:fg, fontFamily:'monospace', textAlign:'center', padding:'10px 0', borderTop:`1px solid ${border}`, borderBottom:`1px solid ${border}`, marginBottom:10 },
  modalRow:  { display:'flex', gap:7, justifyContent:'flex-end' },
  mbtnCancel:{ padding:'6px 14px', borderRadius:6, fontFamily:"'Montserrat',sans-serif", fontSize:11, fontWeight:700, cursor:'pointer', background:bg3, color:fg, border:`1px solid ${border}` },
  mbtnSave:  { padding:'6px 14px', borderRadius:6, fontFamily:"'Montserrat',sans-serif", fontSize:11, fontWeight:700, cursor:'pointer', background:'#d64830', color:'white', border:'none' },
  vcWrap:    { position:'absolute', bottom:14, right:14, width:96, height:96, zIndex:10, userSelect:'none' },
  vcCanvas:  { display:'block', borderRadius:10, cursor:'grab' },
  hint:      { position:'absolute', bottom:118, right:14, zIndex:5, background: dark ? 'rgba(11,21,37,0.88)' : 'rgba(255,255,255,0.92)', border:`1px solid ${border}`, borderRadius:8, padding:'8px 12px', fontSize:9, color:fg2, lineHeight:2, textAlign:'right' },
  welcome:   { position:'absolute', inset:0, background:bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14, zIndex:20 },
  wlcBtn:    { padding:'12px 32px', background:'#d64830', color:'white', border:'none', borderRadius:8, fontFamily:"'Montserrat',sans-serif", fontSize:13, fontWeight:800, cursor:'pointer', marginTop:4 },
  wlcDemo:   { fontSize:11, color:fg2, cursor:'pointer', textDecoration:'underline' },
  loadingOverlay:{ position:'absolute', inset:0, background: dark ? 'rgba(6,11,20,0.85)' : 'rgba(240,242,245,0.85)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, zIndex:28 },
  spinner:   { width:30, height:30, border:`3px solid ${border}`, borderTopColor:'#d64830', borderRadius:'50%', animation:'spin 0.8s linear infinite' },
  presOverlay:{ position:'absolute', bottom:20, left:'50%', transform:'translateX(-50%)', zIndex:10, display:'flex', gap:10, alignItems:'center' },
  presBtn:   { padding:'7px 16px', background: dark ? 'rgba(11,21,37,0.88)' : 'rgba(255,255,255,0.92)', border:`1px solid ${border}`, color:fg, borderRadius:20, fontFamily:"'Montserrat',sans-serif", fontSize:11, fontWeight:700, cursor:'pointer' },
  bottom:    { background:bg2, borderTop:`1px solid ${border}`, padding:'10px 16px', display:'flex', alignItems:'center', gap:18, flexShrink:0, flexWrap:'wrap' },
  botLbl:    { fontSize:9, fontWeight:700, letterSpacing:1.8, color:fg2, textTransform:'uppercase', whiteSpace:'nowrap' },
  botDiv:    { width:1, height:28, background:border },
  clipTog:   { width:28, height:16, borderRadius:8, border:'none', cursor:'pointer', background:border, position:'relative', transition:'background 0.2s', flexShrink:0 },
  clipTogOn: { background:'#d64830' },
  };
};
