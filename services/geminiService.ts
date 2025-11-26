import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { ImageFile, ModelSelection, ImageQuality } from '../types';

// Helper to lazily initialize the AI client
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please configure VITE_API_KEY or API_KEY in your environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

const fileToGenerativePart = (base64: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64,
      mimeType,
    },
  };
};

export interface ViralStrategy {
  needsHuman: boolean;
  reason: string;
  suggestedElements: string[];
}

export const analyzeViralStrategy = async (articleContent: string): Promise<ViralStrategy> => {
    const ai = getAIClient();
    const prompt = `
    You are a viral marketing expert. Analyze the following social media post content to determine the visual strategy.
    
    **Post Content:**
    "${articleContent}"

    **Task:**
    Determine if this content requires a **Human Model (KOL/Actor)** to convey emotion/story, OR if it should focus purely on the **Product/Logo** (e.g., feature list, flash sale, object-only focus).

    **Output Rules:**
    Return a JSON object with:
    1.  \`needsHuman\` (boolean): true if a human model is recommended, false if product-only is better.
    2.  \`reason\` (string): A short explanation in Vietnamese (e.g., "Bài viết kể về nỗi đau khách hàng nên cần biểu cảm khuôn mặt" or "Bài viết tập trung thông số kỹ thuật, nên focus vào sản phẩm").
    3.  \`suggestedElements\` (array of strings): 3-4 keywords in Vietnamese describing the necessary visual props or vibe (e.g., ["Ánh sáng ấm", "Bàn làm việc", "Laptop"]).

    Do not include markdown code blocks. Just the JSON.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        needsHuman: { type: Type.BOOLEAN },
                        reason: { type: Type.STRING },
                        suggestedElements: { 
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        
        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr) as ViralStrategy;
    } catch (error) {
        console.error("Error analyzing strategy:", error);
        return {
            needsHuman: true,
            reason: "Không thể phân tích chiến lược, hiển thị đầy đủ các tùy chọn.",
            suggestedElements: []
        };
    }
};

export const getStyleSuggestions = async (
    productImageBase64: string, 
    mimeType: string, 
    referenceArticle: string = "", 
    modelImageBase64: string = ""
): Promise<string[]> => {
  const prompt = `
    You are a Creative Director for a high-end advertising agency.
    Your task is to suggest 4 visual styles for a marketing campaign.

    **INPUTS TO ANALYZE (In order of priority):**
    1.  **Reference Article (PRIORITY #1):** "${referenceArticle}"
        *   *Instruction:* Read the article to understand the Mood, Emotion, and Target Audience. (e.g., Is it sad? Joyful? Luxurious? Minimalist? Tech-savvy?). The visual style MUST support this message.
    2.  **Model Image (PRIORITY #2):** ${modelImageBase64 ? "Provided" : "Not Provided"}
        *   *Instruction:* If provided, the style must fit the look/vibe of the model.
    3.  **Product Image (PRIORITY #3):** Provided
        *   *Instruction:* Use this ONLY to identify *what* the object is (e.g., a bottle, a chair). **IGNORE the quality, lighting, or background of the original product photo.** Assume we will re-shoot it in a perfect studio.

    **OUTPUT REQUIREMENTS:**
    - Generate 4 distinct style names.
    - **LANGUAGE: VIETNAMESE (Tiếng Việt)**.
    - Format: Short, catchy phrases (2-4 words).
    - Examples: "Sang trọng & Tối giản", "Ấm áp gia đình", "Cyberpunk Công nghệ", "Thiên nhiên tươi mát".

    Return ONLY a JSON object with a "styles" array.
  `;
  
  const parts = [];
  
  // 1. Reference Article is embedded in prompt text
  
  // 2. Model Image (if exists)
  if (modelImageBase64) {
      parts.push(fileToGenerativePart(modelImageBase64, "image/png")); // Mime type guess, strictly inputs usually passed with type but base64 is enough for Gemini usually if context is clear, or we assume png/jpeg
      parts.push({ text: "This is the Model Image (Priority 2)." });
  }

  // 3. Product Image
  parts.push(fileToGenerativePart(productImageBase64, mimeType));
  parts.push({ text: "This is the Product Image (Priority 3 - Only for object identification)." });

  // 4. Prompt
  parts.push({ text: prompt });

  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Use flash for speed, it's good enough for text reasoning on images
      contents: { parts: parts },
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
    return (result.styles || []).slice(0, 4);
  } catch (error) {
    console.error("Error getting style suggestions:", error);
    return ['Sang trọng & Tinh tế', 'Tối giản Hiện đại', 'Điện ảnh Ấn tượng', 'Sáng tạo Đột phá'];
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
    productDimensions: string = "",
    referenceArticle: string = ""
): Promise<string> => {
    
    const ai = getAIClient();

    const modelDescriptionMap: Record<ModelSelection, string> = {
        'female-asian': 'Beautiful Female Asian model, high-fashion look',
        'male-asian': 'Handsome Male Asian model, professional look',
        'female-european': 'Beautiful Female European model, high-fashion look',
        'male-european': 'Handsome Male European model, professional look',
    };
    const modelDescription = modelDescriptionMap[modelSelection];

    // --- LUXURY MANDATE BLOCK ---
    const luxuryMandate = `
    ### 0. LUXURY BRAND MANDATE (HIGHEST PRIORITY)
    - **ROLE:** You are a high-end Art Director for a luxury brand (like Apple, Chanel, or Mercedes).
    - **TONE & MOOD:** The image MUST feel expensive, sophisticated, and clean. No clutter. No cheap effects.
    - **LIGHTING:** Use professional studio lighting (Softbox, Rim Lighting, or Butterfly Lighting). Shadows must be soft and realistic.
    - **COLOR PALETTE:** Strictly adhere to the "${style}" palette, but keep it harmonious and premium.
    `;

    // --- INTERACTION RULES BLOCK ---
    const interactionRules = `
    ### 2.1. PRODUCT INTERACTION RULES (CRITICAL)
    - **HANDS:** If the model holds the product, their hands must look **elegant, manicured, and refined**. Fingers should be relaxed, not gripping tightly.
    - **VISIBILITY:** The model's hands **MUST NOT** cover the product's logo or key details. Hold the product by the edges or base.
    - **ANGLE:** Angle the product towards the camera so it is clearly the hero of the shot.
    `;

    const contextInstruction = referenceArticle 
    ? `
### 1. SCENE & NARRATIVE (FROM ARTICLE)
- **CONTEXT:** Based on the article: "${referenceArticle}"
- **EXECUTION:** Visualize the emotion and setting described. If the article is emotional, the model's expression must be subtle and acting-grade. If the article is promotional, the focus is strictly on the product allure.
- **AESTHETIC:** Merge this narrative with the "${style}" visual style.
`
    : `
### 1. SCENE & STYLE
- Create a high-end background that fits the theme: "${style}".
- Keep the background blurry (Bokeh effect) if necessary to make the product pop.
`;

    const modelInstruction = modelImage
        ? `
### 2. Model (KOL/USER PROVIDED)
- **SOURCE:** Use the provided "Model Image".
- **FIDELITY:** KEEP THE FACE EXACTLY SAME.
- **CLOTHING:** Adjust clothing to fit the "${style}" if needed, but keep it high-fashion/premium.
${interactionRules}`
        : `
### 2. Model (AI GENERATED)
- **ACTION:** Generate a ${modelDescription}.
- **APPEARANCE:** Skin texture must be realistic (pores, fuzz), not waxy or plastic.
- **POSE:** Professional modeling pose.
${interactionRules}`;

    const inputList = [];
    if (modelImage) inputList.push("- Model Image");
    inputList.push("- Product Image");
    if (logoImage) inputList.push("- Logo Image");
    
    const inputImagesList = inputList.join('\n');
    
    const logoInstruction = logoImage ? `
### 4. Logo (BRANDING)
- **PLACEMENT:** "Logo Image" MUST be in the **TOP-LEFT CORNER**.
- **TREATMENT:** Remove background. Add a subtle drop shadow if needed for visibility against bright backgrounds.
- **INTEGRITY:** Do not warp or distort.
` : '';

    const qualityInstruction = `
### 5. RENDER QUALITY
- **OUTPUT:** Photorealistic, 8k resolution, Unreal Engine 5 render style.
- **DETAILS:** Sharp focus on the product. Soft fall-off in the background.
`;
    
    const textInstruction = overlayText ? `
### 6. TEXT OVERLAY
- **CONTENT:** "${overlayText}"
- **FONT:** Sans-serif, modern, clean (Helvetica-like).
- **PLACEMENT:** Negative space (empty area), ensuring readability. NEVER cover the face or product.
` : '';

    const sizeInstruction = productDimensions ? `
### 7. SCALE & PHYSICS
- **TRUE SIZE:** The product is "${productDimensions}".
- **SCALING:** Adjust the size relative to the model/environment to look physically accurate based on this dimension.
` : '';

    const prompt = `
**[-- TECHNICAL REQUIREMENT --]**
**ASPECT RATIO: ${aspectRatio}**
Output image geometry must match this ratio exactly.
**[-- END REQUIREMENT --]**

${luxuryMandate}

${contextInstruction}

${modelInstruction}

### 3. Product (THE HERO)
- **SOURCE:** Use "Product Image".
- **TREATMENT:** The product must look pristine. If it has packaging, unbox it digitally if the style demands it, or keep it if it's premium packaging.
- **INTEGRATION:** Lighting on the product must match the scene lighting perfectly.

${logoInstruction}

${qualityInstruction}
${textInstruction}
${sizeInstruction}

**Input Assets:**
${inputImagesList}

Create a masterpiece.
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