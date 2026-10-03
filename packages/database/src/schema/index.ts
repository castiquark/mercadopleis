import { relations } from 'drizzle-orm';
import { users } from './users';
import { services } from './services';
import { orders } from './orders';
import { disputes } from './disputes';
import { reviews } from './reviews';
import { blockchainTransactions } from './blockchainTransactions';
import { orderMessages } from './orderMessages';

export * from './users';
export * from './services';
export * from './orders';
export * from './disputes';
export * from './reviews';
export * from './blockchainTransactions';
export * from './orderMessages';
export * from './rateLimits';

export const usersRelations = relations(users, ({ many }) => ({
  services: many(services),
  boughtOrders: many(orders, { relationName: 'buyerOrders' }),
  soldOrders: many(orders, { relationName: 'sellerOrders' }),
  writtenReviews: many(reviews, { relationName: 'reviewer' }),
  receivedReviews: many(reviews, { relationName: 'reviewedUser' }),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  seller: one(users, {
    fields: [services.sellerId],
    references: [users.id],
  }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  service: one(services, {
    fields: [orders.serviceId],
    references: [services.id],
  }),
  buyer: one(users, {
    fields: [orders.buyerId],
    references: [users.id],
    relationName: 'buyerOrders',
  }),
  seller: one(users, {
    fields: [orders.sellerId],
    references: [users.id],
    relationName: 'sellerOrders',
  }),
  dispute: one(disputes, {
    fields: [orders.id],
    references: [disputes.orderId],
  }),
  review: one(reviews, {
    fields: [orders.id],
    references: [reviews.orderId],
  }),
  transactions: many(blockchainTransactions),
  messages: many(orderMessages),
}));

export const orderMessagesRelations = relations(orderMessages, ({ one }) => ({
  order: one(orders, {
    fields: [orderMessages.orderId],
    references: [orders.id],
  }),
  sender: one(users, {
    fields: [orderMessages.senderId],
    references: [users.id],
  }),
}));

export const disputesRelations = relations(disputes, ({ one }) => ({
  order: one(orders, {
    fields: [disputes.orderId],
    references: [orders.id],
  }),
  openedBy: one(users, {
    fields: [disputes.openedById],
    references: [users.id],
  }),
  arbitrator: one(users, {
    fields: [disputes.arbitratorId],
    references: [users.id],
  }),
}));
