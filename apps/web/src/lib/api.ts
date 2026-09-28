const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export function getAuthToken(address?: string | null): string | null {
  if (typeof window === 'undefined') return null;
  if (address) {
    const specific = localStorage.getItem(`mercadopleis_jwt_${address.toLowerCase()}`);
    if (specific) return specific;
  }
  return localStorage.getItem('mercadopleis_jwt');
}

export function setAuthToken(token: string, address?: string | null) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('mercadopleis_jwt', token);
  if (address) {
    localStorage.setItem(`mercadopleis_jwt_${address.toLowerCase()}`, token);
  }
}

export function clearAuthToken(address?: string | null) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('mercadopleis_jwt');
  if (address) {
    localStorage.removeItem(`mercadopleis_jwt_${address.toLowerCase()}`);
  }
}

/**
 * Fetch services from PostgreSQL backend API
 */
export async function fetchServices(category?: string | null, search?: string) {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const endpoint = API_URL.startsWith('http') ? `${API_URL}/services` : `${base}${API_URL}/services`;
    const url = new URL(endpoint);
    if (category) url.searchParams.append('category', category);
    if (search) url.searchParams.append('search', search);

    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch services');
    const data = await res.json();
    return data.services || [];
  } catch (error) {
    console.warn('[API] Could not fetch services from backend, using fallback:', error);
    return null;
  }
}

/**
 * Request nonce from backend for SIWE
 */
export async function getNonce(address: string): Promise<string> {
  const res = await fetch(`${API_URL}/auth/nonce?address=${address}`);
  if (!res.ok) throw new Error('Failed to obtain SIWE nonce');
  const data = await res.json();
  return data.nonce;
}

/**
 * Verify SIWE signature and store JWT
 */
export async function verifySignature(address: string, signature: string, message: string) {
  const res = await fetch(`${API_URL}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, signature, message }),
  });
  if (!res.ok) throw new Error('Signature verification failed');
  const data = await res.json();
  if (data.token) {
    setAuthToken(data.token, address);
  }
  return data;
}

/**
 * Create a new service in PostgreSQL
 */
export async function createService(serviceData: {
  title: string;
  description: string;
  category: string;
  priceUsdc: number;
  deliveryDays: number;
}) {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/services`, {
    method: 'POST',
    headers,
    body: JSON.stringify(serviceData),
  });
  if (!res.ok) throw new Error('Failed to create service in database');
  return await res.json();
}

/**
 * Fetch orders for current authenticated user from PostgreSQL
 */
export async function fetchMyOrders(role?: 'buyer' | 'seller') {
  const token = getAuthToken();
  if (!token) return null;

  try {
    const url = new URL(`${API_URL}/orders/my`);
    if (role) url.searchParams.append('role', role);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!res.ok) throw new Error('Failed to fetch user orders');
    const data = await res.json();
    return data.orders || [];
  } catch (err) {
    console.warn('[API] Could not fetch orders from backend:', err);
    return null;
  }
}

/**
 * Creates an order record in PostgreSQL
 */
export async function createOrder(serviceId: string) {
  const token = getAuthToken();
  if (!token) return null;

  const res = await fetch(`${API_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ serviceId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create order in database');
  }

  return await res.json();
}

/**
 * Updates order status or delivery details in PostgreSQL
 */
export async function updateOrder(
  orderId: string,
  updates: {
    status?: string;
    contractOrderId?: number;
    txHashFunding?: string;
    txHashRelease?: string;
    deliveryUrl?: string;
    deliveryHash?: string;
  }
) {
  const token = getAuthToken();
  if (!token) return null;

  const res = await fetch(`${API_URL}/orders/${orderId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to update order');
  }

  return await res.json();
}

/**
 * Fetch disputes (all disputes if admin, user-specific disputes otherwise)
 */
export async function fetchDisputes() {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}/disputes`, {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch disputes');
    const data = await res.json();
    return data.disputes || [];
  } catch (err) {
    console.warn('[API] Could not fetch disputes:', err);
    return [];
  }
}

/**
 * Open a dispute on backend
 */
export async function openDisputeApi(data: {
  orderId: string;
  reason: string;
  evidenceUrl?: string;
}) {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/disputes`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to open dispute on backend');
  }

  return await res.json();
}

/**
 * Resolve dispute on backend
 */
export async function resolveDisputeApi(
  disputeId: string,
  resolution: {
    sellerAwardUsdc: number;
    buyerRefundUsdc: number;
    resolutionNotes?: string;
  }
) {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/disputes/${disputeId}/resolve`, {
    method: 'POST',
    headers,
    body: JSON.stringify(resolution),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to resolve dispute on backend');
  }

  return await res.json();
}

/**
 * Submit review for completed order
 */
export async function submitReview(reviewData: {
  orderId: string;
  rating: number;
  comment: string;
}) {
  const token = getAuthToken();
  if (!token) throw new Error('Debes iniciar sesión con SIWE para calificar');

  const res = await fetch(`${API_URL}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(reviewData),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to submit review');
  }

  return await res.json();
}

/**
 * Fetch reviews for a service
 */
export async function fetchServiceReviews(serviceId: string) {
  try {
    const res = await fetch(`${API_URL}/reviews/service/${serviceId}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch service reviews');
    const data = await res.json();
    return data.reviews || [];
  } catch (err) {
    console.warn('[API] Could not fetch service reviews:', err);
    return [];
  }
}
