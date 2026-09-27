import { NextRequest, NextResponse } from 'next/server';
import { db, services } from '@mercadopleis/database';
import { eq, desc } from 'drizzle-orm';
import { getAuthUserFromRequest } from '@/lib/serverAuth';

const DEFAULT_SERVICES = [
  {
    id: 's-1',
    sellerId: 'user-1',
    title: 'Desarrollo de Smart Contract Escrow o ERC20 en Solidity',
    slug: 'desarrollo-smart-contract-escrow-solidity',
    description: 'Desarrollo integral de smart contracts con Foundry y OpenZeppelin. Pruebas unitarias, fuzz testing de invariantes matemáticas, optimización de gas y scripts de despliegue para Base.',
    category: 'development',
    priceUsdc: '250.00',
    deliveryDays: 4,
    isActive: true,
    seller: {
      id: 'user-1',
      walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      displayName: 'Pablo C.',
      username: 'pablo',
    },
  },
  {
    id: 's-2',
    sellerId: 'user-1',
    title: 'Diseño UI/UX de Landing Page Web3 en Figma',
    slug: 'diseno-ui-ux-landing-page-web3-figma',
    description: 'Prototipo interactivo en Figma de alta fidelidad, sistema de diseño con componentes reutilizables y paleta dark mode premium con gradientes sutiles.',
    category: 'design',
    priceUsdc: '180.00',
    deliveryDays: 3,
    isActive: true,
    seller: {
      id: 'user-1',
      walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      displayName: 'Pablo C.',
      username: 'pablo',
    },
  },
  {
    id: 's-3',
    sellerId: 'user-1',
    title: 'Redacción de Documentación Técnica & Whitepaper Cripto',
    slug: 'redaccion-documentacion-tecnica-whitepaper',
    description: 'Especificación de arquitectura, flujos de smart contracts, tokenomics y modelo de negocio en inglés y español.',
    category: 'marketing',
    priceUsdc: '150.00',
    deliveryDays: 5,
    isActive: true,
    seller: {
      id: 'user-1',
      walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      displayName: 'Pablo C.',
      username: 'pablo',
    },
  },
  {
    id: 's-4',
    sellerId: 'user-1',
    title: 'Consultoría y Auditoría de Seguridad Preliminar de Contratos',
    slug: 'consultoria-auditoria-seguridad-contratos',
    description: 'Revisión técnica de vectores de reentrancy, control de acceso, Slither analysis y recomendaciones de optimización de gas.',
    category: 'consulting',
    priceUsdc: '300.00',
    deliveryDays: 3,
    isActive: true,
    seller: {
      id: 'user-1',
      walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      displayName: 'Pablo C.',
      username: 'pablo',
    },
  },
];

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category');
  try {
    let whereClause = eq(services.isActive, true);

    const allServices = await db.query.services.findMany({
      where: whereClause,
      orderBy: [desc(services.createdAt)],
      with: {
        seller: {
          columns: {
            id: true,
            walletAddress: true,
            displayName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    const filtered = category && category !== 'all'
      ? (allServices as any[]).filter((s: any) => s.category?.toLowerCase() === category.toLowerCase())
      : allServices;

    return NextResponse.json({ services: filtered });
  } catch (err: any) {
    console.warn('Database offline or unconfigured, returning default catalog:', err?.message);
    const filtered = category && category !== 'all'
      ? DEFAULT_SERVICES.filter((s) => s.category.toLowerCase() === category.toLowerCase())
      : DEFAULT_SERVICES;
    return NextResponse.json({ services: filtered });
  }
}

export async function POST(request: NextRequest) {
  const authUser = getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, description, category, priceUsdc, deliveryDays, coverImageUrl } = body;

    if (!title || !description || !category || !priceUsdc || !deliveryDays) {
      return NextResponse.json({ error: 'Missing required service fields' }, { status: 400 });
    }

    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') + `-${Date.now().toString(36)}`;

    const [newService] = await db
      .insert(services)
      .values({
        sellerId: authUser.id,
        title,
        slug,
        description,
        category,
        priceUsdc: priceUsdc.toString(),
        deliveryDays: parseInt(deliveryDays.toString(), 10),
        coverImageUrl: coverImageUrl || null,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ service: newService }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating service:', err);
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  }
}
