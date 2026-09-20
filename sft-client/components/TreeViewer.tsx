'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Minus, Plus, RefreshCw } from 'lucide-react';
import { ReferralTree, TreeNodeData } from './ReferralTree';

interface TreeViewerProps {
    data: TreeNodeData | null;
    currentUserReferralCode?: string;
    loading?: boolean;
}

export const TreeViewer: React.FC<TreeViewerProps> = ({ data, currentUserReferralCode, loading = false }) => {
    const [scale, setScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // Zoom Handlers
    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 2));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.2));
    const handleReset = () => {
        if (containerRef.current && contentRef.current) {
            // Auto-fit logic on reset
            const containerWidth = containerRef.current.clientWidth;
            const contentWidth = contentRef.current.scrollWidth;

            // Add buffer
            const safeContentWidth = contentWidth + 100;

            if (safeContentWidth > containerWidth) {
                const newScale = containerWidth / safeContentWidth;
                setScale(Math.max(0.2, newScale));
            } else {
                setScale(1);
            }

            // Center scroll
            setTimeout(() => {
                if (containerRef.current) {
                    const scrollLeft = (containerRef.current.scrollWidth - containerRef.current.clientWidth) / 2;
                    containerRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' });
                }
            }, 50);
        } else {
            setScale(1);
        }
    };

    // Initial Auto-fit and Center
    useEffect(() => {
        if (!loading && data) {
            // Small delay to allow rendering
            setTimeout(handleReset, 100);
        }
    }, [loading, data]);

    return (
        <div className="relative w-full max-w-full h-[calc(100vh-200px)] border border-gray-200 rounded-xl overflow-hidden bg-gray-50/50 shadow-inner">
            {/* Zoom Controls */}
            <div className="absolute top-4 right-4 z-40 flex flex-col gap-2 bg-white p-2 rounded-lg shadow-md border border-gray-100">
                <button
                    onClick={handleZoomIn}
                    className="p-2 hover:bg-gray-100 rounded-md text-gray-700 transition-colors"
                    title="Zoom In"
                >
                    <Plus size={20} />
                </button>
                <button
                    onClick={handleZoomOut}
                    className="p-2 hover:bg-gray-100 rounded-md text-gray-700 transition-colors"
                    title="Zoom Out"
                >
                    <Minus size={20} />
                </button>
                <button
                    onClick={handleReset}
                    className="p-2 hover:bg-gray-100 rounded-md text-gray-700 transition-colors"
                    title="Reset View"
                >
                    <RefreshCw size={20} />
                </button>
                <div className="text-[10px] text-center text-gray-400 font-mono mt-1 border-t pt-1">
                    {Math.round(scale * 100)}%
                </div>
            </div>

            {/* Scrollable Container */}
            <div
                ref={containerRef}
                className="w-full h-full overflow-auto relative touch-pan-x touch-pan-y text-center"
            >
                {/* 
                   Content Wrapper 
                   Using inline-block inside a block-level overflow container.
                   text-center on parent + inline-block on child = centered when small,
                   scrollable when large. Does NOT expand the parent's layout width.
                */}

                {loading ? (
                    <div className="flex items-center justify-center h-full w-full">
                        <div className="animate-pulse text-muted-foreground">Loading Tree...</div>
                    </div>
                ) : (
                    <div className="inline-block p-10 text-left">
                        <div
                            ref={contentRef}
                            className="origin-top bg-transparent transition-transform duration-200 ease-out"
                            style={{
                                transform: `scale(${scale})`,
                                /* Ensure the container is at least as wide as the view to allow centering */
                                minWidth: '100%',
                                display: 'flex',
                                justifyContent: 'center'
                            }}
                        >
                            <ReferralTree node={data} currentUserReferralCode={currentUserReferralCode} />
                        </div>
                    </div>
                )}
            </div>

            {/* Legend Overlay */}
            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow border border-gray-200 text-xs z-30 pointer-events-none">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full bg-white border-2 border-primary"></div>
                    <span className="text-gray-700 font-medium">Occupied</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-secondary border-2 border-dashed border-gray-300"></div>
                    <span className="text-gray-500">Vacant</span>
                </div>
            </div>
        </div>
    );
};
