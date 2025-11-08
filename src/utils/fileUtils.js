import * as FileSystem from 'expo-file-system';
import {Platform} from 'react-native';

/**
 * Get export directory path
 */
export function getExportPath(folderName = 'GuruReceipts') {
  return `${FileSystem.documentDirectory}${folderName}/`;
}

/**
 * Ensure export directory exists
 */
export async function ensureExportDirectory(path) {
  try {
    const dirInfo = await FileSystem.getInfoAsync(path);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(path, {intermediates: true});
    }
    return {success: true, path};
  } catch (error) {
    console.error('Error creating export directory:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Write file to disk
 */
export async function writeFile(path, content, encoding = FileSystem.EncodingType.UTF8) {
  try {
    await FileSystem.writeAsStringAsync(path, content, {encoding});
    return {success: true, path};
  } catch (error) {
    console.error('Error writing file:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Read file from disk
 */
export async function readFile(path, encoding = FileSystem.EncodingType.UTF8) {
  try {
    const content = await FileSystem.readAsStringAsync(path, {encoding});
    return {success: true, content};
  } catch (error) {
    console.error('Error reading file:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Check if file exists
 */
export async function fileExists(path) {
  try {
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
  } catch (error) {
    console.error('Error checking file existence:', error);
    return false;
  }
}
