'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'es' | 'en';

export const translations = {
  es: {
    // Nav
    escrowBadge: 'Escrow Non-Custodial en Base',
    postService: 'Publicar Servicio',
    myOrders: 'Mis Órdenes',
    adminPanel: 'Panel Admin',
    faucet: 'Faucet',
    signSession: 'Firmar Sesión (SIWE)',
    signing: 'Firmando...',
    exploreServices: 'Explorar Servicios',
    
    // Home / Hero
    heroTitle: 'Marketplace Descentralizado de Servicios en Base',
    heroSubtitle: 'Contrata talento digital internacional con liquidación instantánea en USDC mediante smart contracts non-custodial.',
    searchPlaceholder: 'Buscar servicios por título, tecnología o descripción...',
    allCategories: 'Todos',
    catDev: 'Desarrollo',
    catDesign: 'Diseño',
    catMarketing: 'Marketing',
    catConsulting: 'Consultoría',
    noServicesFound: 'No se encontraron servicios',
    noServicesDesc: 'Intenta con otro término de búsqueda o selecciona otra categoría.',
    clearFilters: 'Limpiar Filtros',
    
    // Orders
    ordersTitle: 'Panel de Órdenes',
    ordersSubtitle: 'Supervisa tus contratos de escrow activos en Base, aprueba entregas o gestiona cobros.',
    refresh: 'Actualizar',
    clearCache: 'Limpiar Caché',
    asBuyer: 'Como Comprador',
    asSeller: 'Como Prestador',
    statusFunded: 'Fondeada (En progreso)',
    statusDelivered: 'Entregada (En revisión)',
    statusReleased: 'Completada & Pagada',
    statusRefunded: 'Reembolsada 100%',
    statusDisputed: 'En Disputa',
    approveAndRelease: 'Aprobar Entrega y Liberar Pago',
    openDispute: 'Abrir Disputa',
    submitDelivery: 'Registrar Entrega de Trabajo',
    rateService: 'Calificar Servicio',
    rated: 'Calificado',
    autoReleaseNotice: 'Auto-release activo en 4 días si no hay disputa.',
    sellerWorkingNotice: 'El prestador está trabajando. Si no entrega antes del plazo acordado, podrás reclamar el 100% de reembolso.',
    sellerDeliveredNotice: 'Entrega enviada al comprador. Si el cliente no revisa en 5 días, los fondos se liberarán automáticamente a tu wallet.',
    contractFinalized: 'Contrato finalizado y fondos liberados.',
    viewTimelineAndChat: 'Ver Línea de Tiempo & Mensajes',
    hideTimelineAndChat: 'Ocultar Actividad & Mensajes',
    noOrdersBuyer: 'Aún no has contratado servicios',
    noOrdersSeller: 'Aún no has recibido órdenes',
    noOrdersBuyerDesc: 'Explora el catálogo de servicios verificados y contrata con la seguridad de smart contracts en Base Sepolia con USDC.',
    noOrdersSellerDesc: 'Publica tus habilidades en el catálogo internacional y comienza a recibir pagos asegurados en escrow.',
    
    // Disputes in Order
    disputeTitleOpen: 'Disputa en Curso — Fondos Congelados en Escrow',
    disputeTitleResolved: 'Fallo de Mediación y Arbitraje Emitido',
    disputeBadgeOpen: 'EN MEDIACIÓN',
    disputeBadgeResolved: 'RESUELTA',
    disputeReasonLabel: 'Motivo del reclamo',
    disputeEvidenceLabel: 'Prueba aportada',
    disputeUnderReviewNotice: 'El proceso de mediación y arbitraje neutral está evaluando las pruebas del caso. Los fondos en USDC permanecen asegurados de forma non-custodial en el contrato de Escrow de Base Sepolia.',
    disputeResolvedNotice: 'Resolución de mediación ejecutada',
    disputeArbitratorNotes: 'Fundamentación de la resolución',
    
    // Dispute Modal
    modalDisputeTitle: 'Abrir Disputa de Orden',
    modalDisputeDesc: 'Al abrir una disputa, el auto-release de fondos se congela de inmediato en el smart contract escrow. El servicio de mediación y arbitraje neutral evaluará el caso para determinar la distribución o reembolso justo de los fondos.',
    modalDisputeReasonLabel: 'Motivo detallado del reclamo',
    modalDisputeReasonPlaceholder: 'Explica detalladamente por qué el trabajo no cumple con lo acordado (ej. fallos de compilación, requerimientos no incluidos, entregable erróneo)...',
    modalDisputeEvidenceLabel: 'Enlace a pruebas / evidencia (URL pública, GitHub, Google Drive, etc.)',
    modalDisputeNotice: '⚠️ Las pruebas aportadas y los mensajes intercambiados en la orden serán evaluados para dictar la resolución final.',
    cancel: 'Cancelar',
    confirmAndFreeze: 'Confirmar y Congelar Fondos',
    freezingEscrow: 'Congelando Fondos en Escrow...',
    
    // Footer
    footerCopyright: 'mercadopleis. Smart Contracts en Base. Liquidación instantánea con USDC.',
    footerTagline: 'Non-custodial by design. Invariablemente auditable on-chain.',
    
    // 404
    notFoundTitle: 'Página no encontrada',
    notFoundDesc: 'La página que estás buscando no existe, ha sido movida o la dirección ingresada no es válida.',
    backToHome: 'Volver al Inicio',
  },
  en: {
    // Nav
    escrowBadge: 'Non-Custodial Escrow on Base',
    postService: 'Post Service',
    myOrders: 'My Orders',
    adminPanel: 'Admin Panel',
    faucet: 'Faucet',
    signSession: 'Sign Session (SIWE)',
    signing: 'Signing...',
    exploreServices: 'Explore Services',
    
    // Home / Hero
    heroTitle: 'Decentralized Marketplace for Services on Base',
    heroSubtitle: 'Hire global digital talent with instant USDC settlement secured by non-custodial smart contracts.',
    searchPlaceholder: 'Search services by title, skills or keywords...',
    allCategories: 'All',
    catDev: 'Development',
    catDesign: 'Design',
    catMarketing: 'Marketing',
    catConsulting: 'Consulting',
    noServicesFound: 'No services found',
    noServicesDesc: 'Try another search query or select a different category.',
    clearFilters: 'Clear Filters',
    
    // Orders
    ordersTitle: 'Orders Dashboard',
    ordersSubtitle: 'Monitor your active escrow contracts on Base, approve deliveries, or manage payouts.',
    refresh: 'Refresh',
    clearCache: 'Clear Cache',
    asBuyer: 'As Buyer',
    asSeller: 'As Seller',
    statusFunded: 'Funded (In progress)',
    statusDelivered: 'Delivered (Under review)',
    statusReleased: 'Completed & Paid',
    statusRefunded: 'Refunded 100%',
    statusDisputed: 'In Dispute',
    approveAndRelease: 'Approve Delivery & Release Payment',
    openDispute: 'Open Dispute',
    submitDelivery: 'Submit Work Delivery',
    rateService: 'Rate Service',
    rated: 'Rated',
    autoReleaseNotice: 'Auto-release active in 4 days if no dispute is opened.',
    sellerWorkingNotice: 'The freelancer is working. If not delivered before deadline, you can claim 100% refund.',
    sellerDeliveredNotice: 'Delivery submitted to buyer. If client does not review in 5 days, funds auto-release to your wallet.',
    contractFinalized: 'Contract completed and escrow funds released.',
    viewTimelineAndChat: 'View Activity Timeline & Messages',
    hideTimelineAndChat: 'Hide Activity & Messages',
    noOrdersBuyer: 'You have not hired any services yet',
    noOrdersSeller: 'You have not received any orders yet',
    noOrdersBuyerDesc: 'Explore verified services and hire with smart contract security on Base Sepolia using USDC.',
    noOrdersSellerDesc: 'List your skills on the international marketplace and start receiving secured escrow payments.',
    
    // Disputes in Order
    disputeTitleOpen: 'Dispute in Progress — Funds Frozen in Escrow',
    disputeTitleResolved: 'Mediation & Arbitration Decision Issued',
    disputeBadgeOpen: 'IN MEDIATION',
    disputeBadgeResolved: 'RESOLVED',
    disputeReasonLabel: 'Claim Reason',
    disputeEvidenceLabel: 'Submitted Evidence',
    disputeUnderReviewNotice: 'Neutral mediation & arbitration is reviewing submitted evidence. USDC funds remain non-custodially locked in Base Sepolia escrow.',
    disputeResolvedNotice: 'Mediation resolution executed',
    disputeArbitratorNotes: 'Resolution findings & notes',
    
    // Dispute Modal
    modalDisputeTitle: 'Open Dispute for Order',
    modalDisputeDesc: 'Opening a dispute immediately freezes auto-release in the escrow smart contract. Neutral mediation will review the case to determine fair payout or refund distribution.',
    modalDisputeReasonLabel: 'Detailed Claim Reason',
    modalDisputeReasonPlaceholder: 'Explain in detail why the deliverable does not meet requirements (e.g. compilation errors, missing requirements, incorrect file)...',
    modalDisputeEvidenceLabel: 'Evidence / Proof link (Public URL, GitHub, Google Drive, etc.)',
    modalDisputeNotice: '⚠️ Submitted evidence and in-order messages will be evaluated to render the final resolution.',
    cancel: 'Cancel',
    confirmAndFreeze: 'Confirm & Freeze Funds',
    freezingEscrow: 'Freezing Funds in Escrow...',
    
    // Footer
    footerCopyright: 'mercadopleis. Smart Contracts on Base. Instant settlement with USDC.',
    footerTagline: 'Non-custodial by design. Invariably auditable on-chain.',
    
    // 404
    notFoundTitle: 'Page Not Found',
    notFoundDesc: 'The page you are looking for does not exist, has been moved, or the URL is invalid.',
    backToHome: 'Back to Home',
  },
} as const;

export type TranslationKey = keyof typeof translations['es'];

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'es',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => translations.es[key] || key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('es');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('mercadopleis_lang') as Language | null;
      if (saved && (saved === 'es' || saved === 'en')) {
        setLanguageState(saved);
      } else {
        const browserLang = navigator.language?.toLowerCase();
        if (browserLang && browserLang.startsWith('en')) {
          setLanguageState('en');
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('mercadopleis_lang', lang);
    } catch {
      // Ignore
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'es' ? 'en' : 'es');
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.es[key] || (key as string);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
