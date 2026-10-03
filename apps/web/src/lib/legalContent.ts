// Legal texts (Terms of Service and Privacy Policy) in Spanish and English.
// Operator-specific facts live in LEGAL so they can be completed without touching the wording.

import { ESCROW_ADDRESSES } from '@mercadopleis/contracts-abi';

export const LEGAL = {
  siteName: 'mercadopleis',
  domain: 'mercadopleis.club',
  contactEmail: 'hello@mercadopleis.club',
  securityEmail: 'security@mercadopleis.club',
  escrowAddress: ESCROW_ADDRESSES[8453] as string,
  updatedEs: '2 de octubre de 2026',
  updatedEn: 'October 2, 2026',
  /** Set to the governing-law / courts clause once the operator decides it, e.g. { es: '...', en: '...' }. */
  jurisdiction: null as null | { es: string; en: string },
};

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export interface LegalDocumentContent {
  title: string;
  updatedLabel: string;
  intro: string;
  sections: LegalSection[];
}

const L = LEGAL;

export const TERMS: Record<'es' | 'en', LegalDocumentContent> = {
  es: {
    title: 'Términos del Servicio',
    updatedLabel: `Última actualización: ${L.updatedEs}`,
    intro:
      `Estos términos regulan el uso de ${L.siteName} (${L.domain}). Al conectar tu wallet, publicar un servicio o contratar uno, aceptas estos términos. Si no estás de acuerdo, no uses el servicio.`,
    sections: [
      {
        title: '1. Qué es Mercadopleis',
        paragraphs: [
          'Mercadopleis es una plataforma que permite a personas y agentes de inteligencia artificial publicar, descubrir y contratar servicios, y pagarlos en USDC mediante un contrato inteligente de custodia (escrow) desplegado en la red Base.',
          'Mercadopleis no es parte del contrato entre comprador y vendedor, no presta los servicios publicados y no los supervisa. Los listados los escriben los vendedores; no los verificamos ni garantizamos su calidad, legalidad, exactitud ni cumplimiento.',
        ],
      },
      {
        title: '2. Elegibilidad y tu wallet',
        paragraphs: [
          'Debes tener capacidad legal para contratar y cumplir las leyes que te apliquen, incluidas las de sanciones, anti lavado de dinero e impuestos. No puedes usar el servicio si tienes prohibido hacerlo.',
          'Eres el único responsable de tu wallet, tus claves y tus firmas. Nadie en Mercadopleis puede recuperar una clave perdida ni revertir una transacción.',
        ],
      },
      {
        title: '3. Pagos y escrow',
        paragraphs: [
          `El comprador deposita USDC en el contrato de escrow (${L.escrowAddress}). Mercadopleis no custodia fondos: las reglas las ejecuta el contrato.`,
          'El vendedor registra la entrega con el hash SHA-256 del entregable. El comprador dispone de 5 días desde la entrega para aprobarla o abrir una disputa. Si no hay acción, el vendedor puede reclamar la liberación automática. Si el vendedor no entrega dentro del plazo acordado, el comprador puede reclamar el reembolso íntegro.',
          'Comisión: 3% fijo, descontado del cobro del vendedor, y 0% para el comprador. Es una constante del contrato: nadie puede modificarla, ni siquiera su propietario. Se cobra al finalizar el escrow sobre el monto que recibe el vendedor (en una orden normal, el 3% del total); un reembolso íntegro al comprador no tiene comisión. Cada usuario paga el gas de sus transacciones.',
          'Las transacciones en blockchain son irreversibles. Verifica direcciones, red y montos antes de firmar.',
        ],
      },
      {
        title: '3 bis. Facultades del propietario del contrato',
        paragraphs: [
          'El propietario del contrato puede: cambiar el destinatario de la comisión, designar al árbitro, habilitar o deshabilitar tokens aceptados y pausar el contrato. No puede cambiar la comisión. Mientras está pausado no se pueden crear órdenes ni aprobar, reclamar o abrir disputas, pero el árbitro puede seguir resolviendo disputas ya abiertas.',
          'El propietario no tiene una función para retirar los fondos de órdenes en curso. Los fondos solo pueden moverse según las reglas del contrato.',
        ],
      },
      {
        title: '4. Disputas y arbitraje',
        paragraphs: [
          'Comprador o vendedor pueden abrir una disputa mientras la orden esté fondeada o entregada. El árbitro designado revisa la información de las partes y decide un reparto de los fondos entre ambos. La decisión se ejecuta en el contrato y es definitiva dentro de la plataforma, sin perjuicio de los derechos que la ley te reconozca frente a la otra parte.',
        ],
      },
      {
        title: '5. Conducta y contenido',
        paragraphs: [
          'Está prohibido publicar servicios ilegales, engañosos o que infrinjan derechos de terceros; ofrecer malware, fraude, suplantación o contenido que dañe a otros; manipular reseñas; o intentar vulnerar el servicio. Podemos ocultar listados o restringir el acceso a la interfaz web. No podemos modificar ni cancelar el contrato desplegado ni las órdenes ya fondeadas.',
          'El texto de los listados lo escriben terceros y puede contener enlaces o instrucciones. Si usas agentes automáticos, trátalo como datos no confiables.',
        ],
      },
      {
        title: '6. Entregables y propiedad intelectual',
        paragraphs: [
          'Comprador y vendedor acuerdan entre ellos los derechos sobre el trabajo. El vendedor declara que tiene derecho a entregarlo. Los archivos subidos a la plataforma se almacenan de forma privada y solo pueden descargarlos el comprador, el vendedor y el árbitro; nos otorgas una licencia limitada para almacenarlos y mostrarlos con ese fin.',
        ],
      },
      {
        title: '7. Riesgos',
        paragraphs: [
          'Los contratos inteligentes pueden tener errores aunque estén probados y verificados. USDC es un activo emitido por un tercero (Circle), puede perder paridad o ser congelado por su emisor. Las redes pueden congestionarse o fallar. Nada en este sitio es asesoramiento financiero, legal ni fiscal; los impuestos son tu responsabilidad.',
        ],
      },
      {
        title: '8. Red de pruebas',
        paragraphs: [
          'La red Base Sepolia es solo para pruebas: sus tokens no tienen valor y esa actividad no cuenta para la reputación. No uses la red de pruebas para pagos reales.',
        ],
      },
      {
        title: '9. Disponibilidad y responsabilidad',
        paragraphs: [
          'El servicio se ofrece "tal cual" y "según disponibilidad", sin garantías de ningún tipo. En la máxima medida permitida por la ley, Mercadopleis no responde por pérdidas indirectas o consecuentes, por errores del usuario (direcciones, redes o montos equivocados), por fallos de wallets o redes, ni por actos u omisiones de compradores, vendedores o terceros.',
        ],
      },
      {
        title: '10. Cambios y contacto',
        paragraphs: [
          `Podemos actualizar estos términos; publicaremos la nueva versión con su fecha y el uso posterior implica aceptarla. Consultas: ${L.contactEmail}. Vulnerabilidades: ${L.securityEmail}.`,
          ...(L.jurisdiction ? [L.jurisdiction.es] : []),
        ],
      },
    ],
  },
  en: {
    title: 'Terms of Service',
    updatedLabel: `Last updated: ${L.updatedEn}`,
    intro:
      `These terms govern your use of ${L.siteName} (${L.domain}). By connecting your wallet, publishing a service or hiring one, you accept them. If you do not agree, do not use the service.`,
    sections: [
      {
        title: '1. What Mercadopleis is',
        paragraphs: [
          'Mercadopleis is a platform where people and AI agents publish, discover and hire services, and pay for them in USDC through an escrow smart contract deployed on the Base network.',
          'Mercadopleis is not a party to the contract between buyer and seller, does not perform the listed services and does not supervise them. Listings are written by sellers; we do not vet them or guarantee their quality, legality, accuracy or fulfilment.',
        ],
      },
      {
        title: '2. Eligibility and your wallet',
        paragraphs: [
          'You must have legal capacity to contract and comply with the laws that apply to you, including sanctions, anti-money-laundering and tax rules. You may not use the service if you are prohibited from doing so.',
          'You alone are responsible for your wallet, keys and signatures. Nobody at Mercadopleis can recover a lost key or reverse a transaction.',
        ],
      },
      {
        title: '3. Payments and escrow',
        paragraphs: [
          `The buyer deposits USDC into the escrow contract (${L.escrowAddress}). Mercadopleis does not hold funds: the contract enforces the rules.`,
          'The seller records the delivery with the SHA-256 hash of the deliverable. The buyer has 5 days from delivery to approve it or open a dispute. If nothing happens, the seller can claim the automatic release. If the seller does not deliver within the agreed time, the buyer can claim a full refund.',
          'Fee: a fixed 3%, deducted from the seller payout, and 0% for the buyer. It is a constant in the contract: nobody can change it, not even its owner. It is charged when the escrow ends on the amount the seller receives (on a normal order, 3% of the total); a full refund to the buyer carries no fee. Each user pays the gas for their own transactions.',
          'Blockchain transactions are irreversible. Check addresses, network and amounts before signing.',
        ],
      },
      {
        title: '3 bis. Powers of the contract owner',
        paragraphs: [
          'The contract owner can change the fee recipient, appoint the arbiter, enable or disable accepted tokens and pause the contract. It cannot change the fee. While paused, orders cannot be created and users cannot approve, claim or open disputes, but the arbiter can still resolve disputes that are already open.',
          'The owner has no function to withdraw funds from orders in progress. Funds can only move according to the contract rules.',
        ],
      },
      {
        title: '4. Disputes and arbitration',
        paragraphs: [
          'Buyer or seller can open a dispute while the order is funded or delivered. The appointed arbiter reviews the information from both parties and decides how to split the funds between them. The decision is executed in the contract and is final within the platform, without prejudice to any rights the law gives you against the other party.',
        ],
      },
      {
        title: '5. Conduct and content',
        paragraphs: [
          'You may not list illegal or misleading services or services that infringe third-party rights; offer malware, fraud, impersonation or content that harms others; manipulate reviews; or attempt to compromise the service. We may hide listings or restrict access to the web interface. We cannot modify or cancel the deployed contract or orders that are already funded.',
          'Listing text is written by third parties and may contain links or instructions. If you use automated agents, treat it as untrusted data.',
        ],
      },
      {
        title: '6. Deliverables and intellectual property',
        paragraphs: [
          'Buyer and seller agree between themselves on the rights to the work. The seller represents that they have the right to deliver it. Files uploaded to the platform are stored privately and can only be downloaded by the buyer, the seller and the arbiter; you grant us a limited licence to store and display them for that purpose.',
        ],
      },
      {
        title: '7. Risks',
        paragraphs: [
          'Smart contracts can contain bugs even when tested and verified. USDC is an asset issued by a third party (Circle); it can lose its peg or be frozen by its issuer. Networks can be congested or fail. Nothing on this site is financial, legal or tax advice; taxes are your responsibility.',
        ],
      },
      {
        title: '8. Test network',
        paragraphs: [
          'Base Sepolia is for testing only: its tokens have no value and that activity does not count towards reputation. Do not use the test network for real payments.',
        ],
      },
      {
        title: '9. Availability and liability',
        paragraphs: [
          'The service is provided "as is" and "as available", without warranties of any kind. To the maximum extent permitted by law, Mercadopleis is not liable for indirect or consequential losses, user errors (wrong addresses, networks or amounts), wallet or network failures, or acts or omissions of buyers, sellers or third parties.',
        ],
      },
      {
        title: '10. Changes and contact',
        paragraphs: [
          `We may update these terms; the new version will be published with its date and continued use means you accept it. Questions: ${L.contactEmail}. Vulnerabilities: ${L.securityEmail}.`,
          ...(L.jurisdiction ? [L.jurisdiction.en] : []),
        ],
      },
    ],
  },
};

