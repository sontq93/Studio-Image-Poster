export type AspectRatio = "1:1" | "9:16" | "16:9";
export type ImageQuality = "4K" | "8K" | "16K";

export interface ImageFile {
  file: File;
  base64: string;
}

export type ModelSelection = 'female-asian' | 'male-asian' | 'female-european' | 'male-european';