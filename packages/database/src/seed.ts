import { db, users, services } from './index';
import { eq } from 'drizzle-orm';

export async function seedDatabase() {
  console.log('[Seed] Seeding initial database data...');

  const sellerWallet = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
  let seller = await db.query.users.findFirst({
    where: eq(users.walletAddress, sellerWallet),
  });

  if (!seller) {
    const [created] = await db
      .insert(users)
      .values({
        walletAddress: sellerWallet,
        username: 'pablo',
        displayName: 'Pablo C.',
        bio: 'Senior Fullstack & Smart Contract Developer especializado en Solidity, Foundry y Next.js.',
        country: 'UY',
        role: 'USER',
      })
      .returning();
    seller = created;
    console.log('[Seed] Created default seller user:', seller.username);
  }

  const initialServices = [
    {
      title: 'Desarrollo de Smart Contract Escrow o ERC20 en Solidity',
      slug: 'desarrollo-smart-contract-escrow-solidity',
      description: 'Desarrollo integral de smart contracts con Foundry y OpenZeppelin. Pruebas unitarias, fuzz testing de invariantes matemáticas, optimización de gas y scripts de despliegue para Base.',
      category: 'development',
      priceUsdc: '250.00',
      deliveryDays: 4,
    },
    {
      title: 'Diseño UI/UX de Landing Page Web3 en Figma',
      slug: 'diseno-ui-ux-landing-page-web3-figma',
      description: 'Prototipo interactivo en Figma de alta fidelidad, sistema de diseño con componentes reutilizables y paleta dark mode premium con gradientes sutiles.',
      category: 'design',
      priceUsdc: '180.00',
      deliveryDays: 3,
    },
    {
      title: 'Redacción de Documentación Técnica & Whitepaper Cripto',
      slug: 'redaccion-documentacion-tecnica-whitepaper',
      description: 'Especificación de arquitectura, flujos de smart contracts, tokenomics y modelo de negocio en inglés y español.',
      category: 'marketing',
      priceUsdc: '150.00',
      deliveryDays: 5,
    },
    {
      title: 'Consultoría y Auditoría de Seguridad Preliminar de Contratos',
      slug: 'consultoria-auditoria-seguridad-contratos',
      description: 'Revisión técnica de vectores de reentrancy, control de acceso, Slither analysis y recomendaciones de optimización de gas.',
      category: 'consulting',
      priceUsdc: '300.00',
      deliveryDays: 3,
    },
  ];

  for (const item of initialServices) {
    const existing = await db.query.services.findFirst({
      where: eq(services.slug, item.slug),
    });

    if (!existing) {
      await db.insert(services).values({
        sellerId: seller.id,
        title: item.title,
        slug: item.slug,
        description: item.description,
        category: item.category,
        priceUsdc: item.priceUsdc,
        deliveryDays: item.deliveryDays,
        isActive: true,
      });
      console.log('[Seed] Inserted service:', item.title);
    }
  }

  console.log('[Seed] Database seeding completed!');
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Seeding failed:', err);
      process.exit(1);
    });
}
