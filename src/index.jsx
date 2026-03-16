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
  { id: "heart",
    priceSlt: 54.99, pricePrint: null,
    hostedBtn: "MDVGEXSZCHEQY", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#e05555", geo: "heart",
    name: { es: "Corazón Humano", en: "Human Heart" },
    tag: { es: "4 cámaras · Válvulas · Grandes vasos", en: "4 chambers · Valves · Great vessels" },
    desc: { es: "Modelo detallado del corazón humano completo con las 4 cámaras cardíacas, válvulas y grandes vasos. Segmentado desde CT con contraste. Ideal para educación cardiovascular y planificación quirúrgica.", en: "Detailed model of the complete human heart with all 4 cardiac chambers, valves and great vessels. Segmented from contrast CT. Ideal for cardiovascular education and surgical planning." },
  },
  { id: "brain",
    priceSlt: 49.99, pricePrint: null,
    hostedBtn: "49659K538LTZ6", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#c98a90", geo: "brain",
    name: { es: "Cerebro", en: "Brain" },
    tag: { es: "Hemisferios · Surcos · Cerebelo", en: "Hemispheres · Sulci · Cerebellum" },
    desc: { es: "Modelo cerebral con surcos y circunvoluciones detalladas, hemisferios separados, cerebelo y tronco encefálico. Segmentado desde MRI T1. Para neurociencia y educación.", en: "Brain model with detailed sulci and gyri, separated hemispheres, cerebellum and brainstem. Segmented from T1 MRI. For neuroscience and education." },
  },
  { id: "lungs",
    priceSlt: 49.99, pricePrint: null,
    hostedBtn: "8BZZW5EGQNZAJ", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#e8a0b0", geo: "lungs",
    name: { es: "Pulmones", en: "Lungs" },
    tag: { es: "Pulmón izq. y der. · Árbol bronquial", en: "Left & right lung · Bronchial tree" },
    desc: { es: "Modelo de pulmones con diferenciación de pulmón izquierdo y derecho, árbol bronquial y estructuras vasculares. Segmentado desde CT de tórax. Para neumología y educación médica.", en: "Lung model with differentiated left and right lungs, bronchial tree and vascular structures. Segmented from chest CT. For pulmonology and medical education." },
  },
  { id: "liver",
    priceSlt: 44.99, pricePrint: null,
    hostedBtn: "FJJB3XH8FURZY", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#b5703a", geo: "liver",
    name: { es: "Hígado", en: "Liver" },
    tag: { es: "Lóbulos · Vesícula · Vasculatura", en: "Lobes · Gallbladder · Vasculature" },
    desc: { es: "Modelo hepático con segmentación de lóbulos, vesícula biliar y vasculatura portal y hepática. Segmentado desde CT con contraste. Para hepatología y cirugía.", en: "Hepatic model with lobe segmentation, gallbladder and portal and hepatic vasculature. Segmented from contrast CT. For hepatology and surgery." },
  },
  { id: "skull",
    priceSlt: 44.99, pricePrint: null,
    hostedBtn: "C757MAF6AM8YA", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#c4a882", geo: "skull",
    name: { es: "Cráneo Adulto", en: "Adult Skull" },
    tag: { es: "Mandíbula articulada · Alta resolución", en: "Articulated mandible · High resolution" },
    desc: { es: "Cráneo completo con mandíbula separable. Incluye suturas craneales, forámenes y procesos óseos. Segmentado desde CT de alta resolución (0.5mm). Para educación anatómica y odontología.", en: "Complete skull with separable mandible. Includes cranial sutures, foramina and bony processes. Segmented from high-resolution CT (0.5mm). For anatomical education and dentistry." },
  },
  { id: "hand",
    priceSlt: 44.99, pricePrint: null,
    hostedBtn: "6U65AC2JJEXFL", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#d4b896", geo: "hand",
    name: { es: "Huesos de la Mano", en: "Hand Bones" },
    tag: { es: "27 huesos · Carpo · Metacarpo · Falanges", en: "27 bones · Carpals · Metacarpals · Phalanges" },
    desc: { es: "Conjunto completo de los 27 huesos de la mano: huesos del carpo, metacarpianos y falanges. Segmentado desde CT de alta resolución. Ideal para cirugía ortopédica y traumatología.", en: "Complete set of 27 hand bones: carpal bones, metacarpals and phalanges. Segmented from high-resolution CT. Ideal for orthopedic surgery and traumatology." },
  },
  { id: "foot",
    priceSlt: 44.99, pricePrint: null,
    hostedBtn: "DHLY63KNSUSFU", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#c8b090", geo: "foot",
    name: { es: "Huesos del Pie", en: "Foot Bones" },
    tag: { es: "26 huesos · Tarso · Metatarso · Falanges", en: "26 bones · Tarsals · Metatarsals · Phalanges" },
    desc: { es: "Conjunto completo de los 26 huesos del pie: tarso, metatarsianos y falanges. Segmentado desde CT. Para podología, ortopedia y biomecánica.", en: "Complete set of 26 foot bones: tarsals, metatarsals and phalanges. Segmented from CT. For podiatry, orthopedics and biomechanics." },
  },
  { id: "spine",
    priceSlt: 44.99, pricePrint: null,
    hostedBtn: "637LDGMDRNE5N", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#7a8fa3", geo: "spine",
    name: { es: "Columna Lumbar", en: "Lumbar Spine" },
    tag: { es: "L1-L5 · Discos intervertebrales", en: "L1-L5 · Intervertebral discs" },
    desc: { es: "Vértebras L1-L5 con discos intervertebrales diferenciados. Detalle de procesos espinosos, transversos y articulares. Para estudio ortopédico y quirúrgico.", en: "L1-L5 vertebrae with differentiated intervertebral discs. Detail of spinous, transverse and articular processes. For orthopedic and surgical study." },
  },
  { id: "kidney",
    priceSlt: 39.99, pricePrint: null,
    hostedBtn: "22N8FEKMP8FAY", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#9e6b5a", geo: "kidney",
    name: { es: "Riñón con Vasculatura", en: "Kidney with Vasculature" },
    tag: { es: "Arterias · Venas renales · Uréter", en: "Arteries · Renal veins · Ureter" },
    desc: { es: "Riñón con arterias y venas renales diferenciadas, uréter y cápsula renal. Para nefrología, urología y educación.", en: "Kidney with color-differentiated renal arteries and veins, ureter and renal capsule. For nephrology, urology and education." },
  },
  { id: "pelvis",
    priceSlt: 39.99, pricePrint: null,
    hostedBtn: "UCHEK3PJFQMBW", hostedBtnPrint: null,
    formats: ".STL, .OBJ", color: "#b5a48a", geo: "pelvis",
    name: { es: "Pelvis Completa", en: "Complete Pelvis" },
    tag: { es: "Ilíacos · Sacro · Cóccix", en: "Iliac bones · Sacrum · Coccyx" },
    desc: { es: "Huesos ilíacos, sacro y cóccix con detalle cortical completo. Segmentado desde CT de trauma. Para ortopedia y planificación quirúrgica.", en: "Iliac bones, sacrum and coccyx with full cortical detail. Segmented from trauma CT. For orthopedics and surgical planning." },
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
   PayPal Checkout Component
   ─────────────────────────────────────────────────────────────────────────
   Estrategia robusta de 2 capas:
   1) Intenta cargar el SDK con enable-funding=card y card-fields
      → muestra botón PayPal + formulario de tarjeta inline sin cuenta
   2) Si el SDK falla (localhost, dominio no aprobado, bloqueado por ad-blocker)
      → muestra botón nativo que abre ventana PayPal con monto pre-cargado
   ═══════════════════════════════════════════════════════════════════════════ */

