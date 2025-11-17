import React, { useRef, useState } from 'react';
import type { ImageFile } from '../types';
import { UploadIcon } from './IconComponents';

interface ImageUploaderProps {
  label: string;
  onImageUpload: (imageFile: ImageFile) => void;
  uploadedImage: ImageFile | null;
  className?: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ label, onImageUpload, uploadedImage, className }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (files: FileList | null) => {
    if (files && files[0]) {
      const file = files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        onImageUpload({ file, base64: base64String });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files);
  };

  return (
    <div className={`w-full ${className}`}>
      <span className="block text-sm font-medium text-slate-300 mb-2">{label}</span>
      <label
        htmlFor={`upload-${label}`}
        className={`relative flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300
        ${isDragging ? 'border-indigo-500 scale-105' : 'border-slate-700'}
        ${uploadedImage ? 'border-indigo-500 bg-slate-900' : 'bg-transparent hover:border-indigo-500'}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {uploadedImage ? (
          <img src={`data:${uploadedImage.file.type};base64,${uploadedImage.base64}`} alt={label} className="object-contain w-full h-full rounded-xl p-2" />
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <UploadIcon className="w-8 h-8 mb-3 text-slate-500" />
            <p className="text-sm text-slate-400">
              <span className="font-semibold text-indigo-400">Tải lên</span> hoặc kéo thả
            </p>
          </div>
        )}
        <input
          id={`upload-${label}`}
          ref={inputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp"
          className="hidden"
          onChange={(e) => handleFileChange(e.target.files)}
        />
      </label>
    </div>
  );
};

export default ImageUploader;