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
  console.log('1. Checking current services in database...');
  const allServices = await sql`SELECT id, title, slug, price_usdc, is_active FROM services;`;
  console.log(`Found ${allServices.length} total services.`);

  // Desactivar todos los servicios de prueba para que no se muestren en la plataforma
  console.log('\n2. Deactivating all previous dummy test services...');
  const updated = await sql`UPDATE services SET is_active = false RETURNING id, title;`;
  console.log(`Deactivated ${updated.length} dummy services.`);

  // Configurar usuario vendedor real
  const sellerWallet = '0x9ddf9f930ff5b7064ffcee63738af7f6a31afb10';
  console.log(`\n3. Setting up verified seller user for wallet: ${sellerWallet}...`);
  
  let [user] = await sql`
    SELECT id, wallet_address, display_name FROM users 
    WHERE LOWER(wallet_address) = LOWER(${sellerWallet});
  `;

  if (!user) {
    [user] = await sql`
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
    console.log('Created seller user:', user.display_name);
  } else {
    console.log('Found seller user:', user.display_name);
  }

  // Insertar servicio real
  const serviceSlug = 'transcripcion-audio-anotacion-datos-ia-espanol';
  console.log(`\n4. Inserting verified real service: "${serviceSlug}"...`);

  const [existing] = await sql`SELECT id FROM services WHERE slug = ${serviceSlug};`;
  if (existing) {
    await sql`
      UPDATE services SET
        seller_id = ${user.id},
        title = 'Transcripción de Audio y Anotación de Datos en Español Nativo para Modelos de IA',
        description = 'Servicio profesional de transcripción fonética y ortográfica precisa en español nativo (latinoamericano / rioplatense / neutro) y formateo de datos para entrenamiento o fine-tuning de modelos de reconocimiento de voz (ASR / Whisper / STT) y datasets conversacionales para LLMs.\n\nIncluye:\n• Paquete base: hasta 10 minutos de video/audio o hasta 200 segmentos de anotación.\n• Transcripción manual exacta con marcas de tiempo (timestamps) si se requiere.\n• Anotación sintáctica y categorización de intención (intent / entity tagging).\n• Limpieza de ruido, corrección de falsos positivos en audios con acentos regionales.\n• Entrega en formato JSON, CSV o TXT estructurado según tu pipeline de machine learning.',
        category: 'development',
        price_usdc = 20.00,
        delivery_days = 2,
        delivery_type = 'digital',
        cover_image_url = '/uploads/transcripcion-audio-es.jpg',
        is_active = true
      WHERE id = ${existing.id};
    `;
    console.log('Existing real service updated and activated.');
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
        ${user.id},
        'Transcripción de Audio y Anotación de Datos en Español Nativo para Modelos de IA',
        ${serviceSlug},
        'Servicio profesional de transcripción fonética y ortográfica precisa en español nativo (latinoamericano / rioplatense / neutro) y formateo de datos para entrenamiento o fine-tuning de modelos de reconocimiento de voz (ASR / Whisper / STT) y datasets conversacionales para LLMs.\n\nIncluye:\n• Paquete base: hasta 10 minutos de video/audio o hasta 200 segmentos de anotación.\n• Transcripción manual exacta con marcas de tiempo (timestamps) si se requiere.\n• Anotación sintáctica y categorización de intención (intent / entity tagging).\n• Limpieza de ruido, corrección de falsos positivos en audios con acentos regionales.\n• Entrega en formato JSON, CSV o TXT estructurado según tu pipeline de machine learning.',
        'development',
        20.00,
        2,
        'digital',
        '/uploads/transcripcion-audio-es.jpg',
        true
      );
    `;
    console.log('Real service created and published!');
  }

  const activeServices = await sql`
    SELECT s.id, s.title, s.slug, s.price_usdc, u.wallet_address 
    FROM services s
    JOIN users u ON s.seller_id = u.id
    WHERE s.is_active = true;
  `;
  console.log(`\nActive services in production catalog now: ${activeServices.length}`);
  for (const s of activeServices) {
    console.log(` - "${s.title}" (${s.price_usdc} USDC) | Seller: ${s.wallet_address}`);
  }

  await sql.end();
}

run().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
