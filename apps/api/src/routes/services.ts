import { Router, Response } from 'express';
import { db, services, users } from '@mercadopleis/database';
import { eq, and, desc, ilike } from 'drizzle-orm';
import { requireAuth, AuthenticatedRequest } from './auth';

export const servicesRouter = Router();

/**
 * Lists marketplace services
 */
servicesRouter.get('/', async (req, res) => {
  try {
    const { category, search, limit = '20', offset = '0' } = req.query;

    const conditions = [eq(services.isActive, true)];

    if (category && typeof category === 'string') {
      conditions.push(eq(services.category, category));
    }

    if (search && typeof search === 'string') {
      conditions.push(ilike(services.title, `%${search}%`));
    }

    const result = await db.query.services.findMany({
      where: and(...conditions),
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
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

    return res.json({ services: result });
  } catch (error) {
    console.error('Error fetching services:', error);
    return res.status(500).json({ error: 'Failed to fetch services' });
  }
});

/**
 * Gets service by slug
 */
servicesRouter.get('/:slug', async (req, res) => {
  try {
    const service = await db.query.services.findFirst({
      where: eq(services.slug, req.params.slug),
      with: {
        seller: true,
        orders: {
          limit: 10,
          orderBy: [desc(services.createdAt)],
        },
      },
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    return res.json({ service });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch service' });
  }
});

/**
 * Creates a new service offering (requires auth)
 */
servicesRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, description, category, priceUsdc, deliveryDays, coverImageUrl } = req.body;

    if (!title || !description || !category || !priceUsdc || !deliveryDays) {
      return res.status(400).json({ error: 'Missing required service fields' });
    }

    const baseSlug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const randomSuffix = Math.floor(Math.random() * 10000);
    const slug = `${baseSlug}-${randomSuffix}`;

    const [newService] = await db
      .insert(services)
      .values({
        sellerId: req.user!.id,
        title,
        slug,
        description,
        category,
        priceUsdc: priceUsdc.toString(),
        deliveryDays: parseInt(deliveryDays, 10),
        coverImageUrl,
        isActive: true,
      })
      .returning();

    return res.status(201).json({ service: newService });
  } catch (error) {
    console.error('Error creating service:', error);
    return res.status(500).json({ error: 'Failed to create service' });
  }
});
