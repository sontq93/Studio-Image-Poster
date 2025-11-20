import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { ImageFile, ModelSelection, ImageQuality } from '../types';

// FIX: The API key must be obtained exclusively from `process.env.API_KEY` and used directly in the `GoogleGenAI` constructor as per the coding guidelines. This also resolves the TypeScript error regarding `import.meta.env`.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToGenerativePart = (base64: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64,
      mimeType,
    },
  };
};

export const getStyleSuggestions = async (productImageBase64: string, mimeType: string): Promise<string[]> => {
  const prompt = `
    You are a professional marketing and branding expert. Your task is to analyze the provided product image and generate 4 distinct, highly creative, and commercially appealing style suggestions for a promotional banner.

    **Analysis Steps:**
    1.  **Identify the Product:** What is the product? Be specific (e.g., "a can of sparkling water," "a high-end wireless headphone").
    2.  **Determine the Category & Industry:** Classify the product (e.g., "beverage," "consumer electronics," "skincare").
    3.  **Isolate Product from Packaging:** If the image includes packaging (like a box or wrapper), your style suggestions must be based on the **product itself**, not the packaging.
    4.  **Generate Tailored Styles:** Based on your analysis, suggest 4 unique styles that would resonate with the target audience for this product. Each style should be a short, evocative phrase (2-3 words).

    **Example Output for a Luxury Watch:**
    - "Modern & Minimalist"
    - "Classic & Timeless"
    - "Adventurous & Rugged"
    - "Sleek & Futuristic"

    Now, analyze the user's product image and provide your 4 style suggestions.
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { 
        parts: [
          fileToGenerativePart(productImageBase64, mimeType),
          { text: prompt },
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            styles: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        },
      }
    });
    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);
    // Ensure we only return up to 4 styles, as requested in the prompt
    return (result.styles || []).slice(0, 4);
  } catch (error) {
    console.error("Error getting style suggestions:", error);
    return ['Tối giản & Sạch sẽ', 'Sống động & Năng động', 'Sang trọng & Thanh lịch', 'Tương lai & Công nghệ'];
  }
};

export const generateBrandedImage = async (
    modelImage: ImageFile | null,
    productImage: ImageFile,
    logoImage: ImageFile | null,
    style: string,
    aspectRatio: '1:1' | '9:16' | '16:9',
    modelSelection: ModelSelection,
    quality: ImageQuality,
    overlayText: string,
    productDimensions: string = ""
): Promise<string> => {
    
    const modelDescriptionMap: Record<ModelSelection, string> = {
        'female-asian': 'Female Asian model',
        'male-asian': 'Male Asian model',
        'female-european': 'Female European model',
        'male-european': 'Male European model',
    };
    const modelDescription = modelDescriptionMap[modelSelection];

    const modelInstruction = modelImage
        ? `
### 2. Model (KOL)
- **Source:** Use the person from the "Model Image".
- **Fidelity:** You **MUST** preserve the model's exact facial identity. This is the most critical instruction.
- **Flexibility:** You **MAY** creatively adjust their pose, expression, hairstyle, and clothing to fit the theme naturally.`
        : `
### 2. Model (KOL)
- **Action:** Generate a new, professional, and photorealistic **${modelDescription}**.
- **Context:** The generated model's appearance and style must be perfectly suited to the product and the overall theme: "${style}".
- **Style:** The model should look natural, engaging, and appealing to the target audience.`;

    // Dynamically build the input list based on available assets
    const inputList = [];
    if (modelImage) inputList.push("- Model Image");
    inputList.push("- Product Image");
    if (logoImage) inputList.push("- Logo Image");
    
    const inputImagesList = inputList.join('\n');
    
    const logoInstruction = logoImage ? `
### 4. Logo
- The "Logo Image" **MUST** be placed in the **top-left corner**.
- The logo must be placed cleanly, without its original background.` : '';

    const qualityInstruction = `
### 5. Image Quality
- **Resolution:** Render the final image in the highest possible fidelity, corresponding to **${quality}** quality. Focus on sharp details, realistic textures, and professional-grade clarity.`;
    
    const textInstruction = overlayText ? `
### 6. Overlay Text (CRITICAL FIDELITY REQUIREMENT)
- **Source Text:** The following string **MUST** be rendered exactly as written, without any character substitution or omission.
  - **TEXT:** "${overlayText}"
- **Language & Font Mandate:** This is **Vietnamese** text. You **MUST** use a high-quality, professional font (such as Arial, Helvetica, or a similar clean sans-serif) that has **100% full support for Vietnamese diacritics (dấu)**. The rendering of accented characters (e.g., ă, â, đ, ê, ô, ơ, ư, à, á, ạ, ả, ã) must be perfect. Any font that cannot render these characters correctly is forbidden.
- **Integrity:** The text is a core part of the design. Do not misspell, alter, or omit any part of it.
- **Placement Rule:** Intelligently place the text in an open, non-distracting area of the image (e.g., a clear sky, a simple wall). The text **MUST NOT** cover the model's face or the main product.
- **Sizing Rule:** The text block should occupy approximately 20% of the total image area.
- **Long Text Fallback:** If the text is long and a suitable open area cannot be found, place the text block cleanly at the bottom of the image, below the model.
` : '';

    const sizeInstruction = productDimensions ? `
### 7. Real-World Product Dimensions (MANDATORY PHYSICS & SCALE)
- **User Specified Dimensions:** The user has explicitly stated the product's physical size is: "${productDimensions}".
- **Scaling Requirement:** You **MUST** scale the product in the generated image to perfectly match these real-world dimensions relative to the human model and the environment.
- **Logic:** 
  - If the size is small (e.g., "5cm", "handheld"), it should fit naturally in a hand or look small on a table. 
  - If the size is large (e.g., "1 meter"), it should appear large.
  - **Override:** Disregard any previous sizing assumptions. This dimension is the absolute truth.
- **Perspective:** Ensure the depth of field and perspective respect this object size.
` : '';

    const prompt = `
**[-- PRIMARY RENDER DIRECTIVE --]**
**ASPECT RATIO: ${aspectRatio}**
This directive is the highest priority. The final output image geometry **MUST** match this aspect ratio exactly.
- If '1:1', the image must be a perfect square (e.g., 4096x4096).
- If '16:9', the image must be wide landscape (e.g., 4096x2304).
- If '9:16', the image must be tall portrait (e.g., 2304x4096).
This is a non-negotiable technical requirement. Failure to adhere to this will result in a failed task.
**[-- END DIRECTIVE --]**

You are a world-class AI art director creating a single, stunning, promotional image. Follow these instructions precisely.

### 1. Scene & Style
- Create a visually stunning background scene that perfectly embodies the theme: "${style}".

${modelInstruction}

### 3. Product
- If the "Product Image" contains packaging, digitally unbox it and use **ONLY the product itself**.
- The product in the final image **MUST BE a LOCKED, UNEDITABLE, PIXEL-PERFECT ELEMENT**. It must be an exact, unaltered representation of the original product. Do not redraw, embellish, or change it. Treat it as a pre-rendered asset to be perfectly composited into the scene.

${logoInstruction}

${qualityInstruction}
${textInstruction}
${sizeInstruction}


**Input Assets Provided:**
${inputImagesList}

Combine all elements into one cohesive, beautiful, professional image.

**Final Confirmation:** Acknowledge and apply the **ASPECT RATIO: ${aspectRatio}** directive.
    `;


    const imageParts = [];

    if (modelImage) {
        imageParts.push(
            { text: "Model Image:" },
            { inlineData: { mimeType: modelImage.file.type, data: modelImage.base64 } }
        );
    }
    
    imageParts.push(
        { text: "Product Image:" },
        { inlineData: { mimeType: productImage.file.type, data: productImage.base64 } }
    );

    if (logoImage) {
        imageParts.push(
            { text: "Logo Image:" },
            { inlineData: { mimeType: logoImage.file.type, data: logoImage.base64 } }
        );
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [{ text: prompt }, ...imageParts],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return part.inlineData.data;
        }
    }

    throw new Error("Branded image generation failed to return an image.");
};