import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { AspectRatio, ImageFile, ModelSelection, ImageQuality } from './types';
import ImageUploader from './components/ImageUploader';
import { SparklesIcon, DownloadIcon, RefreshCwIcon, ZoomInIcon, XIcon, MinimizeIcon, InfoIcon, CopyIcon, CheckIcon } from './components/IconComponents';
import { getStyleSuggestions, generateBrandedImage, analyzeViralStrategy, type ViralStrategy } from './services/geminiService';

type GeneratedImage = {
    style: string;
    image: string;
};

const App: React.FC = () => {
    const [modelImage, setModelImage] = useState<ImageFile | null>(null);
    const [productImage, setProductImage] = useState<ImageFile | null>(null);
    const [logoImage, setLogoImage] = useState<ImageFile | null>(null);
    const [modelSelection, setModelSelection] = useState<ModelSelection>('female-asian');
    
    // Reference Article & Strategy State
    const [referenceArticle, setReferenceArticle] = useState('');
    const [viralStrategy, setViralStrategy] = useState<ViralStrategy | null>(null);
    const [isAnalyzingStrategy, setIsAnalyzingStrategy] = useState(false);
    const [showManualModelInput, setShowManualModelInput] = useState(false); // To force show model input even if AI says no

    const [suggestedStyles, setSuggestedStyles] = useState<string[]>([]);
    const [styleLoading, setStyleLoading] = useState(false);
    
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [imageQuality, setImageQuality] = useState<ImageQuality>('4K');
    const [overlayText, setOverlayText] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[] | null>(null);
    const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
    const [regeneratingStyle, setRegeneratingStyle] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    // State for specific product dimensions
    const [productDimensions, setProductDimensions] = useState<string>('');
    
    // State for copy feedback
    const [copySuccess, setCopySuccess] = useState(false);
    
    // State for the enhanced zoom modal
    const [zoomedImage, setZoomedImage] = useState<GeneratedImage | null>(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

    const requiredImagesUploaded = !!productImage;

    const fetchStyleSuggestions = useCallback(async () => {
        if (!productImage) return;
        setStyleLoading(true);
        setError(null);
        try {
            // Pass article content and model image (if exists) to prioritization logic
            const modelBase64 = modelImage ? modelImage.base64 : "";
            const styles = await getStyleSuggestions(
                productImage.base64, 
                productImage.file.type, 
                referenceArticle, 
                modelBase64
            );
            setSuggestedStyles(styles);
        } catch (err) {
            setError('Không thể lấy gợi ý phong cách. Sử dụng các phong cách mặc định.');
            setSuggestedStyles(['Sang trọng & Tinh tế', 'Hiện đại & Tối giản', 'Sống động & Tươi mới', 'Chuyên nghiệp']);
            console.error(err);
        } finally {
            setStyleLoading(false);
        }
    }, [productImage, modelImage, referenceArticle]);

    // Re-fetch styles when images change
    // Note: We don't include referenceArticle in the dependency array to avoid api calls on every keystroke.
    // Instead, we rely on handleAnalyzeStrategy to trigger updates for text changes, 
    // and this effect for image changes.
    useEffect(() => {
        if (productImage) {
            fetchStyleSuggestions();
        } else {
            setSuggestedStyles([]);
        }
    }, [productImage, modelImage]); // Removed referenceArticle from here intentionally
    
    const handleAnalyzeStrategy = async () => {
        if (!referenceArticle.trim()) return;
        setIsAnalyzingStrategy(true);
        setViralStrategy(null);
        setError(null);
        
        try {
            const strategy = await analyzeViralStrategy(referenceArticle);
            setViralStrategy(strategy);
            // If strategy says we DON'T need a human, ensure manual override is off initially
            if (!strategy.needsHuman) {
                setShowManualModelInput(false);
            }
            
            // After analyzing text, refresh style suggestions if we have a product image
            if (productImage) {
                fetchStyleSuggestions();
            }

        } catch (err) {
            console.error(err);
            setError("Không thể phân tích chiến lược. Vui lòng thử lại.");
        } finally {
            setIsAnalyzingStrategy(false);
        }
    };

    const handleGenerate = async () => {
        if (!requiredImagesUploaded) {
            setError("Vui lòng tải lên ảnh Sản Phẩm để tiếp tục.");
            return;
        }

        const stylesToGenerate = suggestedStyles.slice(0, 4);
        if (stylesToGenerate.length < 1) {
             setError('Không có đủ phong cách được gợi ý để bắt đầu tạo ảnh.');
             return;
        }

        setIsLoading(true);
        setGeneratedImages(null);
        setSelectedImage(null);
        setError(null);
        setProductDimensions(''); // Reset custom dimensions on new full generation
        
        const messages = ["Đang đọc bài viết và dựng bối cảnh...", "Đang tạo các biến thể phong cách...", "Đang hoàn thiện các ấn phẩm...", "AI đang sáng tạo, vui lòng chờ..."];
        let messageIndex = 0;
        setLoadingMessage(messages[messageIndex]);
        const interval = setInterval(() => {
            messageIndex = (messageIndex + 1) % messages.length;
            setLoadingMessage(messages[messageIndex]);
        }, 4000);

        try {
            const generationPromises = stylesToGenerate.map(style => 
                generateBrandedImage(modelImage, productImage, logoImage, style, aspectRatio, modelSelection, imageQuality, overlayText, productDimensions, referenceArticle)
                    .then(image => ({ style, image }))
            );
            
            const finalResult = await Promise.all(generationPromises);
            setGeneratedImages(finalResult);
            setSelectedImage(finalResult[0]);

        } catch (err) {
            setError('Tạo ảnh thất bại. Vui lòng thử lại.');
            console.error(err);
        } finally {
            clearInterval(interval);
            setIsLoading(false);
        }
    };
    
    const handleRegenerateStyle = async (styleToRegen: string, dimensions: string = "") => {
        if (!productImage || regeneratingStyle) return;

        setRegeneratingStyle(styleToRegen);
        setError(null);

        try {
            const regeneratedPart = await generateBrandedImage(
                modelImage, productImage, logoImage, styleToRegen, aspectRatio, modelSelection, imageQuality, overlayText, dimensions, referenceArticle
            );
            
            const newImage = { style: styleToRegen, image: regeneratedPart };

            setGeneratedImages(prev => {
                if (!prev) return [newImage];
                const updatedImages = prev.map(img => img.style === styleToRegen ? newImage : img);
                if (selectedImage?.style === styleToRegen) {
                    setSelectedImage(newImage);
                }
                return updatedImages;
            });

        } catch (err) {
            setError(`Tạo lại phong cách '${styleToRegen}' thất bại.`);
            console.error(err);
        } finally {
            setRegeneratingStyle(null);
        }
    };

    const handleReset = () => {
        setModelImage(null);
        setProductImage(null);
        setLogoImage(null);
        setSuggestedStyles([]);
        setAspectRatio('1:1');
        setImageQuality('4K');
        setOverlayText('');
        setProductDimensions('');
        setReferenceArticle('');
        setViralStrategy(null);
        setGeneratedImages(null);
        setSelectedImage(null);
        setError(null);
        setIsLoading(false);
        setModelSelection('female-asian');
        setShowManualModelInput(false);
    };

    const downloadImage = (base64Image: string, style: string) => {
        if (!base64Image) return;
        const link = document.createElement('a');
        link.href = `data:image/jpeg;base64,${base64Image}`;
        link.download = `brand-image-${style.replace(/\s+/g, '-')}-${Date.now()}.jpeg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleCopyImage = async (base64Image: string) => {
        try {
            const response = await fetch(`data:image/jpeg;base64,${base64Image}`);
            const blob = await response.blob();
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob,
                }),
            ]);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
            console.error("Failed to copy image: ", err);
            alert("Không thể sao chép ảnh trực tiếp. Vui lòng tải xuống.");
        }
    };

    // --- Handlers for the enhanced zoom modal ---
    const openZoomModal = (image: GeneratedImage) => {
        setZoomedImage(image);
        setZoomLevel(1);
        setImagePosition({ x: 0, y: 0 });
    };

    const closeZoomModal = () => {
        setZoomedImage(null);
    };

    const handleZoom = (level: number) => {
        setZoomLevel(level);
        if (level === 1) {
            setImagePosition({ x: 0, y: 0 });
        }
    };

    const handlePanStart = (e: React.MouseEvent) => {
        e.preventDefault();
        if (zoomLevel <= 1) return;
        setIsPanning(true);
        panStartRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialX: imagePosition.x,
            initialY: imagePosition.y,
        };
    };

    const handlePanMove = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!isPanning) return;
        const dx = e.clientX - panStartRef.current.startX;
        const dy = e.clientY - panStartRef.current.startY;
        setImagePosition({
            x: panStartRef.current.initialX + dx,
            y: panStartRef.current.initialY + dy,
        });
    };

    const handlePanEnd = () => {
        setIsPanning(false);
    };
    // --- End of zoom modal handlers ---


    const aspectRatioClasses: Record<AspectRatio, string> = {
        '1:1': 'aspect-square',
        '9:16': 'aspect-[9/16]',
        '16:9': 'aspect-[16/9]',
    };

    const Canvas = () => (
        <div className={`relative flex items-center justify-center w-full bg-slate-800/20 rounded-2xl border border-slate-800 min-h-[60vh] lg:min-h-full transition-all duration-300 ${aspectRatioClasses[aspectRatio]}`}>
            {isLoading ? (
                 <div className="flex flex-col items-center text-center p-8">
                    <div className="relative w-24 h-24 mb-6">
                        <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin"></div>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">Đang tạo...</h3>
                    <p className="text-slate-400">{loadingMessage}</p>
                 </div>
            ) : generatedImages && selectedImage ? (
                <div className="w-full h-full flex flex-col p-4 md:p-6">
                    <div className="relative flex-grow flex items-center justify-center">
                         <img 
                            src={`data:image/jpeg;base64,${selectedImage.image}`} 
                            alt={`Được tạo theo phong cách ${selectedImage.style}`} 
                            className={`rounded-xl w-full h-full object-contain transition-all duration-300`}
                        />
                         <div className="absolute top-2 right-2 flex items-center gap-2">
                             <button onClick={() => openZoomModal(selectedImage)} className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-all" aria-label="Phóng to" title="Phóng to">
                                 <ZoomInIcon className="w-5 h-5"/>
                             </button>
                             <button 
                                onClick={() => handleCopyImage(selectedImage.image)} 
                                className={`p-2 rounded-full text-white backdrop-blur-sm transition-all ${copySuccess ? 'bg-green-600/80 hover:bg-green-600' : 'bg-black/50 hover:bg-black/70'}`}
                                aria-label="Sao chép ảnh"
                                title="Sao chép ảnh vào bộ nhớ tạm"
                             >
                                 {copySuccess ? <CheckIcon className="w-5 h-5"/> : <CopyIcon className="w-5 h-5"/>}
                             </button>
                             <button onClick={() => downloadImage(selectedImage.image, selectedImage.style)} className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-all" aria-label="Tải xuống" title="Tải xuống">
                                 <DownloadIcon className="w-5 h-5"/>
                             </button>
                         </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-800">
                        <div className="flex justify-center overflow-x-auto gap-3 pb-2">
                           {generatedImages.map((img) => (
                            <button key={img.style} onClick={() => setSelectedImage(img)} className={`relative w-20 h-20 rounded-md overflow-hidden flex-shrink-0 transition-all duration-300
                                ${selectedImage.style === img.style ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-indigo-500' : 'opacity-60 hover:opacity-100'}`}
                            >
                                <img src={`data:image/jpeg;base64,${img.image}`} alt={img.style} className="w-full h-full object-cover" />
                                {regeneratingStyle === img.style && (
                                     <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                         <div className="w-6 h-6 border-2 border-t-white rounded-full animate-spin"></div>
                                     </div>
                                )}
                            </button>
                           ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center p-8">
                     <SparklesIcon className="mx-auto h-16 w-16 text-slate-600 mb-4" />
                     <h3 className="text-xl font-semibold text-white">Khung vẽ Sáng tạo</h3>
                     <p className="text-slate-400 mt-2">Tải lên tài sản của bạn và bắt đầu tạo ảnh thương hiệu độc đáo.</p>
                </div>
            )}
        </div>
    );
    
    // UI Helper: Determines if Model Input should be shown
    const shouldShowModelInput = () => {
        // 1. If we have a strategy:
        if (viralStrategy) {
            // Show if strategy needs human OR if user manually overrode it OR if user already uploaded a model
            return viralStrategy.needsHuman || showManualModelInput || !!modelImage;
        }
        // 2. If no strategy (didn't analyze yet, or no article):
        // Show by default (classic behavior)
        return true;
    };

    const Controls = () => (
         <div className="w-full h-full space-y-6">
            
            {/* Step 1: Article & Analysis */}
            <div className="rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-lg text-white">Bước 1: Nội Dung Bài Viết</h3>
                    <InfoIcon className="w-4 h-4 text-slate-500" />
                </div>
                
                <div className="space-y-3">
                    <textarea 
                        id="referenceArticle" 
                        rows={4} 
                        value={referenceArticle} 
                        onChange={(e) => setReferenceArticle(e.target.value)} 
                        placeholder="Dán nội dung bài viết quảng cáo vào đây. AI sẽ phân tích xem bạn cần hình ảnh như thế nào..." 
                        className="bg-slate-900/70 border border-slate-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5 resize-none"
                    ></textarea>
                    
                    <button 
                        onClick={handleAnalyzeStrategy}
                        disabled={!referenceArticle.trim() || isAnalyzingStrategy}
                        className="w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isAnalyzingStrategy ? (
                            <>
                                <div className="w-4 h-4 border-2 border-t-transparent border-indigo-300 rounded-full animate-spin"></div>
                                Đang phân tích chiến lược...
                            </>
                        ) : (
                            <>
                                <SparklesIcon className="w-4 h-4" />
                                Phân tích Chiến lược Viral
                            </>
                        )}
                    </button>
                </div>

                {/* Strategy Result Display */}
                {viralStrategy && (
                    <div className="mt-4 p-3 bg-slate-900/60 rounded-lg border-l-4 border-indigo-500 animate-fade-in">
                        <div className="flex items-start gap-3">
                            <div className="flex-1">
                                <h4 className="text-sm font-semibold text-indigo-300 mb-1">Gợi ý từ Chuyên gia AI:</h4>
                                <p className="text-sm text-slate-300 italic mb-2">"{viralStrategy.reason}"</p>
                                <div className="flex flex-wrap gap-1">
                                    <span className={`text-xs px-2 py-0.5 rounded border ${viralStrategy.needsHuman ? 'bg-green-900/30 border-green-500/50 text-green-400' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>
                                        {viralStrategy.needsHuman ? '✅ Cần yếu tố con người' : '❌ Tập trung vào Sản phẩm'}
                                    </span>
                                    {viralStrategy.suggestedElements.map((el, i) => (
                                        <span key={i} className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-400">{el}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Step 2: Upload Assets (Dynamic based on Strategy) */}
            <div className="rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-5">
                <h3 className="font-semibold text-lg text-white mb-4">Bước 2: Tài Nguyên Hình Ảnh</h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <ImageUploader label="Ảnh Sản Phẩm (*)" onImageUpload={setProductImage} uploadedImage={productImage} />
                        <ImageUploader label="Ảnh Logo" onImageUpload={setLogoImage} uploadedImage={logoImage} />
                    </div>

                    {shouldShowModelInput() ? (
                        <div className="animate-fade-in">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-slate-300">Ảnh Người Mẫu {viralStrategy?.needsHuman && <span className="text-green-400 text-xs ml-2">(Được đề xuất)</span>}</span>
                                {viralStrategy && !viralStrategy.needsHuman && (
                                     <button onClick={() => setShowManualModelInput(false)} className="text-xs text-red-400 hover:text-red-300">Ẩn đi</button>
                                )}
                            </div>
                            <ImageUploader label="" onImageUpload={setModelImage} uploadedImage={modelImage} />
                            {!modelImage && (
                                <div className="mt-2">
                                    <label htmlFor="modelSelection" className="block text-xs font-medium text-slate-400 mb-1">Hoặc Chọn Mẫu AI</label>
                                    <select id="modelSelection" value={modelSelection} onChange={(e) => setModelSelection(e.target.value as ModelSelection)} className="bg-slate-900/70 border border-slate-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5">
                                        <option value="female-asian">Nữ (Châu Á)</option>
                                        <option value="male-asian">Nam (Châu Á)</option>
                                        <option value="female-european">Nữ (Châu Âu)</option>
                                        <option value="male-european">Nam (Châu Âu)</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-4 border border-dashed border-slate-700 rounded-lg text-center bg-slate-800/30">
                            <p className="text-sm text-slate-400 mb-2">AI gợi ý bài viết này hiệu quả nhất khi chỉ tập trung vào Sản phẩm & Logo.</p>
                            <button 
                                onClick={() => setShowManualModelInput(true)}
                                className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                            >
                                Vẫn thêm người mẫu?
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Step 3 & 4 */}
            {requiredImagesUploaded && (
                 <div className="rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-5 space-y-6 animate-fade-in">
                    <div>
                        <h3 className="font-semibold text-lg text-white mb-4">Bước 3: Phong Cách Đề Xuất</h3>
                        {styleLoading ? <div className="text-slate-400 text-sm">Đang phân tích và gợi ý phong cách...</div> : (
                            <div className="flex flex-wrap gap-2">
                                {suggestedStyles.slice(0, 4).map(style => (
                                     <span key={style} className="px-3 py-1 rounded-full text-xs font-medium bg-slate-700 text-indigo-300 border border-slate-600">
                                        {style}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg text-white mb-4">Bước 4: Tùy Chỉnh & Tạo</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Tỷ Lệ</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['1:1', '9:16', '16:9'] as AspectRatio[]).map(ar => (
                                        <button key={ar} onClick={() => setAspectRatio(ar)} className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${aspectRatio === ar ? 'bg-indigo-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>
                                            {ar}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Chất Lượng</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['4K', '8K', '16K'] as ImageQuality[]).map(q => (
                                        <button key={q} onClick={() => setImageQuality(q)} className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${imageQuality === q ? 'bg-indigo-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                           <div>
                                <label htmlFor="overlayText" className="block text-sm font-medium text-slate-300 mb-2">Văn Bản Trên Ảnh (Tùy chọn)</label>
                                <textarea id="overlayText" rows={2} value={overlayText} onChange={(e) => setOverlayText(e.target.value)} placeholder="VD: Ưu đãi đặc biệt..." className="bg-slate-900/70 border border-slate-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5"></textarea>
                           </div>
                        </div>
                    </div>
                     <button onClick={handleGenerate} disabled={isLoading || styleLoading || !requiredImagesUploaded} className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        <SparklesIcon className="w-5 h-5"/> {referenceArticle ? 'Hiện Thực Hóa Ý Tưởng' : 'Tạo 4 Ảnh'}
                    </button>
                 </div>
            )}
             {error && <p className="text-red-400 text-center text-sm">{error}</p>}
        </div>
    );
    
    return (
        <div className="min-h-screen bg-slate-900 text-gray-200 p-4 sm:p-6 lg:p-8">
            <main className="max-w-screen-2xl mx-auto">
                <header className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
                        Studio Ảnh Thương Hiệu AI
                    </h1>
                    <p className="mt-3 text-lg text-slate-400">Tạo ra các ấn phẩm truyền thông mạng xã hội ấn tượng trong vài giây.</p>
                </header>

                <div className="grid lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-7 xl:col-span-8">
                        <Canvas />
                    </div>
                    <div className="lg:col-span-5 xl:col-span-4">
                        {generatedImages && selectedImage ? (
                             <div className="rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-5 space-y-4">
                                 <h3 className="font-semibold text-lg text-white">Kết quả của bạn</h3>
                                 <p className="text-sm text-slate-400">Chọn một ảnh bên trái để xem chi tiết hoặc tạo lại phong cách bạn muốn.</p>
                                 
                                 <div className="grid grid-cols-2 gap-3">
                                    {generatedImages.map(img => (
                                        <button
                                            key={img.style}
                                            disabled={regeneratingStyle !== null}
                                            onClick={() => {
                                                setSelectedImage(img);
                                                handleRegenerateStyle(img.style, productDimensions);
                                            }}
                                            className={`w-full text-sm inline-flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700
                                            ${selectedImage.style === img.style ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                        >
                                            <RefreshCwIcon className="w-4 h-4 mb-1" />
                                            <span className="truncate w-full text-center">{img.style}</span>
                                        </button>
                                    ))}
                                 </div>

                                 {/* Special Regeneration Block for the Selected Image */}
                                 <div className="p-4 rounded-lg bg-indigo-900/30 border border-indigo-500/30 space-y-3">
                                     <p className="text-sm font-medium text-indigo-300">Chỉnh sửa: {selectedImage.style}</p>
                                     
                                     <div className="space-y-2">
                                         <label htmlFor="dimensions" className="block text-xs text-slate-400">Kích thước thực tế sản phẩm:</label>
                                         <div className="flex gap-2">
                                             <input 
                                                 id="dimensions"
                                                 type="text" 
                                                 value={productDimensions}
                                                 onChange={(e) => setProductDimensions(e.target.value)}
                                                 placeholder="VD: Cao 15cm, vừa lòng bàn tay..."
                                                 className="flex-1 bg-slate-900/70 border border-slate-600 text-white text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2"
                                             />
                                         </div>
                                         <button
                                             disabled={regeneratingStyle !== null || !productDimensions.trim()}
                                             onClick={() => handleRegenerateStyle(selectedImage.style, productDimensions)}
                                             className="w-full text-xs inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                         >
                                             <MinimizeIcon className="w-4 h-4" />
                                             Tạo lại với kích thước này
                                         </button>
                                     </div>
                                     <p className="text-[10px] text-indigo-400/80 text-center">
                                        Giữ nguyên bố cục, chỉ điều chỉnh tỷ lệ sản phẩm cho đúng thực tế.
                                     </p>
                                 </div>

                                 <button onClick={handleReset} className="w-full inline-flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg text-base transition-colors mt-4">
                                    <RefreshCwIcon className="w-5 h-5"/> Bắt đầu lại
                                </button>
                             </div>
                        ) : (
                            <Controls />
                        )}
                    </div>
                </div>

                <footer className="mt-12 py-6 border-t border-slate-800 text-center">
                    <p className="text-slate-500 text-sm">
                        Made by <span className="text-slate-400 font-medium">Nguyễn Văn Sơn</span>
                    </p>
                    <p className="text-slate-500 text-sm mt-1">
                        Liên hệ: <a href="tel:0989881732" className="text-indigo-400 hover:text-indigo-300 transition-colors">0989881732</a>
                    </p>
                </footer>
            </main>

            {zoomedImage && (
                <div 
                    className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" 
                    onClick={closeZoomModal}
                    aria-modal="true"
                    role="dialog"
                >
                    <style>{`
                        @keyframes scale-in { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                        .animate-scale-in { animation: scale-in 0.3s cubic-bezier(0.25, 1, 0.5, 1); }
                    `}</style>
                    <div 
                        className="relative w-full max-w-5xl h-full max-h-[90vh] animate-scale-in flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                         <div 
                            className="w-full h-full overflow-hidden"
                            onMouseDown={handlePanStart}
                            onMouseMove={handlePanMove}
                            onMouseUp={handlePanEnd}
                            onMouseLeave={handlePanEnd}
                            style={{ cursor: isPanning ? 'grabbing' : (zoomLevel > 1 ? 'grab' : 'default') }}
                         >
                            <img 
                                src={`data:image/jpeg;base64,${zoomedImage.image}`} 
                                alt={`Chế độ xem phóng to: ${zoomedImage.style}`} 
                                className="w-full h-full object-contain"
                                style={{
                                    transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${zoomLevel})`,
                                    transition: isPanning ? 'none' : 'transform 0.2s ease-out',
                                }}
                                draggable="false"
                            />
                         </div>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-full p-1 flex items-center gap-1 text-white text-sm font-medium shadow-lg">
                            <button onClick={() => handleZoom(1)} className={`px-3 py-1.5 rounded-full transition-colors ${zoomLevel === 1 ? 'bg-indigo-600' : 'hover:bg-white/20'}`}>Fit</button>
                            <button onClick={() => handleZoom(4)} className={`px-3 py-1.5 rounded-full transition-colors ${zoomLevel === 4 ? 'bg-indigo-600' : 'hover:bg-white/20'}`}>4x</button>
                            <button onClick={() => handleZoom(8)} className={`px-3 py-1.5 rounded-full transition-colors ${zoomLevel === 8 ? 'bg-indigo-600' : 'hover:bg-white/20'}`}>8x</button>
                            <button onClick={() => handleZoom(20)} className={`px-3 py-1.5 rounded-full transition-colors ${zoomLevel === 20 ? 'bg-indigo-600' : 'hover:bg-white/20'}`}>20x</button>
                        </div>
                        <button
                            onClick={closeZoomModal}
                            className="absolute -top-3 -right-3 md:-top-4 md:-right-4 bg-white text-gray-800 rounded-full p-2 shadow-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-900 transition-transform hover:scale-110"
                            aria-label="Đóng"
                        >
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;