import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/web/.env.local') });

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('No DATABASE_URL found');
  process.exit(1);
}

const sql = postgres(url, { ssl: 'require' });

async function run() {
  console.log('--- Seeding AI & Technical Services Catalog ---');

  // Asegurar usuario vendedor base
  const sellerWallet = '0x9ddf9f930ff5b7064ffcee63738af7f6a31afb10';
  let [sellerUser] = await sql`
    SELECT id, wallet_address, display_name FROM users 
    WHERE LOWER(wallet_address) = LOWER(${sellerWallet});
  `;

  if (!sellerUser) {
    [sellerUser] = await sql`
      INSERT INTO users (wallet_address, username, display_name, bio, country, role)
      VALUES (
        ${sellerWallet},
        'pablo_data_ai',
        'Pablo - Audio & AI Annotation',
        'Especialista en transcripción fonética y anotación de datos conversacionales en español nativo para entrenamiento de IA y modelos de reconocimiento de voz.',
        'UY',
        'USER'
      )
      RETURNING id, wallet_address, display_name;
    `;
  }

  // Lista de 5 servicios semilla en el rango $10 - $35 USDC
  const seedServices = [
    {
      slug: 'transcripcion-audio-anotacion-datos-ia-espanol',
      title: 'Transcripción de Audio y Anotación de Datos en Español Nativo para Modelos de IA',
      description: 'Servicio profesional de transcripción fonética y ortográfica precisa en español nativo (latinoamericano / rioplatense / neutro) y formateo de datos para entrenamiento o fine-tuning de modelos de reconocimiento de voz (ASR / Whisper / STT) y datasets conversacionales para LLMs.\n\nIncluye:\n• Paquete base: hasta 10 minutos de video/audio o hasta 200 segmentos de anotación.\n• Transcripción manual exacta con marcas de tiempo (timestamps) si se requiere.\n• Anotación sintáctica y categorización de intención (intent / entity tagging).\n• Limpieza de ruido, corrección de falsos positivos en audios con acentos regionales.\n• Entrega en formato JSON, CSV o TXT estructurado según tu pipeline de machine learning.',
      category: 'ai_data',
      priceUsdc: 20.00,
      deliveryDays: 2,
      deliveryType: 'digital',
      coverImageUrl: '/uploads/transcripcion-audio-es.jpg',
    },
    {
      slug: 'limpieza-preparacion-datasets-llms-jsonl',
      title: 'Limpieza, Deduplicación y Formateo de Datasets para Fine-Tuning de LLMs',
      description: 'Preparación y curación de conjuntos de datos de texto y conversacionales en formato JSONL / CSV para entrenamiento o fine-tuning con Llama, Mistral, OpenAI u Ollama.\n\nIncluye:\n• Eliminación de duplicados y filtrado de contenido de baja calidad o ruidoso.\n• Estandarización de roles conversacionales (system, user, assistant).\n• Validación sintáctica y compatibilidad con formatos estándar de tokenización.\n• Entrega de hasta 1,000 pares de prompts/respuestas depurados.',
      category: 'ai_data',
      priceUsdc: 15.00,
      deliveryDays: 2,
      deliveryType: 'digital',
      coverImageUrl: null,
    },
    {
      slug: 'automatizacion-flujo-n8n-make-openai',
      title: 'Configuración de Flujo Automatizado en n8n o Make con Integración de OpenAI / Claude',
      description: 'Diseño e implementación de un workflow automatizado para conectar APIs, procesar información con LLMs y guardar resultados automáticamente.\n\nIncluye:\n• Conexión de webhook o trigger con OpenAI / Claude para clasificación o generación de texto.\n• Exportación de datos estructurados hacia Google Sheets, Notion, Airtable o base de datos PostgreSQL.\n• Pruebas de ejecución y exportación del archivo JSON del workflow listo para importar.\n• Documentación de variables de entorno y soporte post-entrega.',
      category: 'development',
      priceUsdc: 35.00,
      deliveryDays: 2,
      deliveryType: 'digital',
      coverImageUrl: null,
    },
    {
      slug: 'optimizacion-red-teaming-system-prompts',
      title: 'Red-Teaming, Evaluación y Optimización de System Prompts para Agentes Autónomos',
      description: 'Auditoría y afinación de instrucciones de sistema (system prompts) para evitar jailbreaks, alucinaciones y derivación fuera de contexto en agentes de IA.\n\nIncluye:\n• Batería de pruebas de estrés adversarial (prompt injection y edge cases).\n• Refuerzo de restricciones de seguridad y formato de salida estricto (JSON / Markdown).\n• Reporte técnico con métricas de estabilidad y versión optimizada del prompt.',
      category: 'ai_data',
      priceUsdc: 10.00,
      deliveryDays: 1,
      deliveryType: 'digital',
      coverImageUrl: null,
    },
    {
      slug: 'script-python-web-scraping-extraccion-datos',
      title: 'Script en Python para Extracción y Web Scraping de Datos Estructurados',
      description: 'Desarrollo de un script modular en Python (BeautifulSoup / Playwright / Requests) para recolectar información pública de sitios web y estructurarla limpiamente.\n\nIncluye:\n• Código fuente en Python limpio, comentado y listo para ejecutar en local o servidor.\n• Manejo de paginación y almacenamiento de resultados en CSV, JSON o SQLite.\n• Guía rápida de configuración del entorno virtual y dependencias requeridas.',
      category: 'development',
      priceUsdc: 25.00,
      deliveryDays: 2,
      deliveryType: 'digital',
      coverImageUrl: null,
    },
  ];

  for (const s of seedServices) {
    const [existing] = await sql`SELECT id FROM services WHERE slug = ${s.slug};`;
    if (existing) {
      await sql`
        UPDATE services SET
          seller_id = ${sellerUser.id},
          title = ${s.title},
          description = ${s.description},
          category = ${s.category},
          price_usdc = ${s.priceUsdc},
          delivery_days = ${s.deliveryDays},
          delivery_type = ${s.deliveryType},
          cover_image_url = ${s.coverImageUrl},
          is_active = true
        WHERE id = ${existing.id};
      `;
      console.log(`Updated service: "${s.title}" (${s.priceUsdc} USDC)`);
    } else {
      await sql`
        INSERT INTO services (
          seller_id,
          title,
          slug,
          description,
          category,
          price_usdc,
          delivery_days,
          delivery_type,
          cover_image_url,
          is_active
        ) VALUES (
          ${sellerUser.id},
          ${s.title},
          ${s.slug},
          ${s.description},
          ${s.category},
          ${s.priceUsdc},
          ${s.deliveryDays},
          ${s.deliveryType},
          ${s.coverImageUrl},
          true
        );
      `;
      console.log(`Inserted service: "${s.title}" (${s.priceUsdc} USDC)`);
    }
  }

  const activeServices = await sql`
    SELECT s.id, s.title, s.category, s.price_usdc 
    FROM services s 
    WHERE s.is_active = true;
  `;
  console.log(`\nTotal active services in catalog now: ${activeServices.length}`);
  for (const item of activeServices) {
    console.log(` • [${item.category}] ${item.title} -> ${item.price_usdc} USDC`);
  }

  await sql.end();
}

run().catch((e) => {
  console.error('Error seeding services:', e);
  process.exit(1);
});
