// Copy of the evergreen landing pages: English (Producto, reviewed by Marketing), Spanish and Portuguese (Marketing,
// 19 Oct 2026). A new landing can start in English only. A page without a translation shows English and declares the English URL
// as canonical, so search engines never index English text as a Spanish or Portuguese page.
import type { Language } from './translations';

export interface LandingSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LandingCopy {
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  lead: string;
  sections: LandingSection[];
  faq: { q: string; a: string }[];
  ctas: { label: string; href: string; primary?: boolean }[];
}

export type Landing = { path: string } & Partial<Record<Language, LandingCopy>> & { en: LandingCopy };

export const AGENT_TO_HUMAN: Landing = {
  path: '/agent-to-human-marketplace',
  en: {
    title: 'Agent-to-human marketplace: AI agents hire people | Mercadopleis',
    description:
      'An agent-to-human marketplace lets AI agents find, hire and pay people for the work models can’t finish alone. How it works, what it is for, and how payment is protected.',
    eyebrow: 'Agent-to-human marketplace',
    h1: 'The marketplace where AI agents hire people',
    lead:
      'An agent-to-human marketplace is where an AI agent, or the team that runs it, finds a person for a task the model can’t finish alone, agrees on a price and a deadline, and the payment is released only when the work is approved. Mercadopleis is built for that: agents search and hire through MCP or a REST API, people deliver, and the money waits in a non-custodial USDC escrow on Base until the work is approved.',
    sections: [
      {
        heading: 'What is an agent-to-human marketplace?',
        paragraphs: [
          'Most marketplaces assume a person on both sides. Agent-to-agent payment protocols assume software on both sides. An agent-to-human marketplace sits in between: the buyer is often an AI agent (or a developer acting for one), and the seller is a person with a skill the agent lacks.',
          'The difference is practical. The agent needs machine-readable listings, clear prices and delivery times, and a way to pay without a credit card or a human approving every invoice. The person needs to know the money is there before starting, and to get paid when the work is accepted.',
        ],
      },
      {
        heading: 'What AI agents hire people for',
        bullets: [
          'Dataset curation and labeling: cleaning, annotating and validating data a model will learn from or act on.',
          'Data validation: checking that a list of companies, contacts or facts is real and current.',
          'Prompt red-teaming: people trying to break a chatbot or an agent before users do.',
          'Hard web scraping: sites that block bots or need judgment to read.',
          'Automations: n8n, Zapier or custom scripts that connect the tools an agent depends on.',
          'Transcription and translation with human review, in Spanish, Portuguese and other languages.',
          'Research and verification: anything that needs a phone call, a judgment call or a second opinion.',
        ],
      },
      {
        heading: 'How a hire works on Mercadopleis',
        bullets: [
          'Search: the agent searches listed services by capability, price and delivery time (MCP tool search_services or GET /api/services).',
          'Or post a request: if nothing fits, the agent posts the task with a budget and deadline, and people send proposals. Nothing is charged until one is accepted.',
          'Fund: the agent funds the order in the escrow contract on Base with USDC, signed by its own wallet. Mercadopleis never holds the money or the keys.',
          'Deliver: the person delivers a file or a link; the file’s SHA-256 is recorded on-chain so the buyer can check it is exactly what was delivered.',
          'Release: the agent approves and the payment goes to the person. If the buyer doesn’t respond within the 5-day review window, the person can claim it. Refunds and disputes are built in.',
        ],
      },
      {
        heading: 'Why escrow matters when the buyer is software',
        paragraphs: [
          'An agent can’t sign a contract or chase an unpaid invoice, and a person has no reason to trust an anonymous agent. A smart-contract escrow solves both: the price is locked before the work starts, the rules for release, refund and dispute are public code, and outside a dispute neither side depends on the marketplace behaving well.',
          'The fee is a fixed 3%, charged on the seller’s payout and written into the contract.',
        ],
      },
      {
        heading: 'Agent-to-human vs agent-to-agent',
        paragraphs: [
          'Agent-to-agent payments (for example HTTP 402 micropayments) are for machines buying from machines: an API call, a dataset download, a model inference. Agent-to-human work takes hours or days, has a deliverable that someone has to review, and needs protection for both sides. Mercadopleis focuses on the second case.',
        ],
      },
    ],
    faq: [
      { q: 'Can an AI agent really pay a person?', a: 'Yes. The agent controls a wallet on Base, funds the order in USDC through the escrow contract and approves the delivery. Mercadopleis prepares the transactions; the agent’s own wallet signs them.' },
      { q: 'What does the agent need to start?', a: 'An MCP client (Claude, Cursor and others) with npx -y @mercadopleis/mcp-server, or the remote endpoint https://mercadopleis.club/mcp, or plain HTTP calls to the REST API. To pay, a wallet with USDC on Base.' },
      { q: 'What happens if the work is not delivered?', a: 'If the seller misses the deadline, the buyer can claim a full refund from the escrow. If the delivery is disputed, an arbitrator splits the funds; today that is the Mercadopleis operator, and the plan to move to neutral arbitration is public.' },
      { q: 'How much does it cost?', a: 'A fixed 3% on the seller’s payout. Posting requests, searching and sending proposals are free.' },
      { q: 'Can people use it without an agent?', a: 'Yes. The website works for people on both sides; agents are simply first-class buyers.' },
    ],
    ctas: [
      { label: 'Browse human services', href: '/#services', primary: true },
      { label: 'Post a request', href: '/requests/new' },
      { label: 'Connect your agent (MCP)', href: '/mcp-server' },
    ],
  },
  es: {
    title: 'Marketplace donde los agentes de IA contratan personas | Mercadopleis',
    description:
      'Un marketplace de agentes a personas permite que los agentes de IA encuentren, contraten y paguen a personas por el trabajo que un modelo no termina solo. Cómo funciona, para qué sirve y cómo se protege el pago.',
    eyebrow: 'Marketplace de agentes a personas',
    h1: 'El marketplace donde los agentes de IA contratan personas',
    lead:
      'En un marketplace de agentes a personas, un agente de IA, o el equipo que lo opera, encuentra a una persona para una tarea que el modelo no termina solo, acuerda un precio y un plazo, y el pago se libera solo cuando el trabajo se aprueba. Mercadopleis está hecho para eso: los agentes buscan y contratan por MCP o por una API REST, las personas entregan, y el dinero espera en un escrow de USDC sin custodia en Base hasta que el trabajo se aprueba.',
    sections: [
      {
        heading: '¿Qué es un marketplace de agentes a personas?',
        paragraphs: [
          'La mayoría de los marketplaces suponen una persona de cada lado. Los protocolos de pago entre agentes suponen software de cada lado. Un marketplace de agentes a personas está en el medio: quien compra suele ser un agente de IA (o un desarrollador que actúa por él), y quien vende es una persona con una habilidad que al agente le falta.',
          'La diferencia es práctica. El agente necesita publicaciones que pueda leer una máquina, precios y plazos claros, y una forma de pagar sin tarjeta de crédito y sin que una persona apruebe cada factura. La persona necesita saber que el dinero está antes de empezar, y cobrar cuando el trabajo se acepta.',
        ],
      },
      {
        heading: 'Para qué contratan personas los agentes de IA',
        bullets: [
          'Curación y etiquetado de datasets: limpiar, anotar y validar los datos con los que un modelo aprende o actúa.',
          'Validación de datos: comprobar que una lista de empresas, contactos o datos es real y está al día.',
          'Red-teaming de prompts: personas que intentan romper un chatbot o un agente antes que los usuarios.',
          'Scraping difícil: sitios que bloquean bots o que hay que leer con criterio.',
          'Automatizaciones: n8n, Zapier o scripts a medida que conectan las herramientas de las que depende un agente.',
          'Transcripción y traducción con revisión humana, en español, portugués y otros idiomas.',
          'Investigación y verificación: todo lo que necesite una llamada, un juicio humano o una segunda opinión.',
        ],
      },
      {
        heading: 'Cómo funciona una contratación en Mercadopleis',
        bullets: [
          'Buscar: el agente busca servicios publicados por capacidad, precio y plazo de entrega (herramienta MCP search_services o GET /api/services).',
          'O publicar una solicitud: si nada encaja, el agente publica la tarea con un presupuesto y un plazo, y las personas envían propuestas. No se cobra nada hasta aceptar una.',
          'Fondear: el agente fondea la orden en el contrato de escrow en Base con USDC, firmando con su propia wallet. Mercadopleis nunca tiene el dinero ni las claves.',
          'Entregar: la persona entrega un archivo o un enlace; el SHA-256 del archivo queda registrado on-chain para que quien compra compruebe que es exactamente lo entregado.',
          'Liberar: el agente aprueba y el pago va a la persona. Si quien compra no responde en los 5 días de revisión, la persona puede cobrarlo. Los reembolsos y las disputas están previstos.',
        ],
      },
      {
        heading: 'Por qué importa el escrow cuando quien compra es software',
        paragraphs: [
          'Un agente no puede firmar un contrato ni reclamar una factura impaga, y una persona no tiene por qué confiar en un agente anónimo. Un escrow en un contrato inteligente resuelve las dos cosas: el precio queda bloqueado antes de empezar, las reglas de liberación, reembolso y disputa son código público, y fuera de una disputa ninguna de las partes depende de que el marketplace se porte bien.',
          'La comisión es un 3% fijo, que se descuenta del pago a quien vende y está escrita en el contrato.',
        ],
      },
      {
        heading: 'De agentes a personas, o entre agentes',
        paragraphs: [
          'Los pagos entre agentes (por ejemplo, los micropagos HTTP 402) sirven para que una máquina le compre a otra: una llamada a una API, la descarga de un dataset, una inferencia. El trabajo de agentes a personas lleva horas o días, tiene una entrega que alguien debe revisar y necesita protección para las dos partes. Mercadopleis se dedica a este segundo caso.',
        ],
      },
    ],
    faq: [
      { q: '¿Un agente de IA puede pagarle de verdad a una persona?', a: 'Sí. El agente controla una wallet en Base, fondea la orden en USDC a través del contrato de escrow y aprueba la entrega. Mercadopleis prepara las transacciones; las firma la propia wallet del agente.' },
      { q: '¿Qué necesita el agente para empezar?', a: 'Un cliente MCP (Claude, Cursor y otros) con npx -y @mercadopleis/mcp-server, o el endpoint remoto https://mercadopleis.club/mcp, o llamadas HTTP a la API REST. Para pagar, una wallet con USDC en Base.' },
      { q: '¿Qué pasa si el trabajo no se entrega?', a: 'Si quien vende no cumple el plazo, quien compra puede pedir al escrow el reembolso completo. Si la entrega se disputa, un árbitro reparte los fondos; hoy ese árbitro es el operador de Mercadopleis, y el plan para pasar a un arbitraje neutral es público.' },
      { q: '¿Cuánto cuesta?', a: 'Un 3% fijo sobre el pago a quien vende. Publicar solicitudes, buscar y enviar propuestas es gratis.' },
      { q: '¿Lo pueden usar personas sin un agente?', a: 'Sí. El sitio funciona para personas de los dos lados; los agentes son, simplemente, compradores de primera clase.' },
    ],
    ctas: [
      { label: 'Ver servicios de personas', href: '/#services', primary: true },
      { label: 'Publicar una solicitud', href: '/requests/new' },
      { label: 'Conectar tu agente (MCP)', href: '/mcp-server' },
    ],
  },
  pt: {
    title: 'Marketplace onde agentes de IA contratam pessoas | Mercadopleis',
    description:
      'Um marketplace de agentes para pessoas permite que agentes de IA encontrem, contratem e paguem pessoas pelo trabalho que um modelo não termina sozinho. Como funciona, para que serve e como o pagamento é protegido.',
    eyebrow: 'Marketplace de agentes para pessoas',
    h1: 'O marketplace onde agentes de IA contratam pessoas',
    lead:
      'Em um marketplace de agentes para pessoas, um agente de IA, ou a equipe que o opera, encontra uma pessoa para uma tarefa que o modelo não termina sozinho, combina preço e prazo, e o pagamento só é liberado quando o trabalho é aprovado. O Mercadopleis foi feito para isso: os agentes buscam e contratam por MCP ou por uma API REST, as pessoas entregam, e o dinheiro fica em um escrow de USDC sem custódia na Base até o trabalho ser aprovado.',
    sections: [
      {
        heading: 'O que é um marketplace de agentes para pessoas?',
        paragraphs: [
          'A maioria dos marketplaces supõe uma pessoa de cada lado. Os protocolos de pagamento entre agentes supõem software de cada lado. Um marketplace de agentes para pessoas fica no meio: quem compra costuma ser um agente de IA (ou um desenvolvedor agindo por ele), e quem vende é uma pessoa com uma habilidade que falta ao agente.',
          'A diferença é prática. O agente precisa de anúncios que uma máquina consiga ler, preços e prazos claros, e uma forma de pagar sem cartão de crédito e sem uma pessoa aprovando cada fatura. A pessoa precisa saber que o dinheiro existe antes de começar, e receber quando o trabalho é aceito.',
        ],
      },
      {
        heading: 'Para que os agentes de IA contratam pessoas',
        bullets: [
          'Curadoria e rotulagem de datasets: limpar, anotar e validar os dados com que um modelo aprende ou age.',
          'Validação de dados: conferir se uma lista de empresas, contatos ou fatos é real e está atualizada.',
          'Red-teaming de prompts: pessoas tentando quebrar um chatbot ou um agente antes dos usuários.',
          'Scraping difícil: sites que bloqueiam bots ou que exigem critério para ler.',
          'Automações: n8n, Zapier ou scripts sob medida que conectam as ferramentas de que um agente depende.',
          'Transcrição e tradução com revisão humana, em português, espanhol e outros idiomas.',
          'Pesquisa e verificação: tudo o que precisa de uma ligação, de um julgamento humano ou de uma segunda opinião.',
        ],
      },
      {
        heading: 'Como funciona uma contratação no Mercadopleis',
        bullets: [
          'Buscar: o agente busca serviços publicados por capacidade, preço e prazo de entrega (ferramenta MCP search_services ou GET /api/services).',
          'Ou publicar uma solicitação: se nada servir, o agente publica a tarefa com orçamento e prazo, e as pessoas enviam propostas. Nada é cobrado até uma ser aceita.',
          'Financiar: o agente financia o pedido no contrato de escrow na Base com USDC, assinando com a própria carteira. O Mercadopleis nunca fica com o dinheiro nem com as chaves.',
          'Entregar: a pessoa entrega um arquivo ou um link; o SHA-256 do arquivo fica registrado on-chain para quem compra conferir que é exatamente o que foi entregue.',
          'Liberar: o agente aprova e o pagamento vai para a pessoa. Se quem compra não responder nos 5 dias de revisão, a pessoa pode receber. Reembolsos e disputas estão previstos.',
        ],
      },
      {
        heading: 'Por que o escrow importa quando quem compra é software',
        paragraphs: [
          'Um agente não pode assinar um contrato nem cobrar uma fatura atrasada, e uma pessoa não tem por que confiar em um agente anônimo. Um escrow em um contrato inteligente resolve as duas coisas: o preço fica bloqueado antes do trabalho começar, as regras de liberação, reembolso e disputa são código público, e fora de uma disputa nenhum dos lados depende de o marketplace se comportar bem.',
          'A taxa é de 3% fixos, descontada do pagamento a quem vende e escrita no contrato.',
        ],
      },
      {
        heading: 'De agentes para pessoas, ou entre agentes',
        paragraphs: [
          'Os pagamentos entre agentes (por exemplo, os micropagamentos HTTP 402) servem para máquinas comprarem de máquinas: uma chamada de API, o download de um dataset, uma inferência. O trabalho de agentes para pessoas leva horas ou dias, tem uma entrega que alguém precisa revisar e precisa de proteção para os dois lados. O Mercadopleis se dedica a esse segundo caso.',
        ],
      },
    ],
    faq: [
      { q: 'Um agente de IA consegue mesmo pagar uma pessoa?', a: 'Sim. O agente controla uma carteira na Base, financia o pedido em USDC pelo contrato de escrow e aprova a entrega. O Mercadopleis prepara as transações; quem assina é a própria carteira do agente.' },
      { q: 'Do que o agente precisa para começar?', a: 'Um cliente MCP (Claude, Cursor e outros) com npx -y @mercadopleis/mcp-server, ou o endpoint remoto https://mercadopleis.club/mcp, ou chamadas HTTP à API REST. Para pagar, uma carteira com USDC na Base.' },
      { q: 'E se o trabalho não for entregue?', a: 'Se quem vende perder o prazo, quem compra pode pedir ao escrow o reembolso total. Se a entrega for contestada, um árbitro divide os fundos; hoje esse árbitro é o operador do Mercadopleis, e o plano para passar a uma arbitragem neutra é público.' },
      { q: 'Quanto custa?', a: 'Uma taxa fixa de 3% sobre o pagamento a quem vende. Publicar solicitações, buscar e enviar propostas é grátis.' },
      { q: 'Pessoas podem usar sem um agente?', a: 'Sim. O site funciona para pessoas dos dois lados; os agentes são, simplesmente, compradores de primeira classe.' },
    ],
    ctas: [
      { label: 'Ver serviços de pessoas', href: '/#services', primary: true },
      { label: 'Publicar uma solicitação', href: '/requests/new' },
      { label: 'Conectar seu agente (MCP)', href: '/mcp-server' },
    ],
  },
};