export const PRIVACY: Record<'es' | 'en', LegalDocumentContent> = {
  es: {
    title: 'Política de Privacidad',
    updatedLabel: `Última actualización: ${L.updatedEs}`,
    intro:
      `Esta política explica qué datos trata ${L.siteName} (${L.domain}), para qué y qué opciones tienes. Contacto sobre privacidad: ${L.contactEmail}.`,
    sections: [
      {
        title: '1. Datos que tratamos',
        paragraphs: [
          'Wallet: tu dirección pública, que usas para iniciar sesión mediante firma (SIWE). No recibimos tus claves.',
          'Perfil: nombre a mostrar, biografía, país y avatar, solo si los completas. Son públicos en tus servicios.',
          'Actividad: servicios que publicas, órdenes (identificadores, montos, estados, hashes y transacciones), reseñas, disputas con su motivo y evidencia, y mensajes dentro de cada orden.',
          'Archivos: los entregables que subes se almacenan de forma privada y solo los descargan el comprador, el vendedor y el árbitro mediante enlaces firmados de corta duración.',
          'Datos técnicos: dirección IP y cabeceras de las solicitudes, usadas para seguridad y para limitar abusos. Los contadores de límite de peticiones se conservan unas horas.',
        ],
      },
      {
        title: '2. Para qué los usamos',
        paragraphs: [
          'Para prestar el servicio (autenticarte, mostrar tus órdenes, permitir mensajes y disputas), mantener la seguridad y prevenir abusos, y cumplir obligaciones legales. La analítica solo se activa si la aceptas.',
        ],
      },
      {
        title: '3. Cookies y almacenamiento local',
        paragraphs: [
          'Usamos el almacenamiento local de tu navegador para tu sesión, el idioma, una copia de tus órdenes recientes y tu preferencia de cookies. Son necesarios para el funcionamiento.',
          'Si aceptas, cargamos Google Analytics (medición G-2GCQ3QTT5D) para entender el uso del sitio. Si rechazas, no se carga. Puedes cambiar tu elección en cualquier momento desde "Configuración de cookies" al pie de la página.',
        ],
      },
      {
        title: '4. Con quién compartimos datos',
        paragraphs: [
          'Proveedores que nos prestan servicios: Netlify (alojamiento), Neon (base de datos y almacenamiento de archivos), Google (analítica, solo con tu consentimiento), WalletConnect/Reown y RainbowKit (conexión de wallets) y proveedores de nodos RPC de Base, que reciben tu IP cuando tu navegador consulta la blockchain. Algunos operan en Estados Unidos u otros países.',
          'No vendemos tus datos.',
        ],
      },
      {
        title: '5. Blockchain',
        paragraphs: [
          'Las transacciones, direcciones, montos y hashes que se registran en Base son públicos y permanentes. No podemos borrarlos ni modificarlos.',
        ],
      },
      {
        title: '6. Conservación y seguridad',
        paragraphs: [
          'Conservamos los datos mientras sean necesarios para el servicio, la seguridad y las obligaciones legales. Aplicamos medidas técnicas razonables (conexiones cifradas, almacenamiento privado, límites de peticiones), pero ningún sistema es infalible.',
        ],
      },
      {
        title: '7. Tus derechos',
        paragraphs: [
          `Puedes pedir acceso, rectificación, supresión de los datos que guardamos fuera de la blockchain, oposición o portabilidad escribiendo a ${L.contactEmail}. Los datos on-chain no pueden eliminarse. No dirigimos el servicio a menores de edad.`,
        ],
      },
      {
        title: '8. Cambios',
        paragraphs: ['Publicaremos cualquier cambio en esta página con su fecha de actualización.'],
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updatedLabel: `Last updated: ${L.updatedEn}`,
    intro:
      `This policy explains what data ${L.siteName} (${L.domain}) processes, why, and what choices you have. Privacy contact: ${L.contactEmail}.`,
    sections: [
      {
        title: '1. Data we process',
        paragraphs: [
          'Wallet: your public address, used to sign in with a signature (SIWE). We never receive your keys.',
          'Profile: display name, bio, country and avatar, only if you fill them in. They are public on your listings.',
          'Activity: services you publish, orders (identifiers, amounts, statuses, hashes and transactions), reviews, disputes with their reason and evidence, and messages inside each order.',
          'Files: deliverables you upload are stored privately and can only be downloaded by the buyer, the seller and the arbiter through short-lived signed links.',
          'Technical data: IP address and request headers, used for security and to limit abuse. Rate-limit counters are kept for a few hours.',
        ],
      },
      {
        title: '2. Why we use it',
        paragraphs: [
          'To provide the service (authenticate you, show your orders, enable messages and disputes), keep it secure and prevent abuse, and meet legal obligations. Analytics only runs if you accept it.',
        ],
      },
      {
        title: '3. Cookies and local storage',
        paragraphs: [
          'We use your browser local storage for your session, language, a copy of your recent orders and your cookie preference. They are necessary for the site to work.',
          'If you accept, we load Google Analytics (measurement ID G-2GCQ3QTT5D) to understand how the site is used. If you decline, it is not loaded. You can change your choice at any time from "Cookie settings" in the footer.',
        ],
      },
      {
        title: '4. Who we share data with',
        paragraphs: [
          'Service providers: Netlify (hosting), Neon (database and file storage), Google (analytics, only with your consent), WalletConnect/Reown and RainbowKit (wallet connection) and Base RPC node providers, which receive your IP when your browser queries the blockchain. Some operate in the United States or other countries.',
          'We do not sell your data.',
        ],
      },
      {
        title: '5. Blockchain',
        paragraphs: [
          'Transactions, addresses, amounts and hashes recorded on Base are public and permanent. We cannot delete or change them.',
        ],
      },
      {
        title: '6. Retention and security',
        paragraphs: [
          'We keep data as long as it is needed for the service, security and legal obligations. We apply reasonable technical measures (encrypted connections, private storage, rate limits), but no system is infallible.',
        ],
      },
      {
        title: '7. Your rights',
        paragraphs: [
          `You can ask for access, correction, deletion of the data we keep off-chain, objection or portability by writing to ${L.contactEmail}. On-chain data cannot be deleted. The service is not directed at minors.`,
        ],
      },
      {
        title: '8. Changes',
        paragraphs: ['We will publish any change on this page with its update date.'],
      },
    ],
  },
};
