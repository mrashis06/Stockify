
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Camera, Zap, ZapOff, ZoomIn, ZoomOut, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface SharedScannerProps {
    onScanSuccess: (decodedText: string) => void;
    isPaused: boolean;
}

const SharedScanner: React.FC<SharedScannerProps> = ({ onScanSuccess, isPaused }) => {
    const { toast } = useToast();
    const scannerRegionId = "shared-barcode-scanner";
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const videoTrackRef = useRef<MediaStreamTrack | null>(null);

    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scannerState, setScannerState] = useState<'idle' | 'starting' | 'running' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [torchOn, setTorchOn] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [capabilities, setCapabilities] = useState<{
        torch?: boolean;
        zoom?: MediaSettingsRange;
    }>({});
    
    // Function to request camera permission and get capabilities
    const requestCameraPermission = useCallback(async () => {
        setScannerState('starting');
        try {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length) {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        facingMode: 'environment',
                        // These constraints can improve focus
                        advanced: [{ autoFocus: "continuous" }]
                    } 
                });
                
                videoTrackRef.current = stream.getVideoTracks()[0];
                const caps = videoTrackRef.current.getCapabilities();

                setCapabilities({
                    torch: 'torch' in caps,
                    zoom: 'zoom' in caps ? (caps.zoom as MediaSettingsRange) : undefined,
                });

                if (caps.zoom) {
                    setZoom(caps.zoom.min || 1);
                }

                setHasPermission(true);
                setScannerState('idle'); // Ready to start
                return true;
            }
        } catch (error) {
            console.error("Camera permission error:", error);
            setHasPermission(false);
            setErrorMessage("Camera access was denied. Please enable it in your browser settings.");
            setScannerState('error');
        }
        return false;
    }, []);

    // Function to start the scanner
    const startScanner = useCallback(async () => {
        if (scannerState === 'running' || scannerState === 'starting') return;
        if (hasPermission === null) {
            if (!(await requestCameraPermission())) return;
        }

        setScannerState('starting');
        const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const qrboxSize = Math.floor(minEdge * 0.7);
            // Make the box wider for bottle barcodes
            const width = Math.min(qrboxSize * 1.5, viewfinderWidth * 0.9);
            const height = Math.min(qrboxSize * 0.7, viewfinderHeight * 0.9);
            return { width, height };
        };

        // Initialize here to ensure the DOM element exists.
        if (!html5QrCodeRef.current) {
            html5QrCodeRef.current = new Html5Qrcode(scannerRegionId, { verbose: false });
        }
        
        try {
            await html5QrCodeRef.current.start(
                { facingMode: "environment" },
                { 
                    fps: 10,
                    qrbox: qrboxFunction,
                    // Use only the barcode types you need
                    formatsToSupport: [0, 1, 2, 3, 4, 5, 6, 7, 8], // UPC-A, UPC-E, EAN-8, EAN-13, etc.
                },
                onScanSuccess,
                (errorMessage) => { /* ignore, this is called on every frame without a match */ }
            );
            setScannerState('running');
        } catch (error) {
            console.error("Error starting scanner:", error);
            setErrorMessage("Failed to start the scanner. Please try again.");
            setScannerState('error');
        }
    }, [hasPermission, scannerState, requestCameraPermission, onScanSuccess]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                html5QrCodeRef.current.stop().catch(err => console.error("Cleanup stop failed", err));
            }
        };
    }, []);

    // Control pause/resume
    useEffect(() => {
        if (!html5QrCodeRef.current || scannerState !== 'running') return;
        if (isPaused) {
            html5QrCodeRef.current.pause(true);
        } else {
            html5QrCodeRef.current.resume();
        }
    }, [isPaused, scannerState]);

    // Handle Torch
    const toggleTorch = useCallback(async () => {
        if (videoTrackRef.current && capabilities.torch) {
            try {
                await videoTrackRef.current.applyConstraints({
                    advanced: [{ torch: !torchOn }],
                });
                setTorchOn(!torchOn);
            } catch (error) {
                console.error('Failed to toggle torch', error);
                toast({ title: "Error", description: "Could not toggle the flashlight.", variant: "destructive" });
            }
        }
    }, [torchOn, capabilities.torch, toast]);

    // Handle Zoom
    const handleZoomChange = useCallback(async (newZoom: number) => {
        if (videoTrackRef.current && capabilities.zoom) {
             const clampedZoom = Math.max(capabilities.zoom.min, Math.min(newZoom, capabilities.zoom.max));
            try {
                await videoTrackRef.current.applyConstraints({
                    advanced: [{ zoom: clampedZoom }],
                });
                setZoom(clampedZoom);
            } catch (error) {
                console.error("Failed to apply zoom", error);
            }
        }
    }, [capabilities.zoom]);

    if (hasPermission === false) {
        return (
            <Alert variant="destructive" className="text-center">
                <AlertTitle>Camera Access Denied</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
                <Button onClick={requestCameraPermission} variant="secondary" className="mt-4">
                    <RefreshCw className="mr-2 h-4 w-4" /> Try Again
                </Button>
            </Alert>
        );
    }
    
    if (scannerState === 'error') {
         return (
            <Alert variant="destructive" className="text-center">
                <AlertTitle>Scanner Error</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
                <Button onClick={startScanner} variant="secondary" className="mt-4">
                    <RefreshCw className="mr-2 h-4 w-4" /> Restart Scanner
                </Button>
            </Alert>
        );
    }
    
    if (scannerState !== 'running') {
        return (
            <div className="w-full aspect-video bg-black rounded-md flex flex-col items-center justify-center text-white gap-4 p-4">
                {scannerState === 'starting' ? (
                     <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                    <>
                        <p className="text-center">Press the button to start the camera and begin scanning.</p>
                        <Button onClick={startScanner} variant="secondary" size="lg">
                            <Camera className="mr-2" /> Start Scanner
                        </Button>
                    </>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div id={scannerRegionId} className="w-full aspect-video bg-black rounded-md overflow-hidden" />
            
            <div className="grid grid-cols-3 items-center gap-4 px-2">
                 <div className="flex justify-start">
                     {capabilities.torch && (
                        <Button onClick={toggleTorch} variant="outline" size="icon" className="rounded-full h-12 w-12">
                            {torchOn ? <ZapOff /> : <Zap />}
                            <span className="sr-only">Toggle Flashlight</span>
                        </Button>
                     )}
                 </div>
                 
                 <div className="flex items-center gap-2">
                     {capabilities.zoom && (
                         <>
                            <Button onClick={() => handleZoomChange(zoom - capabilities.zoom!.step)} variant="outline" size="icon" className="h-8 w-8 rounded-full" disabled={zoom <= capabilities.zoom.min}>
                                <ZoomOut className="h-4 w-4" />
                            </Button>
                            <Slider
                                min={capabilities.zoom.min}
                                max={capabilities.zoom.max}
                                step={capabilities.zoom.step}
                                value={[zoom]}
                                onValueChange={(value) => handleZoomChange(value[0])}
                                className="w-24"
                            />
                            <Button onClick={() => handleZoomChange(zoom + capabilities.zoom!.step)} variant="outline" size="icon" className="h-8 w-8 rounded-full" disabled={zoom >= capabilities.zoom.max}>
                                <ZoomIn className="h-4 w-4" />
                            </Button>
                         </>
                     )}
                 </div>

                 <div className="flex justify-end">
                     {/* Placeholder for potential future right-aligned control */}
                 </div>
            </div>
        </div>
    );
};

export default SharedScanner;
