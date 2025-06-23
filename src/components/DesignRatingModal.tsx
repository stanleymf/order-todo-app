import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Star, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface DesignRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  designId: string;
  designImage: string;
  prompt: string;
  onRatingSubmit: (rating: number, feedback: string) => void;
}

export const DesignRatingModal: React.FC<DesignRatingModalProps> = ({
  isOpen,
  onClose,
  designId,
  designImage,
  prompt,
  onRatingSubmit,
}) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    
    setIsSubmitting(true);
    try {
      await onRatingSubmit(rating, feedback);
      onClose();
      // Reset form
      setRating(0);
      setFeedback('');
    } catch (error) {
      console.error('Error submitting rating:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setRating(0);
      setFeedback('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Rate This Design
          </DialogTitle>
          <DialogDescription>
            Help us improve our AI by rating this generated bouquet design.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Design Preview */}
          <div className="bg-gray-50 rounded-lg p-3">
            <img
              src={designImage}
              alt="Generated bouquet"
              className="w-full h-32 object-cover rounded-lg mb-2"
            />
            <p className="text-sm text-gray-600 line-clamp-2">
              "{prompt}"
            </p>
          </div>

          {/* Star Rating */}
          <div className="space-y-2">
            <Label>How would you rate this design?</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1 transition-colors"
                >
                  <Star
                    className={`h-6 w-6 ${
                      star <= (hoveredRating || rating)
                        ? 'text-yellow-500 fill-current'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500">
              {rating === 0 && 'Click to rate'}
              {rating === 1 && 'Poor - Not what I was looking for'}
              {rating === 2 && 'Fair - Could be better'}
              {rating === 3 && 'Good - Meets expectations'}
              {rating === 4 && 'Very Good - Exceeds expectations'}
              {rating === 5 && 'Excellent - Perfect match!'}
            </p>
          </div>

          {/* Feedback */}
          <div className="space-y-2">
            <Label htmlFor="feedback">Additional feedback (optional)</Label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us what you liked or what could be improved..."
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={rating === 0 || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Rating'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 