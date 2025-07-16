import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { Request } from 'express';
import fs from 'fs';
import path from 'path';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

interface UploadResult {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  cloudinaryUrl?: string;
  cloudinaryPublicId?: string;
}

class FileUploadService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_PATH || './uploads/';
    this.ensureUploadDir();
  }

  private ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  // Multer configuration for local storage
  getMulterConfig() {
    const storage = multer.diskStorage({
      destination: (req: any, file: any, cb: any) => {
        cb(null, this.uploadDir);
      },
      filename: (req: any, file: any, cb: any) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
      }
    });

    const fileFilter = (req: Request, file: any, cb: any) => {
      // Allowed file types
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];

      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only images and documents are allowed.'));
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
      }
    });
  }

  // Upload to Cloudinary
  async uploadToCloudinary(filePath: string, folder: string = 'vm-visa'): Promise<any> {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder,
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true
      });

      return result;
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error('Failed to upload to cloud storage');
    }
  }

  // Process uploaded file
  async processUpload(file: any, uploadToCloud: boolean = true): Promise<UploadResult> {
    try {
      const result: UploadResult = {
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path
      };

      // Upload to Cloudinary if enabled
      if (uploadToCloud && process.env.NODE_ENV === 'production') {
        const cloudinaryResult = await this.uploadToCloudinary(file.path);
        result.cloudinaryUrl = cloudinaryResult.secure_url;
        result.cloudinaryPublicId = cloudinaryResult.public_id;

        // Delete local file after uploading to cloud
        fs.unlinkSync(file.path);
        result.path = ''; // Clear local path since file is now in cloud
      }

      return result;
    } catch (error) {
      // Clean up local file if something goes wrong
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  // Delete file from Cloudinary
  async deleteFromCloudinary(publicId: string): Promise<boolean> {
    try {
      await cloudinary.uploader.destroy(publicId);
      return true;
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      return false;
    }
  }

  // Delete local file
  deleteLocalFile(filePath: string): boolean {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Local file delete error:', error);
      return false;
    }
  }

  // Generate file download URL
  generateDownloadUrl(fileId: string): string {
    return `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/documents/${fileId}/download`;
  }

  // Validate file type
  isValidFileType(mimetype: string): boolean {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    return allowedTypes.includes(mimetype);
  }

  // Get file extension from mimetype
  getFileExtension(mimetype: string): string {
    const extensions: { [key: string]: string } = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
    };

    return extensions[mimetype] || '';
  }

  // Format file size
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default new FileUploadService();
