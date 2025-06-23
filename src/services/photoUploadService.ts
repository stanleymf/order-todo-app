// Photo Upload Service
// Handles florist photo uploads, compression, metadata extraction, and training data preparation

import {
  uploadFloristPhoto,
  getFloristPhotos,
  updatePhotoDescription,
  assessPhotoQuality,
  getDailyUploadGoals,
  getUploadStatistics,
  createTrainingDataFromPhoto
} from './api';

export interface FloristPhotoUpload {
  id: string;
  tenant_id: string;
  user_id: string;
  original_filename: string;
  original_file_size: number;
  compressed_file_size: number;
  image_url: string;
  thumbnail_url?: string;
  image_metadata?: Record<string, any>;
  upload_status: 'uploaded' | 'processing' | 'approved' | 'rejected' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface PhotoDescription {
  id: string;
  photo_id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  description: string;
  flowers_used?: string[];
  colors?: string[];
  style?: string;
  occasion?: string;
  arrangement_type?: string;
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  special_techniques?: string[];
  materials_used?: string[];
  customer_preferences?: string;
  price_range?: string;
  season?: string;
  tags?: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface PhotoQualityAssessment {
  id: string;
  photo_id: string;
  tenant_id: string;
  assessed_by: string;
  technical_quality: number;
  composition_quality: number;
  design_quality: number;
  training_value: number;
  overall_score: number;
  quality_notes?: string;
  improvement_suggestions?: string;
  is_approved_for_training: boolean;
  assessment_date: string;
  created_at: string;
}

export interface DailyUploadGoal {
  id: string;
  tenant_id: string;
  user_id: string;
  date: string;
  target_count: number;
  actual_count: number;
  goal_status: 'pending' | 'in_progress' | 'completed' | 'missed';
  streak_count: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface UploadStatistics {
  id: string;
  tenant_id: string;
  user_id: string;
  date: string;
  total_uploads: number;
  approved_uploads: number;
  rejected_uploads: number;
  total_file_size: number;
  average_quality_score: number;
  upload_time_distribution?: string[];
  created_at: string;
}

export interface PhotoUploadOptions {
  maxFileSize?: number; // in bytes, default 10MB
  maxWidth?: number; // max width for compression, default 1920
  maxHeight?: number; // max height for compression, default 1920
  quality?: number; // JPEG quality 0-100, default 85
  extractMetadata?: boolean; // whether to extract EXIF metadata
  createThumbnail?: boolean; // whether to create thumbnail
  thumbnailSize?: number; // thumbnail size in pixels, default 300
}

export interface TrainingDataExtraction {
  prompt: string;
  style_parameters: Record<string, any>;
  quality_score: number;
  metadata: Record<string, any>;
}

class PhotoUploadService {
  private tenantId: string;
  private userId: string;
  private defaultOptions: PhotoUploadOptions = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 85,
    extractMetadata: true,
    createThumbnail: true,
    thumbnailSize: 300
  };

  constructor(tenantId: string, userId: string) {
    this.tenantId = tenantId;
    this.userId = userId;
  }

  // ===== PHOTO UPLOAD & PROCESSING =====

  async uploadPhoto(
    file: File, 
    options: PhotoUploadOptions = {}
  ): Promise<FloristPhotoUpload> {
    const opts = { ...this.defaultOptions, ...options };
    
    // Validate file
    this.validateFile(file, opts.maxFileSize!);
    
    // Compress image
    const compressedBlob = await this.compressImage(file, opts);
    
    // Extract metadata if requested
    let metadata: Record<string, any> = {};
    if (opts.extractMetadata) {
      metadata = await this.extractImageMetadata(file);
    }
    
    // Create thumbnail if requested
    let thumbnailBlob: Blob | null = null;
    if (opts.createThumbnail) {
      thumbnailBlob = await this.createThumbnail(file, opts.thumbnailSize!);
    }
    
    // Upload to server
    const formData = new FormData();
    formData.append('photo', compressedBlob, file.name);
    if (thumbnailBlob) {
      formData.append('thumbnail', thumbnailBlob, `thumb_${file.name}`);
    }
    formData.append('metadata', JSON.stringify(metadata));
    formData.append('original_size', file.size.toString());
    formData.append('compressed_size', compressedBlob.size.toString());
    
    return await uploadFloristPhoto(this.tenantId, formData);
  }

  private validateFile(file: File, maxSize: number): void {
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }
    
    if (file.size > maxSize) {
      throw new Error(`File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`);
    }
  }

  private async compressImage(file: File, options: PhotoUploadOptions): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions
        const { width, height } = this.calculateDimensions(
          img.width, 
          img.height, 
          options.maxWidth!, 
          options.maxHeight!
        );
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          options.quality! / 100
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  private calculateDimensions(
    originalWidth: number, 
    originalHeight: number, 
    maxWidth: number, 
    maxHeight: number
  ): { width: number; height: number } {
    let { width, height } = { width: originalWidth, height: originalHeight };
    
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }
    
    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }
    
