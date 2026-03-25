import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIGURACIÓN — Cambia estas variables antes de subir al servidor
   ═══════════════════════════════════════════════════════════════════════════ */

// PayPal Live Client ID
const PAYPAL_CLIENT_ID = "AfSYYHgXDkLFc5SVqwgX96FLwl7W3MUfGN6CsBDaDeVEI4eh5jh15fNuw3ZZX55_fpv775T9dgglL6mI";

// Formspree endpoint — crea cuenta en formspree.io y reemplaza con tu ID
// Ejemplo: "https://formspree.io/f/xpzgkwer"
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xeerrvre";

/* ═══════════════════════════════════════════════════════════════════════════
   EMAILJS — Confirmación de compra
   ─────────────────────────────────────────────────────────────────────────
   Service:  service_gmail  (Gmail conectado en EmailJS)
   Template: order_confirmation  → pega el HTML del archivo email_template.html
   Variables que el código envía al template:
     {{email}}        → correo del comprador (destinatario)
     {{to_name}}      → nombre del comprador
     {{order_id}}     → número de pedido PayPal
     {{order_date}}   → fecha de compra formateada
     {{orders}}       → array JSON de items  [{ name, price, units }]
     {{cost.total}}   → total cobrado
     {{cost.shipping}}→ siempre "0.00" (descarga digital)
     {{cost.tax}}     → siempre "0.00"
     {{discount_line}}→ línea de descuento o cadena vacía
   ═══════════════════════════════════════════════════════════════════════════ */
const EMAILJS_SERVICE_ID  = "service_ekpjlgg";
const EMAILJS_TEMPLATE_ID = "template_5wh599e";
const EMAILJS_PUBLIC_KEY  = "XtMo9JT1OK78Yl6I_";

/* ═══════════════════════════════════════════════════════════════════════════
   CLOUDFLARE WORKER — Links de descarga firmados
   Una vez desplegado el Worker, reemplaza la URL de abajo.
   ═══════════════════════════════════════════════════════════════════════════ */
const DOWNLOAD_WORKER_URL = "https://medu3d-downloads.manuelczelaya.workers.dev";

async function sendConfirmationEmail(params) {
  if (!window.emailjs) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }
  return window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);
}

/* ═══════════════════════════════════════════════════════════════════════════
   CÓDIGOS DE DESCUENTO — USO ÚNICO
   ─────────────────────────────────────────────────────────────────────────
   Cada código solo funciona UNA VEZ por dispositivo (fingerprint + IP).
   Una vez usado, queda bloqueado en ese dispositivo para siempre.

   type:  "percent" → porcentaje  (ej. value:15 = 15% off)
          "fixed"   → monto fijo  (ej. value:5  = $5 off)
   batch: grupo al que pertenece (para generar lotes)

   ── CÓMO GENERAR CÓDIGOS NUEVOS ──────────────────────────────────────────
   Abre la consola del navegador (F12) y corre:
     generateCodes("BV", 10, 15, "percent")   → 10 códigos BIENVENIDO 15%
     generateCodes("RF", 5,  10, "percent")   → 5 códigos REFERIDO 10%
     generateCodes("M5", 20,  5, "fixed")     → 20 códigos $5 off
   Copia los códigos generados y pégalos en SINGLE_USE_CODES abajo.
   ─────────────────────────────────────────────────────────────────────────
   IMPORTANTE: Cada código aquí es único. Al darlo a un cliente,
   ese código deja de funcionar después de su primera compra.
   ═══════════════════════════════════════════════════════════════════════════ */

// Función helper para generar lotes de códigos (úsala en consola del navegador)
window.generateCodes = (prefix, qty, value, type) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const codes = {};
  for (let i = 0; i < qty; i++) {
    let id = "";
    for (let j = 0; j < 8; j++) id += chars[Math.floor(Math.random() * chars.length)];
    const code = `${prefix}-${id.slice(0,4)}-${id.slice(4)}`;
    codes[code] = { type, value, active: true, batch: prefix };
  }
  console.log("── Códigos generados ──");
  Object.entries(codes).forEach(([k,v]) => console.log(`  "${k}": ${JSON.stringify(v)},`));
  return codes;
};

const SINGLE_USE_CODES = {
  // ── TEST — 99% off para pruebas internas (eliminar antes de producción) ──
  "TEST-9999-9999": { type: "percent", value: 99, active: true, batch: "TEST" },
  "TEST-GKCL-MLM5": { type: "percent", value: 99, active: true, batch: "TEST" },
  "BV-XMKR-7T4N": { type: "percent", value: 15, active: true, batch: "BV" },
  "BV-2HJQ-9PLC": { type: "percent", value: 15, active: true, batch: "BV" },
  "BV-RNFT-6W8A": { type: "percent", value: 15, active: true, batch: "BV" },
  "BV-KD4M-XQPZ": { type: "percent", value: 15, active: true, batch: "BV" },
  "BV-8TNH-3FJY": { type: "percent", value: 15, active: true, batch: "BV" },

  // ── Referidos 10% — genera más con: generateCodes("RF",10,10,"percent") ──
  "RF-7MBW-4KXQ": { type: "percent", value: 10, active: true, batch: "RF" },
  "RF-CNTP-8RZJ": { type: "percent", value: 10, active: true, batch: "RF" },
  "RF-HQKA-2NLD": { type: "percent", value: 10, active: true, batch: "RF" },
  "RF-X6FP-WBTM": { type: "percent", value: 10, active: true, batch: "RF" },
  "RF-9JYN-HCTR": { type: "percent", value: 10, active: true, batch: "RF" },

  // ── $5 fijo — genera más con: generateCodes("M5",10,5,"fixed") ──
  "M5-PLFB-7WNK": { type: "fixed",   value: 5,  active: true, batch: "M5" },
  "M5-3XQT-RDJH": { type: "fixed",   value: 5,  active: true, batch: "M5" },
  "M5-YNKC-8ABZ": { type: "fixed",   value: 5,  active: true, batch: "M5" },
};

const BATCH_LABELS = {
  TEST: { es: "99% descuento — prueba interna", en: "99% off — internal test" },
  BV: { es: "15% descuento — primera compra", en: "15% off — first purchase" },
  RF: { es: "10% descuento — cliente referido", en: "10% off — referred customer" },
  M5: { es: "$5 de descuento", en: "$5 off" },
};

/* ─── Fingerprint del dispositivo ─────────────────────────────────────────
   Combina: timezone + idioma + resolución + plataforma + user agent
   Genera un hash de 8 caracteres único por dispositivo.
   No es 100% infalible (nada lo es sin backend) pero hace el abuso
   significativamente más difícil que solo localStorage.
   ───────────────────────────────────────────────────────────────────────── */
async function getDeviceFingerprint() {
  const raw = [
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    `${screen.width}x${screen.height}`,
    navigator.platform,
    navigator.userAgent.slice(0, 80),
    screen.colorDepth,
  ].join("|");

  // Intenta usar IP pública para reforzar el fingerprint
  let ip = "";
  try {
    const r = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(2000) });
    const d = await r.json();
    ip = d.ip || "";
  } catch {}

  const str = raw + "|" + ip;
  // Hash simple (djb2) — suficiente para este propósito
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36).toUpperCase().padStart(8, "0");
}

const LS_KEY = "medu3d_used_codes"; // clave en localStorage

function getUsedCodes() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}

function markCodeUsed(code, fingerprint) {
  const used = getUsedCodes();
  used[code.toUpperCase()] = { fp: fingerprint, ts: Date.now() };
  try { localStorage.setItem(LS_KEY, JSON.stringify(used)); } catch {}
}

function isCodeUsedLocally(code) {
  return !!getUsedCodes()[code.toUpperCase()];
}

async function validateCode(code) {
  const key = code.toUpperCase().trim();
  const def  = SINGLE_USE_CODES[key];
  if (!def || !def.active) return { valid: false, reason: "invalid" };

  // Verificar si ya fue usado en este dispositivo (localStorage)
  if (isCodeUsedLocally(key)) return { valid: false, reason: "used" };

  // Verificar fingerprint
  const fp = await getDeviceFingerprint();
  const used = getUsedCodes();
  const usedByFp = Object.values(used).some(u => u.fp === fp);
  if (usedByFp) return { valid: false, reason: "device" };

  const label = BATCH_LABELS[def.batch] || { es: `${def.value}${def.type==="percent"?"%":"$"} de descuento`, en: `${def.value}${def.type==="percent"?"%":"$"} off` };
  return { valid: true, code: key, def, label, fingerprint: fp };
}

