import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadBufferToCloudinary = (buffer, folder, resourceType = 'image') =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => { if (error) reject(error); else resolve(result); }
    ).end(buffer);
  });

export const deleteFromCloudinary = (url) => {
  if (!url || !url.includes('cloudinary.com')) return Promise.resolve();
  const match = url.match(/\/(?:image|raw|video)\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
  if (!match) return Promise.resolve();
  const publicId = match[1];
  const resourceType = url.includes('/raw/upload/') ? 'raw' : url.includes('/video/upload/') ? 'video' : 'image';
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
    .catch(err => console.error(`Failed to delete Cloudinary asset ${publicId}:`, err.message));
};

export default cloudinary;
