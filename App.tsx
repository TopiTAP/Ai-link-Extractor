import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { extractLinksStream } from './services/geminiService';
import { ClipboardIcon, LinkIcon, CheckIcon, EyeIcon, EyeOffIcon, DownloadIcon } from './components/Icons';

const Header = () => (
  <header className="text-center p-6 mb-4">
    <h1 className="text-4xl md:text-5xl font-bold tracking-wider text-gray-100">
      AI Link Extractor
    </h1>
    <p className="text-gray-400 mt-2">Instantly pull all links from any block of text.</p>
  </header>
);

const Loader = () => (
  <div className="flex justify-center items-center space-x-2">
    <div className="w-2.5 h-2.5 rounded-full bg-gray-400 animate-pulse [animation-delay:-0.3s]"></div>
    <div className="w-2.5 h-2.5 rounded-full bg-gray-400 animate-pulse [animation-delay:-0.15s]"></div>
    <div className="w-2.5 h-2.5 rounded-full bg-gray-400 animate-pulse"></div>
    <span className="text-gray-400 ml-2 text-sm">Extracting links...</span>
  </div>
);

const GalaxyBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let particles: any[] = [];
        const mouse = { x: -200, y: -200 };
        const particleColors = ['#FFFFFF', '#BBBBBB', '#999999'];

        class Particle {
            x: number;
            y: number;
            size: number;
            speedX: number;
            speedY: number;
            color: string;

            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 1.5 + 0.5;
                this.speedX = (Math.random() * 2 - 1) * 0.2;
                this.speedY = (Math.random() * 2 - 1) * 0.2;
                this.color = particleColors[Math.floor(Math.random() * particleColors.length)];
            }

            update() {
                this.x += this.speedX;
                this.y += this.speedY;

                if (this.x > canvas.width || this.x < 0) this.speedX *= -1;
                if (this.y > canvas.height || this.y < 0) this.speedY *= -1;
            }

            draw() {
                if (!ctx) return;
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        const init = () => {
            particles = [];
            const numberOfParticles = Math.floor((canvas.width * canvas.height) / 9000);
            for (let i = 0; i < numberOfParticles; i++) {
                particles.push(new Particle());
            }
        };
        
        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            init(); // Re-initialize particles on resize
        };

        const handleMouseMove = (event: MouseEvent) => {
            mouse.x = event.clientX;
            mouse.y = event.clientY;
        };
        
        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('mousemove', handleMouseMove);
        resizeCanvas();

        const connect = () => {
             if (!ctx) return;
            let opacityValue = 1;
            for (let a = 0; a < particles.length; a++) {
                for (let b = a; b < particles.length; b++) {
                    const dx = particles[a].x - particles[b].x;
                    const dy = particles[a].y - particles[b].y;
                    const distance = dx * dx + dy * dy;

                    if (distance < 10000) {
                        opacityValue = 1 - (distance / 10000);
                        ctx.strokeStyle = `rgba(255, 255, 255, ${opacityValue * 0.3})`;
                        ctx.lineWidth = 0.5;
                        ctx.beginPath();
                        ctx.moveTo(particles[a].x, particles[a].y);
                        ctx.lineTo(particles[b].x, particles[b].y);
                        ctx.stroke();
                    }
                }
            }
             // Connect to mouse
            for (let i = 0; i < particles.length; i++) {
                const dx = particles[i].x - mouse.x;
                const dy = particles[i].y - mouse.y;
                const distance = dx * dx + dy * dy;
                if (distance < 22500) { 
                     opacityValue = 1 - (distance / 22500);
                     ctx.strokeStyle = `rgba(255, 255, 255, ${opacityValue * 0.5})`;
                     ctx.lineWidth = 1;
                     ctx.beginPath();
                     ctx.moveTo(particles[i].x, particles[i].y);
                     ctx.lineTo(mouse.x, mouse.y);
                     ctx.stroke();
                }
            }
        };

        const animate = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });
            connect();
            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, zIndex: -1, background: '#000000' }} />;
}

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [inputText, setInputText] = useState('');
  const [extractedLinks, setExtractedLinks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [isAllCopied, setIsAllCopied] = useState(false);
  
  // State for filters
  const [filterProtocol, setFilterProtocol] = useState('all'); // 'all', 'https', 'http'
  const [filterKeyword, setFilterKeyword] = useState('');
  const [excludeKeyword, setExcludeKeyword] = useState('');
  const [fileName, setFileName] = useState('extracted_links');

  const copyTimeoutRef = useRef<number | null>(null);
  const allCopyTimeoutRef = useRef<number | null>(null);
  
  useEffect(() => {
    const savedApiKey = localStorage.getItem('userApiKey');
    if (savedApiKey) {
        setApiKey(savedApiKey);
    }
  }, []);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    localStorage.setItem('userApiKey', newKey);
  };


  const filteredLinks = useMemo(() => {
    return extractedLinks
      .filter(link => {
        if (filterProtocol === 'all') return true;
        if (filterProtocol === 'https') return link.startsWith('https://');
        if (filterProtocol === 'http') return link.startsWith('http://');
        return true;
      })
      .filter(link => {
        if (!filterKeyword.trim()) return true;
        return link.toLowerCase().includes(filterKeyword.trim().toLowerCase());
      })
      .filter(link => {
        if (!excludeKeyword.trim()) return true;
        return !link.toLowerCase().includes(excludeKeyword.trim().toLowerCase());
      });
  }, [extractedLinks, filterProtocol, filterKeyword, excludeKeyword]);

  const handleCopy = useCallback((link: string) => {
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(link);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = window.setTimeout(() => setCopiedLink(null), 2000);
    });
  }, []);

  const handleCopyAll = useCallback(() => {
    if (filteredLinks.length === 0) return;
    const allLinksText = filteredLinks.join('\n');
    navigator.clipboard.writeText(allLinksText).then(() => {
      setIsAllCopied(true);
      if (allCopyTimeoutRef.current) clearTimeout(allCopyTimeoutRef.current);
      allCopyTimeoutRef.current = window.setTimeout(() => setIsAllCopied(false), 2000);
    });
  }, [filteredLinks]);

  const handleDownload = useCallback(() => {
    if (filteredLinks.length === 0) return;

    const content = filteredLinks.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    const finalFileName = fileName.trim().endsWith('.txt') 
        ? fileName.trim() 
        : `${fileName.trim() || 'extracted_links'}.txt`;
    link.download = finalFileName;
    
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredLinks, fileName]);
  
  const handleClearAll = useCallback(() => {
    setInputText('');
    setExtractedLinks([]);
    setError(null);
    setCopiedLink(null);
    setIsAllCopied(false);
    setFilterProtocol('all');
    setFilterKeyword('');
    setExcludeKeyword('');
    setFileName('extracted_links');
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    if (allCopyTimeoutRef.current) clearTimeout(allCopyTimeoutRef.current);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!apiKey.trim()) {
      setError("Please enter your Gemini API Key to proceed.");
      return;
    }
    if (!inputText.trim()) {
      setError("Please enter some text to extract links from.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setExtractedLinks([]);
    setFilterKeyword('');
    setExcludeKeyword('');
    setFilterProtocol('all');

    try {
      const stream = await extractLinksStream(inputText, apiKey);
      let accumulatedText = '';
      const linksFound = new Set<string>();

      for await (const chunk of stream) {
        accumulatedText += chunk.text;
        const potentialLinks = accumulatedText.split('\n');
        
        potentialLinks.forEach(line => {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('http://') || trimmedLine.startsWith('https://')) {
            try {
              new URL(trimmedLine);
              linksFound.add(trimmedLine);
            } catch (e) {
              // Ignore invalid URL lines
            }
          }
        });
        setExtractedLinks(Array.from(linksFound));
      }
      
      if (linksFound.size === 0) {
        setError("No links were found in the provided text.");
      }

    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [inputText, apiKey]);
  
  const resultTitle = useMemo(() => {
    if (extractedLinks.length === 0) return 'Extracted Links (0)';
    if (filteredLinks.length === extractedLinks.length) {
      return `Extracted Links (${extractedLinks.length})`;
    }
    return `Showing ${filteredLinks.length} of ${extractedLinks.length} Links`;
  }, [filteredLinks.length, extractedLinks.length]);

  return (
    <div className="min-h-screen text-gray-200 font-sans flex flex-col items-center p-4 relative z-10">
      <GalaxyBackground />
      <div className="w-full max-w-2xl mx-auto">
        <Header />
        
        <main className="bg-black/60 backdrop-blur-md p-6 rounded-xl border border-gray-800 shadow-2xl shadow-white/5">
          <div className="flex flex-col gap-4">
             <div>
              <label htmlFor="api-key-input" className="text-gray-400 font-medium text-sm">
                Your Gemini API Key
              </label>
              <div className="relative mt-1">
                <input
                  id="api-key-input"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={handleApiKeyChange}
                  placeholder="Enter your API Key here..."
                  className="w-full p-3 pr-10 bg-gray-900/70 border border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-300 focus:border-gray-300 transition-all duration-300 placeholder-gray-500"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-white"
                  aria-label={showApiKey ? 'Hide API Key' : 'Show API Key'}
                >
                  {showApiKey ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <label htmlFor="text-input" className="text-gray-400 font-medium">
              Paste your text below
            </label>
            <textarea
              id="text-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter text containing links here..."
              className="w-full h-48 p-4 bg-gray-900/70 border border-gray-700 rounded-lg focus:ring-2 focus:ring-gray-300 focus:border-gray-300 transition-all duration-300 resize-none placeholder-gray-500"
              disabled={isLoading}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                onClick={handleSubmit}
                disabled={isLoading || !inputText || !apiKey}
                className="sm:col-span-2 w-full bg-gray-100 text-black font-bold py-3 px-4 rounded-lg hover:bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-white transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                >
                {isLoading ? 'Extracting...' : 'Extract Links'}
                </button>
                <button
                    onClick={handleClearAll}
                    disabled={isLoading || (!inputText && extractedLinks.length === 0)}
                    className="w-full bg-transparent border border-gray-700 text-gray-400 font-bold py-3 px-4 rounded-lg hover:bg-gray-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-gray-500 transition-colors duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Clear All
                </button>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-4 border-b border-gray-800 pb-2">
                <h2 className="text-xl font-semibold text-white mb-4">
                 {resultTitle}
                </h2>
                {filteredLinks.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <div className="relative w-full sm:flex-1">
                            <input
                                type="text"
                                value={fileName}
                                onChange={(e) => setFileName(e.target.value)}
                                placeholder="Enter filename..."
                                className="w-full bg-gray-800/80 border border-gray-700 rounded-lg pl-3 pr-10 py-2 text-sm focus:ring-1 focus:ring-gray-300 focus:border-gray-300 transition-all duration-300 placeholder-gray-500"
                            />
                            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 text-sm">.txt</span>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button 
                                onClick={handleCopyAll}
                                className="flex items-center justify-center gap-2 w-full sm:w-auto bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white px-4 py-2 rounded-lg transition-colors text-sm font-semibold disabled:opacity-50"
                                disabled={isAllCopied}
                            >
                                {isAllCopied ? <CheckIcon /> : <ClipboardIcon />}
                                <span>{isAllCopied ? 'Copied!' : 'Copy All'}</span>
                            </button>
                            <button 
                                onClick={handleDownload}
                                className="flex items-center justify-center gap-2 w-full sm:w-auto bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white px-4 py-2 rounded-lg transition-colors text-sm font-semibold"
                            >
                                <DownloadIcon />
                                <span>Download</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
             {extractedLinks.length > 0 && (
              <div className="p-4 bg-black/30 rounded-lg mb-4 flex flex-col lg:flex-row gap-4 items-center transition-all duration-300 border border-gray-800">
                <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className="text-sm font-medium text-gray-400 mr-2">Protocol:</span>
                     {['all', 'https', 'http'].map(p => (
                         <button
                           key={p}
                           onClick={() => setFilterProtocol(p)}
                           className={`px-3 py-1 text-sm rounded-md transition-colors capitalize font-semibold ${filterProtocol === p ? 'bg-white text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                         >
                           {p}
                         </button>
                     ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full">
                    <input
                        type="text"
                        placeholder="Filter by keyword..."
                        value={filterKeyword}
                        onChange={(e) => setFilterKeyword(e.target.value)}
                        disabled={isLoading}
                        className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-gray-300 focus:border-gray-300 transition-all duration-300 placeholder-gray-500"
                    />
                    <input
                        type="text"
                        placeholder="Exclude keyword..."
                        value={excludeKeyword}
                        onChange={(e) => setExcludeKeyword(e.target.value)}
                        disabled={isLoading}
                        className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-gray-300 focus:border-gray-300 transition-all duration-300 placeholder-gray-500"
                    />
                </div>
              </div>
            )}
            <div className="space-y-1 max-h-96 overflow-y-auto pr-2">
              {isLoading && extractedLinks.length === 0 && <Loader />}
              {!isLoading && error && (
                <div className="text-center text-rose-400 bg-rose-900/30 p-3 rounded-lg border border-rose-800/50">
                  {error}
                </div>
              )}
               {!isLoading && !error && extractedLinks.length === 0 && (
                <div className="text-center text-gray-500 p-3">
                  Links will appear here once extracted.
                </div>
              )}
              {!isLoading && !error && extractedLinks.length > 0 && filteredLinks.length === 0 && (
                 <div className="text-center text-gray-500 p-3">
                    No links found matching your criteria.
                </div>
              )}
              {filteredLinks.map((link, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg group animate-fade-in hover:bg-white/5">
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-gray-300 group-hover:text-white transition-colors flex-1 mr-4"
                    title={link}
                  >
                    {link}
                  </a>
                  <div className="flex items-center space-x-4">
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-white transition-colors"
                      title="Open in new tab"
                    >
                      <LinkIcon />
                    </a>
                    <button
                      onClick={() => handleCopy(link)}
                      className="text-gray-500 hover:text-white transition-colors"
                      title="Copy link"
                    >
                      {copiedLink === link ? <CheckIcon /> : <ClipboardIcon />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
       <style>{`
        :root {
            color-scheme: dark;
        }
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fade-in 0.4s ease-out forwards;
        }
        ::-webkit-scrollbar {
            width: 8px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: #2d3748;
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #4a5568;
        }
      `}</style>
    </div>
  );
}