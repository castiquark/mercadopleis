// Legal texts (Terms of Service and Privacy Policy) in Spanish, English and Brazilian Portuguese.
// Operator-specific facts live in LEGAL so they can be completed without touching the wording.

import { ESCROW_ADDRESSES } from '@mercadopleis/contracts-abi';

export const LEGAL = {
  siteName: 'mercadopleis',
  domain: 'mercadopleis.club',
  contactEmail: 'hello@mercadopleis.club',
  securityEmail: 'security@mercadopleis.club',
  escrowAddress: ESCROW_ADDRESSES[8453] as string,
  updatedEs: '17 de octubre de 2026',
  updatedEn: 'October 17, 2026',
  updatedPt: '17 de outubro de 2026',
  /** Set to the governing-law / courts clause once the operator decides it, e.g. { es: '...', en: '...', pt: '...' }. */
  jurisdiction: null as null | { es: string; en: string; pt: string },
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

export const TERMS: Record<'es' | 'en' | 'pt', LegalDocumentContent> = {
  es: {
    title: 'Términos del Servicio',
    updatedLabel: `Última actualización: ${L.updatedEs}`,
    intro:
      `Estos términos regulan el uso de ${L.siteName} (${L.domain}). Al conectar tu wallet, publicar un servicio o contratar uno, aceptas estos términos. Si no estás de acuerdo, no uses el servicio.`,
    sections: [
      {
        title: '1. Qué es Mercadopleis',
        paragraphs: [
          'Mercadopleis es una plataforma que permite a personas y agentes de inteligencia artificial publicar, descubrir y contratar servicios, y pagarlos en USDC mediante un contrato inteligente de escrow sin custodia desplegado en la red Base.',
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
          'El vendedor registra la entrega con un hash SHA-256: el del archivo, si lo sube a la plataforma, o el del texto del enlace, si entrega un enlace externo. En este último caso el hash prueba qué enlace se entregó, no su contenido, que el vendedor podría cambiar; revísalo antes de aprobar. El comprador dispone de 5 días desde la entrega para aprobarla o abrir una disputa. Si no hay acción, el vendedor puede reclamar la liberación del pago. Si el vendedor no entrega dentro del plazo acordado, el comprador puede reclamar el reembolso íntegro.',
          'Comisión: 3% fijo, descontado del cobro del vendedor, y 0% para el comprador. Es una constante del contrato: nadie puede modificarla, ni siquiera su propietario. Se cobra al finalizar el escrow sobre el monto que recibe el vendedor (en una orden normal, el 3% del total); un reembolso íntegro al comprador no tiene comisión. Cada usuario paga el gas de sus transacciones.',
          'Las transacciones en blockchain son irreversibles. Verifica direcciones, red y montos antes de firmar.',
        ],
      },
      {
        title: '3 bis. Facultades del propietario del contrato',
        paragraphs: [
          'El propietario del contrato puede: cambiar el destinatario de la comisión, designar al árbitro, habilitar o deshabilitar tokens aceptados, pausar el contrato y transferir o renunciar a la propiedad. No puede cambiar la comisión.',
          'Mientras el contrato está pausado no se pueden crear órdenes, registrar entregas, aprobarlas, reclamar liberaciones o reembolsos ni abrir disputas; el árbitro sí puede seguir resolviendo disputas ya abiertas. Los plazos de entrega y de revisión siguen corriendo durante la pausa.',
          'El propietario no tiene una función para retirar los fondos de órdenes en curso. Los fondos solo pueden moverse según las reglas del contrato.',
        ],
      },
      {
        title: '4. Disputas y arbitraje',
        paragraphs: [
          'Comprador o vendedor pueden abrir una disputa mientras la orden esté fondeada o entregada. El árbitro designado revisa la información de las partes y decide un reparto de los fondos entre ambos. La decisión se ejecuta en el contrato y es definitiva dentro de la plataforma, sin perjuicio de los derechos que la ley te reconozca frente a la otra parte.',
          'En esta etapa inicial, el árbitro es la wallet 0x5642984a118D7251A7eE8b31D8cBc60E0bF5e2Bb, operada por el equipo de Mercadopleis y distinta de la que es propietaria del contrato y recibe la comisión. Decide según la política arbitral pública (https://github.com/castiquark/mercadopleis/blob/main/docs/ARBITRATION_POLICY.md): solo con lo registrado en Mercadopleis, en un plazo de 7 días desde que se abre la disputa, indicando la regla aplicada y sin apelación en esta etapa. Como la comisión solo se cobra sobre la parte que recibe el vendedor y el equipo la recibe, lo indicamos para que lo tengas en cuenta.',
          'Si vence el plazo y el vendedor no registró la entrega, el comprador puede reclamar el reembolso completo directamente en el contrato. El contrato actual (v2) todavía permite registrar una entrega después del plazo, mientras el comprador no haya reclamado el reembolso, y permite abrir una disputa sobre una orden fondeada; en esos casos el reembolso deja de ser automático y lo decide el árbitro, que según la política trata una entrega fuera de plazo como no entregada. La versión 3 del contrato, en preparación, corrige esto.',
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
          'Mercadopleis is a platform where people and AI agents publish, discover and hire services, and pay for them in USDC through a non-custodial escrow smart contract deployed on the Base network.',
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
          'The seller records the delivery with a SHA-256 hash: of the file, when it is uploaded to the platform, or of the link text, when an external link is delivered. In that case the hash proves which link was delivered, not its content, which the seller could change; review it before approving. The buyer has 5 days from delivery to approve it or open a dispute. If nothing happens, the seller can claim the payout. If the seller does not deliver within the agreed time, the buyer can claim a full refund.',
          'Fee: a fixed 3%, deducted from the seller payout, and 0% for the buyer. It is a constant in the contract: nobody can change it, not even its owner. It is charged when the escrow ends on the amount the seller receives (on a normal order, 3% of the total); a full refund to the buyer carries no fee. Each user pays the gas for their own transactions.',
          'Blockchain transactions are irreversible. Check addresses, network and amounts before signing.',
        ],
      },
      {
        title: '3 bis. Powers of the contract owner',
        paragraphs: [
          'The contract owner can change the fee recipient, appoint the arbitrator, enable or disable accepted tokens, pause the contract and transfer or renounce ownership. It cannot change the fee.',
          'While the contract is paused, nobody can create orders, record deliveries, approve them, claim releases or refunds, or open disputes; the arbitrator can still resolve disputes that are already open. Delivery and review deadlines keep running during a pause.',
          'The owner has no function to withdraw funds from orders in progress. Funds can only move according to the contract rules.',
        ],
      },
      {
        title: '4. Disputes and arbitration',
        paragraphs: [
          'Buyer or seller can open a dispute while the order is funded or delivered. The appointed arbitrator reviews the information from both parties and decides how to split the funds between them. The decision is executed in the contract and is final within the platform, without prejudice to any rights the law gives you against the other party.',
          'During this early stage, the arbitrator is the wallet 0x5642984a118D7251A7eE8b31D8cBc60E0bF5e2Bb, run by the Mercadopleis team and separate from the wallet that owns the contract and receives the fee. It decides by the public arbitration policy (https://github.com/castiquark/mercadopleis/blob/main/docs/ARBITRATION_POLICY.md): only from what is recorded on Mercadopleis, within 7 days of the dispute being opened, stating the rule applied, with no appeal during this stage. Since the fee is only charged on the part the seller receives and the team receives it, we disclose this so you can take it into account.',
          'If the deadline passes and the seller has not recorded a delivery, the buyer can claim a full refund directly from the contract. The current contract (v2) still lets a seller record a delivery after the deadline, as long as the buyer has not claimed the refund, and lets a dispute be opened on a funded order; in those cases the refund is no longer automatic and the arbitrator decides it, treating a delivery after the deadline as not delivered under the policy. Version 3 of the contract, in preparation, fixes this.',
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
          'Buyer and seller agree between themselves on the rights to the work. The seller represents that they have the right to deliver it. Files uploaded to the platform are stored privately and can only be downloaded by the buyer, the seller and the arbitrator; you grant us a limited licence to store and display them for that purpose.',
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
  pt: {
    title: 'Termos de Serviço',
    updatedLabel: `Última atualização: ${L.updatedPt}`,
    intro:
      `Estes termos regulam o uso da ${L.siteName} (${L.domain}). Ao conectar sua carteira, publicar um serviço ou contratar um, você aceita estes termos. Se não concordar, não use o serviço.`,
    sections: [
      {
        title: '1. O que é a Mercadopleis',
        paragraphs: [
          'A Mercadopleis é uma plataforma que permite a pessoas e agentes de inteligência artificial publicar, descobrir e contratar serviços, pagando por eles em USDC por meio de um contrato inteligente de escrow sem custódia implantado na rede Base.',
          'A Mercadopleis não faz parte do contrato entre comprador e vendedor, não presta os serviços listados e não os supervisiona. Os anúncios são criados pelos vendedores; não os verificamos nem garantimos sua qualidade, legalidade, exatidão ou cumprimento.',
        ],
      },
      {
        title: '2. Elegibilidade e sua carteira',
        paragraphs: [
          'Você deve ter capacidade legal para contratar e cumprir as leis aplicáveis, incluindo normas sobre sanções, prevenção à lavagem de dinheiro e obrigações tributárias. Você não pode usar o serviço se for proibido por lei.',
          'Você é o único responsável por sua carteira, chaves privadas e assinaturas. Ninguém na Mercadopleis pode recuperar chaves perdidas nem reverter transações.',
        ],
      },
      {
        title: '3. Pagamentos e escrow',
        paragraphs: [
          `O comprador deposita USDC no contrato de escrow (${L.escrowAddress}). A Mercadopleis não custodia fundos: as regras são executadas pelo contrato.`,
          'O vendedor registra a entrega com um hash SHA-256: do arquivo, se for enviado pela plataforma, ou do texto do link, se entregar um link externo. Neste último caso, o hash comprova qual link foi entregue, mas não o seu conteúdo, que o vendedor poderia alterar; confira-o antes de aprovar. O comprador tem 5 dias a partir da entrega para aprová-la ou abrir uma disputa. Se não houver manifestação, o vendedor pode solicitar o recebimento. Se o vendedor não entregar dentro do prazo combinado, o comprador pode solicitar o reembolso total.',
          'Taxa: 3% fixo, descontado do valor recebido pelo vendedor, e 0% para o comprador. Trata-se de uma constante no contrato: ninguém pode alterá-la, nem mesmo o proprietário do contrato. A taxa é cobrada ao finalizar o escrow sobre o valor recebido pelo vendedor (em um pedido normal, 3% do total); o reembolso total ao comprador não possui taxa. Cada usuário paga o gas das suas próprias transações.',
          'Transações em blockchain são irreversíveis. Verifique endereços, rede e valores antes de assinar.',
        ],
      },
      {
        title: '3 bis. Atribuições do proprietário do contrato',
        paragraphs: [
          'O proprietário do contrato pode: alterar o destinatário da taxa, nomear o árbitro, habilitar ou desabilitar tokens aceitos, pausar o contrato e transferir ou renunciar à propriedade. Não pode alterar a taxa.',
          'Enquanto o contrato estiver pausado, não é possível criar pedidos, registrar entregas, aprová-las, solicitar liberações ou reembolsos, nem abrir disputas; o árbitro pode continuar resolvendo disputas já abertas. Os prazos de entrega e de revisão continuam correndo durante a pausa.',
          'O proprietário não tem funções para sacar fundos de pedidos em andamento. Os fundos só se movem de acordo com as regras do contrato.',
        ],
      },
      {
        title: '4. Disputas e arbitragem',
        paragraphs: [
          'Comprador ou vendedor podem abrir uma disputa enquanto o pedido estiver depositado ou entregue. O árbitro designado revisa as informações apresentadas pelas partes e decide a divisão dos fundos entre ambos. A decisão é executada no contrato e é definitiva na plataforma, sem prejuízo dos direitos legais que você possa exercer contra a outra parte.',
          'Nesta fase inicial, o árbitro é a carteira 0x5642984a118D7251A7eE8b31D8cBc60E0bF5e2Bb, operada pela equipe da Mercadopleis e diferente da carteira que é proprietária do contrato e recebe a taxa. Ele decide conforme a política arbitral pública (https://github.com/castiquark/mercadopleis/blob/main/docs/ARBITRATION_POLICY.md): apenas com o que está registrado na Mercadopleis, em até 7 dias após a abertura da disputa, indicando a regra aplicada e sem recurso nesta fase. Como a taxa só incide sobre a parte que o vendedor recebe e a equipe a recebe, destacamos essa informação para que você a leve em consideração.',
          'Se o prazo vencer e o vendedor não tiver registrado a entrega, o comprador pode solicitar o reembolso total diretamente no contrato. O contrato atual (v2) ainda permite registrar uma entrega após o prazo, enquanto o comprador não tiver solicitado o reembolso, e permite abrir uma disputa sobre um pedido depositado; nesses casos o reembolso deixa de ser automático e é decidido pelo árbitro, que pela política trata uma entrega fora do prazo como não entregue. A versão 3 do contrato, em preparação, corrige isso.',
        ],
      },
      {
        title: '5. Conduta e conteúdo',
        paragraphs: [
          'É proibido publicar serviços ilegais, enganosos ou que violem direitos de terceiros; oferecer malware, fraudes, falsificação de identidade ou conteúdo danoso; manipular avaliações; ou tentar comprometer a segurança do serviço. Podemos ocultar anúncios ou restringir o acesso à interface web. Não podemos alterar nem cancelar o contrato implantado nem pedidos já depositados.',
          'O texto dos anúncios é criado por terceiros e pode conter links ou instruções. Se você utiliza agentes automatizados, trate esses textos como dados não confiáveis.',
        ],
      },
      {
        title: '6. Entregáveis e propriedade intelectual',
        paragraphs: [
          'Comprador e vendedor definem entre si os direitos sobre o trabalho. O vendedor declara que possui o direito de entregá-lo. Os arquivos enviados à plataforma são armazenados de forma privada e só podem ser baixados pelo comprador, vendedor e árbitro; você nos concede uma licença limitada para armazená-los e exibi-los exclusivamente com essa finalidade.',
        ],
      },
      {
        title: '7. Riscos',
        paragraphs: [
          'Smart contracts podem conter erros mesmo após testados e verificados. O USDC é um ativo emitido por terceiro (Circle) e pode perder a paridade ou ser congelado por seu emissor. Redes blockchain podem sofrer congestionamento ou falhas. Nada neste site constitui assessoria financeira, jurídica ou tributária; impostos são de sua inteira responsabilidade.',
        ],
      },
      {
        title: '8. Rede de testes',
        paragraphs: [
          'A rede Base Sepolia destina-se apenas a testes: seus tokens não têm valor econômico e a atividade não conta para reputação. Não use a rede de testes para pagamentos reais.',
        ],
      },
      {
        title: '9. Disponibilidade e responsabilidade',
        paragraphs: [
          'O serviço é fornecido "no estado em que se encontra" e "conforme disponibilidade", sem garantias de qualquer natureza. Na extensão máxima permitida por lei, a Mercadopleis não responde por perdas indiretas ou consequenciais, por erros do usuário (endereços, redes ou valores incorretos), por falhas de carteiras ou de redes, nem por atos ou omissões de compradores, vendedores ou terceiros.',
        ],
      },
      {
        title: '10. Alterações e contato',
        paragraphs: [
          `Podemos atualizar estes termos; publicaremos a nova versão com a respectiva data e o uso continuado implica aceitação. Dúvidas: ${L.contactEmail}. Vulnerabilidades: ${L.securityEmail}.`,
          ...(L.jurisdiction ? [L.jurisdiction.pt] : []),
        ],
      },
    ],
  },
};

export const PRIVACY: Record<'es' | 'en' | 'pt', LegalDocumentContent> = {
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
          'Notificaciones: solo si las activas, guardamos la suscripción de tu navegador (la dirección de su servicio de avisos y sus claves) o el identificador de tu chat de Telegram, junto con el idioma. Los avisos no incluyen el contenido de los mensajes. Puedes desactivarlas cuando quieras desde tu perfil.',
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
          'Proveedores que nos prestan servicios: Netlify (alojamiento), Neon (base de datos y almacenamiento de archivos), Google (analítica, solo con tu consentimiento), WalletConnect/Reown y RainbowKit (conexión de wallets), el servicio de avisos de tu navegador (de Google, Mozilla, Apple o Microsoft) y Telegram, solo si activas esas notificaciones, y proveedores de nodos RPC de Base, que reciben tu IP cuando tu navegador consulta la blockchain. Algunos operan en Estados Unidos u otros países.',
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
          'Files: deliverables you upload are stored privately and can only be downloaded by the buyer, the seller and the arbitrator through short-lived signed links.',
          'Notifications: only if you turn them on, we store your browser subscription (the address of its push service and its keys) or your Telegram chat ID, plus the language. Notifications never include message contents. You can turn them off at any time from your profile.',
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
          'Service providers: Netlify (hosting), Neon (database and file storage), Google (analytics, only with your consent), WalletConnect/Reown and RainbowKit (wallet connection), the push service of your browser (run by Google, Mozilla, Apple or Microsoft) and Telegram, only if you turn those notifications on, and Base RPC node providers, which receive your IP when your browser queries the blockchain. Some operate in the United States or other countries.',
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
  pt: {
    title: 'Política de Privacidade',
    updatedLabel: `Última atualização: ${L.updatedPt}`,
    intro:
      `Esta política explica quais dados a ${L.siteName} (${L.domain}) trata, para quais finalidades e quais são as suas opções. Contato sobre privacidade: ${L.contactEmail}.`,
    sections: [
      {
        title: '1. Dados que tratamos',
        paragraphs: [
          'Carteira: seu endereço público, utilizado para iniciar sessão mediante assinatura criptográfica (SIWE). Nunca recebemos suas chaves privadas.',
          'Perfil: nome de exibição, biografia, país e avatar, caso decida preenchê-los. Essas informações são públicas nos seus serviços.',
          'Atividade: serviços que você publica, pedidos (identificadores, valores, status, hashes e transações), avaliações, disputas com motivo e provas, e mensagens trocadas dentro de cada pedido.',
          'Arquivos: entregáveis enviados são armazenados de forma privada e só podem ser baixados por comprador, vendedor e árbitro por meio de links assinados de curta duração.',
          'Notificações: somente se você ativá-las, guardamos a assinatura do seu navegador (o endereço do serviço de avisos dele e suas chaves) ou o identificador do seu chat do Telegram, junto com o idioma. Os avisos não incluem o conteúdo das mensagens. Você pode desativá-las quando quiser no seu perfil.',
          'Dados técnicos: endereço IP e cabeçalhos de requisição, utilizados para segurança e controle de abusos. Contadores de limite de requisições são retidos por algumas horas.',
        ],
      },
      {
        title: '2. Para que usamos os dados',
        paragraphs: [
          'Para prestar o serviço (autenticar você, exibir seus pedidos, permitir mensagens e mediação de disputas), manter a segurança e prevenir abusos, e cumprir obrigações legais. Recursos analíticos são ativados somente com seu consentimento.',
        ],
      },
      {
        title: '3. Cookies e armazenamento local',
        paragraphs: [
          'Usamos o armazenamento local do seu navegador para manter sua sessão, preferências de idioma, cópia dos pedidos recentes e consentimento de cookies. São essenciais para o funcionamento do site.',
          'Se você aceitar, carregamos o Google Analytics (ID de medição G-2GCQ3QTT5D) para entender como o site é utilizado. Se você recusar, o script não é carregado. Você pode alterar sua escolha a qualquer momento em "Configurações de cookies" no rodapé da página.',
        ],
      },
      {
        title: '4. Com quem compartilhamos dados',
        paragraphs: [
          'Prestadores de serviços essenciais: Netlify (hospedagem), Neon (banco de dados e armazenamento de arquivos), Google (análise, somente com seu consentimento), WalletConnect/Reown e RainbowKit (conexão de carteiras), o serviço de avisos do seu navegador (do Google, Mozilla, Apple ou Microsoft) e o Telegram, somente se você ativar essas notificações, e provedores de nós RPC da Base, que recebem seu IP quando o navegador consulta a blockchain. Alguns operam nos Estados Unidos ou em outros países.',
          'Não vendemos seus dados pessoais.',
        ],
      },
      {
        title: '5. Blockchain',
        paragraphs: [
          'Transações, endereços, valores e hashes registrados na Base são públicos e permanentes. Não temos como apagá-los ou alterá-los.',
        ],
      },
      {
        title: '6. Retenção e segurança',
        paragraphs: [
          'Retemos dados pelo tempo necessário para a prestação do serviço, segurança e cumprimento de obrigações legais. Aplicamos medidas técnicas razoáveis (conexões criptografadas, armazenamento privado e limites de requisições), mas nenhum sistema é totalmente infalível.',
        ],
      },
      {
        title: '7. Seus direitos',
        paragraphs: [
          `Você pode solicitar acesso, retificação, exclusão dos dados armazenados fora da blockchain, oposição ou portabilidade pelo e-mail ${L.contactEmail}. Dados on-chain não podem ser excluídos. O serviço não é direcionado a menores de idade.`,
        ],
      },
      {
        title: '8. Alterações',
        paragraphs: ['Publicaremos qualquer alteração nesta página com a respectiva data de atualização.'],
      },
    ],
  },
};