    return { width: Math.round(width), height: Math.round(height) };
  }

  private async createThumbnail(file: File, size: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate thumbnail dimensions (square)
        const { width, height } = this.calculateDimensions(
          img.width, 
          img.height, 
          size, 
          size
        );
        
        canvas.width = size;
        canvas.height = size;
        
        // Center the image in the square
        const offsetX = (size - width) / 2;
        const offsetY = (size - height) / 2;
        
        ctx!.drawImage(img, offsetX, offsetY, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create thumbnail'));
            }
          },
          'image/jpeg',
          0.8
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image for thumbnail'));
      img.src = URL.createObjectURL(file);
    });
  }

  private async extractImageMetadata(file: File): Promise<Record<string, any>> {
    // This would typically use a library like exif-js
    // For now, return basic metadata
    return {
      filename: file.name,
      fileSize: file.size,
      fileType: file.type,
      lastModified: file.lastModified,
      uploadDate: new Date().toISOString()
    };
  }

  // ===== PHOTO DESCRIPTION MANAGEMENT =====

  async addPhotoDescription(
    photoId: string, 
    description: Omit<PhotoDescription, 'id' | 'photo_id' | 'tenant_id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<PhotoDescription> {
    return await updatePhotoDescription(this.tenantId, photoId, description);
  }

  async getPhotoDescription(photoId: string): Promise<PhotoDescription | null> {
    const photos = await getFloristPhotos(this.tenantId, { photo_id: photoId });
    return photos.length > 0 ? photos[0].description : null;
  }

  // ===== QUALITY ASSESSMENT =====

  async assessPhotoQuality(
    photoId: string,
    assessment: Omit<PhotoQualityAssessment, 'id' | 'photo_id' | 'tenant_id' | 'assessed_by' | 'assessment_date' | 'created_at'>
  ): Promise<PhotoQualityAssessment> {
    return await assessPhotoQuality(this.tenantId, photoId, assessment);
  }

  // ===== GOAL TRACKING =====

  async getDailyUploadGoal(date?: string): Promise<DailyUploadGoal | null> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return await getDailyUploadGoals(this.tenantId, targetDate);
  }

  async getUploadStatistics(dateRange?: { start: string; end: string }): Promise<UploadStatistics[]> {
    return await getUploadStatistics(this.tenantId, dateRange);
  }

  // ===== TRAINING DATA EXTRACTION =====

  async extractTrainingDataFromPhoto(photoId: string): Promise<TrainingDataExtraction> {
    const photo = await this.getPhoto(photoId);
    const description = await this.getPhotoDescription(photoId);
    
    if (!photo || !description) {
      throw new Error('Photo and description required for training data extraction');
    }
    
    // Generate prompt from description
    const prompt = this.generatePromptFromDescription(description);
    
    // Extract style parameters
    const styleParameters = this.extractStyleParameters(description);
    
    // Calculate quality score
    const qualityScore = await this.calculateQualityScore(photoId);
    
    // Prepare metadata
    const metadata = {
      photo_id: photoId,
      original_filename: photo.original_filename,
      upload_date: photo.created_at,
      description_data: description,
      image_metadata: photo.image_metadata
    };
    
    return {
      prompt,
      style_parameters: styleParameters,
      quality_score: qualityScore,
      metadata
    };
  }

  private async getPhoto(photoId: string): Promise<FloristPhotoUpload | null> {
    const photos = await getFloristPhotos(this.tenantId, { photo_id: photoId });
    return photos.length > 0 ? photos[0] : null;
  }

  private generatePromptFromDescription(description: PhotoDescription): string {
    const parts: string[] = [];
    
    if (description.arrangement_type) {
      parts.push(description.arrangement_type);
    }
    
    if (description.flowers_used && description.flowers_used.length > 0) {
      parts.push(`featuring ${description.flowers_used.join(', ')}`);
    }
    
    if (description.colors && description.colors.length > 0) {
      parts.push(`in ${description.colors.join(', ')} colors`);
    }
    
    if (description.style) {
      parts.push(`with a ${description.style} style`);
    }
    
    if (description.occasion) {
      parts.push(`perfect for ${description.occasion}`);
    }
    
    if (description.special_techniques && description.special_techniques.length > 0) {
      parts.push(`using ${description.special_techniques.join(', ')} techniques`);
    }
    
    return parts.join(' ');
  }

  private extractStyleParameters(description: PhotoDescription): Record<string, any> {
    return {
      flowers: description.flowers_used || [],
      colors: description.colors || [],
      style: description.style,
      occasion: description.occasion,
      arrangement_type: description.arrangement_type,
      difficulty_level: description.difficulty_level,
      techniques: description.special_techniques || [],
      materials: description.materials_used || [],
      price_range: description.price_range,
      season: description.season,
      tags: description.tags || []
    };
  }

  private async calculateQualityScore(photoId: string): Promise<number> {
    // This would typically fetch quality assessment data
    // For now, return a default score
    return 4.0;
  }

  // ===== BULK OPERATIONS =====

  async createTrainingDataFromPhotos(photoIds: string[]): Promise<any[]> {
    const trainingData = [];
    
    for (const photoId of photoIds) {
      try {
        const extraction = await this.extractTrainingDataFromPhoto(photoId);
        const trainingRecord = await createTrainingDataFromPhoto(this.tenantId, photoId, extraction);
        trainingData.push(trainingRecord);
      } catch (error) {
        console.error(`Failed to create training data for photo ${photoId}:`, error);
      }
    }
    
    return trainingData;
  }

  // ===== UTILITY METHODS =====

  async getPhotos(filters?: {
    status?: string;
    date_range?: { start: string; end: string };
    user_id?: string;
  }): Promise<FloristPhotoUpload[]> {
    return await getFloristPhotos(this.tenantId, filters);
  }

  async getPhotoStats(): Promise<{
    total_photos: number;
    approved_photos: number;
    pending_photos: number;
    average_quality: number;
    total_file_size: number;
  }> {
    const photos = await this.getPhotos();
    const stats = await this.getUploadStatistics();
    
    const totalPhotos = photos.length;
    const approvedPhotos = photos.filter(p => p.upload_status === 'approved').length;
    const pendingPhotos = photos.filter(p => p.upload_status === 'uploaded').length;
    const totalFileSize = photos.reduce((sum, p) => sum + p.compressed_file_size, 0);
    
    // Calculate average quality (this would need quality assessment data)
    const averageQuality = 4.0; // Placeholder
    
    return {
      total_photos: totalPhotos,
      approved_photos: approvedPhotos,
      pending_photos: pendingPhotos,
      average_quality: averageQuality,
      total_file_size: totalFileSize
    };
  }
}

// Factory function to create service instance
export const createPhotoUploadService = (tenantId: string, userId: string): PhotoUploadService => {
  return new PhotoUploadService(tenantId, userId);
};

// Default export for convenience
export default PhotoUploadService; 