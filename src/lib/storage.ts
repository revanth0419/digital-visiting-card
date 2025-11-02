import { supabase } from "@/integrations/supabase/client";

/**
 * Generate a signed URL for a private storage object
 * @param bucket The storage bucket name
 * @param path The file path within the bucket
 * @param expirySeconds URL expiry time in seconds (default: 1 hour)
 * @returns Signed URL string or empty string on error
 */
export const getSignedUrl = async (
  bucket: string,
  path: string,
  expirySeconds: number = 3600
): Promise<string> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expirySeconds);

    if (error) {
      console.error('Failed to generate signed URL:', error);
      return '';
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return '';
  }
};

/**
 * Extract the storage path from a full URL
 * @param url The full storage URL
 * @returns The path portion (userId/filename)
 */
export const extractStoragePath = (url: string): string => {
  try {
    // Handle both old public URLs and signed URLs
    const urlParts = url.split('/');
    const objectIndex = urlParts.findIndex(part => part === 'object');
    if (objectIndex >= 0) {
      // Skip 'object', 'public' or 'sign', bucket name, and get the rest
      return urlParts.slice(objectIndex + 3).join('/');
    }
    // Fallback: assume last two parts are userId/filename
    return urlParts.slice(-2).join('/');
  } catch {
    return '';
  }
};
