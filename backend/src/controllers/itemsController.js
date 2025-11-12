import Item from '../models/Item.js';
import { resolveCompanyCode } from '../utils/companyScope.js';

export const getItems = async (req, res) => {
  const { since } = req.query;

  try {
    const companyCode = await resolveCompanyCode(req);
    if (!companyCode) {
      return res.status(403).json({ error: 'Company scope required' });
    }

    const query = { company_code: companyCode };
    if (since) {
      query.updatedAt = { $gt: new Date(since) };
    }

    const items = await Item.find(query).sort({ updatedAt: -1 });
    res.json({ items });
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
};

export const createItemsBatch = async (req, res) => {
  const { items } = req.body;
  const userId = req.user.userId;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items array is required' });
  }

  try {
    const companyCode = await resolveCompanyCode(req);
    if (!companyCode) {
      return res.status(403).json({ error: 'Company scope required' });
    }

    const createdItems = [];
    const warnings = [];

    for (const item of items) {
      const { id, name, barcode, sku, price, unit, image_url, category, inventory_qty, recommended, updated_at } = item;

      if (!id || !name) {
        warnings.push({ item, error: 'Missing required fields: id or name' });
        continue;
      }

      // Upsert with conflict resolution based on updatedAt
      const existingItem = await Item.findOne({ _id: id, company_code: companyCode });
      const itemUpdatedAt = updated_at ? new Date(updated_at) : new Date();

      if (existingItem && existingItem.updatedAt > itemUpdatedAt) {
        warnings.push({ id, error: 'Server version is newer' });
        continue;
      }

      const upsertedItem = await Item.findOneAndUpdate(
        { _id: id, company_code: companyCode },
        {
          _id: id,
          user_id: userId,
          company_code: companyCode,
          name,
          barcode,
          sku,
          price: price || 0,
          unit: unit || 'pc',
          image_url,
          category,
          inventory_qty: inventory_qty !== undefined ? inventory_qty : 0,
          recommended: recommended || false,
          updatedAt: itemUpdatedAt
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      createdItems.push(upsertedItem);
    }

    res.json({ items: createdItems, warnings });
  } catch (error) {
    console.error('Batch create items error:', error);
    res.status(500).json({ error: 'Failed to create items' });
  }
};

export const updateItem = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;
  const updates = req.body;

  try {
    const companyCode = await resolveCompanyCode(req);
    if (!companyCode) {
      return res.status(403).json({ error: 'Company scope required' });
    }

    const safeUpdates = { ...updates, company_code: companyCode };
    if (userId) {
      safeUpdates.user_id = userId;
    }

    const item = await Item.findOneAndUpdate(
      { _id: id, company_code: companyCode },
      { $set: safeUpdates },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ item });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
};

export const deleteItem = async (req, res) => {
  const { id } = req.params;

  try {
    const companyCode = await resolveCompanyCode(req);
    if (!companyCode) {
      return res.status(403).json({ error: 'Company scope required' });
    }

    const item = await Item.findOneAndDelete({ _id: id, company_code: companyCode });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ success: true, id: item._id });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
};