function applyDiscount(subtotal, validationResult) {
  if (!validationResult?.valid) return null;
  const { def, label } = validationResult;
  const discount = def.type === "percent"
    ? parseFloat((subtotal * def.value / 100).toFixed(2))
    : Math.min(def.value, subtotal);
  return {
    discount,
    total: parseFloat((subtotal - discount).toFixed(2)),
    label,
    code: validationResult.code,
    fingerprint: validationResult.fingerprint,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   i18n
   ═══════════════════════════════════════════════════════════════════════════ */
const T = {
  es: {
    nav: { catalog: "Catálogo", quote: "Cotización", contact: "Contacto", cart: "Carrito", about: "Sobre mí" },
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
      typeStl: "Archivo Digital", typePrint: "Maqueta Impresa",
      stlDesc: "Archivos .STL y .OBJ — descarga inmediata",
      printDesc: "Modelo físico impreso en 3D, enviado a tu dirección",
      comingSoon: "Próximamente", comingSoonNote: "Las maquetas impresas estarán disponibles pronto.",
      notifyMe: "Notificarme cuando estén disponibles", fromPrice: "Desde",
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
    nav: { catalog: "Catalog", quote: "Quote", contact: "Contact", cart: "Cart", about: "About" },
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
      typeStl: "Digital File", typePrint: "3D Printed Model",
      stlDesc: ".STL & .OBJ files — instant download",
      printDesc: "Physical 3D printed model, shipped to your address",
      comingSoon: "Coming Soon", comingSoonNote: "3D printed models will be available soon.",
      notifyMe: "Notify me when available", fromPrice: "From",
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
/* ─── CÓMO AGREGAR UN PRODUCTO NUEVO ───────────────────────────────────────
   1. Copia un bloque { id: ... } y pégalo al final del array
   2. Cambia id, priceSlt, pricePrint (null = próximamente), color, geo
   3. Pega el hosted_button_id de PayPal en hostedBtn / hostedBtnPrint
   4. Para geo nuevos sin placeholder, usa "sphere" como fallback temporal
   ─────────────────────────────────────────────────────────────────────────── */
const P = [
  { id: "heart", modelId: "corazon",
    priceSlt: 34.99, pricePrint: null,
    hostedBtn: "MDVGEXSZCHEQY", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#e05555", geo: "heart",
    region: "torax", tissue: "cardiovascular",
    rotation: [-Math.PI/2, 0, 0],
    name: { es: "Corazón Humano", en: "Human Heart" },
    tag: { es: "4 cámaras · Válvulas · Grandes vasos", en: "4 chambers · Valves · Great vessels" },
    desc: { es: "Modelo detallado del corazón humano completo con las 4 cámaras cardíacas, válvulas y grandes vasos. Segmentado desde CT con contraste. Ideal para educación cardiovascular y planificación quirúrgica.", en: "Detailed model of the complete human heart with all 4 cardiac chambers, valves and great vessels. Segmented from contrast CT. Ideal for cardiovascular education and surgical planning." },
  },
  { id: "brain", modelId: "brain",
    priceSlt: 24.99, pricePrint: null,
    hostedBtn: "49659K538LTZ6", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#c98a90", geo: "brain",
    region: "cabeza", tissue: "nervioso",
    rotation: [-Math.PI/2, 0, 0],
    name: { es: "Cerebro", en: "Brain" },
    tag: { es: "Hemisferios · Surcos · Cerebelo", en: "Hemispheres · Sulci · Cerebellum" },
    desc: { es: "Modelo cerebral con surcos y circunvoluciones detalladas, hemisferios separados, cerebelo y tronco encefálico. Segmentado desde MRI T1. Para neurociencia y educación.", en: "Brain model with detailed sulci and gyri, separated hemispheres, cerebellum and brainstem. Segmented from T1 MRI. For neuroscience and education." },
  },
  { id: "lungs", modelId: "lungs",
    priceSlt: 24.99, pricePrint: null,
    hostedBtn: "8BZZW5EGQNZAJ", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#e8a0b0", geo: "lungs",
    region: "torax", tissue: "respiratorio",
    rotation: [-Math.PI/2, 0, 0],
    name: { es: "Pulmones", en: "Lungs" },
    tag: { es: "Pulmón izq. y der. · Árbol bronquial", en: "Left & right lung · Bronchial tree" },
    desc: { es: "Modelo de pulmones con diferenciación de pulmón izquierdo y derecho, árbol bronquial y estructuras vasculares. Segmentado desde CT de tórax. Para neumología y educación médica.", en: "Lung model with differentiated left and right lungs, bronchial tree and vascular structures. Segmented from chest CT. For pulmonology and medical education." },
  },
  { id: "liver", modelId: "model",
    priceSlt: 19.99, pricePrint: null,
    hostedBtn: "FJJB3XH8FURZY", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#b5703a", geo: "liver",
    region: "abdomen", tissue: "visceral",
    rotation: [-Math.PI/2, 0, 0],
    name: { es: "Hígado", en: "Liver" },
    tag: { es: "Lóbulos · Vasculatura portal y hepática", en: "Lobes · Portal & hepatic vasculature" },
    desc: { es: "Modelo hepático con segmentación de lóbulos y vasculatura portal y hepática. Segmentado desde CT con contraste. Para hepatología y cirugía.", en: "Hepatic model with lobe segmentation and portal and hepatic vasculature. Segmented from contrast CT. For hepatology and surgery." },
  },
  { id: "skull", modelId: "craneo",
    priceSlt: 34.99, pricePrint: null,
    hostedBtn: "C757MAF6AM8YA", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#c4a882", geo: "skull",
    region: "cabeza", tissue: "oseo",
    rotation: [-Math.PI/2, 0, 0],
    name: { es: "Cráneo Adulto", en: "Adult Skull" },
    tag: { es: "Mandíbula articulada · Alta resolución", en: "Articulated mandible · High resolution" },
    desc: { es: "Cráneo completo con mandíbula separable. Incluye suturas craneales, forámenes y procesos óseos. Segmentado desde CT de alta resolución (0.5mm). Para educación anatómica y odontología.", en: "Complete skull with separable mandible. Includes cranial sutures, foramina and bony processes. Segmented from high-resolution CT (0.5mm). For anatomical education and dentistry." },
  },
  { id: "hand", modelId: "hand",
    priceSlt: 29.99, pricePrint: null,
    hostedBtn: "6U65AC2JJEXFL", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#d4b896", geo: "hand",
    region: "extremidades", tissue: "oseo",
    rotation: [-Math.PI/2, 0, 0],
    name: { es: "Huesos de la Mano", en: "Hand Bones" },
    tag: { es: "27 huesos · Carpo · Metacarpo · Falanges", en: "27 bones · Carpals · Metacarpals · Phalanges" },
    desc: { es: "Conjunto completo de los 27 huesos de la mano: huesos del carpo, metacarpianos y falanges. Segmentado desde CT de alta resolución. Ideal para cirugía ortopédica y traumatología.", en: "Complete set of 27 hand bones: carpal bones, metacarpals and phalanges. Segmented from high-resolution CT. Ideal for orthopedic surgery and traumatology." },
  },
  { id: "foot", modelId: "foot",
    priceSlt: 29.99, pricePrint: null,
    hostedBtn: "DHLY63KNSUSFU", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#c8b090", geo: "foot",
    region: "extremidades", tissue: "oseo",
    rotation: [-Math.PI/2, 0, 0],
    name: { es: "Huesos del Pie", en: "Foot Bones" },
    tag: { es: "26 huesos · Tarso · Metatarso · Falanges", en: "26 bones · Tarsals · Metatarsals · Phalanges" },
    desc: { es: "Conjunto completo de los 26 huesos del pie: tarso, metatarsianos y falanges. Segmentado desde CT. Para podología, ortopedia y biomecánica.", en: "Complete set of 26 foot bones: tarsals, metatarsals and phalanges. Segmented from CT. For podiatry, orthopedics and biomechanics." },
  },
  { id: "spine", modelId: "vertebras",
    priceSlt: 29.99, pricePrint: null,
    hostedBtn: "637LDGMDRNE5N", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#7a8fa3", geo: "spine",
    region: "columna", tissue: "oseo",
    rotation: [0, 0, 0],
    name: { es: "Columna Torácica y Lumbar", en: "Thoracic & Lumbar Spine" },
    tag: { es: "T1-L5 · Sacro · Discos intervertebrales", en: "T1-L5 · Sacrum · Intervertebral discs" },
    desc: { es: "Columna vertebral completa desde T1 hasta L5 con sacro y discos intervertebrales diferenciados. Detalle de procesos espinosos, transversos y articulares. Para estudio ortopédico y quirúrgico.", en: "Complete spine from T1 to L5 with sacrum and differentiated intervertebral discs. Detail of spinous, transverse and articular processes. For orthopedic and surgical study." },
  },
  { id: "kidney", modelId: "rinones",
    priceSlt: 19.99, pricePrint: null,
    hostedBtn: "22N8FEKMP8FAY", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#9e6b5a", geo: "kidney",
    region: "abdomen", tissue: "visceral",
    rotation: [-Math.PI/2, 0, 0],
    name: { es: "Riñón con Vasculatura", en: "Kidney with Vasculature" },
    tag: { es: "Arterias · Venas renales", en: "Arteries · Renal veins" },
    desc: { es: "Riñón con arterias y venas renales diferenciadas y cápsula renal. Para nefrología, urología y educación.", en: "Kidney with color-differentiated renal arteries and veins and renal capsule. For nephrology, urology and education." },
  },
  { id: "pelvis", modelId: "pelvis",
    priceSlt: 19.99, pricePrint: null,
    hostedBtn: "UCHEK3PJFQMBW", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#b5a48a", geo: "pelvis",
    region: "pelvis", tissue: "oseo",
    rotation: [-Math.PI/2, 0, 0],
    name: { es: "Pelvis Completa", en: "Complete Pelvis" },
    tag: { es: "Ilíacos · Sacro · Cóccix", en: "Iliac bones · Sacrum · Coccyx" },
    desc: { es: "Huesos ilíacos, sacro y cóccix con detalle cortical completo. Para ortopedia y planificación quirúrgica.", en: "Iliac bones, sacrum and coccyx with full cortical detail. For orthopedics and surgical planning." },
  },
];

// Helper: precio activo según tipo seleccionado
function getPrice(p, type) { return type === "print" ? p.pricePrint : p.priceSlt; }
// Helper: item de carrito enriquecido con tipo
function makeCartItem(p, type) {
  return { ...p, price: getPrice(p, type), cartType: type,
    cartId: p.id + "_" + type,  // ID único por tipo para permitir ambos en carrito
    displayName: p.name,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PayPal SDK loader — singleton, carga el script una sola vez
   ═══════════════════════════════════════════════════════════════════════════ */
let sdkPromise = null;
function loadPayPalSDK() {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (window.paypal) { resolve(window.paypal); return; }
    const s = document.createElement("script");
    s.id  = "paypal-sdk";
    s.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD&intent=capture&enable-funding=card&components=buttons`;
    s.setAttribute("data-page-type", "checkout");
    s.onload  = () => resolve(window.paypal);
    s.onerror = () => { sdkPromise = null; reject(new Error("PayPal SDK failed")); };
    document.head.appendChild(s);
  });
  return sdkPromise;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PayPalButton — funciona en carrito (varios items) y en producto individual.
   El precio viene del código, no de PayPal. No hay nada que configurar
   por producto en el dashboard de PayPal.
   ═══════════════════════════════════════════════════════════════════════════ */
function PayPalButton({ items, lang, onSuccess }) {
  const containerRef = useRef(null);
  const btnRef       = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | failed

  const total   = items.reduce((s, p) => s + p.price, 0).toFixed(2);
  const itemKey = items.map(i => i.cartId || i.id).join(",") + total;

  useEffect(() => {
    if (!items.length) return;
    setStatus("loading");
    if (btnRef.current) { try { btnRef.current.close(); } catch {} btnRef.current = null; }
    if (containerRef.current) containerRef.current.innerHTML = "";

    loadPayPalSDK().then(paypal => {
      if (!containerRef.current) return;
      btnRef.current = paypal.Buttons({
        style: { layout: "vertical", color: "blue", shape: "rect", label: "pay", height: 48 },
        createOrder: (data, actions) => actions.order.create({
          purchase_units: [{
            description: "Medu 3D — Modelos Anatómicos 3D",
            amount: {
              currency_code: "USD", value: total,
              breakdown: { item_total: { currency_code: "USD", value: total } },
            },
            items: items.map(p => ({
              name: p.name[lang] || p.name.es,
              unit_amount: { currency_code: "USD", value: p.price.toFixed(2) },
              quantity: "1",
            })),
          }],
        }),
        onApprove: async (data, actions) => {
          const order = await actions.order.capture();
          if (onSuccess) onSuccess(order);
        },
        onError: (err) => { console.error("PayPal error:", err); setStatus("failed"); },
      });
      if (btnRef.current.isEligible()) {
        btnRef.current.render(containerRef.current).then(() => setStatus("ready"));
      } else {
        setStatus("failed");
      }
    }).catch(() => setStatus("failed"));

    return () => { if (btnRef.current) { try { btnRef.current.close(); } catch {} btnRef.current = null; } };
  }, [itemKey, lang]);

  if (!items.length) return null;

  return (
    <div>
      {status === "loading" && (
        <div style={{ padding: "14px 0", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--fg3)", fontSize: 13 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          {lang === "es" ? "Cargando métodos de pago..." : "Loading payment options..."}
        </div>
      )}
      {status === "failed" && (
        <a href={`https://www.paypal.com/paypalme/medu3d/${total}USD`} target="_blank" rel="noopener noreferrer"
          style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, width:"100%", padding:"14px 20px", background:"#0070BA", color:"#fff", borderRadius:12, textDecoration:"none", fontFamily:"Montserrat,sans-serif", fontWeight:700, fontSize:15, transition:"background .2s", boxSizing:"border-box" }}
          onMouseOver={e=>e.currentTarget.style.background="#003087"} onMouseOut={e=>e.currentTarget.style.background="#0070BA"}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.59 3.025-2.566 4.643-5.813 4.643h-2.19a.96.96 0 0 0-.949.813l-1.12 7.107-.31 1.964a.42.42 0 0 0 .416.49h2.938l.478-3.018.03-.174a.96.96 0 0 1 .948-.814h.599c3.863 0 6.888-1.57 7.772-6.106.37-1.9.179-3.488-.751-4.618z"/></svg>
          {lang === "es" ? `Pagar $${total} · PayPal / Tarjeta` : `Pay $${total} · PayPal / Card`}
        </a>
      )}
      <div ref={containerRef} style={{ display: status === "failed" ? "none" : "block", width: "100%" }} />
    </div>
  );
}
/* ═══════════════════════════════════════════════════════════════════════════
   LazyViewer — solo carga el modelo 3D cuando la tarjeta es visible
   ═══════════════════════════════════════════════════════════════════════════ */
function LazyViewer({ color, modelId, bgColor, rotation = [0,0,0] }) {
  const wrapRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { rootMargin: "100px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "100%" }}>
      {visible
        ? <Viewer color={color} active={true} modelId={modelId} bgColor={bgColor} rotation={rotation} />
        : <div style={{ width:"100%", height:"100%", background:`#${bgColor.toString(16).padStart(6,"0")}`,
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#b0b4c8" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
      }
    </div>
  );
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
   Three.js Viewer — STL (hero) / GLB (product)
   ═══════════════════════════════════════════════════════════════════════════ */
function parseBinarySTL(buf) {
  const dv = new DataView(buf);
  const n = dv.getUint32(80, true);
  const pos = new Float32Array(n * 9);
  const nor = new Float32Array(n * 9);
  let off = 84;
  for (let i = 0; i < n; i++) {
    const nx = dv.getFloat32(off,true), ny = dv.getFloat32(off+4,true), nz = dv.getFloat32(off+8,true);
    off += 12;
    for (let v = 0; v < 3; v++) {
      const b = i*9+v*3;
      pos[b]=dv.getFloat32(off,true); pos[b+1]=dv.getFloat32(off+4,true); pos[b+2]=dv.getFloat32(off+8,true);
      nor[b]=nx; nor[b+1]=ny; nor[b+2]=nz;
      off += 12;
    }
    off += 2;
  }
  return { pos, nor };
}

function parseGLB(buf) {
  // Parse GLB binary format to extract position/normal arrays
  const dv = new DataView(buf);
  const jsonLen = dv.getUint32(12, true);
  const jsonStr = new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen));
  const json = JSON.parse(jsonStr);
  const binOffset = 20 + jsonLen + 8;
  const bin = buf.slice(binOffset);

  // Get first mesh primitive
  const prim = json.meshes[0].primitives[0];
  const getArr = (accIdx) => {
    const acc = json.accessors[accIdx];
    const bv  = json.bufferViews[acc.bufferView];
    const off = (bv.byteOffset||0) + (acc.byteOffset||0);
    const comp = acc.type === 'VEC3' ? 3 : 1;
    return new Float32Array(bin, off, acc.count * comp);
  };
  const pos = getArr(prim.attributes.POSITION);
  const nor = prim.attributes.NORMAL != null ? getArr(prim.attributes.NORMAL) : null;

  // Handle indexed geometry
  if (prim.indices != null) {
    const idxAcc = json.accessors[prim.indices];
    const idxBv  = json.bufferViews[idxAcc.bufferView];
    const idxOff = (idxBv.byteOffset||0) + (idxAcc.byteOffset||0);
    let indices;
    if (idxAcc.componentType === 5123) indices = new Uint16Array(bin, idxOff, idxAcc.count);
    else indices = new Uint32Array(bin, idxOff, idxAcc.count);
    const epos = new Float32Array(indices.length * 3);
    const enor = nor ? new Float32Array(indices.length * 3) : null;
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      epos[i*3]=pos[idx*3]; epos[i*3+1]=pos[idx*3+1]; epos[i*3+2]=pos[idx*3+2];
      if (enor) { enor[i*3]=nor[idx*3]; enor[i*3+1]=nor[idx*3+1]; enor[i*3+2]=nor[idx*3+2]; }
    }
    return { pos: epos, nor: enor };
  }
  return { pos, nor };
}

function Viewer({ color, active, hd = false, modelId = "model", interact = false, bgColor = 0xeef1f5, rotation = [0,0,0] }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active || !ref.current) return;
    const c = ref.current;
    const w = c.clientWidth || 400, h = c.clientHeight || 400;
    let alive = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bgColor);
    const cam = new THREE.PerspectiveCamera(38, w/h, 0.1, 100);
    cam.position.set(0, 0, 4.5);
    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setSize(w, h); r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.4;
    c.appendChild(r.domElement);

    scene.add(new THREE.AmbientLight(0xd0d4de, 1.1));
    const l1 = new THREE.DirectionalLight(0xfff8f0, 1.5); l1.position.set(5,6,5); scene.add(l1);
    const l2 = new THREE.DirectionalLight(0x8899bb, 0.6); l2.position.set(-4,-2,3); scene.add(l2);
    const l3 = new THREE.DirectionalLight(0xffffff, 0.3); l3.position.set(0,-5,0); scene.add(l3);

    const url = hd ? `/${modelId}_hd.glb` : `/${modelId}.stl`;
    fetch(url).then(res => res.arrayBuffer()).then(buf => {
      if (!alive) return;
      let parsed;
      try { parsed = hd ? parseGLB(buf) : parseBinarySTL(buf); }
      catch(e) { console.error("Parse error:", e); return; }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(parsed.pos, 3));
      if (parsed.nor) geo.setAttribute("normal", new THREE.BufferAttribute(parsed.nor, 3));
      else geo.computeVertexNormals();
      geo.center();
      geo.computeBoundingSphere();

      const sc = 2.2 / (geo.boundingSphere.radius * 2);
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.35, metalness: 0.08 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.setScalar(sc);
      mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
      if (!alive) return;
      scene.add(mesh);
    }).catch(e => console.error("Fetch error:", e));

    let drag=false, px=0, py=0, rx=0, ry2=0, td=4.5, d=4.5;
    if (interact) {
      const el = r.domElement;
      el.addEventListener("pointerdown", e=>{drag=true;px=e.clientX;py=e.clientY;el.setPointerCapture(e.pointerId);});
      el.addEventListener("pointermove", e=>{if(!drag)return;ry2+=(e.clientX-px)*0.008;rx=Math.max(-1.2,Math.min(1.2,rx+(e.clientY-py)*0.008));px=e.clientX;py=e.clientY;});
      el.addEventListener("pointerup", ()=>drag=false);
      el.addEventListener("wheel", e=>{td=Math.max(2,Math.min(8,td+e.deltaY*0.003));},{passive:true});
    }

    let ar=0, aid;
    const anim = () => {
      if (!alive) return;
      aid = requestAnimationFrame(anim);
      if (!drag) ar += interact ? 0.003 : 0.005;
      d += (td-d)*0.08;
      cam.position.set(Math.sin(ry2+ar)*Math.cos(rx)*d, Math.sin(rx)*d, Math.cos(ry2+ar)*Math.cos(rx)*d);
      cam.lookAt(0,0,0); r.render(scene,cam);
    };
    anim();

    const onR = ()=>{ if(!alive)return; const nw=c.clientWidth,nh=c.clientHeight; cam.aspect=nw/nh; cam.updateProjectionMatrix(); r.setSize(nw,nh); };
    window.addEventListener("resize", onR);
    return ()=>{ alive=false; cancelAnimationFrame(aid); window.removeEventListener("resize",onR); r.dispose(); try{if(c.contains(r.domElement))c.removeChild(r.domElement);}catch(e){} };
  }, [active, color, hd, modelId, interact, bgColor, rotation]);

  return <div ref={ref} style={{width:"100%",height:"100%"}} />;
}
/* ═══════════════════════════════════════════════════════════════════════════
   App
   ═══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [lang, setLang] = useState("es");
  const [page, setPage] = useState(() => {
    // Lee la página inicial desde el hash de la URL si existe
    const h = window.location.hash.replace("#", "");
    return ["home","catalog","quote","about","contact","product","privacy","terms"].includes(h) ? h : "home";
  });
  const [selProd, setSelProd] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(null); // { discount, total, label } | null
  const [discountValidating, setDiscountValidating] = useState(false);
  const [discountError, setDiscountError] = useState("");
  const [hi, setHi] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | out | in
  const [nextHi, setNextHi] = useState(0);
  const [dir, setDir] = useState(1); // 1=forward -1=backward
  const [paymentDone, setPaymentDone] = useState(false);
  const [downloadLinks, setDownloadLinks] = useState({});
  const busy = useRef(false);
  const skipHistory = useRef(false); // evita doble push cuando popstate dispara

  const t = T[lang];

  const hiRef = useRef(0);
  const phaseRef = useRef("idle");

  // ── Sincroniza URL con la página actual ──────────────────────────────────
  const pushHistory = (p, prodId = null) => {
    if (skipHistory.current) return;
    const hash = p === "home" ? "" : `#${p}`;
    const state = { page: p, prodId };
    window.history.pushState(state, "", hash || window.location.pathname);
  };

  // ── Escucha el botón atrás/adelante del navegador ────────────────────────
  useEffect(() => {
    const onPop = (e) => {
      const state = e.state;
      const target = state?.page ?? "home";
      skipHistory.current = true;
      setPageVisible(false);
      setTimeout(() => {
        if (target === "product" && state?.prodId) {
          const prod = P.find(p => p.id === state.prodId);
          if (prod) setSelProd(prod);
        }
        setPage(target);
        setPendingPage(null);
        window.scrollTo(0, 0);
        setTimeout(() => { setPageVisible(true); skipHistory.current = false; }, 30);
      }, 320);
    };
    window.addEventListener("popstate", onPop);
    // Registra el estado inicial para que el primer "atrás" funcione
    const initHash = window.location.hash.replace("#", "") || "home";
    window.history.replaceState({ page: initHash, prodId: null }, "", window.location.href);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const goTo = useCallback((idx, d) => {
    if (busy.current || idx === hiRef.current) return;
    busy.current = true;
    phaseRef.current = "out";
    setDir(d);
    setPhase("out");
    setTimeout(() => {
      hiRef.current = idx;
      phaseRef.current = "in";
      setHi(idx);
      setPhase("in");
      setTimeout(() => {
        phaseRef.current = "idle";
        setPhase("idle");
        busy.current = false;
      }, 650);
    }, 500);
  }, []);

  useEffect(() => {
    const handler = () => goPage("quote");
    window.addEventListener("goQuote", handler);
    return () => window.removeEventListener("goQuote", handler);
  }, []);

  useEffect(() => {
    if (page !== "home") return;
    const iv = setInterval(() => {
      const nxt = (hiRef.current + 1) % P.length;
      goTo(nxt, 1);
    }, 7500);
    return () => clearInterval(iv);
  }, [page, goTo]);

  const addCart = (p, type) => {
    const item = makeCartItem(p, type);
    if (!cart.find(c => c.cartId === item.cartId)) {
      setCart([...cart, item]);
      setAppliedDiscount(null);
      setDiscountCode("");
      setDiscountError("");
    }
  };
  const rmCart = cartId => {
    setCart(cart.filter(c => c.cartId !== cartId));
    setAppliedDiscount(null);
    setDiscountCode("");
    setDiscountError("");
  };
  const subtotal = parseFloat(cart.reduce((s, p) => s + p.price, 0).toFixed(2));
  const total = appliedDiscount ? appliedDiscount.total.toFixed(2) : subtotal.toFixed(2);

  const goProd = p => {
    setPageVisible(false);
    setTimeout(() => {
      setSelProd(p);
      setPage("product");
      pushHistory("product", p.id);
      window.scrollTo(0, 0);
      setTimeout(() => setPageVisible(true), 30);
    }, 320);
  };

  const [pageVisible, setPageVisible] = useState(true);
  const [pendingPage, setPendingPage] = useState(null);

  const goPage = p => {
    if (p === page) { setMenuOpen(false); return; }
    setPageVisible(false);
    setPendingPage(p);
    setMenuOpen(false);
    pushHistory(p);
  };

  useEffect(() => {
    if (!pageVisible && pendingPage !== null) {
      const t = setTimeout(() => {
        setPage(pendingPage);
        setPendingPage(null);
        window.scrollTo(0, 0);
        setTimeout(() => setPageVisible(true), 30);
      }, 320);
      return () => clearTimeout(t);
    }
  }, [pageVisible, pendingPage]);

  const cur = P[hi];
  const textState = phase === "out" ? "exit" : (phase === "in" ? "entering" : "idle");
  const modelState = phase === "out" ? "exit" : (phase === "in" ? "entering" : "idle");

  const handleApplyCode = async () => {
    const code = discountCode.trim();
    if (!code) return;
    setDiscountValidating(true);
    setDiscountError("");
    const result = await validateCode(code);
    setDiscountValidating(false);
    if (!result.valid) {
      const msgs = {
        invalid: { es: "Código inválido o no existe", en: "Invalid or unknown code" },
        used:    { es: "Este código ya fue utilizado en este dispositivo", en: "This code was already used on this device" },
        device:  { es: "Ya se usó un código de descuento en este dispositivo", en: "A discount code was already used on this device" },
      };
      setDiscountError((msgs[result.reason] || msgs.invalid)[lang]);
    } else {
      setAppliedDiscount(applyDiscount(subtotal, result));
    }
  };

  const handlePaymentSuccess = async (order, itemsOverride = null, discountOverride = null) => {
    const activeCart     = itemsOverride || cart;
    const activeDiscount = discountOverride || appliedDiscount;

    // 1. Quemar código de descuento si se usó
    if (activeDiscount?.code && activeDiscount?.fingerprint) {
      markCodeUsed(activeDiscount.code, activeDiscount.fingerprint);
    }

    const buyerEmail = order?.payer?.email_address || "";
    const buyerName  = `${order?.payer?.name?.given_name || ""} ${order?.payer?.name?.surname || ""}`.trim() || "Cliente";
    const orderId    = order?.id || `MEDU-${Date.now()}`;
    const orderDate  = new Date().toLocaleDateString(lang === "es" ? "es-CR" : "en-US", {
      year: "numeric", month: "long", day: "numeric"
    });

    // 2. Solicitar links de descarga al Worker
    let downloadLinks = {};
    let downloadSection = "";
    try {
      const productIds = activeCart.map(p => p.id);
      const res = await fetch(`${DOWNLOAD_WORKER_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, productIds, paypalToken: orderId }),
      });
      if (res.ok) {
        const data = await res.json();
        downloadLinks = data.links || {};
        // Construir sección de links para el email
        downloadSection = Object.entries(downloadLinks).map(([pid, files]) => {
          const prod = cart.find(p => p.id === pid);
          const name = prod?.name[lang] || pid;
          const fileLinks = files.map(f =>
            `${f.filename}: ${f.url}`
          ).join("\n");
          return `${name}:\n${fileLinks}`;
        }).join("\n\n");
      }
    } catch(e) {
      console.warn("Worker unreachable, skipping download links:", e);
    }

    // 3. Construir y enviar email completo como HTML (evita escaping de EmailJS)
    const discountAmt  = activeDiscount ? activeDiscount.discount.toFixed(2) : null;
    const activeSubtotal = parseFloat(activeCart.reduce((s,p) => s + p.price, 0).toFixed(2));
    const activeTotal    = activeDiscount ? activeDiscount.total.toFixed(2) : activeSubtotal.toFixed(2);
    const itemsRows = activeCart.map(p => `<tr><td style="padding:12px 0;border-bottom:1px solid #f0f2f7;"><div style="font-weight:700;color:#15172a;font-size:14px;">${p.name[lang]||p.name.es}</div><div style="font-size:12px;color:#888;margin-top:3px;">Formato: STL, OBJ</div></td><td style="padding:12px 0 12px 16px;border-bottom:1px solid #f0f2f7;text-align:right;font-weight:700;color:#0b3c73;font-size:15px;white-space:nowrap;">$${p.price.toFixed(2)}</td></tr>`).join("");
    const discountRow = discountAmt ? `<tr><td></td><td colspan="2" style="padding:6px 0;text-align:right;color:#0891b2;font-size:13px;font-weight:700;">Descuento aplicado: -$${discountAmt}</td></tr>` : "";
    const downloadBox = downloadSection
      ? `<div style="margin-top:24px;background:#f0f8ff;border-left:4px solid #0891b2;border-radius:0 8px 8px 0;padding:16px 18px;"><div style="font-weight:700;color:#0b3c73;margin-bottom:8px;font-size:14px;">Descarga tus archivos</div><p style="font-size:12px;color:#555;margin:0 0 10px;">Los links son validos por 2 horas desde la compra.</p><div style="font-size:12px;background:#fff;padding:12px;border-radius:6px;border:1px solid #e0e0e0;word-break:break-all;white-space:pre-line;">${downloadSection}</div></div>`
      : `<div style="margin-top:24px;background:#f0f8ff;border-left:4px solid #0891b2;border-radius:0 8px 8px 0;padding:16px 18px;"><div style="font-weight:700;color:#0b3c73;margin-bottom:6px;">Descarga inmediata</div><div style="font-size:13px;color:#555;">Si no recibes tus archivos en 30 minutos, respondenos a contacto@medu3d.com</div></div>`;
    const messageHtml = `<div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#333;padding:24px 8px;background:#f0f2f7;"><div style="max-width:600px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);"><div style="background:linear-gradient(135deg,#0b3c73 0%,#071e3d 100%);padding:28px 32px;"><table style="width:100%;border-collapse:collapse;"><tr><td style="vertical-align:middle;padding-right:20px;border-right:1px solid rgba(255,255,255,0.25);"><span style="font-size:26px;font-weight:900;"><span style="color:#fff;">Medu</span><span style="color:#d64830;">3D</span></span></td><td style="vertical-align:middle;padding-left:20px;"><div style="color:#fff;font-size:18px;font-weight:700;">Gracias por tu compra</div><div style="color:rgba(255,255,255,0.55);font-size:12px;margin-top:3px;">Thank you for your order</div></td></tr></table></div><div style="padding:28px 32px;"><p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#0b3c73;">Hola ${buyerName},</p><p style="margin:0 0 24px;color:#555;line-height:1.65;font-size:14px;">Tu pago fue procesado exitosamente. A continuacion encontraras el resumen de tu pedido.</p><table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#f6f7fa;border-radius:8px;"><tr><td style="padding:14px 16px;vertical-align:top;"><div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;font-weight:700;">N de Pedido</div><div style="font-weight:700;color:#0b3c73;font-size:13px;margin-top:4px;">${orderId}</div></td><td style="padding:14px 16px;vertical-align:top;text-align:right;"><div style="font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Fecha</div><div style="font-weight:600;color:#333;font-size:13px;margin-top:4px;">${orderDate}</div></td></tr></table><div style="border-top:2px solid #0b3c73;padding-top:14px;margin-bottom:4px;"><div style="font-size:11px;font-weight:700;color:#0b3c73;text-transform:uppercase;letter-spacing:1.2px;">Productos</div></div><table style="width:100%;border-collapse:collapse;margin:8px 0 4px;">${itemsRows}</table><table style="border-collapse:collapse;width:100%;margin-top:8px;">${discountRow}<tr><td style="width:60%"></td><td style="padding:5px 8px;color:#888;font-size:13px;">Envio</td><td style="padding:5px 0;text-align:right;color:#888;font-size:13px;">$0.00 (digital)</td></tr><tr><td></td><td style="padding:12px 8px 8px;border-top:2px solid #0b3c73;font-weight:700;font-size:14px;color:#0b3c73;">Total</td><td style="padding:12px 0 8px;border-top:2px solid #0b3c73;text-align:right;font-weight:800;font-size:18px;color:#0b3c73;">$${activeTotal}</td></tr></table>${downloadBox}<div style="text-align:center;margin-top:28px;"><a href="https://medu3d.com" target="_blank" style="display:inline-block;padding:13px 32px;background:#0891b2;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">Explorar mas modelos</a></div></div><div style="background:#f6f7fa;border-top:1px solid #e8ebf0;padding:20px 32px;text-align:center;"><p style="margin:0 0 4px;font-weight:900;font-size:16px;"><span style="color:#0b3c73;">Medu</span><span style="color:#d64830;">3D</span></p><p style="margin:0 0 4px;font-size:12px;color:#888;">medu3d.com</p><p style="margin:0;font-size:11px;color:#bbb;">Enviado a ${buyerEmail} por una compra en medu3d.com.</p></div></div></div>`;
    try {
      await sendConfirmationEmail({ email: buyerEmail, to_name: buyerName, reply_to: "contacto@medu3d.com", order_id: orderId, message_html: messageHtml });
    } catch(e) { console.warn("Email confirmation failed:", e); }

    // 4. Guardar links en estado para mostrarlos en pantalla
    setDownloadLinks(downloadLinks);
    setPaymentDone(true);
    setCart([]);
    setCartOpen(false);
    setAppliedDiscount(null);
    setDiscountCode("");
    setDiscountError("");
  };

  return (
    <>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,600&display=swap');
:root { --bg:#f6f7fa; --bg2:#fff; --bg3:#eceef3; --vbg:#e8ebf0; --fg:#15172a; --fg2:#555770; --fg3:#9496ab; --ac:#0891b2; --ac2:#06b6d4; --acs:rgba(8,145,178,0.07); --rd:16px; --sh:0 2px 16px rgba(0,0,0,0.05); }
*{margin:0;padding:0;box-sizing:border-box}
body,html{background:var(--bg);color:var(--fg);font-family:'Montserrat',sans-serif;font-weight:400;-webkit-font-smoothing:antialiased;scroll-behavior:smooth}
h1,h2,h3{font-family:'Montserrat',sans-serif;font-weight:700}

nav{position:fixed;top:0;left:0;right:0;padding:0 48px;height:68px;display:flex;align-items:center;justify-content:space-between;background:rgba(246,247,250,0.97);backdrop-filter:blur(20px);z-index:200;border-bottom:1px solid rgba(0,0,0,0.06);transform:translateZ(0);-webkit-transform:translateZ(0)}
.logo{font-family:'Montserrat',sans-serif;font-size:30px;cursor:pointer;display:flex;gap:0;align-items:center;font-weight:800;letter-spacing:-0.5px}.logo .m{color:#0b3c73}.logo .d{color:#d64830}.logo img{height:48px;width:auto;object-fit:contain;margin-right:10px}
.nl{display:flex;gap:4px;align-items:center;list-style:none}
.nb{background:none;border:1px solid transparent;color:var(--fg2);padding:10px 18px;border-radius:10px;cursor:pointer;font-size:14px;font-family:'Montserrat';font-weight:500;transition:all .2s;position:relative}
.nb:hover,.nb.on{background:var(--acs);color:var(--ac);border-color:rgba(8,145,178,0.1)}
.cb{position:absolute;top:2px;right:2px;width:17px;height:17px;background:var(--ac);color:#fff;border-radius:50%;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:700}
.lb{background:var(--bg3);border:none;color:var(--fg2);padding:6px 12px;border-radius:8px;cursor:pointer;font-size:11px;font-family:'Montserrat';font-weight:600;letter-spacing:.5px;transition:all .2s}.lb:hover{background:var(--acs);color:var(--ac)}
.hb{display:none;background:none;border:none;color:var(--fg);cursor:pointer;padding:4px}
.mm{display:none;position:fixed;top:68px;left:0;right:0;bottom:0;background:rgba(246,247,250,0.98);z-index:199;flex-direction:column;align-items:center;justify-content:center;gap:28px}.mm.open{display:flex}
.mm button{background:none;border:none;color:var(--fg);font-family:'Montserrat',sans-serif;font-size:26px;cursor:pointer}

/* HERO */
.hero{min-height:100vh;display:flex;align-items:center;padding:100px 48px 40px;gap:0;max-width:1440px;margin:0 auto;overflow:hidden;position:relative}
.hero-left{flex:0 0 34%;padding-right:40px;position:relative;overflow:hidden;height:320px}
.hero-right{flex:1;height:72vh;min-height:460px;border-radius:24px;overflow:hidden;cursor:pointer;position:relative}






