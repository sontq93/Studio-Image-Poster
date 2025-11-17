import React, { useState, useCallback, useEffect } from 'react';
import type { AspectRatio, ImageFile, ModelSelection, ImageQuality } from './types';
import ImageUploader from './components/ImageUploader';
import { SparklesIcon, DownloadIcon, RefreshCwIcon, ZoomInIcon, XIcon } from './components/IconComponents';
import { getStyleSuggestions, generateBrandedImage } from './services/geminiService';

type GeneratedImage = {
    style: string;
    image: string;
};

const App: React.FC = () => {
    const [modelImage, setModelImage] = useState<ImageFile | null>(null);
    const [productImage, setProductImage] = useState<ImageFile | null>(null);
    const [logoImage, setLogoImage] = useState<ImageFile | null>(null);
    const [modelSelection, setModelSelection] = useState<ModelSelection>('female-asian');

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
    const [zoomedImage, setZoomedImage] = useState<GeneratedImage | null>(null);


    const requiredImagesUploaded = productImage && logoImage;

    const fetchStyleSuggestions = useCallback(async () => {
        if (!productImage) return;
        setStyleLoading(true);
        setError(null);
        try {
            const styles = await getStyleSuggestions(productImage.base64, productImage.file.type);
            setSuggestedStyles(styles);
        } catch (err) {
            setError('Không thể lấy gợi ý phong cách. Sử dụng các phong cách mặc định.');
            setSuggestedStyles(['Tối giản', 'Sống động', 'Thanh lịch', 'Hiện đại']);
            console.error(err);
        } finally {
            setStyleLoading(false);
        }
    }, [productImage]);

    useEffect(() => {
        if (productImage) {
            fetchStyleSuggestions();
        } else {
            setSuggestedStyles([]);
        }
    }, [productImage, fetchStyleSuggestions]);
    
    const handleGenerate = async () => {
        if (!requiredImagesUploaded) {
            setError("Vui lòng tải lên ảnh Sản Phẩm và Logo để tiếp tục.");
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
        
        const messages = ["Đang dựng bối cảnh...", "Đang tạo các biến thể phong cách...", "Đang hoàn thiện các ấn phẩm...", "AI đang sáng tạo, vui lòng chờ..."];
        let messageIndex = 0;
        setLoadingMessage(messages[messageIndex]);
        const interval = setInterval(() => {
            messageIndex = (messageIndex + 1) % messages.length;
            setLoadingMessage(messages[messageIndex]);
        }, 4000);

        try {
            const generationPromises = stylesToGenerate.map(style => 
                generateBrandedImage(modelImage, productImage, logoImage, style, aspectRatio, modelSelection, imageQuality, overlayText)
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
    
    const handleRegenerateStyle = async (styleToRegen: string) => {
        if (!productImage || !logoImage || regeneratingStyle) return;

        setRegeneratingStyle(styleToRegen);
        setError(null);

        try {
            const regeneratedPart = await generateBrandedImage(
                modelImage, productImage, logoImage, styleToRegen, aspectRatio, modelSelection, imageQuality, overlayText
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
        setGeneratedImages(null);
        setSelectedImage(null);
        setError(null);
        setIsLoading(false);
        setModelSelection('female-asian');
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
                             <button onClick={() => setZoomedImage(selectedImage)} className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-all" aria-label="Phóng to">
                                 <ZoomInIcon className="w-5 h-5"/>
                             </button>
                             <button onClick={() => downloadImage(selectedImage.image, selectedImage.style)} className="p-2 rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm transition-all" aria-label="Tải xuống">
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
    
    const Controls = () => (
         <div className="w-full h-full space-y-6">
            {/* Step 1 */}
            <div className="rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-5">
                <h3 className="font-semibold text-lg text-white mb-4">Bước 1: Tải Lên Tài Sản</h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <ImageUploader label="Ảnh Sản Phẩm (*)" onImageUpload={setProductImage} uploadedImage={productImage} />
                        <ImageUploader label="Ảnh Logo (*)" onImageUpload={setLogoImage} uploadedImage={logoImage} />
                    </div>
                    <ImageUploader label="Ảnh Người Mẫu" onImageUpload={setModelImage} uploadedImage={modelImage} />
                    {!modelImage && (
                        <div>
                            <label htmlFor="modelSelection" className="block text-sm font-medium text-slate-300 mb-2">Hoặc Chọn Kiểu Người Mẫu</label>
                            <select id="modelSelection" value={modelSelection} onChange={(e) => setModelSelection(e.target.value as ModelSelection)} className="bg-slate-900/70 border border-slate-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5">
                                <option value="female-asian">Nữ (Châu Á)</option>
                                <option value="male-asian">Nam (Châu Á)</option>
                                <option value="female-european">Nữ (Châu Âu)</option>
                                <option value="male-european">Nam (Châu Âu)</option>
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Step 2 & 3 */}
            {requiredImagesUploaded && (
                 <div className="rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-5 space-y-6">
                    <div>
                        <h3 className="font-semibold text-lg text-white mb-4">Bước 2: Phong Cách AI Gợi Ý</h3>
                        {styleLoading ? <div className="text-slate-400 text-sm">Đang phân tích...</div> : (
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
                        <h3 className="font-semibold text-lg text-white mb-4">Bước 3: Tùy Chỉnh & Tạo Ảnh</h3>
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
                                <label htmlFor="overlayText" className="block text-sm font-medium text-slate-300 mb-2">Văn Bản (Tùy chọn)</label>
                                <textarea id="overlayText" rows={3} value={overlayText} onChange={(e) => setOverlayText(e.target.value)} placeholder="VD: Ưu đãi đặc biệt..." className="bg-slate-900/70 border border-slate-600 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5"></textarea>
                           </div>
                        </div>
                    </div>
                     <button onClick={handleGenerate} disabled={isLoading || styleLoading || !requiredImagesUploaded} className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        <SparklesIcon className="w-5 h-5"/> Tạo 4 Ảnh
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
                        {generatedImages ? (
                             <div className="rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-5 space-y-4">
                                 <h3 className="font-semibold text-lg text-white">Kết quả của bạn</h3>
                                 <p className="text-sm text-slate-400">Chọn một ảnh bên trái để xem chi tiết hoặc tạo lại phong cách bạn muốn.</p>
                                 <div className="grid grid-cols-2 gap-3">
                                    {generatedImages.map(img => (
                                        <button
                                            key={img.style}
                                            disabled={regeneratingStyle !== null}
                                            onClick={() => handleRegenerateStyle(img.style)}
                                            className="w-full text-sm inline-flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2 px-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <RefreshCwIcon className="w-4 h-4" />
                                            Tạo lại "{img.style}"
                                        </button>
                                    ))}
                                 </div>
                                 <button onClick={handleReset} className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-base transition-colors">
                                    <RefreshCwIcon className="w-5 h-5"/> Bắt đầu lại
                                </button>
                             </div>
                        ) : (
                            <Controls />
                        )}
                    </div>
                </div>
            </main>

            {zoomedImage && (
                <div 
                    className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" 
                    onClick={() => setZoomedImage(null)}
                    aria-modal="true"
                    role="dialog"
                >
                    <style>{`
                        @keyframes scale-in { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                        .animate-scale-in { animation: scale-in 0.3s cubic-bezier(0.25, 1, 0.5, 1); }
                    `}</style>
                    <div 
                        className="relative w-full max-w-5xl max-h-[90vh] animate-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                         <img 
                             src={`data:image/jpeg;base64,${zoomedImage.image}`} 
                             alt={`Chế độ xem phóng to: ${zoomedImage.style}`} 
                             className="rounded-lg object-contain w-full h-auto max-h-[90vh]"
                         />
                        <button
                            onClick={() => setZoomedImage(null)}
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