import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIGURACIÓN — Cambia estas variables antes de subir al servidor
   ═══════════════════════════════════════════════════════════════════════════ */

// PayPal Live Client ID
const PAYPAL_CLIENT_ID = "ARguyNA3-2Hr-J5fgk9nuSxNnAe6Bd4YD7yxccFcHpmN05eMOQiQ7xddFDGokoMb9DhrVgmCTFUtBdMa";

// Formspree endpoint — crea cuenta en formspree.io y reemplaza con tu ID
// Ejemplo: "https://formspree.io/f/xpzgkwer"
const FORMSPREE_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID";

/* ═══════════════════════════════════════════════════════════════════════════
   i18n
   ═══════════════════════════════════════════════════════════════════════════ */
const T = {
  es: {
    nav: { catalog: "Catálogo", quote: "Cotización", contact: "Contacto", cart: "Carrito" },
    hero: { explore: "Ver detalles", badge: "Desde CT & MRI reales" },
    about: {
      title: "¿Qué es Medu 3D?",
      desc: "Transformamos tomografías y resonancias reales en modelos 3D de precisión clínica — listos para visualizar, estudiar o imprimir.",
      s1t: "Modelos Educativos", s1d: "Órganos y estructuras detalladas para estudio anatómico y formación médica.",
      s2t: "Servicio a la Medida", s2d: "Envíanos tu CT o MRI y generamos el modelo 3D personalizado.",
      s3t: "Impresión 3D", s3d: "Archivos .STL y .OBJ listos para imprimir con cualquier impresora 3D.",
    },
    catalog: {
      title: "Catálogo Completo", subtitle: "Todos nuestros modelos disponibles",
      addCart: "Añadir al carrito", added: "✓ Añadido", buy: "Comprar ahora",
      back: "← Volver", formats: "Formatos", rotate: "Arrastra para rotar · Scroll para zoom", desc: "Descripción",
    },
    quote: {
      title: "Solicitar Cotización", subtitle: "¿Necesitas un modelo personalizado? Descríbenos tu proyecto.",
      name: "Nombre completo", email: "Correo electrónico",
      details: "Describe el modelo que necesitas (región anatómica, propósito, etc.)",
      send: "Enviar solicitud", sending: "Enviando...", sent: "¡Solicitud enviada! Te contactaremos pronto.",
      error: "Error al enviar. Intenta de nuevo o escríbenos directamente.",
    },
    contact: {
      title: "Contacto", subtitle: "Escríbenos directamente", or: "o envíanos un mensaje",
      name: "Nombre completo", email: "Correo electrónico",
      msg: "Tu mensaje",
      send: "Enviar mensaje", sending: "Enviando...", sent: "¡Mensaje enviado! Te respondemos pronto.",
      error: "Error al enviar. Escríbenos directamente a contacto@medu3d.com",
    },
    cart: {
      title: "Tu Carrito", empty: "Tu carrito está vacío", total: "Total",
      checkout: "Pagar ahora", remove: "Quitar", browse: "Explorar catálogo",
      paypalNote: "Paga con tarjeta o cuenta PayPal — sin redirección",
    },
    footer: { tag: "Modelos anatómicos 3D de precisión clínica.", rights: "Todos los derechos reservados." },
  },
  en: {
    nav: { catalog: "Catalog", quote: "Quote", contact: "Contact", cart: "Cart" },
    hero: { explore: "View details", badge: "From real CT & MRI" },
    about: {
      title: "What is Medu 3D?",
      desc: "We transform real CT scans and MRIs into clinical-precision 3D models — ready to visualize, study, or print.",
      s1t: "Educational Models", s1d: "Detailed organs and structures for anatomical study and medical training.",
      s2t: "Custom Service", s2d: "Send us your CT or MRI and we generate a personalized 3D model.",
      s3t: "3D Printing", s3d: ".STL and .OBJ files ready to print on any 3D printer.",
    },
    catalog: {
      title: "Full Catalog", subtitle: "All our available models",
      addCart: "Add to cart", added: "✓ Added", buy: "Buy now",
      back: "← Back", formats: "Formats", rotate: "Drag to rotate · Scroll to zoom", desc: "Description",
    },
    quote: {
      title: "Request a Quote", subtitle: "Need a custom model? Tell us about your project.",
      name: "Full name", email: "Email address",
      details: "Describe the model you need (anatomical region, purpose, etc.)",
      send: "Send request", sending: "Sending...", sent: "Request sent! We'll be in touch soon.",
      error: "Failed to send. Please try again or email us directly.",
    },
    contact: {
      title: "Contact", subtitle: "Write to us directly", or: "or send us a message",
      name: "Full name", email: "Email address",
      msg: "Your message",
      send: "Send message", sending: "Sending...", sent: "Message sent! We'll reply soon.",
      error: "Failed to send. Email us directly at contacto@medu3d.com",
    },
    cart: {
      title: "Your Cart", empty: "Your cart is empty", total: "Total",
      checkout: "Pay now", remove: "Remove", browse: "Browse catalog",
      paypalNote: "Pay with card or PayPal account — no redirect",
    },
    footer: { tag: "Clinical-precision 3D anatomical models.", rights: "All rights reserved." },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Product Data
   ═══════════════════════════════════════════════════════════════════════════ */
const P = [
  { id: "heart", price: 24.99, formats: ".STL, .OBJ", color: "#e05555", geo: "heart",
    name: { es: "Corazón Humano", en: "Human Heart" },
    tag: { es: "4 cámaras · Válvulas · Grandes vasos", en: "4 chambers · Valves · Great vessels" },
    desc: { es: "Modelo detallado del corazón humano completo con las 4 cámaras cardíacas, válvulas y grandes vasos. Segmentado desde CT con contraste. Ideal para educación cardiovascular y planificación quirúrgica.", en: "Detailed model of the complete human heart with all 4 cardiac chambers, valves and great vessels. Segmented from contrast CT. Ideal for cardiovascular education and surgical planning." },
  },
  { id: "skull", price: 29.99, formats: ".STL, .OBJ", color: "#c4a882", geo: "skull",
    name: { es: "Cráneo Adulto", en: "Adult Skull" },
    tag: { es: "Mandíbula articulada · Alta resolución", en: "Articulated mandible · High resolution" },
    desc: { es: "Cráneo completo con mandíbula separable. Incluye suturas craneales, forámenes y procesos óseos. Segmentado desde CT de alta resolución (0.5mm). Para educación anatómica y odontología.", en: "Complete skull with separable mandible. Includes cranial sutures, foramina and bony processes. Segmented from high-resolution CT (0.5mm). For anatomical education and dentistry." },
  },
  { id: "spine", price: 19.99, formats: ".STL, .OBJ", color: "#7a8fa3", geo: "spine",
    name: { es: "Columna Lumbar", en: "Lumbar Spine" },
    tag: { es: "L1-L5 · Discos intervertebrales", en: "L1-L5 · Intervertebral discs" },
    desc: { es: "Vértebras L1-L5 con discos intervertebrales diferenciados. Detalle de procesos espinosos, transversos y articulares. Para estudio ortopédico y quirúrgico.", en: "L1-L5 vertebrae with differentiated intervertebral discs. Detail of spinous, transverse and articular processes. For orthopedic and surgical study." },
  },
  { id: "brain", price: 22.99, formats: ".STL, .OBJ", color: "#c98a90", geo: "brain",
    name: { es: "Cerebro", en: "Brain" },
    tag: { es: "Hemisferios · Surcos · Cerebelo", en: "Hemispheres · Sulci · Cerebellum" },
    desc: { es: "Modelo cerebral con surcos y circunvoluciones detalladas, hemisferios separados, cerebelo y tronco encefálico. Segmentado desde MRI T1. Para neurociencia y educación.", en: "Brain model with detailed sulci and gyri, separated hemispheres, cerebellum and brainstem. Segmented from T1 MRI. For neuroscience and education." },
  },
  { id: "kidney", price: 18.99, formats: ".STL, .OBJ", color: "#9e6b5a", geo: "kidney",
    name: { es: "Riñón con Vasculatura", en: "Kidney with Vasculature" },
    tag: { es: "Arterias · Venas renales · Uréter", en: "Arteries · Renal veins · Ureter" },
    desc: { es: "Riñón con arterias y venas renales diferenciadas, uréter y cápsula renal. Para nefrología, urología y educación.", en: "Kidney with color-differentiated renal arteries and veins, ureter and renal capsule. For nephrology, urology and education." },
  },
  { id: "pelvis", price: 26.99, formats: ".STL, .OBJ", color: "#b5a48a", geo: "pelvis",
    name: { es: "Pelvis Completa", en: "Complete Pelvis" },
    tag: { es: "Ilíacos · Sacro · Cóccix", en: "Iliac bones · Sacrum · Coccyx" },
    desc: { es: "Huesos ilíacos, sacro y cóccix con detalle cortical completo. Segmentado desde CT de trauma. Para ortopedia y planificación quirúrgica.", en: "Iliac bones, sacrum and coccyx with full cortical detail. Segmented from trauma CT. For orthopedics and surgical planning." },
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   PayPal Smart Buttons Component
   Carga el SDK de PayPal dinámicamente y renderiza los botones
   ═══════════════════════════════════════════════════════════════════════════ */
function PayPalButtons({ items, onSuccess, onError, lang }) {
  const containerRef = useRef(null);
  const buttonsRef = useRef(null);
  const total = items.reduce((s, p) => s + p.price, 0).toFixed(2);

  useEffect(() => {
    if (!items.length || !containerRef.current) return;

    // Limpia botones anteriores
    if (buttonsRef.current) {
      buttonsRef.current.close();
      buttonsRef.current = null;
    }
    if (containerRef.current) containerRef.current.innerHTML = "";

    const loadAndRender = async () => {
      // Carga el SDK solo una vez
      if (!window.paypal) {
        await new Promise((resolve, reject) => {
          const existing = document.getElementById("paypal-sdk");
          if (existing) { resolve(); return; }
          const script = document.createElement("script");
          script.id = "paypal-sdk";
          script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD&intent=capture`;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      if (!window.paypal || !containerRef.current) return;

      const itemList = items.map(p => ({
        name: lang === "es" ? p.name.es : p.name.en,
        unit_amount: { currency_code: "USD", value: p.price.toFixed(2) },
        quantity: "1",
      }));

      buttonsRef.current = window.paypal.Buttons({
        style: {
          layout: "vertical",
          color: "blue",
          shape: "rect",
          label: "pay",
          height: 44,
        },
        createOrder: (data, actions) => {
          return actions.order.create({
            purchase_units: [{
              description: "Medu 3D — Modelos Anatómicos 3D",
              amount: {
                currency_code: "USD",
                value: total,
                breakdown: {
                  item_total: { currency_code: "USD", value: total },
                },
              },
              items: itemList,
            }],
          });
        },
        onApprove: async (data, actions) => {
          const order = await actions.order.capture();
          if (onSuccess) onSuccess(order);
        },
        onError: (err) => {
          console.error("PayPal error:", err);
          if (onError) onError(err);
        },
      });

      if (containerRef.current) {
        buttonsRef.current.render(containerRef.current);
      }
    };

    loadAndRender().catch(console.error);

    return () => {
      if (buttonsRef.current) {
        try { buttonsRef.current.close(); } catch {}
        buttonsRef.current = null;
      }
    };
  }, [items.map(i => i.id).join(","), total, lang]);

  if (!items.length) return null;

  return <div ref={containerRef} style={{ width: "100%", minHeight: 50 }} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PayPal Single Product Button (página de producto)
   ═══════════════════════════════════════════════════════════════════════════ */
function PayPalSingleButton({ product, lang, onSuccess }) {
  return <PayPalButtons items={[product]} lang={lang} onSuccess={onSuccess} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Formspree Form Hook
   ═══════════════════════════════════════════════════════════════════════════ */
function useForm(endpoint) {
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [fields, setFields] = useState({});

  const set = (k, v) => setFields(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setStatus("sending");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        setStatus("sent");
        setFields({});
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return { fields, set, submit, status };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Three.js Viewer
   ═══════════════════════════════════════════════════════════════════════════ */
function Viewer({ color, geo, active, interact = false, bgColor = 0xeef1f5 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active || !ref.current) return;
    const c = ref.current, w = c.clientWidth, h = c.clientHeight;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(bgColor);
    const cam = new THREE.PerspectiveCamera(38, w / h, 0.1, 100); cam.position.set(0, 0, 4.5);
    const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(w, h); r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.5; c.appendChild(r.domElement);

    scene.add(new THREE.AmbientLight(0xd0d4de, 0.9));
    const l1 = new THREE.DirectionalLight(0xfff8f0, 1.4); l1.position.set(5, 6, 5); scene.add(l1);
    const l2 = new THREE.DirectionalLight(0x8899bb, 0.5); l2.position.set(-4, -2, 3); scene.add(l2);

    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.4, metalness: 0.06 });
    const g = new THREE.Group();
    switch (geo) {
      case "heart": {
        const s = new THREE.Shape(); s.moveTo(0, 0.5); s.bezierCurveTo(0, 0.8, -0.5, 1.1, -1, 0.7); s.bezierCurveTo(-1.5, 0.3, -1.2, -0.4, 0, -1.2);
        s.moveTo(0, 0.5); s.bezierCurveTo(0, 0.8, 0.5, 1.1, 1, 0.7); s.bezierCurveTo(1.5, 0.3, 1.2, -0.4, 0, -1.2);
        const eg = new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.1, bevelSegments: 8 }); eg.center();
        g.add(new THREE.Mesh(eg, mat)); const a = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.8, 16), mat.clone()); a.material.color.set("#a02020"); a.position.set(0.15, 0.9, 0); a.rotation.z = -0.2; g.add(a); break;
      }
      case "skull": {
        const cr = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), mat); cr.scale.set(0.85, 1, 0.95); g.add(cr);
        const em = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.9 });
        [-0.3, 0.3].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), em); e.position.set(x, 0.05, 0.8); g.add(e); });
        const j = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.5), mat.clone()); j.position.set(0, -0.55, 0.1); j.scale.set(1.1, 0.7, 1); g.add(j); break;
      }
      case "spine": {
        for (let i = 0; i < 5; i++) { const v = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.38, 0.28, 8), mat); v.position.y = i * 0.45 - 0.9; g.add(v);
          const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.4), mat); p.position.set(0, i * 0.45 - 0.9, -0.35); g.add(p);
          if (i < 4) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 16), new THREE.MeshStandardMaterial({ color: 0x6699aa, roughness: 0.7, transparent: true, opacity: 0.7 })); d.position.y = i * 0.45 - 0.67; g.add(d); }
        } break;
      }
      case "brain": {
        const bm = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.6, metalness: 0.05 });
        [-0.15, 0.15].forEach(x => { const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.85, 32, 24), bm.clone()); h2.scale.set(0.48, 0.65, 0.8); h2.position.x = x; g.add(h2); });
        const cb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16), bm.clone()); cb.material.color.set("#c0808a"); cb.scale.set(1, 0.6, 0.7); cb.position.set(0, -0.5, -0.4); g.add(cb); break;
      }
      case "kidney": {
        g.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 24), mat), { scale: new THREE.Vector3(0.55, 1, 0.45) }));
        const ar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0xcc3333 })); ar.rotation.z = Math.PI / 2; ar.position.set(0.55, 0.1, 0); g.add(ar);
        const vn = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0x3344aa })); vn.rotation.z = Math.PI / 2; vn.position.set(0.5, -0.1, 0); g.add(vn);
        const ur = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0xddcc88 })); ur.position.set(0.1, -0.85, 0); g.add(ur); break;
      }
      case "pelvis": {
        g.add(Object.assign(new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.7, 6), mat), { position: new THREE.Vector3(0, 0.2, -0.1) }));
        [[-0.45, -0.4, 0.3], [0.45, 0.4, -0.3]].forEach(([x, ry, rz]) => { const il = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.12, 8, 16, Math.PI * 0.8), mat.clone()); il.position.x = x; il.rotation.y = ry; il.rotation.z = rz; g.add(il); });
        g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.15), mat.clone()), { position: new THREE.Vector3(0, -0.55, 0.3) })); break;
      }
      default: g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), mat));
    }
    scene.add(g);

    let drag = false, px = 0, py = 0, rx = 0, ry2 = 0, td = 4.5, d = 4.5;
    if (interact) {
      const el = r.domElement;
      el.addEventListener("pointerdown", e => { drag = true; px = e.clientX; py = e.clientY; });
      el.addEventListener("pointermove", e => { if (!drag) return; ry2 += (e.clientX - px) * 0.008; rx = Math.max(-1.5, Math.min(1.5, rx + (e.clientY - py) * 0.008)); px = e.clientX; py = e.clientY; });
      el.addEventListener("pointerup", () => drag = false);
      el.addEventListener("wheel", e => { td = Math.max(2, Math.min(8, td + e.deltaY * 0.003)); });
      el.addEventListener("touchstart", e => { if (e.touches.length === 1) { drag = true; px = e.touches[0].clientX; py = e.touches[0].clientY; } }, { passive: true });
      el.addEventListener("touchmove", e => { if (!drag || e.touches.length !== 1) return; e.preventDefault(); ry2 += (e.touches[0].clientX - px) * 0.008; rx = Math.max(-1.5, Math.min(1.5, rx + (e.touches[0].clientY - py) * 0.008)); px = e.touches[0].clientX; py = e.touches[0].clientY; }, { passive: false });
      el.addEventListener("touchend", () => drag = false);
    }

    let ar = 0, aid;
    const anim = () => { aid = requestAnimationFrame(anim); if (!drag) ar += interact ? 0.003 : 0.002; d += (td - d) * 0.08;
      cam.position.set(Math.sin(ry2 + ar) * Math.cos(rx) * d, Math.sin(rx) * d, Math.cos(ry2 + ar) * Math.cos(rx) * d); cam.lookAt(0, 0, 0); r.render(scene, cam); };
    anim();
    const onR = () => { const nw = c.clientWidth, nh = c.clientHeight; cam.aspect = nw / nh; cam.updateProjectionMatrix(); r.setSize(nw, nh); };
    window.addEventListener("resize", onR);
    return () => { cancelAnimationFrame(aid); window.removeEventListener("resize", onR); r.dispose(); if (c.contains(r.domElement)) c.removeChild(r.domElement); };
  }, [active, color, geo, interact, bgColor]);
  return <div ref={ref} style={{ width: "100%", height: "100%" }} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   App
   ═══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [lang, setLang] = useState("es");
  const [page, setPage] = useState("home");
  const [selProd, setSelProd] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [slideDir, setSlideDir] = useState(1);
  const [animating, setAnimating] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);

  const t = T[lang];

  const goTo = useCallback((idx, dir) => {
    if (animating || idx === hi) return;
    setSlideDir(dir); setAnimating(true);
    setTimeout(() => { setHi(idx); setTimeout(() => setAnimating(false), 50); }, 350);
  }, [animating, hi]);

  useEffect(() => {
    if (page !== "home") return;
    const iv = setInterval(() => { goTo((hi + 1) % P.length, 1); }, 7000);
    return () => clearInterval(iv);
  }, [page, hi, animating, goTo]);

  const addCart = p => { if (!cart.find(c => c.id === p.id)) setCart([...cart, p]); };
  const rmCart = id => setCart(cart.filter(c => c.id !== id));
  const total = cart.reduce((s, p) => s + p.price, 0).toFixed(2);
  const goProd = p => { setSelProd(p); setPage("product"); window.scrollTo(0, 0); };
  const goPage = p => { setPage(p); setMenuOpen(false); window.scrollTo(0, 0); };

  const cur = P[hi];
  const textState = animating ? "exit" : "enter";
  const modelState = animating ? "exit" : "enter";

  const handlePaymentSuccess = (order) => {
    setPaymentDone(true);
    setCart([]);
    setCartOpen(false);
  };

  return (
    <>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Montserrat:wght@800&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300&display=swap');
:root { --bg:#f4f6fb; --bg2:#fff; --bg3:#e8ecf5; --vbg:#dfe4f0; --fg:#0b1d35; --fg2:#4a5a72; --fg3:#8896aa; --ac:#d64830; --ac2:#e85a40; --acs:rgba(214,72,48,0.08); --navy:#0b3c73; --navy2:#0d4a8e; --navys:rgba(11,60,115,0.07); --rd:16px; --sh:0 4px 24px rgba(11,60,115,0.10); }
*{margin:0;padding:0;box-sizing:border-box}
body,html{background:var(--bg);color:var(--fg);font-family:'Outfit',sans-serif;font-weight:400;-webkit-font-smoothing:antialiased;scroll-behavior:smooth}
h1,h2,h3{font-family:'Fraunces',serif;font-weight:600}

nav{position:fixed;top:0;left:0;right:0;padding:16px 48px;display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.95);backdrop-filter:blur(24px);z-index:200;border-bottom:1px solid rgba(11,60,115,0.08);box-shadow:0 2px 20px rgba(11,60,115,0.06)}
.logo{font-family:'Montserrat',sans-serif;font-size:26px;cursor:pointer;display:flex;gap:1px;align-items:center;font-weight:800;letter-spacing:-0.5px}.logo .m{color:#0b3c73}.logo .d{color:#d64830}.logo img{height:40px;width:auto;object-fit:contain;margin-right:9px}
.nl{display:flex;gap:6px;align-items:center;list-style:none}
.nb{background:none;border:1px solid transparent;color:var(--fg2);padding:8px 16px;border-radius:10px;cursor:pointer;font-size:13px;font-family:'Outfit';font-weight:500;transition:all .2s;position:relative}
.nb:hover,.nb.on{background:var(--navys);color:var(--navy);border-color:rgba(11,60,115,0.12)}
.cb{position:absolute;top:2px;right:2px;width:17px;height:17px;background:var(--ac);color:#fff;border-radius:50%;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:700}
.lb{background:var(--ac);border:none;color:#fff;padding:8px 16px;border-radius:9px;cursor:pointer;font-size:12px;font-family:'Outfit';font-weight:700;letter-spacing:.3px;transition:all .2s}.lb:hover{background:var(--ac2);transform:translateY(-1px)}
.hb{display:none;background:none;border:none;color:var(--fg);cursor:pointer;padding:4px}
.mm{display:none;position:fixed;top:54px;left:0;right:0;bottom:0;background:rgba(246,247,250,0.98);z-index:199;flex-direction:column;align-items:center;justify-content:center;gap:28px}.mm.open{display:flex}
.mm button{background:none;border:none;color:var(--fg);font-family:'Fraunces',serif;font-size:26px;cursor:pointer}

/* HERO */
.hero{min-height:100vh;display:flex;align-items:center;padding:88px 60px 48px;gap:0;max-width:1440px;margin:0 auto;overflow:hidden;position:relative;background:linear-gradient(160deg,#f4f6fb 0%,#edf0f8 100%)}
.hero-left{flex:0 0 38%;padding-right:52px;position:relative;overflow:hidden;height:360px}
.hero-right{flex:1;height:75vh;min-height:500px;border-radius:28px;overflow:hidden;cursor:pointer;position:relative;box-shadow:0 20px 60px rgba(11,60,115,0.15)}
.text-slide{position:absolute;top:0;left:0;right:0;display:flex;flex-direction:column;justify-content:center;height:100%;padding-right:20px;transition:transform .45s cubic-bezier(.4,0,.2,1),opacity .45s ease}
.text-slide.enter{transform:translateY(0);opacity:1}
.text-slide.exit{transform:translateY(${slideDir > 0 ? "-40px" : "40px"});opacity:0}
.model-wrap{width:100%;height:100%;position:relative;transition:transform .5s cubic-bezier(.4,0,.2,1),opacity .4s ease}
.model-wrap.enter{transform:translateX(0);opacity:1}
.model-wrap.exit{transform:translateX(${slideDir > 0 ? "-60px" : "60px"});opacity:0}
.hero-badge{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--navy);padding:6px 14px;border-radius:20px;background:var(--navys);border:1px solid rgba(11,60,115,0.12);margin-bottom:22px}
.hero-left h1{font-size:clamp(30px,3.8vw,52px);line-height:1.08;margin-bottom:12px;letter-spacing:-.8px;color:var(--fg)}
.hero-tag{font-size:14px;color:var(--fg2);line-height:1.6;margin-bottom:6px}
.hero-price{font-family:'Fraunces',serif;font-size:38px;margin:16px 0 26px;color:var(--navy);font-weight:300}.hero-price span{font-size:14px;color:var(--fg3);font-family:'Outfit';font-weight:400;margin-left:4px}
.hero-cta{display:inline-flex;align-items:center;gap:10px;padding:14px 28px;background:var(--ac);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;transition:all .25s;font-family:'Outfit';letter-spacing:.2px}.hero-cta:hover{background:var(--ac2);transform:translateY(-2px);box-shadow:0 10px 30px rgba(214,72,48,.3)}
.hero-nav{position:absolute;bottom:48px;left:48px;display:flex;gap:8px;align-items:center;z-index:10}
.hero-arr{width:36px;height:36px;border-radius:50%;border:1px solid rgba(0,0,0,0.1);background:var(--bg2);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;color:var(--fg2);font-size:16px}.hero-arr:hover{border-color:var(--ac);color:var(--ac);background:var(--acs)}
.hero-dots{display:flex;gap:6px;margin:0 8px}
.hero-dot{width:8px;height:8px;border-radius:50%;border:none;cursor:pointer;transition:all .3s}.hero-dot.on{background:var(--ac);width:22px;border-radius:4px}.hero-dot:not(.on){background:var(--bg3)}

/* ABOUT */
.about{padding:96px 60px;max-width:1100px;margin:0 auto;text-align:center}
.about h2{font-size:clamp(28px,4vw,46px);margin-bottom:16px;letter-spacing:-.3px}
.about>p{max-width:560px;margin:0 auto 52px;color:var(--fg2);font-size:16px;line-height:1.75}
.sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}
.sc{background:var(--bg2);border:1px solid rgba(11,60,115,0.07);border-radius:var(--rd);padding:32px 26px;text-align:left;transition:all .3s;box-shadow:0 2px 12px rgba(11,60,115,0.04)}.sc:hover{border-color:rgba(11,60,115,0.18);box-shadow:var(--sh);transform:translateY(-4px)}
.si{width:46px;height:46px;border-radius:12px;background:var(--navys);display:flex;align-items:center;justify-content:center;margin-bottom:16px}
.sc h3{font-size:16px;margin-bottom:6px;font-family:'Outfit';font-weight:600}.sc p{font-size:13px;color:var(--fg2);line-height:1.6}

/* CATALOG */
.cat{padding:90px 48px 40px;max-width:1200px;margin:0 auto}
.cat-h{text-align:center;margin-bottom:44px}.cat-h h2{font-size:clamp(26px,4vw,40px);margin-bottom:8px}.cat-h p{color:var(--fg2);font-size:15px}
.cg{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
.cc{background:var(--bg2);border:1px solid rgba(11,60,115,0.07);border-radius:var(--rd);overflow:hidden;cursor:pointer;transition:all .3s;box-shadow:0 2px 12px rgba(11,60,115,0.04)}.cc:hover{border-color:rgba(11,60,115,0.18);box-shadow:var(--sh);transform:translateY(-4px)}
.ct{height:190px;background:var(--vbg);display:flex;align-items:center;justify-content:center}.ct svg{opacity:.45}
.ci{padding:18px}.ci h3{font-size:17px;margin-bottom:3px;font-family:'Outfit';font-weight:600}.ci .tl{font-size:12px;color:var(--fg3);margin-bottom:12px}
.cf{display:flex;justify-content:space-between;align-items:center}
.cp{font-family:'Fraunces',serif;font-size:24px;color:var(--navy)}
.cb2{padding:8px 16px;border-radius:10px;border:none;font-size:12px;font-weight:600;cursor:pointer;font-family:'Outfit';transition:all .2s}.cb2.pr{background:var(--ac);color:#fff;box-shadow:0 3px 12px rgba(214,72,48,0.25)}.cb2.pr:hover{background:var(--ac2);transform:translateY(-1px)}.cb2.ad{background:var(--acs);color:var(--ac)}

/* PRODUCT DETAIL */
.pd{padding:90px 48px 40px;max-width:1200px;margin:0 auto}
.pd-b{background:none;border:none;color:var(--fg2);font-size:14px;cursor:pointer;font-family:'Outfit';margin-bottom:20px;padding:0;transition:color .2s}.pd-b:hover{color:var(--ac)}
.pd-l{display:grid;grid-template-columns:1fr 1fr;gap:36px;align-items:start}
.pd-v{height:480px;border-radius:20px;overflow:hidden;background:var(--vbg)}
.pd-i h1{font-size:30px;margin-bottom:6px}.pd-i .tl{font-size:14px;color:var(--fg3);margin-bottom:14px}
.pd-i .pr{font-family:'Fraunces',serif;font-size:34px;margin-bottom:6px}.pd-i .pr span{font-size:14px;color:var(--fg3);font-family:'Outfit'}
.pd-i .fm{font-size:12px;color:var(--fg3);background:var(--bg3);display:inline-block;padding:4px 12px;border-radius:6px;margin-bottom:18px}
.pd-i .dt{font-size:13px;font-weight:600;color:var(--fg2);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px}
.pd-i .dd{font-size:14px;color:var(--fg2);line-height:1.7;margin-bottom:16px}
.pd-a{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.pd-btn{padding:13px 26px;border-radius:12px;border:none;font-size:14px;font-weight:600;cursor:pointer;font-family:'Outfit';transition:all .2s;display:inline-flex;align-items:center;gap:8px;text-decoration:none}
.pd-btn.cart{background:var(--bg3);color:var(--fg)}.pd-btn.cart:hover{background:var(--acs);color:var(--ac)}.pd-btn.cart.ad{background:var(--acs);color:var(--ac)}
.pd-paypal{margin-top:12px}
.pd-h{font-size:12px;color:var(--fg3);margin-top:14px}

/* FORMS */
.fp{padding:100px 48px 60px;max-width:520px;margin:0 auto}
.fp h2{font-size:clamp(26px,4vw,36px);margin-bottom:8px;text-align:center}
.fp>p{color:var(--fg2);text-align:center;margin-bottom:32px;font-size:15px}
.fp input,.fp textarea{width:100%;padding:13px 16px;background:var(--bg2);border:1px solid rgba(0,0,0,0.07);border-radius:12px;color:var(--fg);font-size:14px;font-family:'Outfit';outline:none;transition:border-color .2s;margin-bottom:10px}
.fp input:focus,.fp textarea:focus{border-color:var(--ac);box-shadow:0 0 0 3px var(--acs)}
.fp textarea{min-height:110px;resize:vertical}
.fp input::placeholder,.fp textarea::placeholder{color:var(--fg3)}
.fs{width:100%;padding:13px;background:var(--ac);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:'Outfit';transition:all .2s}.fs:hover:not(:disabled){background:var(--ac2)}.fs:disabled{opacity:.6;cursor:not-allowed}
.fok{text-align:center;padding:36px;color:var(--ac);font-size:16px}
.ferr{text-align:center;padding:12px;color:#e05555;font-size:13px;background:rgba(224,85,85,0.06);border-radius:10px;margin-bottom:10px}
.ce{display:block;text-align:center;font-size:18px;color:var(--ac);text-decoration:none;margin-bottom:28px;font-weight:500}

/* CART SIDEBAR */
.co{position:fixed;inset:0;background:rgba(0,0,0,0.25);z-index:300;opacity:0;pointer-events:none;transition:opacity .3s}.co.open{opacity:1;pointer-events:all}
.cs{position:fixed;top:0;right:0;bottom:0;width:420px;max-width:92vw;background:var(--bg2);z-index:301;transform:translateX(100%);transition:transform .35s cubic-bezier(.25,.46,.45,.94);box-shadow:-6px 0 36px rgba(0,0,0,0.08);display:flex;flex-direction:column}.cs.open{transform:translateX(0)}
.cs-h{padding:18px 22px;border-bottom:1px solid rgba(0,0,0,0.05);display:flex;justify-content:space-between;align-items:center}.cs-h h3{font-size:17px;font-family:'Outfit';font-weight:600}
.cs-x{background:none;border:none;color:var(--fg3);cursor:pointer;font-size:20px;padding:4px}
.cs-i{flex:1;overflow-y:auto;padding:14px 22px}
.cit{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid rgba(0,0,0,0.03)}
.cit-c{width:38px;height:38px;border-radius:10px;flex-shrink:0}
.cit-i{flex:1}.cit-i h4{font-size:13px;font-weight:600;margin-bottom:1px}.cit-i span{font-size:12px;color:var(--fg3)}
.cit-p{font-family:'Fraunces',serif;font-size:17px;font-weight:600}
.cit-r{background:none;border:none;color:var(--fg3);font-size:11px;cursor:pointer;margin-left:6px;text-decoration:underline;font-family:'Outfit'}.cit-r:hover{color:#e05555}
.cs-e{text-align:center;padding:50px 20px;color:var(--fg3)}.cs-e p{margin-bottom:14px}
.cs-f{padding:18px 22px;border-top:1px solid rgba(0,0,0,0.05)}
.cs-t{display:flex;justify-content:space-between;margin-bottom:4px;font-size:15px;font-weight:600}.cs-t span:last-child{font-family:'Fraunces',serif;font-size:20px}
.cs-note{font-size:11px;color:var(--fg3);margin-bottom:14px;display:flex;align-items:center;gap:5px}
.cs-ok{text-align:center;padding:24px;background:rgba(8,145,178,0.05);border-radius:12px;color:var(--ac);font-size:15px;font-weight:500}

/* PAYMENT SUCCESS MODAL */
.ps-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px}
.ps-modal{background:var(--bg2);border-radius:20px;padding:40px 36px;max-width:400px;width:100%;text-align:center}
.ps-icon{font-size:52px;margin-bottom:16px}
.ps-modal h3{font-size:22px;margin-bottom:8px}
.ps-modal p{color:var(--fg2);font-size:14px;line-height:1.6;margin-bottom:24px}
.ps-btn{padding:12px 28px;background:var(--ac);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:'Outfit'}

footer{background:var(--navy);padding:40px 48px;text-align:center;margin-top:60px}
.fl{font-family:'Montserrat',sans-serif;font-size:20px;margin-bottom:6px;font-weight:800}.fl .m{color:#fff}.fl .d{color:var(--ac)}
footer p{font-size:12px;color:rgba(255,255,255,0.45)}

@media(max-width:900px){
  nav{padding:10px 16px}.nl{display:none}.hb{display:block}
  .hero{flex-direction:column;padding:76px 20px 32px;min-height:auto;gap:20px}
  .hero-left{flex:none;text-align:center;height:auto;overflow:visible;padding:0}
  .text-slide{position:relative}
  .hero-right{height:50vh;min-height:280px;width:100%}
  .hero-nav{position:relative;bottom:auto;left:auto;justify-content:center;margin-top:16px}
  .about,.cat,.pd{padding-left:20px;padding-right:20px}
  .pd-l{grid-template-columns:1fr}.pd-v{height:320px}
  .cg{grid-template-columns:1fr}
  .fp{padding-left:20px;padding-right:20px}
  footer{padding:28px 20px}
}
      `}</style>

      {/* PAYMENT SUCCESS MODAL */}
      {paymentDone && (
        <div className="ps-overlay" onClick={() => setPaymentDone(false)}>
          <div className="ps-modal" onClick={e => e.stopPropagation()}>
            <div className="ps-icon">✅</div>
            <h3>{lang === "es" ? "¡Pago exitoso!" : "Payment successful!"}</h3>
            <p>{lang === "es"
              ? "Gracias por tu compra. Te enviaremos los archivos a tu correo en las próximas horas."
              : "Thank you for your purchase. We'll send the files to your email within a few hours."}</p>
            <button className="ps-btn" onClick={() => setPaymentDone(false)}>
              {lang === "es" ? "Cerrar" : "Close"}
            </button>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav>
        <div className="logo" onClick={() => goPage("home")}><img src="/logo.png" alt="Medu 3D" /><span className="m">Medu</span><span className="d">3D</span></div>
        <ul className="nl">
          <li><button className={`nb ${page === "catalog" ? "on" : ""}`} onClick={() => goPage("catalog")}>{t.nav.catalog}</button></li>
          <li><button className={`nb ${page === "quote" ? "on" : ""}`} onClick={() => goPage("quote")}>{t.nav.quote}</button></li>
          <li><button className={`nb ${page === "contact" ? "on" : ""}`} onClick={() => goPage("contact")}>{t.nav.contact}</button></li>
          <li><button className="nb" onClick={() => setCartOpen(true)}>{t.nav.cart}{cart.length > 0 && <span className="cb">{cart.length}</span>}</button></li>
          <li><button className="lb" onClick={() => setLang(lang === "es" ? "en" : "es")}>{lang === "es" ? "EN" : "ES"}</button></li>
        </ul>
        <button className="hb" onClick={() => setMenuOpen(!menuOpen)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{menuOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}</svg>
        </button>
      </nav>
      <div className={`mm ${menuOpen ? "open" : ""}`}>
        <button onClick={() => goPage("catalog")}>{t.nav.catalog}</button>
        <button onClick={() => goPage("quote")}>{t.nav.quote}</button>
        <button onClick={() => goPage("contact")}>{t.nav.contact}</button>
        <button onClick={() => { setCartOpen(true); setMenuOpen(false); }}>{t.nav.cart} {cart.length > 0 && `(${cart.length})`}</button>
        <button className="lb" onClick={() => { setLang(lang === "es" ? "en" : "es"); setMenuOpen(false); }}>{lang === "es" ? "English" : "Español"}</button>
      </div>

      {/* CART */}
      <div className={`co ${cartOpen ? "open" : ""}`} onClick={() => setCartOpen(false)} />
      <div className={`cs ${cartOpen ? "open" : ""}`}>
        <div className="cs-h"><h3>{t.cart.title}</h3><button className="cs-x" onClick={() => setCartOpen(false)}>✕</button></div>
        <div className="cs-i">
          {cart.length === 0 ? (
            <div className="cs-e"><p>{t.cart.empty}</p><button className="hero-cta" onClick={() => { setCartOpen(false); goPage("catalog"); }}>{t.cart.browse}</button></div>
          ) : cart.map(p => (
            <div className="cit" key={p.id}>
              <div className="cit-c" style={{ background: p.color }} />
              <div className="cit-i"><h4>{p.name[lang]}</h4><span>{p.formats}</span></div>
              <div className="cit-p">${p.price}</div>
              <button className="cit-r" onClick={() => rmCart(p.id)}>{t.cart.remove}</button>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="cs-f">
            <div className="cs-t"><span>{t.cart.total}</span><span>${total}</span></div>
            <p className="cs-note">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              {t.cart.paypalNote}
            </p>
            <PayPalButtons
              items={cart}
              lang={lang}
              onSuccess={handlePaymentSuccess}
            />
          </div>
        )}
      </div>

      {/* HOME */}
      {page === "home" && <>
        <div className="hero">
          <div className="hero-left">
            <div className={`text-slide ${textState}`} key={cur.id}>
              <div className="hero-badge">{t.hero.badge}</div>
              <h1>{cur.name[lang]}</h1>
              <p className="hero-tag">{cur.tag[lang]}</p>
              <div className="hero-price">${cur.price} <span>USD</span></div>
              <button className="hero-cta" onClick={() => goProd(cur)}>{t.hero.explore} →</button>
            </div>
          </div>
          <div className="hero-right" onClick={() => goProd(cur)}>
            <div className={`model-wrap ${modelState}`} key={cur.id}>
              <Viewer color={cur.color} geo={cur.geo} active={true} bgColor={0xeef1f5} />
            </div>
          </div>
        </div>
        <div className="hero-nav">
          <button className="hero-arr" onClick={() => goTo((hi - 1 + P.length) % P.length, -1)}>←</button>
          <div className="hero-dots">
            {P.map((_, i) => <button key={i} className={`hero-dot ${i === hi ? "on" : ""}`} onClick={() => goTo(i, i > hi ? 1 : -1)} />)}
          </div>
          <button className="hero-arr" onClick={() => goTo((hi + 1) % P.length, 1)}>→</button>
        </div>
        <div className="about">
          <h2>{t.about.title}</h2>
          <p>{t.about.desc}</p>
          <div className="sg">
            {[1, 2, 3].map(n => (
              <div className="sc" key={n}>
                <div className="si"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2">
                  {n === 1 && <><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></>}
                  {n === 2 && <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15h6"/></>}
                  {n === 3 && <><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></>}
                </svg></div>
                <h3>{t.about[`s${n}t`]}</h3><p>{t.about[`s${n}d`]}</p>
              </div>
            ))}
          </div>
        </div>
      </>}

      {/* CATALOG */}
      {page === "catalog" && <div className="cat">
        <div className="cat-h"><h2>{t.catalog.title}</h2><p>{t.catalog.subtitle}</p></div>
        <div className="cg">{P.map(p => {
          const ic = cart.find(c => c.id === p.id);
          return (<div className="cc" key={p.id}>
            <div className="ct" onClick={() => goProd(p)}><svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth="1"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
            <div className="ci"><h3 onClick={() => goProd(p)} style={{cursor:"pointer"}}>{p.name[lang]}</h3><p className="tl">{p.tag[lang]}</p>
              <div className="cf"><span className="cp">${p.price}</span><button className={`cb2 ${ic ? "ad" : "pr"}`} onClick={() => addCart(p)}>{ic ? t.catalog.added : t.catalog.addCart}</button></div>
            </div>
          </div>);
        })}</div>
      </div>}

      {/* PRODUCT */}
      {page === "product" && selProd && <div className="pd">
        <button className="pd-b" onClick={() => goPage("catalog")}>{t.catalog.back}</button>
        <div className="pd-l">
          <div className="pd-v"><Viewer color={selProd.color} geo={selProd.geo} active={true} interact={true} bgColor={0xeef1f5} /></div>
          <div className="pd-i">
            <h1>{selProd.name[lang]}</h1><p className="tl">{selProd.tag[lang]}</p>
            <div className="pr">${selProd.price} <span>USD</span></div>
            <div className="fm">{t.catalog.formats}: {selProd.formats}</div>
            <p className="dt">{t.catalog.desc}</p><p className="dd">{selProd.desc[lang]}</p>
            <div className="pd-a">
              <button className={`pd-btn cart ${cart.find(c => c.id === selProd.id) ? "ad" : ""}`} onClick={() => addCart(selProd)}>
                {cart.find(c => c.id === selProd.id) ? t.catalog.added : t.catalog.addCart}
              </button>
            </div>
            <div className="pd-paypal">
              <PayPalSingleButton product={selProd} lang={lang} onSuccess={handlePaymentSuccess} />
            </div>
            <p className="pd-h">{t.catalog.rotate}</p>
          </div>
        </div>
      </div>}

      {/* QUOTE */}
      {page === "quote" && <QuoteForm t={t} />}

      {/* CONTACT */}
      {page === "contact" && <ContactForm t={t} lang={lang} />}

      <footer>
        <div className="fl"><span className="m">Medu</span><span className="d">3D</span></div>
        <p>{t.footer.tag}</p>
        <p style={{marginTop:4}}>© {new Date().getFullYear()} Medu 3D · {t.footer.rights}</p>
      </footer>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Quote Form — conectado a Formspree
   ═══════════════════════════════════════════════════════════════════════════ */
function QuoteForm({ t }) {
  const tq = t.quote;
  const { fields, set, submit, status } = useForm(FORMSPREE_ENDPOINT);

  return (
    <div className="fp">
      <h2>{tq.title}</h2><p>{tq.subtitle}</p>
      {status === "sent" ? (
        <div className="fok">{tq.sent}</div>
      ) : <>
        {status === "error" && <div className="ferr">{tq.error}</div>}
        <input
          placeholder={tq.name}
          value={fields.name || ""}
          onChange={e => set("name", e.target.value)}
        />
        <input
          type="email"
          placeholder={tq.email}
          value={fields.email || ""}
          onChange={e => set("email", e.target.value)}
        />
        <textarea
          placeholder={tq.details}
          value={fields.message || ""}
          onChange={e => set("message", e.target.value)}
        />
        <input type="hidden" name="_subject" value="Nueva cotización — Medu 3D" />
        <button
          className="fs"
          onClick={submit}
          disabled={status === "sending"}
        >
          {status === "sending" ? tq.sending : tq.send}
        </button>
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Contact Form — conectado a Formspree
   ═══════════════════════════════════════════════════════════════════════════ */
function ContactForm({ t, lang }) {
  const tc = t.contact;
  const tq = t.quote;
  const { fields, set, submit, status } = useForm(FORMSPREE_ENDPOINT);

  return (
    <div className="fp">
      <h2>{tc.title}</h2><p>{tc.subtitle}</p>
      <a className="ce" href="mailto:contacto@medu3d.com">contacto@medu3d.com</a>
      <p style={{textAlign:"center",color:"var(--fg3)",marginBottom:20}}>{tc.or}</p>
      {status === "sent" ? (
        <div className="fok">{tc.sent}</div>
      ) : <>
        {status === "error" && <div className="ferr">{tc.error}</div>}
        <input
          placeholder={tq.name}
          value={fields.name || ""}
          onChange={e => set("name", e.target.value)}
        />
        <input
          type="email"
          placeholder={tq.email}
          value={fields.email || ""}
          onChange={e => set("email", e.target.value)}
        />
        <textarea
          placeholder={lang === "es" ? "Tu mensaje" : "Your message"}
          value={fields.message || ""}
          onChange={e => set("message", e.target.value)}
        />
        <button
          className="fs"
          onClick={submit}
          disabled={status === "sending"}
        >
          {status === "sending" ? tc.sending : tc.send}
        </button>
      </>}
    </div>
  );
}
