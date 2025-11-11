/**
 * Generate a UUID v4 using pure JavaScript
 * No native modules required - works in Expo Go
 */
export function generateUUID() {
  // Generate UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// For compatibility with uuid package
export const v4 = generateUUID;

export default {
  v4: generateUUID,
  generate: generateUUID,
};
