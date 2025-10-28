import {database} from './index';
import {seedItems, defaultSettings} from './seeds';

export async function seedDatabase() {
  try {
    await database.write(async () => {
      const itemsCollection = database.collections.get('items');
      const settingsCollection = database.collections.get('settings');

      // Seed items
      for (const itemData of seedItems) {
        await itemsCollection.create(item => {
          item.name = itemData.name;
          item.barcode = itemData.barcode;
          item.price = itemData.price;
          item.unit = itemData.unit;
          item.category = itemData.category;
          item.recommended = itemData.recommended;
          item.defaultQuantity = itemData.defaultQuantity;
        });
      }

      // Seed settings
      for (const settingData of defaultSettings) {
        await settingsCollection.create(setting => {
          setting.key = settingData.key;
          setting.value = settingData.value;
        });
      }

      console.log('Database seeded successfully');
    });
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

// For CLI usage
if (require.main === module) {
  seedDatabase().then(() => process.exit(0));
}