// URL de fallback: abre PayPal con monto y descripción, acepta tarjeta sin cuenta
function paypalFallbackUrl(items, lang) {
  const total = items.reduce((s, p) => s + p.price, 0).toFixed(2);
  const desc = items.map(p => p.name[lang]).join(", ");
  // PayPal checkout directo — el cliente puede pagar con tarjeta sin login
  return `https://www.paypal.com/checkoutnow?token=&useraction=commit&amount=${total}&currencyCode=USD&description=${encodeURIComponent("Medu 3D: " + desc)}`;
}

function PayPalCheckout({ items, lang, onSuccess }) {
  const containerRef = useRef(null);
  const cardFieldsRef = useRef(null);
  const buttonsRef = useRef(null);
  const [sdkStatus, setSdkStatus] = useState("loading"); // loading | ready | failed
  const [paying, setPaying] = useState(false);
  const [cardError, setCardError] = useState("");
  const [showCardForm, setShowCardForm] = useState(false);

  const total = items.reduce((s, p) => s + p.price, 0).toFixed(2);
  const itemKey = items.map(i => i.id).join(",");

  // Limpia instancias previas de PayPal
  const cleanup = () => {
    if (buttonsRef.current) { try { buttonsRef.current.close(); } catch {} buttonsRef.current = null; }
    if (cardFieldsRef.current) { try { cardFieldsRef.current.close(); } catch {} cardFieldsRef.current = null; }
    if (containerRef.current) containerRef.current.innerHTML = "";
    ["pp-card-number","pp-card-expiry","pp-card-cvv","pp-card-name"].forEach(id => {
      const el = document.getElementById(id); if (el) el.innerHTML = "";
    });
  };

  useEffect(() => {
    if (!items.length) return;
    setSdkStatus("loading");
    setShowCardForm(false);
    cleanup();

    const loadSDK = () => new Promise((resolve, reject) => {
      // Elimina SDK anterior si tenía parámetros distintos
      const existing = document.getElementById("paypal-sdk");
      if (existing) existing.remove();
      delete window.paypal;

      const script = document.createElement("script");
      script.id = "paypal-sdk";
      // enable-funding=card  → muestra botón "Pagar con tarjeta" + Card Fields
      // components=buttons,card-fields → habilita formulario de tarjeta inline
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD&intent=capture&enable-funding=card&components=buttons,card-fields`;
      script.setAttribute("data-page-type", "checkout");
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    const createOrder = () => {
      const itemList = items.map(p => ({
        name: p.name[lang] || p.name.es,
        unit_amount: { currency_code: "USD", value: p.price.toFixed(2) },
        quantity: "1",
      }));
      return window.paypal.Orders.create({
        purchase_units: [{
          description: "Medu 3D — Modelos Anatómicos 3D",
          amount: {
            currency_code: "USD",
            value: total,
            breakdown: { item_total: { currency_code: "USD", value: total } },
          },
          items: itemList,
        }],
      }).then(o => o.id);
    };

    const createOrderActions = (data, actions) => {
      const itemList = items.map(p => ({
        name: p.name[lang] || p.name.es,
        unit_amount: { currency_code: "USD", value: p.price.toFixed(2) },
        quantity: "1",
      }));
      return actions.order.create({
        purchase_units: [{
          description: "Medu 3D — Modelos Anatómicos 3D",
          amount: {
            currency_code: "USD",
            value: total,
            breakdown: { item_total: { currency_code: "USD", value: total } },
          },
          items: itemList,
        }],
      });
    };

    const renderPayPal = async () => {
      await loadSDK();
      if (!window.paypal || !containerRef.current) { setSdkStatus("failed"); return; }

      // ── Botón PayPal estándar ──────────────────────────────────────────
      buttonsRef.current = window.paypal.Buttons({
        style: { layout: "vertical", color: "blue", shape: "rect", label: "pay", height: 44 },
        createOrder: createOrderActions,
        onApprove: async (data, actions) => {
          const order = await actions.order.capture();
          if (onSuccess) onSuccess(order);
        },
        onError: (err) => { console.error("PayPal buttons error:", err); setSdkStatus("failed"); },
      });

      if (buttonsRef.current.isEligible() && containerRef.current) {
        await buttonsRef.current.render(containerRef.current);
      }

      // ── Card Fields (formulario de tarjeta inline) ─────────────────────
      if (window.paypal.CardFields) {
        const fields = window.paypal.CardFields({
          createOrder: createOrder,
          onApprove: async (data) => {
            setPaying(true);
            setCardError("");
            try {
              const res = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${data.orderID}/capture`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
              });
              const order = await res.json();
              if (onSuccess) onSuccess(order);
            } catch (e) {
              setCardError(lang === "es" ? "Error al procesar el pago. Intenta de nuevo." : "Payment error. Please try again.");
            } finally { setPaying(false); }
          },
          onError: (err) => {
            console.error("Card fields error:", err);
            setCardError(lang === "es" ? "Error con la tarjeta. Verifica los datos." : "Card error. Please check your details.");
            setPaying(false);
          },
          style: {
            input: { "font-family": "Montserrat, sans-serif", "font-size": "14px", "color": "#15172a" },
            ".invalid": { "color": "#e05555" },
          },
        });

        if (fields.isEligible()) {
          cardFieldsRef.current = fields;
          const mountIfExists = (id, mountFn) => {
            const el = document.getElementById(id); if (el) mountFn(el);
          };
          mountIfExists("pp-card-number", el => fields.NumberField().render(el));
          mountIfExists("pp-card-expiry", el => fields.ExpiryField().render(el));
          mountIfExists("pp-card-cvv", el => fields.CVVField().render(el));
          mountIfExists("pp-card-name", el => fields.NameField && fields.NameField().render(el));
          setShowCardForm(true);
        }
      }

      setSdkStatus("ready");
    };

    renderPayPal().catch((err) => {
      console.warn("PayPal SDK falló, usando fallback:", err);
      setSdkStatus("failed");
    });

    return cleanup;
  }, [itemKey, total, lang]);

  if (!items.length) return null;

  // ── FALLBACK: SDK no disponible (localhost / dominio no aprobado) ──────
  if (sdkStatus === "failed") {
    return (
      <div style={{ marginTop: 4 }}>
        <a
          href={`https://www.paypal.com/pay?receiver=manuelczelaya%40gmail.com&amount=${total}&currency_code=USD&item_name=${encodeURIComponent("Medu 3D (" + items.map(p => p.name[lang]).join(", ") + ")")}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            width: "100%", padding: "13px 20px", background: "#0070BA", color: "#fff",
            borderRadius: 10, textDecoration: "none", fontFamily: "Montserrat, sans-serif",
            fontWeight: 700, fontSize: 15, transition: "background .2s",
          }}
          onMouseOver={e => e.currentTarget.style.background = "#003087"}
          onMouseOut={e => e.currentTarget.style.background = "#0070BA"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.59 3.025-2.566 4.643-5.813 4.643h-2.19a.96.96 0 0 0-.949.813l-1.12 7.107-.31 1.964a.42.42 0 0 0 .416.49h2.938l.478-3.018.03-.174a.96.96 0 0 1 .948-.814h.599c3.863 0 6.888-1.57 7.772-6.106.37-1.9.179-3.488-.751-4.618z"/>
          </svg>
          {lang === "es" ? `Pagar $${total} con PayPal / Tarjeta` : `Pay $${total} with PayPal / Card`}
        </a>
        <p style={{ fontSize: 11, color: "var(--fg3)", textAlign: "center", marginTop: 8 }}>
          {lang === "es"
            ? "Se abrirá PayPal — puedes pagar con tarjeta sin crear cuenta"
            : "PayPal will open — you can pay by card without an account"}
        </p>
      </div>
    );
  }

  // ── LOADING ────────────────────────────────────────────────────────────
  if (sdkStatus === "loading") {
    return (
      <div style={{ padding: "16px 0", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--fg3)", fontSize: 13 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          {lang === "es" ? "Cargando métodos de pago..." : "Loading payment methods..."}
        </div>
      </div>
    );
  }

  // ── SDK CARGADO: Botón PayPal + Formulario de tarjeta ─────────────────
  return (
    <div>
      {/* Contenedor del botón PayPal estándar */}
      <div ref={containerRef} style={{ width: "100%", minHeight: 44 }} />

      {/* Formulario de tarjeta inline (Card Fields) */}
      {showCardForm && (
        <div style={{ marginTop: 12, border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: "16px 14px", background: "var(--bg2)" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--fg3)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.8px" }}>
            {lang === "es" ? "— O paga con tarjeta —" : "— Or pay with card —"}
          </p>
          <div id="pp-card-number" style={cardFieldStyle} />
          <div style={{ display: "flex", gap: 10 }}>
            <div id="pp-card-expiry" style={{ ...cardFieldStyle, flex: 1 }} />
            <div id="pp-card-cvv" style={{ ...cardFieldStyle, flex: 1 }} />
          </div>
          <div id="pp-card-name" style={cardFieldStyle} />
          {cardError && <p style={{ color: "#e05555", fontSize: 12, marginBottom: 8 }}>{cardError}</p>}
          <button
            onClick={() => { if (cardFieldsRef.current) { setPaying(true); cardFieldsRef.current.submit().catch(e => { setPaying(false); setCardError(lang === "es" ? "Verifica los datos de tu tarjeta." : "Check your card details."); }); }}}
            disabled={paying}
            style={{
              width: "100%", padding: "12px", background: paying ? "var(--fg3)" : "var(--ac)",
              color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: paying ? "not-allowed" : "pointer", fontFamily: "Montserrat, sans-serif",
              marginTop: 4, transition: "background .2s",
            }}
          >
            {paying
              ? (lang === "es" ? "Procesando..." : "Processing...")
              : (lang === "es" ? `Pagar con tarjeta $${total}` : `Pay by card $${total}`)}
          </button>
        </div>
      )}
    </div>
  );
}

const cardFieldStyle = {
  height: 42, border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9,
  marginBottom: 10, padding: "0 4px", background: "var(--bg)",
  overflow: "hidden",
};
/* ════════════════════════════════════════════════════════════════════════════
/* ═══════════════════════════════════════════════════════════════════════════
   Acepta tarjeta directamente sin cuenta PayPal
   ═══════════════════════════════════════════════════════════════════════════ */
function HostedPayPalButton({ hostedBtnId, lang }) {
  if (!hostedBtnId) return null;

  const handleClick = () => {
    const form = document.createElement("form");
    form.action = "https://www.paypal.com/cgi-bin/webscr";
    form.method = "post";
    form.target = "_blank";
    const fields = [["cmd","_s-xclick"],["hosted_button_id",hostedBtnId],["currency_code","USD"]];
    fields.forEach(([n,v]) => {
      const inp = document.createElement("input");
      inp.type = "hidden"; inp.name = n; inp.value = v;
      form.appendChild(inp);
    });
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={handleClick}
        style={{
          width: "100%", padding: "13px 20px",
          background: "#0070BA", color: "#fff", border: "none",
          borderRadius: 10, fontFamily: "Montserrat, sans-serif",
          fontWeight: 700, fontSize: 15, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          transition: "background .2s",
        }}
        onMouseOver={e => e.currentTarget.style.background = "#003087"}
        onMouseOut={e => e.currentTarget.style.background = "#0070BA"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.59 3.025-2.566 4.643-5.813 4.643h-2.19a.96.96 0 0 0-.949.813l-1.12 7.107-.31 1.964a.42.42 0 0 0 .416.49h2.938l.478-3.018.03-.174a.96.96 0 0 1 .948-.814h.599c3.863 0 6.888-1.57 7.772-6.106.37-1.9.179-3.488-.751-4.618z"/>
        </svg>
        {lang === "es" ? "Comprar ahora · PayPal / Tarjeta" : "Buy now · PayPal / Card"}
      </button>
      <p style={{ fontSize: 11, color: "var(--fg3)", textAlign: "center", marginTop: 7 }}>
        {lang === "es"
          ? "→ Ingresa tu email → clic Siguiente → aparecerá el formulario de tarjeta (Visa / Mastercard / Amex)"
          : "→ Enter your email → click Next → card form will appear (Visa / Mastercard / Amex)"}
      </p>
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

function Viewer({ color, active, hd = false, interact = false, bgColor = 0xeef1f5 }) {
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

    const url = hd ? "/model_hd.glb" : "/model.stl";
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
  }, [active, color, hd, interact, bgColor]);

  return <div ref={ref} style={{width:"100%",height:"100%"}} />;
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
  const [phase, setPhase] = useState("idle"); // idle | out | in
  const [nextHi, setNextHi] = useState(0);
  const [dir, setDir] = useState(1); // 1=forward -1=backward
  const [paymentDone, setPaymentDone] = useState(false);
  const busy = useRef(false);

  const t = T[lang];

  const hiRef = useRef(0);
  const phaseRef = useRef("idle");

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
    if (page !== "home") return;
    const iv = setInterval(() => {
      const nxt = (hiRef.current + 1) % P.length;
      goTo(nxt, 1);
    }, 7500);
    return () => clearInterval(iv);
  }, [page, goTo]);

  const addCart = (p, type) => {
    const item = makeCartItem(p, type);
    if (!cart.find(c => c.cartId === item.cartId)) setCart([...cart, item]);
  };
  const rmCart = cartId => setCart(cart.filter(c => c.cartId !== cartId));
  const total = cart.reduce((s, p) => s + p.price, 0).toFixed(2);
  const goProd = p => {
    setPageVisible(false);
    setTimeout(() => {
      setSelProd(p);
      setPage("product");
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

  const handlePaymentSuccess = (order) => {
    setPaymentDone(true);
    setCart([]);
    setCartOpen(false);
  };

  return (
    <>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,600&display=swap');
:root { --bg:#f6f7fa; --bg2:#fff; --bg3:#eceef3; --vbg:#e8ebf0; --fg:#15172a; --fg2:#555770; --fg3:#9496ab; --ac:#0891b2; --ac2:#06b6d4; --acs:rgba(8,145,178,0.07); --rd:16px; --sh:0 2px 16px rgba(0,0,0,0.05); }
*{margin:0;padding:0;box-sizing:border-box}
body,html{background:var(--bg);color:var(--fg);font-family:'Montserrat',sans-serif;font-weight:400;-webkit-font-smoothing:antialiased;scroll-behavior:smooth}
h1,h2,h3{font-family:'Montserrat',sans-serif;font-weight:700}

nav{position:fixed;top:0;left:0;right:0;padding:20px 48px;display:flex;align-items:center;justify-content:space-between;background:rgba(246,247,250,0.92);backdrop-filter:blur(20px);z-index:200;border-bottom:1px solid rgba(0,0,0,0.06)}
.logo{font-family:'Montserrat',sans-serif;font-size:28px;cursor:pointer;display:flex;gap:0;align-items:center;font-weight:800;letter-spacing:-0.5px}.logo .m{color:#0b3c73}.logo .d{color:#d64830}.logo img{height:44px;width:auto;object-fit:contain;margin-right:10px}
.nl{display:flex;gap:6px;align-items:center;list-style:none}
.nb{background:none;border:1px solid transparent;color:var(--fg2);padding:8px 16px;border-radius:10px;cursor:pointer;font-size:13px;font-family:'Montserrat';font-weight:500;transition:all .2s;position:relative}
.nb:hover,.nb.on{background:var(--acs);color:var(--ac);border-color:rgba(8,145,178,0.1)}
.cb{position:absolute;top:2px;right:2px;width:17px;height:17px;background:var(--ac);color:#fff;border-radius:50%;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:700}
.lb{background:var(--bg3);border:none;color:var(--fg2);padding:6px 12px;border-radius:8px;cursor:pointer;font-size:11px;font-family:'Montserrat';font-weight:600;letter-spacing:.5px;transition:all .2s}.lb:hover{background:var(--acs);color:var(--ac)}
.hb{display:none;background:none;border:none;color:var(--fg);cursor:pointer;padding:4px}
.mm{display:none;position:fixed;top:54px;left:0;right:0;bottom:0;background:rgba(246,247,250,0.98);z-index:199;flex-direction:column;align-items:center;justify-content:center;gap:28px}.mm.open{display:flex}
.mm button{background:none;border:none;color:var(--fg);font-family:'Montserrat',sans-serif;font-size:26px;cursor:pointer}

/* HERO */
.hero{min-height:100vh;display:flex;align-items:center;padding:90px 48px 40px;gap:0;max-width:1440px;margin:0 auto;overflow:hidden;position:relative}
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
.cat-h{text-align:center;margin-bottom:44px}.cat-h h2{font-size:clamp(26px,4vw,40px);margin-bottom:8px}.cat-h p{color:var(--fg2);font-size:15px}
.cg{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px}
.cc{background:var(--bg2);border:1px solid rgba(0,0,0,0.04);border-radius:var(--rd);overflow:hidden;cursor:pointer;transition:all .3s}.cc:hover{border-color:rgba(8,145,178,0.12);box-shadow:var(--sh);transform:translateY(-3px)}
.ct{height:190px;background:var(--vbg);display:flex;align-items:center;justify-content:center}.ct svg{opacity:.45}
.ci{padding:18px}.ci h3{font-size:17px;margin-bottom:3px;font-family:'Montserrat';font-weight:600}.ci .tl{font-size:12px;color:var(--fg3);margin-bottom:12px}
.cf{display:flex;justify-content:space-between;align-items:center}
.cp{font-family:'Montserrat',sans-serif;font-size:22px}
.cb2{padding:8px 16px;border-radius:10px;border:none;font-size:12px;font-weight:600;cursor:pointer;font-family:'Montserrat';transition:all .2s}.cb2.pr{background:var(--ac);color:#fff}.cb2.pr:hover{background:var(--ac2)}.cb2.ad{background:var(--acs);color:var(--ac)}

/* PRODUCT DETAIL */
.pd{padding:90px 48px 40px;max-width:1200px;margin:0 auto}
.pd-b{background:none;border:none;color:var(--fg2);font-size:14px;cursor:pointer;font-family:'Montserrat';margin-bottom:20px;padding:0;transition:color .2s}.pd-b:hover{color:var(--ac)}
.pd-l{display:grid;grid-template-columns:1fr 1fr;gap:36px;align-items:start}
.pd-v{height:480px;border-radius:20px;overflow:hidden;background:var(--vbg)}
.pd-i h1{font-size:30px;margin-bottom:6px}.pd-i .tl{font-size:14px;color:var(--fg3);margin-bottom:14px}
.pd-i .pr{font-family:'Montserrat',sans-serif;font-size:34px;margin-bottom:6px}.pd-i .pr span{font-size:14px;color:var(--fg3);font-family:'Montserrat'}
.pd-i .fm{font-size:12px;color:var(--fg3);background:var(--bg3);display:inline-block;padding:4px 12px;border-radius:6px;margin-bottom:18px}
.pd-i .dt{font-size:13px;font-weight:600;color:var(--fg2);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px}
.pd-i .dd{font-size:14px;color:var(--fg2);line-height:1.7;margin-bottom:16px}
.pd-a{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.pd-btn{padding:13px 26px;border-radius:12px;border:none;font-size:14px;font-weight:600;cursor:pointer;font-family:'Montserrat';transition:all .2s;display:inline-flex;align-items:center;gap:8px;text-decoration:none}
.pd-btn.cart{background:var(--bg3);color:var(--fg)}.pd-btn.cart:hover{background:var(--acs);color:var(--ac)}.pd-btn.cart.ad{background:var(--acs);color:var(--ac)}
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
.ferr{text-align:center;padding:12px;color:#e05555;font-size:13px;background:rgba(224,85,85,0.06);border-radius:10px;margin-bottom:10px}
.ce{display:block;text-align:center;font-size:18px;color:var(--ac);text-decoration:none;margin-bottom:28px;font-weight:500}

/* CART SIDEBAR */
.co{position:fixed;inset:0;background:rgba(0,0,0,0.25);z-index:300;opacity:0;pointer-events:none;transition:opacity .3s}.co.open{opacity:1;pointer-events:all}
.cs{position:fixed;top:0;right:0;bottom:0;width:420px;max-width:92vw;background:var(--bg2);z-index:301;transform:translateX(100%);transition:transform .35s cubic-bezier(.25,.46,.45,.94);box-shadow:-6px 0 36px rgba(0,0,0,0.08);display:flex;flex-direction:column}.cs.open{transform:translateX(0)}
.cs-h{padding:18px 22px;border-bottom:1px solid rgba(0,0,0,0.05);display:flex;justify-content:space-between;align-items:center}.cs-h h3{font-size:17px;font-family:'Montserrat';font-weight:600}
.cs-x{background:none;border:none;color:var(--fg3);cursor:pointer;font-size:20px;padding:4px}
.cs-i{flex:1;overflow-y:auto;padding:14px 22px}
.cit{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid rgba(0,0,0,0.03)}
.cit-c{width:38px;height:38px;border-radius:10px;flex-shrink:0}
.cit-i{flex:1}.cit-i h4{font-size:13px;font-weight:600;margin-bottom:1px}.cit-i span{font-size:12px;color:var(--fg3)}
.cit-p{font-family:'Montserrat',sans-serif;font-size:17px;font-weight:600}
.cit-r{background:none;border:none;color:var(--fg3);font-size:11px;cursor:pointer;margin-left:6px;text-decoration:underline;font-family:'Montserrat'}.cit-r:hover{color:#e05555}
.cs-e{text-align:center;padding:50px 20px;color:var(--fg3)}.cs-e p{margin-bottom:14px}
.cs-f{padding:18px 22px;border-top:1px solid rgba(0,0,0,0.05)}
.cs-t{display:flex;justify-content:space-between;margin-bottom:4px;font-size:15px;font-weight:600}.cs-t span:last-child{font-family:'Montserrat',sans-serif;font-size:20px}
.cs-note{font-size:11px;color:var(--fg3);margin-bottom:14px;display:flex;align-items:center;gap:5px}
.cs-ok{text-align:center;padding:24px;background:rgba(8,145,178,0.05);border-radius:12px;color:var(--ac);font-size:15px;font-weight:500}

/* PAYMENT SUCCESS MODAL */
.ps-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px}
.ps-modal{background:var(--bg2);border-radius:20px;padding:40px 36px;max-width:400px;width:100%;text-align:center}
.ps-icon{font-size:52px;margin-bottom:16px}
.ps-modal h3{font-size:22px;margin-bottom:8px}
.ps-modal p{color:var(--fg2);font-size:14px;line-height:1.6;margin-bottom:24px}
.ps-btn{padding:12px 28px;background:var(--ac);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:'Montserrat'}

footer{border-top:1px solid rgba(0,0,0,0.05);padding:36px 48px;text-align:center;margin-top:40px}
.fl{font-family:'Montserrat',sans-serif;font-size:19px;margin-bottom:4px}.fl .d{color:var(--ac);font-style:italic}
footer p{font-size:12px;color:var(--fg3)}

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
        <div className="logo" onClick={() => goPage("home")}><img src="/logo.png" alt="Medu 3D logo" /><span className="m">Medu</span><span className="d">3D</span></div>
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
            <PayPalCheckout
              items={cart}
              lang={lang}
              onSuccess={handlePaymentSuccess}
            />
          </div>
        )}
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
              <Viewer color={cur.color} active={true} bgColor={0xeef1f5} />
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
      </>}

      {/* CATALOG */}
      {page === "catalog" && <div className="cat">
        <div className="cat-h"><h2>{t.catalog.title}</h2><p>{t.catalog.subtitle}</p></div>
        <div className="cg">{P.map(p => {
          const ic = cart.find(c => c.id === p.id && c.cartType === "stl");
          return (<div className="cc" key={p.id}>
            <div className="ct" onClick={() => goProd(p)}><svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth="1"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
            <div className="ci"><h3 onClick={() => goProd(p)} style={{cursor:"pointer"}}>{p.name[lang]}</h3><p className="tl">{p.tag[lang]}</p>
              <div className="cf">
                <div>
                  <span className="cp">${p.priceSlt}</span>
                  <span style={{fontSize:11,color:"var(--fg3)",marginLeft:4}}>STL</span>
                </div>
                <button className={`cb2 ${ic ? "ad" : "pr"}`} onClick={() => addCart(p, "stl")}>{ic ? t.catalog.added : t.catalog.addCart}</button>
              </div>
            </div>
          </div>);
        })}</div>
      </div>}

      {/* PRODUCT */}
      {page === "product" && selProd && <ProductDetail
        prod={selProd} lang={lang} t={t} cart={cart}
        addCart={addCart} onPaySuccess={handlePaymentSuccess}
        goPage={goPage}
      />}

      {/* QUOTE */}
      {page === "quote" && <QuoteForm t={t} />}

      {/* CONTACT */}
      {page === "contact" && <ContactForm t={t} lang={lang} />}
      </div>

      <footer>
        <div className="fl"><img src="/logo.png" alt="" style={{height:28,marginRight:6,verticalAlign:"middle"}} />Medu <span className="d">3D</span></div>
        <p>{t.footer.tag}</p>
        <p style={{marginTop:4}}>© {new Date().getFullYear()} Medu 3D · {t.footer.rights}</p>
      </footer>
    </>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   ProductDetail — página de producto con toggle STL / Maqueta
   ═══════════════════════════════════════════════════════════════════════════ */
function ProductDetail({ prod, lang, t, cart, addCart, onPaySuccess, goPage }) {
  const [type, setType] = useState("stl"); // "stl" | "print"
  const tc = t.catalog;
  const isPrint = type === "print";
  const price = isPrint ? prod.pricePrint : prod.priceSlt;
  const cartId = prod.id + "_" + type;
  const inCart = cart.find(c => c.cartId === cartId);

  return (
    <div className="pd">
      <button className="pd-b" onClick={() => goPage("catalog")}>{tc.back}</button>
      <div className="pd-l">
        <div className="pd-v">
          <Viewer color={prod.color} active={true} hd={true} interact={true} bgColor={0xeef1f5} />
        </div>
        <div className="pd-i">
          <h1>{prod.name[lang]}</h1>
          <p className="tl">{prod.tag[lang]}</p>

          {/* ── TOGGLE STL / MAQUETA ─────────────────────────────────── */}
          <div className="type-toggle">
            <button
              className={`tt-btn ${!isPrint ? "on" : ""}`}
              onClick={() => setType("stl")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
              {tc.typeStl}
            </button>
            <button
              className={`tt-btn ${isPrint ? "on" : ""}`}
              onClick={() => setType("print")}
            >
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
              <div className="pr">${prod.priceSlt} <span>USD</span></div>
              <div className="fm">{tc.formats}: {prod.formats}</div>
              <p className="dt">{tc.desc}</p>
              <p className="dd">{prod.desc[lang]}</p>
              <div className="pd-a">
                <button
                  className={`pd-btn cart ${inCart ? "ad" : ""}`}
                  onClick={() => addCart(prod, "stl")}
                >
                  {inCart ? tc.added : tc.addCart}
                </button>
              </div>
              <div className="pd-paypal">
                <HostedPayPalButton hostedBtnId={prod.hostedBtn} lang={lang} />
              </div>
            </>
          )}

          {/* ── MAQUETA PRÓXIMAMENTE ─────────────────────────────────── */}
          {isPrint && prod.pricePrint === null && (
            <div className="cs-box">
              <div className="cs-icon">🖨️</div>
              <h3>{tc.comingSoon}</h3>
              <p>{tc.comingSoonNote}</p>
              <a
                href="mailto:contacto@medu3d.com?subject=Notificarme — Maqueta Impresa"
                className="cs-cta"
              >
                {tc.notifyMe} →
              </a>
            </div>
          )}

          {/* ── MAQUETA DISPONIBLE (cuando pricePrint tenga valor) ───── */}
          {isPrint && prod.pricePrint !== null && (
            <>
              <div className="pr">${prod.pricePrint} <span>USD</span></div>
              <p className="dt">{tc.desc}</p>
              <p className="dd">{prod.desc[lang]}</p>
              <div className="pd-a">
                <button
                  className={`pd-btn cart ${inCart ? "ad" : ""}`}
                  onClick={() => addCart(prod, "print")}
                >
                  {inCart ? tc.added : tc.addCart}
                </button>
              </div>
              <div className="pd-paypal">
                <HostedPayPalButton hostedBtnId={prod.hostedBtnPrint} lang={lang} />
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
