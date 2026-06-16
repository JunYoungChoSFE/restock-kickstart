import db from "../db.server";

/**
 * Ensures a Shop and its default Setting exist. Creates them if missing, otherwise returns as is.
 * The entry point for multitenancy — a single shopDomain scopes all data for that domain.
 */
export async function ensureShop(shopDomain: string) {
  const shop = await db.shop.upsert({
    where: { shopDomain },
    update: {},
    create: { shopDomain, setting: { create: {} } },
    include: { setting: true },
  });

  // Defensive: backfill the Setting if it's empty due to legacy data.
  if (!shop.setting) {
    const setting = await db.setting.create({ data: { shopId: shop.id } });
    return { ...shop, setting };
  }
  return shop;
}
