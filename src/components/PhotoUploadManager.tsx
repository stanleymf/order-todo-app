import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';
import { 
  Upload, 
  Camera, 
  Image, 
  FileText, 
  Star, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Download,
  Trash2,
  Eye,
  Edit3,
  Target,
  TrendingUp,
  Calendar,
  Users
} from 'lucide-react';
import { createPhotoUploadService, type FloristPhotoUpload, type PhotoDescription, type PhotoQualityAssessment } from '../services/photoUploadService';
import { useAuth } from '../contexts/AuthContext';

interface PhotoUploadManagerProps {
  tenantId: string;
}

export default function PhotoUploadManager({ tenantId }: PhotoUploadManagerProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photos, setPhotos] = useState<FloristPhotoUpload[]>([]);
  const [descriptions, setDescriptions] = useState<Record<string, PhotoDescription>>({});
  const [assessments, setAssessments] = useState<Record<string, PhotoQualityAssessment>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  
  const photoUploadService = createPhotoUploadService(tenantId, user?.id || '');

  // Load existing photos on component mount
  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const photoList = await photoUploadService.getPhotos();
      setPhotos(photoList);
      
      // Load descriptions and assessments for each photo
      const descs: Record<string, PhotoDescription> = {};
      const assess: Record<string, PhotoQualityAssessment> = {};
      
      for (const photo of photoList) {
        try {
          const desc = await photoUploadService.getPhotoDescription(photo.id);
          if (desc) descs[photo.id] = desc;
        } catch (error) {
          console.log(`No description for photo ${photo.id}`);
        }
      }
      
      setDescriptions(descs);
      setAssessments(assess);
    } catch (error) {
      setError('Failed to load photos');
      console.error('Error loading photos:', error);
    } finally {
      setLoading(false);
    }
  };

  // File selection handlers
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    
    setSelectedFile(file);
    setError(null);
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  // Upload handler
  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const uploadedPhoto = await photoUploadService.uploadPhoto(selectedFile, {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 85,
        extractMetadata: true,
        createThumbnail: true,
        thumbnailSize: 300
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Add to photos list
      setPhotos(prev => [uploadedPhoto, ...prev]);
      
      // Reset form
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      setSuccess('Photo uploaded successfully!');
      setTimeout(() => setSuccess(null), 3000);
      
      // Switch to photos tab to show the new upload
      setActiveTab('photos');
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Description form handlers
  const handleDescriptionSubmit = async (photoId: string, description: Partial<PhotoDescription>) => {
    try {
      const newDescription = await photoUploadService.addPhotoDescription(photoId, {
        title: description.title || '',
        description: description.description || '',
        flowers_used: description.flowers_used || [],
        colors: description.colors || [],
        style: description.style || '',
        occasion: description.occasion || '',
        arrangement_type: description.arrangement_type || '',
        difficulty_level: description.difficulty_level || 'intermediate',
        special_techniques: description.special_techniques || [],
        materials_used: description.materials_used || [],
        customer_preferences: description.customer_preferences || '',
        price_range: description.price_range || '',
        season: description.season || '',
        tags: description.tags || [],
        is_public: description.is_public ?? true
      });

      setDescriptions(prev => ({
        ...prev,
        [photoId]: newDescription
      }));

      setSuccess('Description saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError('Failed to save description');
    }
  };

  // Quality assessment handlers
  const handleQualityAssessment = async (photoId: string, assessment: Partial<PhotoQualityAssessment>) => {
    try {
      const newAssessment = await photoUploadService.assessPhotoQuality(photoId, {
        technical_quality: assessment.technical_quality || 0,
        composition_quality: assessment.composition_quality || 0,
        design_quality: assessment.design_quality || 0,
        training_value: assessment.training_value || 0,
        overall_score: assessment.overall_score || 0,
        quality_notes: assessment.quality_notes || '',
        improvement_suggestions: assessment.improvement_suggestions || '',
        is_approved_for_training: assessment.is_approved_for_training ?? false
      });

      setAssessments(prev => ({
        ...prev,
        [photoId]: newAssessment
      }));

      setSuccess('Quality assessment saved!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError('Failed to save quality assessment');
    }
  };

  // Training data extraction
  const handleExtractTrainingData = async (photoId: string) => {
    try {
      const trainingData = await photoUploadService.extractTrainingDataFromPhoto(photoId);
      setSuccess('Training data extracted successfully!');
      console.log('Extracted training data:', trainingData);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError('Failed to extract training data');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Photo Upload Manager</h2>
          <p className="text-muted-foreground">
            Upload and manage florist photos for AI training
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Camera className="h-3 w-3" />
            {photos.length} Photos
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            {photos.filter(p => p.upload_status === 'approved').length} Approved
          </Badge>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="photos" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            Photos ({photos.length})
          </TabsTrigger>
          <TabsTrigger value="descriptions" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Descriptions
          </TabsTrigger>
          <TabsTrigger value="quality" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            Quality
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload New Photo</CardTitle>
              <CardDescription>
                Upload a photo of your floral arrangement. The image will be automatically compressed and optimized.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drag & Drop Zone */}
              <div
                ref={dropZoneRef}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  selectedFile 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                {selectedFile ? (
                  <div className="space-y-2">
                    <Image className="h-12 w-12 mx-auto text-green-600" />
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(selectedFile.size)}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-12 w-12 mx-auto text-gray-400" />
                    <p className="font-medium">Drop your photo here</p>
                    <p className="text-sm text-gray-500">
                      or click to browse files
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Select File
                    </Button>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              {/* Upload Button */}
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photo
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Uploaded Photos</CardTitle>
              <CardDescription>
                Manage and organize your uploaded photos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto" />
                  <p className="mt-2 text-gray-500">Loading photos...</p>
                </div>
              ) : photos.length === 0 ? (
                <div className="text-center py-8">
                  <Image className="h-12 w-12 mx-auto text-gray-400" />
                  <p className="mt-2 text-gray-500">No photos uploaded yet</p>
                  <Button
                    variant="outline"
                    className="mt-2"
                    onClick={() => setActiveTab('upload')}
                  >
                    Upload Your First Photo
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {photos.map((photo) => (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      description={descriptions[photo.id]}
                      assessment={assessments[photo.id]}
                      onDescriptionSubmit={(desc) => handleDescriptionSubmit(photo.id, desc)}
                      onQualityAssessment={(assess) => handleQualityAssessment(photo.id, assess)}
                      onExtractTrainingData={() => handleExtractTrainingData(photo.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="descriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Photo Descriptions</CardTitle>
              <CardDescription>
                Add detailed descriptions to your photos for better AI training
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {photos.filter(p => !descriptions[p.id]).map((photo) => (
                  <DescriptionForm
                    key={photo.id}
                    photo={photo}
                    onSubmit={(desc) => handleDescriptionSubmit(photo.id, desc)}
                  />
                ))}
                {photos.filter(p => !descriptions[p.id]).length === 0 && (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-gray-400" />
                    <p className="mt-2 text-gray-500">All photos have descriptions</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quality Assessment</CardTitle>
              <CardDescription>
                Assess photo quality and approve for AI training
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {photos.filter(p => !assessments[p.id]).map((photo) => (
                  <QualityAssessmentForm
                    key={photo.id}
                    photo={photo}
                    description={descriptions[photo.id]}
                    onSubmit={(assess) => handleQualityAssessment(photo.id, assess)}
                  />
                ))}
                {photos.filter(p => !assessments[p.id]).length === 0 && (
                  <div className="text-center py-8">
                    <Star className="h-12 w-12 mx-auto text-gray-400" />
                    <p className="mt-2 text-gray-500">All photos have been assessed</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Photo Card Component
interface PhotoCardProps {
  photo: FloristPhotoUpload;
  description?: PhotoDescription;
  assessment?: PhotoQualityAssessment;
  onDescriptionSubmit: (description: Partial<PhotoDescription>) => void;
  onQualityAssessment: (assessment: Partial<PhotoQualityAssessment>) => void;
  onExtractTrainingData: () => void;
}

function PhotoCard({ 
  photo, 
  description, 
  assessment, 
  onDescriptionSubmit, 
  onQualityAssessment,
  onExtractTrainingData 
}: PhotoCardProps) {
  const [showDescriptionForm, setShowDescriptionForm] = useState(false);
  const [showQualityForm, setShowQualityForm] = useState(false);

  return (
    <Card className="overflow-hidden">
      <div className="aspect-square relative">
        <img
          src={photo.thumbnail_url || photo.image_url}
          alt={photo.original_filename}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 right-2">
          <Badge className={getStatusColor(photo.upload_status)}>
            {photo.upload_status}
          </Badge>
        </div>
      </div>
      
      <CardContent className="p-4">
        <div className="space-y-2">
          <h4 className="font-medium truncate">{photo.original_filename}</h4>
          <p className="text-sm text-gray-500">
            {formatFileSize(photo.compressed_file_size)} • {new Date(photo.created_at).toLocaleDateString()}
          </p>
          
          {description && (
            <div className="space-y-1">
              <p className="text-sm font-medium">{description.title}</p>
              <p className="text-xs text-gray-600 line-clamp-2">{description.description}</p>
            </div>
          )}
          
          {assessment && (
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 text-yellow-500 fill-current" />
              <span className="text-sm">{assessment.overall_score.toFixed(1)}/5.0</span>
            </div>
          )}
          
          <div className="flex gap-2 pt-2">
            {!description && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDescriptionForm(true)}
              >
                <Edit3 className="h-3 w-3 mr-1" />
                Add Description
              </Button>
            )}
            
            {!assessment && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowQualityForm(true)}
              >
                <Star className="h-3 w-3 mr-1" />
                Assess Quality
              </Button>
            )}
            
            {description && assessment && (
              <Button
                size="sm"
                variant="outline"
                onClick={onExtractTrainingData}
              >
                <Download className="h-3 w-3 mr-1" />
                Extract Training Data
              </Button>
            )}
          </div>
        </div>
      </CardContent>
      
      {/* Description Form Modal */}
      {showDescriptionForm && (
        <DescriptionForm
          photo={photo}
          onSubmit={(desc) => {
            onDescriptionSubmit(desc);
            setShowDescriptionForm(false);
          }}
          onCancel={() => setShowDescriptionForm(false)}
        />
      )}
      
      {/* Quality Assessment Form Modal */}
      {showQualityForm && (
        <QualityAssessmentForm
          photo={photo}
          description={description}
          onSubmit={(assess) => {
            onQualityAssessment(assess);
            setShowQualityForm(false);
          }}
          onCancel={() => setShowQualityForm(false)}
        />
      )}
    </Card>
  );
}

// Description Form Component
interface DescriptionFormProps {
  photo: FloristPhotoUpload;
  onSubmit: (description: Partial<PhotoDescription>) => void;
  onCancel?: () => void;
}

function DescriptionForm({ photo, onSubmit, onCancel }: DescriptionFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    flowers_used: [] as string[],
    colors: [] as string[],
    style: '',
    occasion: '',
    arrangement_type: '',
    difficulty_level: 'intermediate' as const,
    special_techniques: [] as string[],
    materials_used: [] as string[],
    customer_preferences: '',
    price_range: '',
    season: '',
    tags: [] as string[],
    is_public: true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Wedding Bouquet"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="arrangement_type">Arrangement Type</Label>
            <Select
              value={formData.arrangement_type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, arrangement_type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bouquet">Bouquet</SelectItem>
                <SelectItem value="centerpiece">Centerpiece</SelectItem>
                <SelectItem value="wreath">Wreath</SelectItem>
                <SelectItem value="corsage">Corsage</SelectItem>
                <SelectItem value="boutonniere">Boutonniere</SelectItem>
                <SelectItem value="arrangement">Arrangement</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="style">Style</Label>
            <Select
              value={formData.style}
              onValueChange={(value) => setFormData(prev => ({ ...prev, style: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="romantic">Romantic</SelectItem>
                <SelectItem value="modern">Modern</SelectItem>
                <SelectItem value="rustic">Rustic</SelectItem>
                <SelectItem value="elegant">Elegant</SelectItem>
                <SelectItem value="wild">Wild & Natural</SelectItem>
                <SelectItem value="minimalist">Minimalist</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="occasion">Occasion</Label>
            <Select
              value={formData.occasion}
              onValueChange={(value) => setFormData(prev => ({ ...prev, occasion: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select occasion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wedding">Wedding</SelectItem>
                <SelectItem value="birthday">Birthday</SelectItem>
                <SelectItem value="anniversary">Anniversary</SelectItem>
                <SelectItem value="sympathy">Sympathy</SelectItem>
                <SelectItem value="celebration">Celebration</SelectItem>
                <SelectItem value="everyday">Everyday</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div>
          <Label htmlFor="description">Detailed Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe the arrangement, techniques used, and any special details..."
            rows={4}
            required
          />
        </div>
        
        <div className="flex gap-2">
          <Button type="submit">Save Description</Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

// Quality Assessment Form Component
interface QualityAssessmentFormProps {
  photo: FloristPhotoUpload;
  description?: PhotoDescription;
  onSubmit: (assessment: Partial<PhotoQualityAssessment>) => void;
  onCancel?: () => void;
}

function QualityAssessmentForm({ photo, description, onSubmit, onCancel }: QualityAssessmentFormProps) {
  const [formData, setFormData] = useState({
    technical_quality: 4,
    composition_quality: 4,
    design_quality: 4,
    training_value: 4,
    overall_score: 4,
    quality_notes: '',
    improvement_suggestions: '',
    is_approved_for_training: true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Technical Quality (Lighting, Focus)</Label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={formData.technical_quality}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  technical_quality: parseFloat(e.target.value) 
                }))}
                className="flex-1"
              />
              <span className="text-sm font-medium">{formData.technical_quality}</span>
            </div>
          </div>
          
          <div>
            <Label>Composition Quality (Framing, Angle)</Label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={formData.composition_quality}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  composition_quality: parseFloat(e.target.value) 
                }))}
                className="flex-1"
              />
              <span className="text-sm font-medium">{formData.composition_quality}</span>
            </div>
          </div>
          
          <div>
            <Label>Design Quality (Floral Arrangement)</Label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={formData.design_quality}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  design_quality: parseFloat(e.target.value) 
                }))}
                className="flex-1"
              />
              <span className="text-sm font-medium">{formData.design_quality}</span>
            </div>
          </div>
          
          <div>
            <Label>Training Value (AI Learning)</Label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={formData.training_value}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  training_value: parseFloat(e.target.value) 
                }))}
                className="flex-1"
              />
              <span className="text-sm font-medium">{formData.training_value}</span>
            </div>
          </div>
        </div>
        
        <div>
          <Label>Overall Score</Label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="5"
              step="0.5"
              value={formData.overall_score}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                overall_score: parseFloat(e.target.value) 
              }))}
              className="flex-1"
            />
            <span className="text-sm font-medium">{formData.overall_score}</span>
          </div>
        </div>
        
        <div>
          <Label htmlFor="quality_notes">Quality Notes</Label>
          <Textarea
            id="quality_notes"
            value={formData.quality_notes}
            onChange={(e) => setFormData(prev => ({ ...prev, quality_notes: e.target.value }))}
            placeholder="Detailed feedback about the photo quality..."
            rows={3}
          />
        </div>
        
        <div>
          <Label htmlFor="improvement_suggestions">Improvement Suggestions</Label>
          <Textarea
            id="improvement_suggestions"
            value={formData.improvement_suggestions}
            onChange={(e) => setFormData(prev => ({ ...prev, improvement_suggestions: e.target.value }))}
            placeholder="Suggestions for better photos..."
            rows={3}
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="approved_for_training"
            checked={formData.is_approved_for_training}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              is_approved_for_training: e.target.checked 
            }))}
          />
          <Label htmlFor="approved_for_training">Approve for AI Training</Label>
        </div>
        
        <div className="flex gap-2">
          <Button type="submit">Save Assessment</Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
} 