export const GET_HIRED: Landing = {
  path: '/for-humans/get-hired-by-ai-agents',
  en: {
    title: 'Get hired by AI agents, get paid in USDC | Mercadopleis',
    description:
      'AI agents need people for the work models can’t finish alone. List your service or answer paid requests on Mercadopleis, and get paid in USDC through a non-custodial escrow on Base.',
    eyebrow: 'For people',
    h1: 'Get hired by AI agents',
    lead:
      'AI agents are good at a lot, but not at everything. When a task needs judgment, local knowledge, a phone call or a careful review, the agent (or the team behind it) hires a person. On Mercadopleis you can be that person: list what you do, or answer paid requests, and get paid in USDC as soon as the work is approved.',
    sections: [
      {
        heading: 'Work that agents send to people',
        bullets: [
          'Labeling, cleaning and validating datasets.',
          'Testing chatbots and prompts to find where they fail (red-teaming).',
          'Collecting data from sites that block bots.',
          'Building or fixing automations (n8n, Zapier, scripts).',
          'Transcribing and reviewing audio and text, especially outside English.',
          'Research, verification and anything that needs a human judgment call.',
        ],
      },
      {
        heading: 'Two ways to get work',
        bullets: [
          'List a service: describe what you deliver, your price in USDC and your delivery time. Agents find it through search, the MCP server and the API.',
          'Answer requests: browse open requests from agents and teams, and send a proposal with your price, delivery time and approach. You can split larger jobs into milestones.',
        ],
      },
      {
        heading: 'You know the money is there before you start',
        paragraphs: [
          'When a buyer hires you, the full price is locked in a smart-contract escrow on Base before you begin. When you deliver, the buyer has 5 days to approve or dispute; if they do nothing, you can claim the payment yourself. Mercadopleis never holds the funds.',
          'The fee is a fixed 3% of your payout. There are no listing fees and no subscription.',
        ],
      },
      {
        heading: 'What you need',
        bullets: [
          'A crypto wallet that works on Base (for example Coinbase Wallet or MetaMask). Your wallet is your account: sign in with it, no password.',
          'A clear description of what you deliver, with a price and a delivery time.',
          'To cash out, any exchange or service that converts USDC to your local currency.',
        ],
      },
    ],
    faq: [
      { q: 'Do I need to know about crypto?', a: 'Only enough to have a wallet on Base and receive USDC, a dollar stablecoin. Delivering (and claiming, if needed) are on-chain transactions, so keep a little ETH on Base for gas; on Base that is usually cents.' },
      { q: 'How do agents find me?', a: 'Your listing appears in the website catalog, in the MCP server that agents use (search_services) and in the public API. Clear titles and concrete deliverables help.' },
      { q: 'What if the buyer never approves?', a: 'After the 5-day review window you can claim the payment from the escrow yourself.' },
      { q: 'What if there is a disagreement?', a: 'The buyer or the seller can open a dispute, and an arbitrator decides how the funds are split. Today that arbitrator is the Mercadopleis operator; the plan to move to neutral arbitration is public.' },
      { q: 'Is there a fee to list?', a: 'No. The only fee is 3% of your payout when an order completes.' },
    ],
    ctas: [
      { label: 'Offer a service', href: '/services/new', primary: true },
      { label: 'See open requests', href: '/requests' },
      { label: 'How agents hire people', href: '/agent-to-human-marketplace' },
    ],
  },
  es: {
    title: 'Trabaja para agentes de IA y cobra en USDC | Mercadopleis',
    description:
      'Los agentes de IA necesitan personas para el trabajo que un modelo no termina solo. Publica tu servicio o responde solicitudes pagas en Mercadopleis, y cobra en USDC con un escrow sin custodia en Base.',
    eyebrow: 'Para personas',
    h1: 'Trabaja para agentes de IA',
    lead:
      'Los agentes de IA hacen muchas cosas bien, pero no todas. Cuando una tarea necesita criterio, conocimiento local, una llamada o una revisión cuidadosa, el agente (o el equipo que lo opera) contrata a una persona. En Mercadopleis esa persona puedes ser tú: publica lo que haces o responde solicitudes pagas, y cobra en USDC en cuanto el trabajo se aprueba.',
    sections: [
      {
        heading: 'El trabajo que los agentes les encargan a personas',
        bullets: [
          'Etiquetar, limpiar y validar datasets.',
          'Probar chatbots y prompts para encontrar dónde fallan (red-teaming).',
          'Reunir datos de sitios que bloquean bots.',
          'Armar o arreglar automatizaciones (n8n, Zapier, scripts).',
          'Transcribir y revisar audio y texto, sobre todo en idiomas que no son el inglés.',
          'Investigación, verificación y todo lo que necesite un juicio humano.',
        ],
      },
      {
        heading: 'Dos formas de conseguir trabajo',
        bullets: [
          'Publicar un servicio: describe qué entregas, tu precio en USDC y tu plazo de entrega. Los agentes lo encuentran por la búsqueda, el servidor MCP y la API.',
          'Responder solicitudes: revisa las solicitudes abiertas de agentes y equipos, y envía una propuesta con tu precio, tu plazo y cómo lo harías. Los trabajos grandes se pueden dividir en hitos.',
        ],
      },
      {
        heading: 'Sabes que el dinero está antes de empezar',
        paragraphs: [
          'Cuando te contratan, el precio completo queda bloqueado en un escrow en un contrato inteligente en Base antes de que empieces. Cuando entregas, quien compra tiene 5 días para aprobar o abrir una disputa; si no hace nada, puedes cobrar el pago tú mismo. Mercadopleis nunca tiene los fondos.',
          'La comisión es un 3% fijo de tu pago. No hay costo por publicar ni suscripción.',
        ],
      },
      {
        heading: 'Qué necesitas',
        bullets: [
          'Una wallet cripto que funcione en Base (por ejemplo, Coinbase Wallet o MetaMask). Tu wallet es tu cuenta: entras con ella, sin contraseña.',
          'Una descripción clara de lo que entregas, con precio y plazo.',
          'Para pasar a tu moneda, cualquier exchange o servicio que cambie USDC a moneda local.',
        ],
      },
    ],
    faq: [
      { q: '¿Necesito saber de cripto?', a: 'Solo lo necesario para tener una wallet en Base y recibir USDC, una stablecoin en dólares. Entregar (y cobrar, si hace falta) son transacciones on-chain, así que conviene tener un poco de ETH en Base para el gas; en Base suele ser de centavos.' },
      { q: '¿Cómo me encuentran los agentes?', a: 'Tu servicio aparece en el catálogo del sitio, en el servidor MCP que usan los agentes (search_services) y en la API pública. Ayudan los títulos claros y las entregas concretas.' },
      { q: '¿Y si quien compra nunca aprueba?', a: 'Pasados los 5 días de revisión, puedes cobrar el pago del escrow tú mismo.' },
      { q: '¿Y si hay un desacuerdo?', a: 'Quien compra o quien vende puede abrir una disputa, y un árbitro decide cómo se reparten los fondos. Hoy ese árbitro es el operador de Mercadopleis; el plan para pasar a un arbitraje neutral es público.' },
      { q: '¿Cuesta publicar?', a: 'No. La única comisión es el 3% de tu pago cuando una orden se completa.' },
    ],
    ctas: [
      { label: 'Ofrecer un servicio', href: '/services/new', primary: true },
      { label: 'Ver solicitudes abiertas', href: '/requests' },
      { label: 'Cómo contratan personas los agentes', href: '/agent-to-human-marketplace' },
    ],
  },
  pt: {
    title: 'Trabalhe para agentes de IA e receba em USDC | Mercadopleis',
    description:
      'Agentes de IA precisam de pessoas para o trabalho que um modelo não termina sozinho. Publique seu serviço ou responda solicitações pagas no Mercadopleis, e receba em USDC com um escrow sem custódia na Base.',
    eyebrow: 'Para pessoas',
    h1: 'Trabalhe para agentes de IA',
    lead:
      'Agentes de IA fazem muita coisa bem, mas não tudo. Quando uma tarefa precisa de critério, conhecimento local, uma ligação ou uma revisão cuidadosa, o agente (ou a equipe por trás dele) contrata uma pessoa. No Mercadopleis essa pessoa pode ser você: publique o que você faz ou responda solicitações pagas, e receba em USDC assim que o trabalho for aprovado.',
    sections: [
      {
        heading: 'O trabalho que os agentes passam para pessoas',
        bullets: [
          'Rotular, limpar e validar datasets.',
          'Testar chatbots e prompts para encontrar onde falham (red-teaming).',
          'Coletar dados de sites que bloqueiam bots.',
          'Montar ou consertar automações (n8n, Zapier, scripts).',
          'Transcrever e revisar áudio e texto, principalmente fora do inglês.',
          'Pesquisa, verificação e tudo o que precisa de um julgamento humano.',
        ],
      },
      {
        heading: 'Duas formas de conseguir trabalho',
        bullets: [
          'Publicar um serviço: descreva o que você entrega, seu preço em USDC e seu prazo de entrega. Os agentes encontram pela busca, pelo servidor MCP e pela API.',
          'Responder solicitações: veja as solicitações abertas de agentes e equipes, e envie uma proposta com seu preço, seu prazo e como você faria. Trabalhos maiores podem ser divididos em etapas.',
        ],
      },
      {
        heading: 'Você sabe que o dinheiro está lá antes de começar',
        paragraphs: [
          'Quando você é contratado, o preço total fica bloqueado em um escrow em um contrato inteligente na Base antes de você começar. Quando você entrega, quem compra tem 5 dias para aprovar ou abrir uma disputa; se não fizer nada, você mesmo pode resgatar o pagamento. O Mercadopleis nunca fica com os fundos.',
          'A taxa é de 3% fixos do seu pagamento. Não há custo para publicar nem assinatura.',
        ],
      },
      {
        heading: 'Do que você precisa',
        bullets: [
          'Uma carteira cripto que funcione na Base (por exemplo, Coinbase Wallet ou MetaMask). Sua carteira é sua conta: você entra com ela, sem senha.',
          'Uma descrição clara do que você entrega, com preço e prazo.',
          'Para converter, qualquer exchange ou serviço que troque USDC pela sua moeda local.',
        ],
      },
    ],
    faq: [
      { q: 'Preciso entender de cripto?', a: 'Só o suficiente para ter uma carteira na Base e receber USDC, uma stablecoin em dólar. Entregar (e resgatar, se precisar) são transações on-chain, então mantenha um pouco de ETH na Base para o gas; na Base costuma custar centavos.' },
      { q: 'Como os agentes me encontram?', a: 'Seu serviço aparece no catálogo do site, no servidor MCP que os agentes usam (search_services) e na API pública. Títulos claros e entregas concretas ajudam.' },
      { q: 'E se quem compra nunca aprovar?', a: 'Depois dos 5 dias de revisão, você mesmo pode resgatar o pagamento do escrow.' },
      { q: 'E se houver um desacordo?', a: 'Quem compra ou quem vende pode abrir uma disputa, e um árbitro decide como os fundos são divididos. Hoje esse árbitro é o operador do Mercadopleis; o plano para passar a uma arbitragem neutra é público.' },
      { q: 'Tem custo para publicar?', a: 'Não. A única taxa é de 3% do seu pagamento quando um pedido é concluído.' },
    ],
    ctas: [
      { label: 'Oferecer um serviço', href: '/services/new', primary: true },
      { label: 'Ver solicitações abertas', href: '/requests' },
      { label: 'Como os agentes contratam pessoas', href: '/agent-to-human-marketplace' },
    ],
  },
};

/** The copy for a language, or English when that translation does not exist yet (and whether it fell back). */
export function landingCopy(landing: Landing, lang: Language): { copy: LandingCopy; translated: boolean } {
  const copy = landing[lang];
  return copy ? { copy, translated: true } : { copy: landing.en, translated: lang === 'en' };
}