.hero-badge{display:inline-block;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--ac);padding:6px 14px;border-radius:20px;background:var(--acs);margin-bottom:20px}
.hero-left h1{font-size:clamp(28px,3.5vw,44px);line-height:1.15;margin-bottom:10px;letter-spacing:-.5px}
.hero-tag{font-size:14px;color:var(--fg2);line-height:1.6;margin-bottom:6px}
.hero-price{font-family:'Montserrat',sans-serif;font-size:30px;margin:14px 0 22px;font-weight:300}.hero-price span{font-size:14px;color:var(--fg3);font-family:'Montserrat',sans-serif;font-weight:400}
.hero-cta{display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:var(--ac);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;transition:all .25s;font-family:'Montserrat'}.hero-cta:hover{background:var(--ac2);transform:translateY(-2px);box-shadow:0 8px 24px rgba(8,145,178,.25)}
.hero-nav{display:flex;gap:10px;align-items:center;justify-content:center;padding:18px 0 28px;width:100%}
.hero-arr{width:36px;height:36px;border-radius:50%;border:1px solid rgba(0,0,0,0.1);background:var(--bg2);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;color:var(--fg2);font-size:16px}.hero-arr:hover{border-color:var(--ac);color:var(--ac);background:var(--acs)}
.hero-dots{display:flex;gap:6px;margin:0 8px}
@keyframes textOut{from{transform:translateY(0);opacity:1}to{transform:translateY(-60px);opacity:0}}
@keyframes textIn{from{transform:translateY(70px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes textOutUp{from{transform:translateY(0);opacity:1}to{transform:translateY(50px);opacity:0}}
@keyframes textInDown{from{transform:translateY(-60px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes modelOut{from{transform:scale(1) translateX(0) rotateY(0deg);opacity:1}to{transform:scale(0.5) translateX(-120px) rotateY(-45deg);opacity:0}}
@keyframes modelIn{from{transform:scale(0.6) translateX(160px) rotateY(30deg);opacity:0}to{transform:scale(1) translateX(0) rotateY(0deg);opacity:1}}
@keyframes modelOutRight{from{transform:scale(1) translateX(0) rotateY(0deg);opacity:1}to{transform:scale(0.5) translateX(120px) rotateY(45deg);opacity:0}}
@keyframes modelInLeft{from{transform:scale(0.6) translateX(-160px) rotateY(-30deg);opacity:0}to{transform:scale(1) translateX(0) rotateY(0deg);opacity:1}}
.text-slide{position:absolute;top:0;left:0;right:0;display:flex;flex-direction:column;justify-content:center;height:100%;padding-right:20px}
.text-slide.idle{transform:translateY(0);opacity:1}
.text-slide.exit{animation:textOut .8s cubic-bezier(.4,0,.2,1) forwards}
.text-slide.entering{animation:textIn .9s cubic-bezier(.2,0,.2,1) forwards}
.model-wrap{width:100%;height:100%;position:relative;transform-style:preserve-3d}
.model-wrap.idle{transform:scale(1) translateX(0);opacity:1}
.model-wrap.exit{animation:modelOut .8s cubic-bezier(.4,0,.2,1) forwards}
.model-wrap.entering{animation:modelIn .95s cubic-bezier(.2,0,.2,1) forwards}
.hero-dot{width:8px;height:8px;border-radius:50%;border:none;cursor:pointer;transition:all .3s}.hero-dot.on{background:var(--ac);width:22px;border-radius:4px}.hero-dot:not(.on){background:var(--bg3)}

/* ABOUT */
.about{padding:80px 48px;max-width:1100px;margin:0 auto;text-align:center}
.about h2{font-size:clamp(26px,4vw,40px);margin-bottom:14px}
.about>p{max-width:580px;margin:0 auto 44px;color:var(--fg2);font-size:15px;line-height:1.7}
.sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}
.sc{background:var(--bg2);border:1px solid rgba(0,0,0,0.04);border-radius:var(--rd);padding:28px 22px;text-align:left;transition:all .3s}.sc:hover{border-color:rgba(8,145,178,0.12);box-shadow:var(--sh);transform:translateY(-3px)}
.si{width:42px;height:42px;border-radius:11px;background:var(--acs);display:flex;align-items:center;justify-content:center;margin-bottom:14px}
.sc h3{font-size:16px;margin-bottom:6px;font-family:'Montserrat';font-weight:600}.sc p{font-size:13px;color:var(--fg2);line-height:1.6}

/* CATALOG */
.cat{padding:90px 48px 40px;max-width:1200px;margin:0 auto}
.cat-h{text-align:center;margin-bottom:32px}.cat-h h2{font-size:clamp(26px,4vw,40px);margin-bottom:8px}.cat-h p{color:var(--fg2);font-size:15px}
.cat-filters{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:28px;padding:16px 20px;background:var(--bg2);border-radius:14px;border:1px solid rgba(0,0,0,0.05)}
.cat-filter-group{display:flex;align-items:center;gap:6px}
.cat-filter-label{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--fg3);white-space:nowrap}
.cat-filter-select{padding:7px 12px;border-radius:9px;border:1.5px solid rgba(0,0,0,0.07);background:var(--bg);color:var(--fg);font-size:12px;font-weight:600;font-family:'Montserrat',sans-serif;cursor:pointer;outline:none;transition:border-color .2s;appearance:none;-webkit-appearance:none;padding-right:28px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239496ab' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 9px center}
.cat-filter-select:focus{border-color:var(--ac)}
.cat-filter-sep{width:1px;height:20px;background:rgba(0,0,0,0.07);margin:0 4px}
.cat-active-count{margin-left:auto;font-size:12px;color:var(--fg3);font-weight:500}
.cat-reset{background:none;border:none;color:var(--ac);font-size:12px;font-weight:600;cursor:pointer;font-family:'Montserrat';padding:6px 10px;border-radius:8px;transition:background .2s}.cat-reset:hover{background:var(--acs)}
.cg{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
.cc{background:var(--bg2);border:1px solid rgba(0,0,0,0.04);border-radius:var(--rd);overflow:hidden;cursor:pointer;transition:all .3s}.cc:hover{border-color:rgba(8,145,178,0.12);box-shadow:var(--sh);transform:translateY(-3px)}
.ct{height:190px;background:var(--vbg);overflow:hidden;position:relative}.ct svg{opacity:.45}
.ci{padding:18px}.ci h3{font-size:17px;margin-bottom:3px;font-family:'Montserrat';font-weight:600}.ci .tl{font-size:12px;color:var(--fg3);margin-bottom:12px}
.cf{display:flex;justify-content:space-between;align-items:center}
.cp{font-family:'Montserrat',sans-serif;font-size:22px}
.cb2{padding:8px 16px;border-radius:10px;border:none;font-size:12px;font-weight:600;cursor:pointer;font-family:'Montserrat';transition:all .2s}.cb2.pr{background:var(--ac);color:#fff}.cb2.pr:hover{background:var(--ac2)}.cb2.ad{background:var(--acs);color:var(--ac)}

/* PRODUCT DETAIL */
.pd{padding:100px 48px 40px;max-width:1200px;margin:0 auto}
.pd-b{display:inline-flex;align-items:center;gap:8px;background:var(--bg2);border:1.5px solid rgba(0,0,0,0.08);color:var(--fg2);font-size:14px;font-weight:600;cursor:pointer;font-family:'Montserrat';margin-bottom:24px;padding:10px 20px;border-radius:10px;transition:all .2s}.pd-b:hover{color:var(--ac);border-color:var(--ac);background:var(--acs);transform:translateX(-2px)}
.pd-l{display:grid;grid-template-columns:1fr 1fr;gap:36px;align-items:start}
.pd-v{height:480px;border-radius:20px;overflow:hidden;background:var(--vbg)}
.pd-i h1{font-size:30px;margin-bottom:6px}.pd-i .tl{font-size:14px;color:var(--fg3);margin-bottom:14px}
.pd-i .pr{font-family:'Montserrat',sans-serif;font-size:34px;margin-bottom:6px}.pd-i .pr span{font-size:14px;color:var(--fg3);font-family:'Montserrat'}
.pd-i .fm{font-size:12px;color:var(--fg3);background:var(--bg3);display:inline-block;padding:4px 12px;border-radius:6px;margin-bottom:18px}
.pd-i .dt{font-size:13px;font-weight:600;color:var(--fg2);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px}
.pd-i .dd{font-size:14px;color:var(--fg2);line-height:1.7;margin-bottom:16px}
.pd-a{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.pd-btn{padding:14px 28px;border-radius:12px;border:none;font-size:15px;font-weight:600;cursor:pointer;font-family:'Montserrat';transition:all .2s;display:inline-flex;align-items:center;gap:8px;text-decoration:none;width:100%;justify-content:center}
.pd-btn.cart{background:var(--bg3);color:var(--fg);border:1.5px solid rgba(0,0,0,0.1)}.pd-btn.cart:hover{background:var(--acs);color:var(--ac);border-color:var(--ac)}.pd-btn.cart.ad{background:var(--acs);color:var(--ac);border-color:var(--ac)}
.pd-paypal{margin-top:12px}
.pd-h{font-size:12px;color:var(--fg3);margin-top:14px}

/* TYPE TOGGLE */
.type-toggle{display:flex;gap:8px;margin-bottom:10px}
.tt-btn{display:flex;align-items:center;gap:7px;padding:10px 18px;border-radius:11px;border:1.5px solid rgba(0,0,0,0.08);background:var(--bg);color:var(--fg2);font-size:13px;font-weight:600;cursor:pointer;font-family:'Montserrat';transition:all .22s;position:relative}
.tt-btn:hover{border-color:rgba(8,145,178,0.2);color:var(--ac)}
.tt-btn.on{background:var(--acs);border-color:var(--ac);color:var(--ac)}
.tt-cs{position:absolute;top:-9px;right:-6px;background:var(--ac);color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:20px;letter-spacing:.5px;text-transform:uppercase;white-space:nowrap}
.type-desc{font-size:12px;color:var(--fg3);margin-bottom:14px;padding:8px 12px;background:var(--bg3);border-radius:8px}

/* COMING SOON BOX */
.cs-box{text-align:center;padding:36px 28px;background:var(--bg3);border-radius:16px;border:1.5px dashed rgba(8,145,178,0.2);margin-top:4px}
.cs-icon{font-size:42px;margin-bottom:12px}
.cs-box h3{font-size:20px;margin-bottom:8px;font-family:'Montserrat',sans-serif}
.cs-box p{font-size:13px;color:var(--fg2);line-height:1.6;margin-bottom:20px}
.cs-cta{display:inline-flex;align-items:center;gap:8px;padding:11px 22px;background:var(--ac);color:#fff;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;font-family:'Montserrat';transition:all .2s}.cs-cta:hover{background:var(--ac2)}

/* FORMS */
.fp{padding:100px 48px 60px;max-width:520px;margin:0 auto}
.fp h2{font-size:clamp(26px,4vw,36px);margin-bottom:8px;text-align:center}
.fp>p{color:var(--fg2);text-align:center;margin-bottom:32px;font-size:15px}
.page-wrap{transition:opacity .32s cubic-bezier(.4,0,.2,1),transform .32s cubic-bezier(.4,0,.2,1)}.page-wrap.visible{opacity:1;transform:translateY(0)}.page-wrap.hidden{opacity:0;transform:translateY(18px)}
.fp input,.fp textarea{width:100%;padding:13px 16px;background:var(--bg2);border:1px solid rgba(0,0,0,0.07);border-radius:12px;color:var(--fg);font-size:14px;font-family:'Montserrat';outline:none;transition:border-color .2s;margin-bottom:10px}
.fp input:focus,.fp textarea:focus{border-color:var(--ac);box-shadow:0 0 0 3px var(--acs)}
.fp textarea{min-height:110px;resize:vertical}
.fp input::placeholder,.fp textarea::placeholder{color:var(--fg3)}
.fs{width:100%;padding:13px;background:var(--ac);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:'Montserrat';transition:all .2s}.fs:hover:not(:disabled){background:var(--ac2)}.fs:disabled{opacity:.6;cursor:not-allowed}
.fok{text-align:center;padding:36px;color:var(--ac);font-size:16px}

/* QUOTE PAGE */
.qp{padding:90px 0 60px;max-width:1200px;margin:0 auto}
.qp-hero{background:linear-gradient(135deg,#0b3c73 0%,#0a2d5a 100%);padding:64px 60px;text-align:center;margin-bottom:0}
.qp-hero h2{font-size:clamp(26px,3.5vw,42px);color:#fff;margin-bottom:12px;font-weight:700}
.qp-hero p{color:rgba(255,255,255,0.65);font-size:15px;max-width:560px;margin:0 auto}
.qp-services{display:grid;grid-template-columns:repeat(2,1fr);gap:0;border-top:none}
.qp-svc{padding:40px 44px;background:var(--bg2);border:1px solid rgba(11,60,115,0.07);display:flex;gap:20px;align-items:flex-start;transition:all .3s}
.qp-svc:hover{background:#f8faff;border-color:rgba(11,60,115,0.18)}
.qp-svc-icon{width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:24px}
.qp-svc h3{font-size:17px;font-weight:700;color:var(--fg);margin-bottom:6px}
.qp-svc p{font-size:13px;color:var(--fg2);line-height:1.6}
.qp-process{padding:56px 60px;background:var(--bg3)}
.qp-process h3{font-size:22px;font-weight:700;text-align:center;margin-bottom:8px}
.qp-process > p{text-align:center;color:var(--fg2);font-size:14px;margin-bottom:36px}
.qp-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.qp-step{background:var(--bg2);border-radius:16px;overflow:hidden;border:1px solid rgba(11,60,115,0.07)}
.qp-step-img{height:160px;background:linear-gradient(135deg,#dde3ef,#e8ecf5);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.qp-step-img img{width:100%;height:100%;object-fit:cover}
.qp-step-img-placeholder{display:flex;flex-direction:column;align-items:center;gap:10px;color:var(--fg3)}
.qp-step-img-placeholder span{font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase}
.qp-step-body{padding:18px 16px}
.qp-step-num{width:26px;height:26px;border-radius:50%;background:var(--navy,#0b3c73);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:8px}
.qp-step h4{font-size:14px;font-weight:700;margin-bottom:4px;color:var(--fg)}
.qp-step p{font-size:12px;color:var(--fg2);line-height:1.55}
.qp-form{padding:56px 60px}
.qp-form h3{font-size:22px;font-weight:700;text-align:center;margin-bottom:8px}
.qp-form > p{text-align:center;color:var(--fg2);font-size:14px;margin-bottom:36px}
.qp-form-inner{max-width:560px;margin:0 auto}
.qp-form-inner input,.qp-form-inner textarea,.qp-form-inner select{width:100%;padding:13px 16px;background:var(--bg2);border:1.5px solid rgba(11,60,115,0.1);border-radius:12px;color:var(--fg);font-size:14px;font-family:'Montserrat',sans-serif;outline:none;transition:border-color .2s;margin-bottom:12px}
.qp-form-inner input:focus,.qp-form-inner textarea:focus,.qp-form-inner select:focus{border-color:#0b3c73;box-shadow:0 0 0 3px rgba(11,60,115,0.07)}
.qp-form-inner textarea{min-height:120px;resize:vertical}
.qp-form-inner input::placeholder,.qp-form-inner textarea::placeholder{color:var(--fg3)}

/* CONTACT PAGE */
.cp-wrap{padding:90px 0 60px;max-width:1100px;margin:0 auto}
.cp-hero{background:linear-gradient(135deg,#0b3c73 0%,#0a2d5a 100%);padding:64px 60px;text-align:center}
.cp-hero h2{font-size:clamp(26px,3.5vw,42px);color:#fff;margin-bottom:12px;font-weight:700}
.cp-hero p{color:rgba(255,255,255,0.65);font-size:15px;max-width:480px;margin:0 auto}
.cp-channels{display:grid;grid-template-columns:repeat(3,1fr);gap:0;background:var(--bg2)}
.cp-channel{padding:40px 36px;text-align:center;border:1px solid rgba(11,60,115,0.07);display:flex;flex-direction:column;align-items:center;gap:14px;transition:all .3s}
.cp-channel:hover{background:#f8faff;border-color:rgba(11,60,115,0.18)}
.cp-ch-icon{width:60px;height:60px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:26px}
.cp-channel h3{font-size:16px;font-weight:700;color:var(--fg)}
.cp-channel p{font-size:13px;color:var(--fg2);line-height:1.5}
.cp-ch-btn{display:inline-flex;align-items:center;gap:8px;padding:11px 22px;border-radius:10px;font-size:13px;font-weight:700;font-family:'Montserrat',sans-serif;text-decoration:none;transition:all .2s;border:none;cursor:pointer}
.cp-ch-btn.green{background:#25D366;color:#fff}.cp-ch-btn.green:hover{background:#1ebe5a;transform:translateY(-1px)}
.cp-ch-btn.blue{background:#0b3c73;color:#fff}.cp-ch-btn.blue:hover{background:#0d4a8e;transform:translateY(-1px)}
.cp-ch-btn.coral{background:#d64830;color:#fff}.cp-ch-btn.coral:hover{background:#e85a40;transform:translateY(-1px)}
.cp-form-section{padding:56px 60px;background:var(--bg3)}
.cp-form-section h3{font-size:22px;font-weight:700;text-align:center;margin-bottom:8px}
.cp-form-section > p{text-align:center;color:var(--fg2);font-size:14px;margin-bottom:36px}
.cp-form-inner{max-width:520px;margin:0 auto}
.cp-form-inner input,.cp-form-inner textarea{width:100%;padding:13px 16px;background:var(--bg2);border:1.5px solid rgba(11,60,115,0.1);border-radius:12px;color:var(--fg);font-size:14px;font-family:'Montserrat',sans-serif;outline:none;transition:border-color .2s;margin-bottom:12px}
.cp-form-inner input:focus,.cp-form-inner textarea:focus{border-color:#0b3c73;box-shadow:0 0 0 3px rgba(11,60,115,0.07)}
.cp-form-inner textarea{min-height:110px;resize:vertical}
.cp-form-inner input::placeholder,.cp-form-inner textarea::placeholder{color:var(--fg3)}

/* SERVICES SECTION (landing) */
.svcs{padding:96px 60px;background:var(--bg2)}
.svcs-h{text-align:center;margin-bottom:56px}
.svcs-h h2{font-size:clamp(26px,3.5vw,42px);margin-bottom:12px;font-weight:700}
.svcs-h p{color:var(--fg2);font-size:15px;max-width:540px;margin:0 auto}
.svcs-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:1080px;margin:0 auto 40px}
.svc-card{background:var(--bg);border:1px solid rgba(11,60,115,0.08);border-radius:20px;padding:32px 26px;transition:all .3s;position:relative;overflow:hidden}
.svc-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#0b3c73,#d64830);opacity:0;transition:.3s}
.svc-card:hover{border-color:rgba(11,60,115,0.2);box-shadow:var(--sh);transform:translateY(-4px)}
.svc-card:hover::before{opacity:1}
.svc-icon{width:52px;height:52px;border-radius:14px;background:var(--acs);display:flex;align-items:center;justify-content:center;margin-bottom:16px;flex-shrink:0}
.svc-card h3{font-size:16px;font-weight:700;margin-bottom:8px;color:var(--fg)}
.svc-card p{font-size:13px;color:var(--fg2);line-height:1.65;margin-bottom:16px}
.svc-tag{display:inline-block;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:20px;background:var(--navys);color:var(--navy,#0b3c73);margin-bottom:12px}
.svcs-cta{text-align:center}
.svcs-cta-btn{display:inline-flex;align-items:center;gap:10px;padding:14px 32px;background:var(--navy,#0b3c73);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Montserrat',sans-serif;transition:all .25s}
.svcs-cta-btn:hover{background:#0d4a8e;transform:translateY(-2px);box-shadow:0 8px 28px rgba(11,60,115,.25)}

/* ABOUT PAGE */
.ap{padding:0 0 80px;max-width:1100px;margin:0 auto}
.ap-hero{background:linear-gradient(135deg,#0b3c73 0%,#071e3d 100%);padding:80px 60px;display:block;position:relative;overflow:hidden}
.ap-hero::before{content:'';position:absolute;right:-100px;top:-100px;width:500px;height:500px;background:radial-gradient(circle,rgba(214,72,48,0.12),transparent 65%);pointer-events:none}
.ap-hero-text h1{font-size:clamp(28px,4vw,48px);color:#fff;font-weight:800;margin-bottom:6px;letter-spacing:-0.5px}
.ap-hero-text h2{font-size:16px;color:rgba(255,255,255,0.55);font-weight:500;margin-bottom:24px;letter-spacing:.5px;text-transform:uppercase}
.ap-quote{font-size:16px;color:rgba(255,255,255,0.85);line-height:1.7;font-style:italic;border-left:3px solid #d64830;padding-left:20px;font-weight:300}
.ap-photo{width:280px;height:320px;border-radius:20px;overflow:hidden;background:rgba(255,255,255,0.08);border:2px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ap-photo img{width:100%;height:100%;object-fit:cover}
.ap-photo-placeholder{display:flex;flex-direction:column;align-items:center;gap:12px;color:rgba(255,255,255,0.35)}
.ap-photo-placeholder svg{opacity:.5}
.ap-photo-placeholder span{font-size:12px;font-weight:600;letter-spacing:.5px}
.ap-body{padding:60px 60px 0;display:grid;grid-template-columns:1fr 1fr;gap:48px}
.ap-section h3{font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--navy,#0b3c73);margin-bottom:24px;display:flex;align-items:center;gap:10px}
.ap-section h3::after{content:'';flex:1;height:1px;background:rgba(11,60,115,0.12)}
.ap-exp{display:flex;flex-direction:column;gap:20px}
.ap-exp-item{display:flex;gap:16px;align-items:flex-start}
.ap-exp-dot{width:10px;height:10px;border-radius:50%;background:var(--ac,#d64830);flex-shrink:0;margin-top:5px}
.ap-exp-item h4{font-size:14px;font-weight:700;color:var(--fg);margin-bottom:2px}
.ap-exp-item .ap-org{font-size:12px;color:var(--navy,#0b3c73);font-weight:600;margin-bottom:4px}
.ap-exp-item .ap-yr{font-size:11px;color:var(--fg3);font-weight:500;margin-bottom:6px}
.ap-exp-item p{font-size:12px;color:var(--fg2);line-height:1.6}
.ap-skills{display:flex;flex-direction:column;gap:14px}
.ap-skill-group h4{font-size:12px;font-weight:700;color:var(--fg);margin-bottom:8px;letter-spacing:.3px}
.ap-skill-tags{display:flex;flex-wrap:wrap;gap:6px}
.ap-skill-tag{font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;background:var(--bg3);color:var(--fg2);border:1px solid rgba(11,60,115,0.08)}
.ap-certs{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.ap-cert{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--fg2)}
.ap-cert-dot{width:8px;height:8px;border-radius:50%;background:var(--navy,#0b3c73);flex-shrink:0}
.ap-cta{margin:48px 60px 0;background:linear-gradient(135deg,#0b3c73,#0a2d5a);border-radius:20px;padding:40px 48px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.ap-cta h3{font-size:22px;font-weight:700;color:#fff;margin-bottom:6px}
.ap-cta p{font-size:14px;color:rgba(255,255,255,0.6)}
.ap-cta-btns{display:flex;gap:12px;flex-shrink:0}
.ap-cta-btn{display:inline-flex;align-items:center;gap:8px;padding:12px 22px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Montserrat',sans-serif;transition:all .2s;text-decoration:none;border:none}
.ap-cta-btn.primary{background:#d64830;color:#fff}.ap-cta-btn.primary:hover{background:#e85a40}
.ap-cta-btn.secondary{background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2)}.ap-cta-btn.secondary:hover{background:rgba(255,255,255,0.18)}
@media(max-width:900px){
  .svcs{padding:60px 20px}
  .svcs-grid{grid-template-columns:1fr}
  .ap-hero{grid-template-columns:1fr;padding:48px 20px}
  .ap-photo{width:100%;height:220px}
  .ap-body{grid-template-columns:1fr;padding:32px 20px 0}
  .ap-cta{flex-direction:column;margin:32px 20px 0;padding:32px 24px}
  .ap-cta-btns{flex-direction:column;width:100%}
}

/* FLOATING WHATSAPP */
.wa-float{position:fixed;bottom:28px;left:28px;z-index:250;width:56px;height:56px;background:#25D366;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(37,211,102,0.45);cursor:pointer;transition:all .25s;text-decoration:none}
.wa-float:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(37,211,102,0.55)}
.wa-float.hidden{opacity:0;pointer-events:none;transform:scale(0.8)}

@media(max-width:900px){
  .qp-services{grid-template-columns:1fr}
  .qp-steps{grid-template-columns:repeat(2,1fr)}
  .qp-process,.qp-form,.qp-hero,.cp-hero,.cp-form-section{padding-left:20px;padding-right:20px}
  .cp-channels{grid-template-columns:1fr}
}
.ferr{text-align:center;padding:12px;color:#e05555;font-size:13px;background:rgba(224,85,85,0.06);border-radius:10px;margin-bottom:10px}
.ce{display:block;text-align:center;font-size:18px;color:var(--ac);text-decoration:none;margin-bottom:28px;font-weight:500}

/* CART MODAL (checkout overlay — full scrollable) */
.co{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:300;opacity:0;pointer-events:none;transition:opacity .3s;display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;overflow-y:auto}.co.open{opacity:1;pointer-events:all}
.cs{background:var(--bg2);z-index:301;width:100%;max-width:560px;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.18);margin:auto;transform:translateY(20px) scale(0.97);transition:transform .35s cubic-bezier(.25,.46,.45,.94);opacity:0;pointer-events:none}.co.open .cs{transform:translateY(0) scale(1);opacity:1;pointer-events:all}
.cs-h{padding:22px 28px 18px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:var(--bg2);z-index:1;border-radius:20px 20px 0 0}.cs-h h3{font-size:18px;font-family:'Montserrat';font-weight:700}
.cs-x{background:none;border:none;color:var(--fg3);cursor:pointer;font-size:20px;padding:4px;border-radius:6px;transition:color .2s}.cs-x:hover{color:var(--fg)}
.cs-i{padding:8px 28px 16px}
.cit{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid rgba(0,0,0,0.04)}
.cit-c{width:42px;height:42px;border-radius:10px;flex-shrink:0}
.cit-i{flex:1}.cit-i h4{font-size:14px;font-weight:600;margin-bottom:2px}.cit-i span{font-size:12px;color:var(--fg3)}
.cit-p{font-family:'Montserrat',sans-serif;font-size:18px;font-weight:600}
.cit-r{background:none;border:none;color:var(--fg3);font-size:11px;cursor:pointer;margin-left:6px;text-decoration:underline;font-family:'Montserrat';transition:color .2s}.cit-r:hover{color:#e05555}
.cs-e{text-align:center;padding:50px 20px;color:var(--fg3)}.cs-e p{margin-bottom:14px}
.cs-f{padding:20px 28px 28px}
.cs-divider{height:1px;background:rgba(0,0,0,0.06);margin-bottom:16px}
.cs-t{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size:15px;font-weight:600}.cs-t span:last-child{font-family:'Montserrat',sans-serif;font-size:22px;color:var(--fg)}
.cs-note{font-size:11px;color:var(--fg3);margin-bottom:16px;display:flex;align-items:center;gap:5px}
.cs-ok{text-align:center;padding:24px;background:rgba(8,145,178,0.05);border-radius:12px;color:var(--ac);font-size:15px;font-weight:500}
/* DISCOUNT CODE */
.cs-discount{display:flex;gap:8px;margin-bottom:14px}
.cs-discount input{flex:1;padding:10px 14px;border:1.5px solid rgba(0,0,0,0.08);border-radius:10px;font-size:13px;font-family:'Montserrat',sans-serif;outline:none;background:var(--bg);color:var(--fg);transition:border-color .2s;text-transform:uppercase;letter-spacing:.5px}
.cs-discount input:focus{border-color:var(--ac);box-shadow:0 0 0 3px var(--acs)}
.cs-discount input::placeholder{text-transform:none;letter-spacing:0}
.cs-discount-btn{padding:10px 16px;background:var(--navy,#0b3c73);color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Montserrat',sans-serif;white-space:nowrap;transition:background .2s}.cs-discount-btn:hover{background:#0d4a8e}
.cs-discount-applied{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(8,145,178,0.06);border-radius:9px;border:1px solid rgba(8,145,178,0.15);margin-bottom:14px}
.cs-discount-applied span{font-size:12px;font-weight:600;color:var(--ac)}
.cs-discount-remove{background:none;border:none;color:var(--fg3);font-size:11px;cursor:pointer;font-family:'Montserrat';text-decoration:underline}.cs-discount-remove:hover{color:#e05555}
.cs-discount-err{font-size:11px;color:#e05555;margin-bottom:10px;padding:0 2px}
.cs-savings{display:flex;justify-content:space-between;font-size:13px;color:var(--ac);font-weight:600;margin-bottom:6px}

/* PAYMENT SUCCESS MODAL */
.ps-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto}
.ps-modal{background:var(--bg2);border-radius:20px;padding:36px 32px;max-width:480px;width:100%;text-align:center}
.ps-icon{font-size:52px;margin-bottom:16px}
.ps-modal h3{font-size:22px;margin-bottom:8px}
.ps-modal p{color:var(--fg2);font-size:14px;line-height:1.6;margin-bottom:16px}
.ps-btn{padding:12px 28px;background:var(--ac);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:'Montserrat'}
.ps-downloads{margin:16px 0;text-align:left}
.ps-dl-title{font-size:12px;font-weight:700;color:var(--fg3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px;text-align:center}
.ps-dl-item{margin-bottom:10px;background:var(--bg3);border-radius:10px;padding:12px 14px}
.ps-dl-name{font-size:13px;font-weight:600;color:var(--fg);margin-bottom:6px}
.ps-dl-btns{display:flex;gap:6px;flex-wrap:wrap}
.ps-dl-btn{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;background:var(--ac);color:#fff;border-radius:8px;text-decoration:none;font-size:11px;font-weight:700;font-family:'Montserrat';transition:background .2s}.ps-dl-btn:hover{background:var(--ac2)}
.ps-dl-note{font-size:11px;color:var(--fg3);margin-top:10px;text-align:center;line-height:1.5}

footer{border-top:1px solid rgba(0,0,0,0.05);padding:36px 48px;text-align:center;margin-top:40px}
.fl{font-family:'Montserrat',sans-serif;font-size:19px;margin-bottom:4px}.fl .d{color:var(--ac);font-style:italic}
footer p{font-size:12px;color:var(--fg3)}

@media(max-width:900px){
  nav{padding:0 16px}.nl{display:none}.hb{display:block}
  .hero{flex-direction:column;padding:86px 20px 32px;min-height:auto;gap:20px}
  .hero-left{flex:none;text-align:center;height:auto;overflow:visible;padding:0}
  .text-slide{position:relative}
  .hero-right{height:50vh;min-height:280px;width:100%}
  .hero-nav{position:relative;bottom:auto;left:auto;justify-content:center;margin-top:16px}
  .about,.cat,.pd{padding-left:20px;padding-right:20px}
  .cat-filters{flex-direction:column;align-items:flex-start;gap:12px}
  .cat-filter-sep{display:none}
  .cat-active-count{margin-left:0}
  .pd-l{grid-template-columns:1fr}.pd-v{height:320px}
  .cg{grid-template-columns:1fr}
  .fp{padding-left:20px;padding-right:20px}
  footer{padding:28px 20px}
}
      `}</style>

      {/* PAYMENT SUCCESS MODAL */}
      {paymentDone && (
        <div className="ps-overlay" onClick={() => { setPaymentDone(false); setDownloadLinks({}); }}>
          <div className="ps-modal" onClick={e => e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
              <img src="/logo.png" alt="Medu 3D" style={{height:48,marginRight:8}} />
              <span style={{fontFamily:"Montserrat",fontWeight:800,fontSize:26}}>
                <span style={{color:"#0b3c73"}}>Medu</span><span style={{color:"#d64830"}}>3D</span>
              </span>
            </div>
            <div style={{width:52,height:52,background:"#0891b2",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3>{lang === "es" ? "¡Pago exitoso!" : "Payment successful!"}</h3>
            <p>{lang === "es"
              ? "Gracias por tu compra. También recibirás un correo de confirmación con los links."
              : "Thank you for your purchase. You'll also receive a confirmation email with the links."}</p>

            {/* Download links section */}
            {Object.keys(downloadLinks).length > 0 ? (
              <div className="ps-downloads">
                <div className="ps-dl-title">
                  {lang === "es" ? "📥 Descarga tus archivos" : "📥 Download your files"}
                </div>
                {Object.entries(downloadLinks).map(([pid, files]) => {
                  const prod = P.find(p => p.id === pid);
                  return (
                    <div className="ps-dl-item" key={pid}>
                      <div className="ps-dl-name">{prod?.name[lang] || pid}</div>
                      <div className="ps-dl-btns">
                        {files.map(f => (
                          <a key={f.filename} href={f.url} className="ps-dl-btn" download={f.filename}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            {lang === "es" ? "Descargar archivos" : "Download files"} ({f.filename.split(".").pop().toUpperCase()})
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <p className="ps-dl-note">
                  {lang === "es"
                    ? "⏱ Los links son válidos por 2 horas. También los recibirás en tu correo."
                    : "⏱ Links are valid for 2 hours. You'll also receive them by email."}
                </p>
              </div>
            ) : (
              <p style={{fontSize:12,color:"var(--fg3)",marginBottom:20}}>
                {lang === "es"
                  ? "Los links de descarga llegarán a tu correo en breve."
                  : "Download links will arrive to your email shortly."}
              </p>
            )}

            <button className="ps-btn" onClick={() => { setPaymentDone(false); setDownloadLinks({}); }}>
              {lang === "es" ? "Cerrar" : "Close"}
            </button>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav>
        <div className="logo" onClick={() => goPage("home")}><img src="/logo.png" alt="Medu 3D logo" /><span className="m">Medu</span><span className="d">3D</span></div>
        <ul className="nl">
          <li><button className={`nb ${page === "catalog" ? "on" : ""}`} onClick={() => goPage("catalog")}>{t.nav.catalog}</button></li>
          <li><button className={`nb ${page === "quote" ? "on" : ""}`} onClick={() => goPage("quote")}>{t.nav.quote}</button></li>
          <li><button className={`nb ${page === "about" ? "on" : ""}`} onClick={() => goPage("about")}>{t.nav.about}</button></li>
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
        <button onClick={() => goPage("about")}>{t.nav.about}</button>
        <button onClick={() => goPage("contact")}>{t.nav.contact}</button>
        <button onClick={() => { setCartOpen(true); setMenuOpen(false); }}>{t.nav.cart} {cart.length > 0 && `(${cart.length})`}</button>
        <button className="lb" onClick={() => { setLang(lang === "es" ? "en" : "es"); setMenuOpen(false); }}>{lang === "es" ? "English" : "Español"}</button>
      </div>

      {/* CART MODAL */}
      <div className={`co ${cartOpen ? "open" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) setCartOpen(false); }}>
        <div className={`cs`}>
          {/* Header */}
          <div className="cs-h">
            <div>
              <h3>{t.cart.title}</h3>
              {cart.length > 0 && <span style={{fontSize:12,color:"var(--fg3)",fontWeight:500}}>{cart.length} {lang==="es" ? "producto" : "item"}{cart.length!==1?"s":""}</span>}
            </div>
            <button className="cs-x" onClick={() => setCartOpen(false)}>✕</button>
          </div>

          {/* Items */}
          <div className="cs-i">
            {cart.length === 0 ? (
              <div className="cs-e">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{marginBottom:12,opacity:.3}}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>
                <p>{t.cart.empty}</p>
                <button className="hero-cta" onClick={() => { setCartOpen(false); goPage("catalog"); }}>{t.cart.browse}</button>
              </div>
            ) : cart.map(p => (
              <div className="cit" key={p.cartId}>
                <div className="cit-c" style={{ background: p.color }} />
                <div className="cit-i">
                  <h4>{p.name[lang]}</h4>
                  <span>{p.formats}</span>
                </div>
                <div className="cit-p">${p.price.toFixed(2)}</div>
                <button className="cit-r" onClick={() => rmCart(p.cartId)}>{t.cart.remove}</button>
              </div>
            ))}
          </div>

          {/* Footer: total + payment */}
          {cart.length > 0 && (
            <div className="cs-f">
              <div className="cs-divider" />

              {/* Discount code input */}
              {!appliedDiscount ? (
                <>
                  <div className="cs-discount">
                    <input
                      placeholder={lang === "es" ? "Código de descuento" : "Discount code"}
                      value={discountCode}
                      onChange={e => { setDiscountCode(e.target.value.toUpperCase()); setDiscountError(""); }}
                      onKeyDown={e => { if (e.key === "Enter") handleApplyCode(); }}
                      disabled={discountValidating}
                    />
                    <button
                      className="cs-discount-btn"
                      onClick={handleApplyCode}
                      disabled={discountValidating || !discountCode.trim()}
                    >
                      {discountValidating
                        ? (lang === "es" ? "..." : "...")
                        : (lang === "es" ? "Aplicar" : "Apply")}
                    </button>
                  </div>
                  {discountError && (
                    <p className="cs-discount-err">{discountError}</p>
                  )}
                </>
              ) : (
                <div className="cs-discount-applied">
                  <span>
                    🏷 {appliedDiscount.label?.[lang]}
                    {" · "}{lang === "es" ? "ahorras" : "you save"} ${appliedDiscount.discount.toFixed(2)}
                  </span>
                  <button className="cs-discount-remove" onClick={() => {
                    setAppliedDiscount(null); setDiscountCode(""); setDiscountError("");
                  }}>{lang === "es" ? "Quitar" : "Remove"}</button>
                </div>
              )}

              {/* Subtotal + discount breakdown */}
              {appliedDiscount && (
                <>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"var(--fg3)",marginBottom:4}}>
                    <span>{lang === "es" ? "Subtotal" : "Subtotal"}</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="cs-savings">
                    <span>{lang === "es" ? "Descuento" : "Discount"}</span>
                    <span>− ${appliedDiscount.discount.toFixed(2)}</span>
                  </div>
                </>
              )}

              <div className="cs-t">
                <span>{t.cart.total}</span>
                <span>${total}</span>
              </div>
              <p className="cs-note">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                {t.cart.paypalNote}
              </p>
              <PayPalButton
                items={cart.map(p => ({ ...p, price: parseFloat((p.price * parseFloat(total) / subtotal).toFixed(2)) }))}
                lang={lang}
                onSuccess={handlePaymentSuccess}
              />
            </div>
          )}
        </div>
      </div>

      {/* PAGES */}
      <div className={`page-wrap ${pageVisible ? "visible" : "hidden"}`}>
      {page === "home" && <>
        <div className="hero">
          <div className="hero-left">
            <div className={`text-slide ${textState}`} key={hi}>
              <div className="hero-badge">{t.hero.badge}</div>
              <h1>{cur.name[lang]}</h1>
              <p className="hero-tag">{cur.tag[lang]}</p>
              <div className="hero-price">${cur.priceSlt} <span>USD</span></div>
              <button className="hero-cta" onClick={() => goProd(cur)}>{t.hero.explore} →</button>
            </div>
          </div>
          <div className="hero-right" onClick={() => goProd(cur)}>
            <div className={`model-wrap ${modelState}`} key={hi}>
              <Viewer color={cur.color} active={true} modelId={cur.modelId} bgColor={0xeef1f5} rotation={cur.rotation||[0,0,0]} />
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
                <div className="si"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth="2">
                  {n === 1 && <><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></>}
                  {n === 2 && <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15h6"/></>}
                  {n === 3 && <><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></>}
                </svg></div>
                <h3>{t.about[`s${n}t`]}</h3><p>{t.about[`s${n}d`]}</p>
              </div>
            ))}
          </div>
        </div>

        {/* SERVICES SECTION */}
        <div className="svcs">
          <div className="svcs-h">
            <h2>{lang === "es" ? "Servicios Especializados" : "Specialized Services"}</h2>
            <p>{lang === "es" ? "Más allá de los modelos estándar — soluciones a la medida para cada proyecto médico o ingenieril." : "Beyond standard models — tailored solutions for every medical or engineering project."}</p>
          </div>
          <div className="svcs-grid">
            {[
              { svg: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth="2"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>, tag: lang==="es"?"Personalizado":"Custom", title: lang==="es"?"Segmentación CT/MRI":"CT/MRI Segmentation", desc: lang==="es"?"Convertimos tus imágenes DICOM en modelos 3D de precisión clínica. Cada estructura anatómica segmentada con detalle para tu caso específico.":"We convert your DICOM images into clinical-precision 3D models. Each anatomical structure segmented in detail for your specific case." },
              { svg: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>, tag: lang==="es"?"Cirugía":"Surgery", title: lang==="es"?"Planificación Quirúrgica":"Surgical Planning", desc: lang==="es"?"Modelos submilimétricos para visualizar procedimientos, diseñar guías quirúrgicas y mejorar resultados en reconstrucción ósea y cirugía ortopédica.":"Sub-millimeter models to visualize procedures, design surgical guides and improve outcomes in bone reconstruction and orthopedic surgery." },
              { svg: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth="2"><path d="M12 2a4 4 0 014 4 4 4 0 01-4 4 4 4 0 01-4-4 4 4 0 014-4"/><path d="M2 20c0-4 4-7 10-7s10 3 10 7"/><path d="M17 14l2 2 4-4"/></svg>, tag: lang==="es"?"Rehabilitación":"Rehab", title: lang==="es"?"Férulas Personalizadas":"Custom Orthoses", desc: lang==="es"?"Diseño y fabricación de férulas a medida desde escaneo 3D del paciente. Mayor confort, mejor ajuste y tiempo de fabricación reducido.":"Design and fabrication of custom splints from 3D patient scanning. Greater comfort, better fit and reduced manufacturing time." },
              { svg: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>, tag: lang==="es"?"Fabricación":"Manufacturing", title: lang==="es"?"Impresión 3D Médica e Ingenieril":"Medical & Engineering 3D Printing", desc: lang==="es"?"FDM, SLA y SLS para prototipos, piezas funcionales y modelos anatómicos. Materiales biocompatibles disponibles para aplicaciones clínicas.":"FDM, SLA and SLS for prototypes, functional parts and anatomical models. Biocompatible materials available for clinical applications." },
              { svg: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>, tag: lang==="es"?"Asesoría":"Advisory", title: lang==="es"?"Asesoría en Modelado 3D":"3D Modeling Advisory", desc: lang==="es"?"Consultoría técnica para equipos médicos e ingenieros que necesitan integrar el modelado 3D y la impresión en su flujo de trabajo clínico o industrial.":"Technical consulting for medical teams and engineers needing to integrate 3D modeling and printing into their clinical or industrial workflow." },
              { svg: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05"/><path d="M12 22.08V12"/></svg>, tag: lang==="es"?"I+D":"R&D", title: lang==="es"?"Proyectos de Investigación":"Research Projects", desc: lang==="es"?"Colaboración en proyectos académicos y de I+D que requieran prototipado rápido, modelado anatómico o desarrollo de dispositivos biomédicos.":"Collaboration on academic and R&D projects requiring rapid prototyping, anatomical modeling or biomedical device development." },
            ].map((s,i) => (
              <div className="svc-card" key={i}>
                <div className="svc-icon">{s.svg}</div>
                <div className="svc-tag">{s.tag}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="svcs-cta">
            <button className="svcs-cta-btn" onClick={() => goPage("quote")}>
              {lang === "es" ? "Solicitar cotización personalizada →" : "Request a custom quote →"}
            </button>
          </div>
        </div>
      </>}

      {/* CATALOG */}
      {page === "catalog" && <CatalogPage t={t} lang={lang} cart={cart} addCart={addCart} goProd={goProd} />}

      {/* PRODUCT */}
      {page === "product" && selProd && <ProductDetail
        prod={selProd} lang={lang} t={t} cart={cart}
        addCart={addCart} onPaySuccess={handlePaymentSuccess}
        goPage={goPage} applyDiscountFn={applyDiscount}
      />}

      {/* ABOUT */}
      {page === "about" && <AboutPage lang={lang} />}

      {/* QUOTE */}
      {page === "quote" && <QuoteForm t={t} lang={lang} />}

      {/* CONTACT */}
      {page === "contact" && <ContactForm t={t} lang={lang} />}

      {/* LEGAL */}
      {page === "privacy" && <LegalPage type="privacy" lang={lang} goPage={goPage} />}
      {page === "terms"   && <LegalPage type="terms"   lang={lang} goPage={goPage} />}
      </div>

      {/* Floating WhatsApp */}
      <a className={`wa-float ${cartOpen ? "hidden" : ""}`} href="https://wa.me/50662924815" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.532 5.86L.057 23.428a.75.75 0 00.921.921l5.568-1.475A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.712 9.712 0 01-4.964-1.362l-.355-.212-3.683.975.99-3.595-.232-.371A9.712 9.712 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
      </a>

      <footer>
        <div className="fl"><img src="/logo.png" alt="" style={{height:28,marginRight:6,verticalAlign:"middle"}} />Medu <span className="d">3D</span></div>
        <p>{t.footer.tag}</p>
        <p style={{marginTop:4}}>© {new Date().getFullYear()} Medu 3D · {t.footer.rights}</p>
        <p style={{marginTop:12,display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}>
          <button onClick={() => goPage("privacy")} style={{background:"none",border:"none",color:"var(--fg3)",fontSize:12,cursor:"pointer",fontFamily:"Montserrat",textDecoration:"underline"}}>
            {lang === "es" ? "Política de Privacidad" : "Privacy Policy"}
          </button>
          <button onClick={() => goPage("terms")} style={{background:"none",border:"none",color:"var(--fg3)",fontSize:12,cursor:"pointer",fontFamily:"Montserrat",textDecoration:"underline"}}>
            {lang === "es" ? "Términos y Condiciones" : "Terms & Conditions"}
          </button>
          <a href="mailto:contacto@medu3d.com" style={{color:"var(--fg3)",fontSize:12,textDecoration:"underline"}}>contacto@medu3d.com</a>
        </p>
      </footer>
    </>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   CatalogPage — with region, price and tissue filters
   ═══════════════════════════════════════════════════════════════════════════ */
function CatalogPage({ t, lang, cart, addCart, goProd }) {
  const tc = t.catalog;
  const es = lang === "es";
  const [filterRegion, setFilterRegion] = useState("");
  const [filterTissue, setFilterTissue] = useState("");
  const [filterPrice, setFilterPrice] = useState("");

  const regions = {
    cabeza:      { es: "Cabeza",      en: "Head" },
    torax:       { es: "Tórax",       en: "Thorax" },
    abdomen:     { es: "Abdomen",     en: "Abdomen" },
    pelvis:      { es: "Pelvis",      en: "Pelvis" },
    columna:     { es: "Columna",     en: "Spine" },
    extremidades:{ es: "Extremidades",en: "Extremities" },
  };
  const tissues = {
    oseo:          { es: "Óseo",          en: "Bone" },
    cardiovascular:{ es: "Cardiovascular",en: "Cardiovascular" },
    nervioso:      { es: "Nervioso",      en: "Neural" },
    respiratorio:  { es: "Respiratorio",  en: "Respiratory" },
    visceral:      { es: "Visceral",      en: "Visceral" },
  };

  const filtered = P.filter(p => {
    if (filterRegion && p.region !== filterRegion) return false;
    if (filterTissue && p.tissue !== filterTissue) return false;
    if (filterPrice === "under40" && p.priceSlt >= 40) return false;
    if (filterPrice === "40to50" && (p.priceSlt < 40 || p.priceSlt > 50)) return false;
    if (filterPrice === "over50" && p.priceSlt <= 50) return false;
    return true;
  });

  const isFiltered = filterRegion || filterTissue || filterPrice;

  return (
    <div className="cat">
      <div className="cat-h"><h2>{tc.title}</h2><p>{tc.subtitle}</p></div>

      {/* Filter bar */}
      <div className="cat-filters">
        <div className="cat-filter-group">
          <span className="cat-filter-label">{es ? "Región" : "Region"}</span>
          <select className="cat-filter-select" value={filterRegion} onChange={e => setFilterRegion(e.target.value)}>
            <option value="">{es ? "Todas" : "All"}</option>
            {Object.entries(regions).map(([k,v]) => <option key={k} value={k}>{v[lang]}</option>)}
          </select>
        </div>
        <div className="cat-filter-sep" />
        <div className="cat-filter-group">
          <span className="cat-filter-label">{es ? "Tejido" : "Tissue"}</span>
          <select className="cat-filter-select" value={filterTissue} onChange={e => setFilterTissue(e.target.value)}>
            <option value="">{es ? "Todos" : "All"}</option>
            {Object.entries(tissues).map(([k,v]) => <option key={k} value={k}>{v[lang]}</option>)}
          </select>
        </div>
        <div className="cat-filter-sep" />
        <div className="cat-filter-group">
          <span className="cat-filter-label">{es ? "Precio" : "Price"}</span>
          <select className="cat-filter-select" value={filterPrice} onChange={e => setFilterPrice(e.target.value)}>
            <option value="">{es ? "Cualquier precio" : "Any price"}</option>
            <option value="under40">{es ? "Menos de $40" : "Under $40"}</option>
            <option value="40to50">$40 – $50</option>
            <option value="over50">{es ? "Más de $50" : "Over $50"}</option>
          </select>
        </div>
        <span className="cat-active-count">{filtered.length} {es ? "modelo" : "model"}{filtered.length !== 1 ? "s" : ""}</span>
        {isFiltered && <button className="cat-reset" onClick={() => { setFilterRegion(""); setFilterTissue(""); setFilterPrice(""); }}>{es ? "Limpiar filtros" : "Clear filters"}</button>}
      </div>

      <div className="cg">{filtered.length === 0
        ? <div style={{gridColumn:"1/-1",textAlign:"center",padding:"60px 0",color:"var(--fg3)"}}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{marginBottom:12,opacity:.4}}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <p style={{fontSize:15}}>{es ? "Ningún modelo coincide con los filtros" : "No models match the selected filters"}</p>
          </div>
        : filtered.map(p => {
          const ic = cart.find(c => c.id === p.id && c.cartType === "stl");
          return (<div className="cc" key={p.id}>
            <div className="ct" onClick={() => goProd(p)}><LazyViewer color={p.color} modelId={p.modelId} bgColor={0xe8ebf0} rotation={p.rotation||[0,0,0]} /></div>
            <div className="ci"><h3 onClick={() => goProd(p)} style={{cursor:"pointer"}}>{p.name[lang]}</h3><p className="tl">{p.tag[lang]}</p>
              <div className="cf">
                <div>
                  <span className="cp">${p.priceSlt}</span>
                  <span style={{fontSize:11,color:"var(--fg3)",marginLeft:4}}>STL</span>
                </div>
                <button className={`cb2 ${ic ? "ad" : "pr"}`} onClick={() => addCart(p, "stl")}>{ic ? tc.added : tc.addCart}</button>
              </div>
            </div>
          </div>);
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ProductDetail — página de producto con toggle STL / Maqueta
   ═══════════════════════════════════════════════════════════════════════════ */
function ProductDetail({ prod, lang, t, cart, addCart, onPaySuccess, goPage, applyDiscountFn }) {
  const [type, setType] = useState("stl"); // "stl" | "print"
  const [pdDiscount, setPdDiscount] = useState(null);
  const [pdCode, setPdCode]         = useState("");
  const [pdError, setPdError]       = useState("");
  const [pdValidating, setPdValidating] = useState(false);
  const tc = t.catalog;
  const isPrint = type === "print";
  const basePrice = isPrint ? prod.pricePrint : prod.priceSlt;
  const finalPrice = pdDiscount ? pdDiscount.total : basePrice;

  const handleApplyPdCode = async () => {
    if (!pdCode.trim()) return;
    setPdValidating(true); setPdError("");
    const result = await validateCode(pdCode.trim());
    setPdValidating(false);
    if (!result.valid) {
      const msgs = { invalid:"Código inválido o no existe", used:"Ya fue utilizado en este dispositivo", device:"Ya se usó un código en este dispositivo" };
      setPdError(msgs[result.reason] || msgs.invalid);
    } else {
      const r = applyDiscount(basePrice, result);
      setPdDiscount(r);
    }
  };

  return (
    <div className="pd">
      <button className="pd-b" onClick={() => goPage("catalog")}>{tc.back}</button>
      <div className="pd-l">
        <div className="pd-v">
          <Viewer color={prod.color} active={true} hd={true} modelId={prod.modelId} interact={true} bgColor={0xeef1f5} rotation={prod.rotation||[0,0,0]} />
        </div>
        <div className="pd-i">
          <h1>{prod.name[lang]}</h1>
          <p className="tl">{prod.tag[lang]}</p>

          {/* ── TOGGLE STL / MAQUETA ─────────────────────────────────── */}
          <div className="type-toggle">
            <button className={`tt-btn ${!isPrint ? "on" : ""}`} onClick={() => setType("stl")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
              {tc.typeStl}
            </button>
            <button className={`tt-btn ${isPrint ? "on" : ""}`} onClick={() => setType("print")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
              {tc.typePrint}
              {prod.pricePrint === null && <span className="tt-cs">{tc.comingSoon}</span>}
            </button>
          </div>

          {/* ── DESCRIPCIÓN DEL TIPO ─────────────────────────────────── */}
          <p className="type-desc">{isPrint ? tc.printDesc : tc.stlDesc}</p>

          {/* ── PRECIO ───────────────────────────────────────────────── */}
          {!isPrint && (
            <>
              <div className="pr">
                {pdDiscount ? (
                  <>
                    <span style={{textDecoration:"line-through",opacity:.4,fontSize:"0.7em",marginRight:8}}>${prod.priceSlt}</span>
                    ${pdDiscount.total.toFixed(2)}
                  </>
                ) : `$${prod.priceSlt}`}
                {" "}<span>USD</span>
              </div>
              <div className="fm">{tc.formats}: {prod.formats}</div>
              <p className="dt">{tc.desc}</p>
              <p className="dd">{prod.desc[lang]}</p>

              {/* Discount code field */}
              <div style={{margin:"16px 0 4px"}}>
                {!pdDiscount ? (
                  <>
                    <div className="cs-discount">
                      <input
                        placeholder={lang==="es" ? "Código de descuento" : "Discount code"}
                        value={pdCode}
                        onChange={e => { setPdCode(e.target.value.toUpperCase()); setPdError(""); }}
                        onKeyDown={e => e.key==="Enter" && handleApplyPdCode()}
                        disabled={pdValidating}
                        style={{fontSize:12}}
                      />
                      <button className="cs-discount-btn" onClick={handleApplyPdCode} disabled={pdValidating || !pdCode.trim()}>
                        {pdValidating ? "..." : (lang==="es" ? "Aplicar" : "Apply")}
                      </button>
                    </div>
                    {pdError && <p className="cs-discount-err">{pdError}</p>}
                  </>
                ) : (
                  <div className="cs-discount-applied" style={{marginBottom:8}}>
                    <span>{pdDiscount.label?.[lang]} · {lang==="es"?"ahorras":"you save"} ${pdDiscount.discount.toFixed(2)}</span>
                    <button className="cs-discount-remove" onClick={() => { setPdDiscount(null); setPdCode(""); setPdError(""); }}>
                      {lang==="es" ? "Quitar" : "Remove"}
                    </button>
                  </div>
                )}
              </div>

              <div className="pd-a">
                <button className={`pd-btn cart ${cart.find(c=>c.cartId===prod.id+"_stl") ? "ad" : ""}`} onClick={() => addCart(prod, "stl")}>
                  {cart.find(c=>c.cartId===prod.id+"_stl") ? tc.added : tc.addCart}
                </button>
              </div>
              <div className="pd-paypal">
                <PayPalButton
                  items={[{ ...prod, price: finalPrice, cartId: prod.id + "_stl" }]}
                  lang={lang}
                  onSuccess={(order) => {
                    if (pdDiscount?.fingerprint) markCodeUsed(pdDiscount.code, pdDiscount.fingerprint);
                    onPaySuccess(order, [{ ...prod, price: finalPrice, cartId: prod.id + "_stl" }], pdDiscount);
                  }}
                />
              </div>
            </>
          )}

          {/* ── MAQUETA PRÓXIMAMENTE ─────────────────────────────────── */}
          {isPrint && prod.pricePrint === null && (
            <div className="cs-box">
              <div className="cs-icon">🖨️</div>
              <h3>{tc.comingSoon}</h3>
              <p>{tc.comingSoonNote}</p>
              <a href="mailto:contacto@medu3d.com?subject=Notificarme — Maqueta Impresa" className="cs-cta">{tc.notifyMe} →</a>
            </div>
          )}

          {/* ── MAQUETA DISPONIBLE ───────────────────────────────────── */}
          {isPrint && prod.pricePrint !== null && (
            <>
              <div className="pr">${prod.pricePrint} <span>USD</span></div>
              <p className="dt">{tc.desc}</p>
              <p className="dd">{prod.desc[lang]}</p>
              <div className="pd-a">
                <button className={`pd-btn cart ${cart.find(c=>c.cartId===prod.id+"_print") ? "ad" : ""}`} onClick={() => addCart(prod, "print")}>
                  {cart.find(c=>c.cartId===prod.id+"_print") ? tc.added : tc.addCart}
                </button>
              </div>
              <div className="pd-paypal">
                <PayPalButton
                  items={[{ ...prod, price: prod.pricePrint, cartId: prod.id + "_print" }]}
                  lang={lang}
                  onSuccess={onPaySuccess}
                />
              </div>
            </>
          )}

          <p className="pd-h">{tc.rotate}</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   About Page
   ═══════════════════════════════════════════════════════════════════════════ */
function AboutPage({ lang }) {
  const es = lang === "es";

  return (
    <div className="ap">
      {/* Hero */}
      <div className="ap-hero">
        <div className="ap-hero-text">
          <h1>Manuel Castillo</h1>
          <h2>{es ? "Ingeniero Biomédico · Fundador de Medu 3D" : "Biomedical Engineer · Founder of Medu 3D"}</h2>
          <p className="ap-quote">
            {es
              ? "El modelado e impresión 3D están abriendo puertas a avances médicos que antes parecían imposibles. Al dominar estas herramientas, quise hacer algo simple pero poderoso: democratizar el acceso a la anatomía de precisión, y ponerla al alcance de quienes realmente la necesitan."
              : "3D modeling and printing are opening doors to medical advances that once seemed impossible. By mastering these tools, I wanted to do something simple yet powerful: democratize access to precision anatomy, and put it within reach of those who truly need it."}
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="ap-cta">
        <div>
          <h3>{es ? "¿Tienes un proyecto en mente?" : "Have a project in mind?"}</h3>
          <p>{es ? "Hablemos — cada caso es único y me encanta resolver retos técnicos." : "Let's talk — every case is unique and I love solving technical challenges."}</p>
        </div>
        <div className="ap-cta-btns">
          <a className="ap-cta-btn primary" href="https://wa.me/50662924815" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a className="ap-cta-btn secondary" href="mailto:contacto@medu3d.com">contacto@medu3d.com</a>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Quote Form — conectado a Formspree
   ═══════════════════════════════════════════════════════════════════════════ */
function QuoteForm({ t, lang }) {
  const tq = t.quote;
  const { fields, set, submit, status } = useForm(FORMSPREE_ENDPOINT);
  const es = lang === "es";

  const services = [
    { svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0b3c73" strokeWidth="2"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>, bg: "#e8f0fb", title: es ? "Segmentación desde CT/MRI" : "CT/MRI Segmentation",
      desc: es ? "Tomografías y resonancias propias convertidas en modelos 3D de alta fidelidad. Envianos tus archivos DICOM y generamos el modelo de tu caso específico." : "Your own CT or MRI scans converted into high-fidelity 3D models. Send us your DICOM files and we generate the model for your specific case." },
    { svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b45a1a" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>, bg: "#fef3e8", title: es ? "Modelos Educativos" : "Educational Models",
      desc: es ? "Anatomía humana estándar lista para usar en aula, laboratorio o presentaciones clínicas. Disponible en STL y OBJ compatibles con cualquier software." : "Standard human anatomy ready for classroom, laboratory or clinical presentations. Available in STL and OBJ compatible with any software." },
    { svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>, bg: "#edf8f1", title: es ? "Planificación Quirúrgica" : "Surgical Planning",
      desc: es ? "Modelos de precisión submilimétrica para visualizar procedimientos, diseñar guías quirúrgicas y mejorar resultados en cirugía ortopédica, maxilofacial y más." : "Sub-millimeter precision models for visualizing procedures, designing surgical guides and improving outcomes in orthopedic, maxillofacial surgery and more." },
    { svg: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#991b1b" strokeWidth="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>, bg: "#fce8e8", title: es ? "Impresión 3D Física" : "Physical 3D Printing",
      desc: es ? "Entregamos maquetas físicas impresas en resina o PLA de alta resolución. Ideal para simulación, enseñanza táctil y comunicación con pacientes." : "We deliver physical models printed in high-resolution resin or PLA. Ideal for simulation, tactile teaching and patient communication." },
  ];

  const steps = [
    { num: 1, title: es ? "Envías tus imágenes" : "Send your images",
      desc: es ? "Subís tus archivos DICOM (CT o MRI) o indicás el modelo anatómico que necesitás. También podés describirnos el caso." : "Upload your DICOM files (CT or MRI) or specify the anatomical model you need. You can also describe the case to us.",
      img: null, placeholder: es ? "Imagen: archivo DICOM en visor" : "Image: DICOM file in viewer" },
    { num: 2, title: es ? "Segmentación en 3D Slicer" : "Segmentation in 3D Slicer",
      desc: es ? "Procesamos las imágenes con 3D Slicer delimitando cada estructura anatómica con precisión clínica y detalle submilimétrico." : "We process the images with 3D Slicer, delineating each anatomical structure with clinical precision and sub-millimeter detail.",
      img: null, placeholder: es ? "Imagen: segmentación en 3D Slicer" : "Image: segmentation in 3D Slicer" },
    { num: 3, title: es ? "Revisión y refinamiento" : "Review and refinement",
      desc: es ? "Limpiamos la malla 3D, optimizamos para impresión y aplicamos acabado de superficie profesional con verificación dimensional." : "We clean the 3D mesh, optimize for printing and apply professional surface finishing with dimensional verification.",
      img: null, placeholder: es ? "Imagen: modelo refinado en vista 3D" : "Image: refined model in 3D view" },
    { num: 4, title: es ? "Entrega de archivos" : "File delivery",
      desc: es ? "Recibes los archivos en STL y OBJ listos para visualizar, imprimir o integrar en tu flujo de trabajo clínico." : "You receive the files in STL and OBJ ready to visualize, print or integrate into your clinical workflow.",
      img: null, placeholder: es ? "Imagen: archivos finales exportados" : "Image: final exported files" },
  ];

  return (
    <div className="qp">
      {/* Hero */}
      <div className="qp-hero">
        <h2>{es ? "Servicios a la Medida" : "Custom Services"}</h2>
        <p>{es ? "Desde tomografías reales hasta maquetas físicas — adaptamos cada proyecto a tus necesidades clínicas, educativas o de investigación." : "From real CT scans to physical models — we tailor each project to your clinical, educational or research needs."}</p>
      </div>

      {/* Services grid */}
      <div className="qp-services">
        {services.map((s,i) => (
          <div className="qp-svc" key={i}>
            <div className="qp-svc-icon" style={{background:s.bg}}>{s.svg}</div>
            <div><h3>{s.title}</h3><p>{s.desc}</p></div>
          </div>
        ))}
      </div>

      {/* Process steps */}
      <div className="qp-process">
        <h3>{es ? "¿Cómo funciona?" : "How does it work?"}</h3>
        <p>{es ? "Del archivo DICOM al modelo 3D listo para usar en 4 pasos" : "From DICOM file to ready-to-use 3D model in 4 steps"}</p>
        <div className="qp-steps">
          {steps.map((s,i) => (
            <div className="qp-step" key={i}>
              <div className="qp-step-img">
                {s.img
                  ? <img src={s.img} alt={s.title} />
                  : <div className="qp-step-img-placeholder">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9496ab" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                      <span>{s.placeholder}</span>
                    </div>
                }
              </div>
              <div className="qp-step-body">
                <div className="qp-step-num">{s.num}</div>
                <h4>{s.title}</h4>
                <p>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="qp-form">
        <h3>{es ? "Solicitar Cotización" : "Request a Quote"}</h3>
        <p>{es ? "Cuéntanos tu proyecto y te respondemos en menos de 24 horas" : "Tell us about your project and we'll respond within 24 hours"}</p>
        <div className="qp-form-inner">
          {status === "sent" ? (
            <div className="fok">{tq.sent}</div>
          ) : <>
            {status === "error" && <div className="ferr">{tq.error}</div>}
            <input placeholder={tq.name} value={fields.name||""} onChange={e=>set("name",e.target.value)} />
            <input type="email" placeholder={tq.email} value={fields.email||""} onChange={e=>set("email",e.target.value)} />
            <select value={fields.service||""} onChange={e=>set("service",e.target.value)}>
              <option value="">{es?"Tipo de servicio":"Service type"}</option>
              <option value="segmentacion">{es?"Segmentación CT/MRI":"CT/MRI Segmentation"}</option>
              <option value="educativo">{es?"Modelo educativo":"Educational model"}</option>
              <option value="quirurgico">{es?"Planificación quirúrgica":"Surgical planning"}</option>
              <option value="impresion">{es?"Impresión 3D física":"Physical 3D printing"}</option>
            </select>
            <textarea placeholder={tq.details} value={fields.message||""} onChange={e=>set("message",e.target.value)} />
            <button className="fs" onClick={submit} disabled={status==="sending"}>
              {status==="sending" ? tq.sending : tq.send}
            </button>
          </>}
        </div>
      </div>
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
  const es = lang === "es";
  const WA = "https://wa.me/50662924815";

  return (
    <div className="cp-wrap">
      {/* Hero */}
      <div className="cp-hero">
        <h2>{tc.title}</h2>
        <p>{es ? "Estamos disponibles para responder tus preguntas por el canal que prefieras." : "We are available to answer your questions through whichever channel you prefer."}</p>
      </div>

      {/* Channels */}
      <div className="cp-channels">
        <div className="cp-channel">
          <div className="cp-ch-icon" style={{background:"#e7faf0"}}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.532 5.86L.057 23.428a.75.75 0 00.921.921l5.568-1.475A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.712 9.712 0 01-4.964-1.362l-.355-.212-3.683.975.99-3.595-.232-.371A9.712 9.712 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
          </div>
          <h3>WhatsApp</h3>
          <p>+506 6292 4815<br/>{es?"Respuesta rápida · Lun–Vie":"Quick reply · Mon–Fri"}</p>
          <a className="cp-ch-btn green" href={WA} target="_blank" rel="noopener noreferrer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/></svg>
            {es ? "Escribir por WhatsApp" : "Message on WhatsApp"}
          </a>
        </div>

        <div className="cp-channel">
          <div className="cp-ch-icon" style={{background:"#e8f0fb"}}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0b3c73" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </div>
          <h3>Email</h3>
          <p>contacto@medu3d.com<br/>{es?"Respuesta en 24 horas":"24-hour response"}</p>
          <a className="cp-ch-btn blue" href="mailto:contacto@medu3d.com">
            {es ? "Enviar email" : "Send email"}
          </a>
        </div>

        <div className="cp-channel">
          <div className="cp-ch-icon" style={{background:"#fce8e8"}}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d64830" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </div>
          <h3>{es?"Cotización":"Quote"}</h3>
          <p>{es?"¿Necesitas un modelo personalizado?":"Need a custom model?"}<br/>{es?"Te preparamos una propuesta":"We'll prepare a proposal"}</p>
          <button className="cp-ch-btn coral" onClick={() => window.dispatchEvent(new CustomEvent('goQuote'))}>
            {es ? "Solicitar cotización" : "Request quote"}
          </button>
        </div>
      </div>

      {/* Message form */}
      <div className="cp-form-section">
        <h3>{es?"Envíanos un mensaje":"Send us a message"}</h3>
        <p>{es?"También puedes escribirnos directamente aquí":"You can also write to us directly here"}</p>
        <div className="cp-form-inner">
          {status === "sent" ? (
            <div className="fok">{tc.sent}</div>
          ) : <>
            {status === "error" && <div className="ferr">{tc.error}</div>}
            <input placeholder={tq.name} value={fields.name||""} onChange={e=>set("name",e.target.value)} />
            <input type="email" placeholder={tq.email} value={fields.email||""} onChange={e=>set("email",e.target.value)} />
            <textarea placeholder={es?"Tu mensaje":"Your message"} value={fields.message||""} onChange={e=>set("message",e.target.value)} />
            <button className="fs" onClick={submit} disabled={status==="sending"}>
              {status==="sending" ? tc.sending : tc.send}
            </button>
          </>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Legal Pages — Política de Privacidad & Términos y Condiciones
   ═══════════════════════════════════════════════════════════════════════════ */
function LegalPage({ type, lang, goPage }) {
  const es = lang === "es";
  const isPrivacy = type === "privacy";

  const sections = isPrivacy ? [
    {
      title: es ? "1. Responsable del tratamiento" : "1. Data Controller",
      body: es
        ? "Medu 3D, operado por Manuel Castillo (contacto@medu3d.com), es responsable del tratamiento de los datos personales recopilados a través de medu3d.com."
        : "Medu 3D, operated by Manuel Castillo (contacto@medu3d.com), is the data controller for personal data collected through medu3d.com.",
    },
    {
      title: es ? "2. Datos que recopilamos" : "2. Data We Collect",
      body: es
        ? "Al realizar una compra recopilamos: nombre, correo electrónico y datos de pago procesados directamente por PayPal (no almacenamos datos de tarjeta). Al contactarnos: nombre y correo electrónico. Datos de navegación: dirección IP, tipo de navegador y páginas visitadas, mediante Google Analytics."
        : "When you make a purchase we collect: name, email address and payment data processed directly by PayPal (we do not store card data). When you contact us: name and email address. Browsing data: IP address, browser type and pages visited, via Google Analytics.",
    },
    {
      title: es ? "3. Finalidad del tratamiento" : "3. Purpose of Processing",
      body: es
        ? "Usamos tus datos para: procesar y confirmar tu compra, enviarte los archivos adquiridos, responder consultas de soporte, y mejorar la experiencia del sitio mediante análisis de uso anónimo."
        : "We use your data to: process and confirm your purchase, send you purchased files, answer support inquiries, and improve site experience through anonymous usage analytics.",
    },
    {
      title: es ? "4. Compartición de datos" : "4. Data Sharing",
      body: es
        ? "No vendemos ni compartimos tus datos con terceros, salvo los necesarios para procesar el pago (PayPal) y analítica de uso (Google Analytics). Ambos servicios tienen sus propias políticas de privacidad."
        : "We do not sell or share your data with third parties, except those necessary to process payment (PayPal) and usage analytics (Google Analytics). Both services have their own privacy policies.",
    },
    {
      title: es ? "5. Cookies" : "5. Cookies",
      body: es
        ? "Usamos cookies técnicas necesarias para el funcionamiento del sitio y cookies de analítica de Google Analytics, que puedes rechazar desactivando JavaScript o usando extensiones de bloqueo."
        : "We use technical cookies necessary for site operation and Google Analytics cookies, which you can reject by disabling JavaScript or using blocking extensions.",
    },
    {
      title: es ? "6. Tus derechos" : "6. Your Rights",
      body: es
        ? "Tienes derecho a acceder, rectificar o eliminar tus datos personales. Para ejercerlos, escríbenos a contacto@medu3d.com."
        : "You have the right to access, rectify or delete your personal data. To exercise them, email us at contacto@medu3d.com.",
    },
    {
      title: es ? "7. Cambios a esta política" : "7. Changes to This Policy",
      body: es
        ? "Podemos actualizar esta política ocasionalmente. La versión vigente siempre estará disponible en esta página con su fecha de actualización."
        : "We may occasionally update this policy. The current version will always be available on this page with its update date.",
    },
  ] : [
    {
      title: es ? "1. Aceptación de los términos" : "1. Acceptance of Terms",
      body: es
        ? "Al acceder y usar medu3d.com, aceptas estar sujeto a estos Términos y Condiciones. Si no estás de acuerdo, por favor no utilices el sitio."
        : "By accessing and using medu3d.com, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the site.",
    },
    {
      title: es ? "2. Productos digitales" : "2. Digital Products",
      body: es
        ? "Los modelos anatómicos 3D son archivos digitales en formato STL y/u OBJ. Al completar tu compra recibirás acceso inmediato a los archivos. Por la naturaleza digital del producto, no se aceptan devoluciones una vez descargado el archivo."
        : "The 3D anatomical models are digital files in STL and/or OBJ format. Upon completing your purchase you will receive immediate access to the files. Due to the digital nature of the product, refunds are not accepted once the file has been downloaded.",
    },
    {
      title: es ? "3. Licencia de uso" : "3. License of Use",
      body: es
        ? "Al adquirir un modelo, obtienes una licencia personal, no exclusiva e intransferible para uso educativo, de investigación o impresión privada. No se permite la reventa, redistribución ni el uso comercial sin autorización escrita de Medu 3D."
        : "By purchasing a model, you obtain a personal, non-exclusive, non-transferable license for educational, research or private printing use. Resale, redistribution or commercial use without written authorization from Medu 3D is not permitted.",
    },
    {
      title: es ? "4. Precisión de los modelos" : "4. Model Accuracy",
      body: es
        ? "Los modelos son generados desde imágenes médicas reales con fines educativos. No están destinados a diagnóstico clínico, planificación quirúrgica real ni ningún uso médico directo sin supervisión profesional."
        : "The models are generated from real medical images for educational purposes. They are not intended for clinical diagnosis, real surgical planning, or any direct medical use without professional supervision.",
    },
    {
      title: es ? "5. Pagos" : "5. Payments",
      body: es
        ? "Los pagos se procesan de forma segura a través de PayPal. Medu 3D no almacena datos de tarjetas de crédito. Todos los precios están en USD e incluyen los archivos indicados en cada producto."
        : "Payments are processed securely through PayPal. Medu 3D does not store credit card data. All prices are in USD and include the files indicated in each product.",
    },
    {
      title: es ? "6. Propiedad intelectual" : "6. Intellectual Property",
      body: es
        ? "Todos los modelos 3D, imágenes, textos y diseños de medu3d.com son propiedad de Medu 3D. Queda prohibida su reproducción total o parcial sin autorización expresa."
        : "All 3D models, images, texts and designs on medu3d.com are the property of Medu 3D. Total or partial reproduction without express authorization is prohibited.",
    },
    {
      title: es ? "7. Limitación de responsabilidad" : "7. Limitation of Liability",
      body: es
        ? "Medu 3D no se hace responsable por daños derivados del uso inadecuado de los modelos, incompatibilidad de software de terceros, o interrupciones del servicio fuera de nuestro control."
        : "Medu 3D is not responsible for damages resulting from improper use of the models, incompatibility with third-party software, or service interruptions beyond our control.",
    },
    {
      title: es ? "8. Legislación aplicable" : "8. Governing Law",
      body: es
        ? "Estos términos se rigen por la legislación vigente en Costa Rica. Cualquier disputa se someterá a los tribunales competentes de San José, Costa Rica."
        : "These terms are governed by the laws in force in Costa Rica. Any dispute shall be submitted to the competent courts of San José, Costa Rica.",
    },
  ];

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "100px 48px 60px" }}>
      <button
        onClick={() => goPage("home")}
        style={{ display:"inline-flex",alignItems:"center",gap:8,background:"var(--bg2)",border:"1.5px solid rgba(0,0,0,0.08)",color:"var(--fg2)",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"Montserrat",marginBottom:32,padding:"10px 20px",borderRadius:10,transition:"all .2s" }}
        onMouseOver={e=>{e.currentTarget.style.color="var(--ac)";e.currentTarget.style.borderColor="var(--ac)"}}
        onMouseOut={e=>{e.currentTarget.style.color="var(--fg2)";e.currentTarget.style.borderColor="rgba(0,0,0,0.08)"}}
      >← {es ? "Volver" : "Back"}</button>

      <h1 style={{ fontSize:"clamp(24px,4vw,36px)", fontWeight:800, marginBottom:8 }}>
        {isPrivacy
          ? (es ? "Política de Privacidad" : "Privacy Policy")
          : (es ? "Términos y Condiciones" : "Terms & Conditions")}
      </h1>
      <p style={{ color:"var(--fg3)", fontSize:13, marginBottom:40 }}>
        {es ? "Última actualización: marzo 2026" : "Last updated: March 2026"}
      </p>

      <div style={{ display:"flex", flexDirection:"column", gap:28 }}>
        {sections.map((s, i) => (
          <div key={i}>
            <h2 style={{ fontSize:16, fontWeight:700, marginBottom:8, color:"var(--fg)" }}>{s.title}</h2>
            <p style={{ fontSize:14, color:"var(--fg2)", lineHeight:1.75 }}>{s.body}</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop:48, padding:"20px 24px", background:"var(--bg3)", borderRadius:12 }}>
        <p style={{ fontSize:13, color:"var(--fg2)" }}>
          {es
            ? <>¿Tienes preguntas? Escríbenos a <a href="mailto:contacto@medu3d.com" style={{color:"var(--ac)"}}>contacto@medu3d.com</a></>
            : <>Questions? Email us at <a href="mailto:contacto@medu3d.com" style={{color:"var(--ac)"}}>contacto@medu3d.com</a></>}
        </p>
      </div>
    </div>
  );
}
