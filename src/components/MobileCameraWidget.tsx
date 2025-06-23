import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Camera, 
  X, 
  CheckCircle, 
  AlertCircle,
  Upload,
  Image as ImageIcon,
  FileText,
  Star,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { createPhotoUploadService, type FloristPhotoUpload, type PhotoDescription } from '../services/photoUploadService';
import { useAuth } from '../contexts/AuthContext';

interface MobileCameraWidgetProps {
  tenantId: string;
}

export default function MobileCameraWidget({ tenantId }: MobileCameraWidgetProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentStep, setCurrentStep] = useState<'camera' | 'description' | 'uploading' | 'success'>('camera');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const photoUploadService = createPhotoUploadService(tenantId, user?.id || '');

  // Description form state
  const [description, setDescription] = useState({
    title: '',
    description: '',
    flowers_used: [] as string[],
    colors: [] as string[],
    style: '',
    occasion: '',
    arrangement_type: '',
    difficulty_level: 'intermediate' as 'beginner' | 'intermediate' | 'advanced' | 'expert',
    special_techniques: [] as string[],
    materials_used: [] as string[],
    customer_preferences: '',
    price_range: '',
    season: '',
    tags: [] as string[],
    is_public: true
  });

  // Quick description templates
  const quickTemplates: Array<{
    title: string;
    style: string;
    occasion: string;
    arrangement_type: string;
    difficulty_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    price_range: string;
    flowers_used: string[];
    colors: string[];
    special_techniques: string[];
    materials_used: string[];
    tags: string[];
  }> = [
    {
      title: "Wedding Bouquet",
      style: "romantic",
      occasion: "wedding",
      arrangement_type: "bouquet",
      difficulty_level: "intermediate" as const,
      price_range: "premium",
      flowers_used: ["roses", "peonies", "baby's breath"],
      colors: ["white", "ivory", "pink"],
      special_techniques: ["wiring", "taping"],
      materials_used: ["satin ribbon", "pearls"],
      tags: ["romantic", "elegant", "wedding", "bouquet"]
    },
    {
      title: "Birthday Centerpiece",
      style: "modern",
      occasion: "birthday",
      arrangement_type: "centerpiece",
      difficulty_level: "beginner" as const,
      price_range: "mid-range",
      flowers_used: ["lilies", "gerbera daisies", "carnations"],
      colors: ["yellow", "orange", "pink"],
      special_techniques: ["foam arrangement"],
      materials_used: ["vase", "floral foam"],
      tags: ["modern", "colorful", "birthday", "centerpiece"]
    },
    {
      title: "Sympathy Arrangement",
      style: "elegant",
      occasion: "sympathy",
      arrangement_type: "arrangement",
      difficulty_level: "intermediate" as const,
      price_range: "mid-range",
      flowers_used: ["white roses", "lilies", "eucalyptus"],
      colors: ["white", "ivory", "green"],
      special_techniques: ["hand-tied"],
      materials_used: ["vase", "ribbon"],
      tags: ["elegant", "respectful", "sympathy", "white"]
    },
    {
      title: "Anniversary Roses",
      style: "romantic",
      occasion: "anniversary",
      arrangement_type: "bouquet",
      difficulty_level: "beginner" as const,
      price_range: "premium",
      flowers_used: ["red roses", "baby's breath"],
      colors: ["red", "white"],
      special_techniques: ["hand-tied"],
      materials_used: ["satin ribbon", "rose thorns removed"],
      tags: ["romantic", "anniversary", "roses", "red"]
    },
    {
      title: "Everyday Wild Bouquet",
      style: "wild",
      occasion: "everyday",
      arrangement_type: "bouquet",
      difficulty_level: "beginner" as const,
      price_range: "budget",
      flowers_used: ["daisies", "sunflowers", "wildflowers"],
      colors: ["yellow", "white", "purple"],
      special_techniques: ["natural arrangement"],
      materials_used: ["twine", "brown paper"],
      tags: ["wild", "natural", "everyday", "garden"]
    }
  ];

  // Camera functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera
          width: { ideal: 1920 },
          height: { ideal: 1920 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video frame to canvas
        context.drawImage(video, 0, 0);
        
        // Convert to blob
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
            setSelectedFile(file);
            setCapturedImage(canvas.toDataURL('image/jpeg'));
            setCurrentStep('description');
            stopCamera();
          }
        }, 'image/jpeg', 0.85);
      }
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setCapturedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      setCurrentStep('description');
    }
  };

  const applyQuickTemplate = (template: typeof quickTemplates[0]) => {
    setDescription(prev => ({
      ...prev,
      ...template
    }));
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('No photo selected');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Upload photo
      const uploadResult = await photoUploadService.uploadPhoto(selectedFile);
      
      // Add description
      await photoUploadService.addPhotoDescription(uploadResult.id, description);
      
      // Create training data automatically
      try {
        const trainingData = await photoUploadService.extractTrainingDataFromPhoto(uploadResult.id);
        await photoUploadService.createTrainingDataFromPhotos([uploadResult.id]);
      } catch (trainingError) {
        console.warn('Failed to create training data:', trainingError);
        // Don't fail the upload if training data creation fails
      }

      clearInterval(progressInterval);
      setUploadProgress(100);
      setSuccess('Photo uploaded successfully! Training data created.');
      
      // Reset form after a delay
      setTimeout(() => {
        resetForm();
        setCurrentStep('camera');
      }, 2000);
      
    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep('camera');
    setCapturedImage(null);
    setSelectedFile(null);
    setDescription({
      title: '',
      description: '',
      flowers_used: [],
      colors: [],
      style: '',
      occasion: '',
      arrangement_type: '',
      difficulty_level: 'intermediate',
      special_techniques: [],
      materials_used: [],
      customer_preferences: '',
      price_range: '',
      season: '',
      tags: [],
      is_public: true
    });
    setError(null);
    setSuccess(null);
    setIsOpen(false);
    setIsExpanded(false);
  };

  const openCamera = () => {
    setIsOpen(true);
    setIsExpanded(true);
    setCurrentStep('camera');
    setError(null);
    setSuccess(null);
  };

  // Start camera when component mounts and camera step is active
  useEffect(() => {
    if (isOpen && currentStep === 'camera') {
      startCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [isOpen, currentStep]);

  // Floating camera button (always visible)
  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={openCamera}
          size="lg"
          className="h-16 w-16 rounded-full shadow-lg bg-green-600 hover:bg-green-700"
        >
          <Camera className="h-8 w-8" />
        </Button>
      </div>
    );
  }

  // Full-screen camera interface
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-black text-white p-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetForm}
          className="text-white hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-medium">Take Photo</h2>
        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* Camera View */}
      {currentStep === 'camera' && (
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Camera Controls */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-6">
            {/* Gallery Button */}
            <Button
              variant="ghost"
              size="lg"
              onClick={() => fileInputRef.current?.click()}
              className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
            >
              <ImageIcon className="h-6 w-6" />
            </Button>
            
            {/* Capture Button */}
            <Button
              size="lg"
              onClick={capturePhoto}
              className="h-16 w-16 rounded-full bg-white hover:bg-gray-100"
            >
              <div className="h-12 w-12 rounded-full border-4 border-gray-800" />
            </Button>
            
            {/* Expand/Collapse */}
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setIsExpanded(!isExpanded)}
              className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30"
            >
              {isExpanded ? <ChevronDown className="h-6 w-6" /> : <ChevronUp className="h-6 w-6" />}
            </Button>
          </div>

          {/* Quick Templates (when expanded) */}
          {isExpanded && (
            <div className="absolute top-4 left-4 right-4">
              <div className="bg-black/50 backdrop-blur-sm rounded-lg p-4">
                <h3 className="text-white text-sm font-medium mb-3">Quick Templates</h3>
                <div className="grid grid-cols-2 gap-2">
                  {quickTemplates.map((template, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => applyQuickTemplate(template)}
                      className="text-white border-white/30 hover:bg-white/10 text-xs"
                    >
                      {template.title}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Description Form */}
      {currentStep === 'description' && capturedImage && (
        <div className="flex-1 bg-white overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Captured Image Preview */}
            <div className="relative">
              <img
                src={capturedImage}
                alt="Captured photo"
                className="w-full h-48 object-cover rounded-lg"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep('camera')}
                className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Quick Templates */}
            <div>
              <Label className="text-sm font-medium">Quick Templates</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {quickTemplates.map((template, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => applyQuickTemplate(template)}
                    className="text-xs"
                  >
                    {template.title}
                  </Button>
                ))}
              </div>
            </div>

            {/* Description Form */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={description.title}
                  onChange={(e) => setDescription(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Wedding Bouquet"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="style">Style</Label>
                  <Select
                    value={description.style}
                    onValueChange={(value) => setDescription(prev => ({ ...prev, style: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="romantic">Romantic</SelectItem>
                      <SelectItem value="modern">Modern</SelectItem>
                      <SelectItem value="rustic">Rustic</SelectItem>
                      <SelectItem value="elegant">Elegant</SelectItem>
                      <SelectItem value="wild">Wild & Natural</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="occasion">Occasion</Label>
                  <Select
                    value={description.occasion}
                    onValueChange={(value) => setDescription(prev => ({ ...prev, occasion: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select occasion" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wedding">Wedding</SelectItem>
                      <SelectItem value="birthday">Birthday</SelectItem>
                      <SelectItem value="anniversary">Anniversary</SelectItem>
                      <SelectItem value="sympathy">Sympathy</SelectItem>
                      <SelectItem value="everyday">Everyday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={description.description}
                  onChange={(e) => setDescription(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the arrangement, flowers used, techniques..."
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="arrangement_type">Type</Label>
                  <Select
                    value={description.arrangement_type}
                    onValueChange={(value) => setDescription(prev => ({ ...prev, arrangement_type: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bouquet">Bouquet</SelectItem>
                      <SelectItem value="centerpiece">Centerpiece</SelectItem>
                      <SelectItem value="arrangement">Arrangement</SelectItem>
                      <SelectItem value="wreath">Wreath</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="price_range">Price Range</Label>
                  <Select
                    value={description.price_range}
                    onValueChange={(value) => setDescription(prev => ({ ...prev, price_range: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select price" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="budget">Budget</SelectItem>
                      <SelectItem value="mid-range">Mid-Range</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={!description.title || !description.description || isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photo
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {currentStep === 'uploading' && (
        <div className="flex-1 bg-white flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-green-600" />
            <div>
              <h3 className="text-lg font-medium">Uploading Photo</h3>
              <p className="text-gray-500">Please wait...</p>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        </div>
      )}

      {/* Success */}
      {currentStep === 'success' && (
        <div className="flex-1 bg-white flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
            <div>
              <h3 className="text-lg font-medium">Photo Uploaded!</h3>
              <p className="text-gray-500">Your photo has been successfully uploaded and added to the training data.</p>
            </div>
            <Button onClick={resetForm} className="w-full">
              Take Another Photo
            </Button>
          </div>
        </div>
      )}

      {/* Hidden file input for gallery selection */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
} 