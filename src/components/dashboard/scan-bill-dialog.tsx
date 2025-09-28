

"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { extractItemsFromBill, BillExtractionOutput, ExtractedItem } from '@/ai/flows/extract-bill-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, UploadCloud, FileCheck2, AlertCircle, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';

type ScanBillDialogProps = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onAddItems: (items: ExtractedItem[]) => void;
};

export default function ScanBillDialog({ isOpen, onOpenChange, onAddItems }: ScanBillDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [extractedData, setExtractedData] = useState<BillExtractionOutput | null>(null);

    const resetState = () => {
        setFile(null);
        setIsLoading(false);
        setError(null);
        setExtractedData(null);
    };

    useEffect(() => {
        if(!isOpen) {
            resetState();
        }
    }, [isOpen]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0]);
            setError(null);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/png': ['.png'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'application/pdf': ['.pdf'],
        },
        multiple: false,
    });

    const handleExtraction = async () => {
        if (!file) return;

        setIsLoading(true);
        setError(null);
        setExtractedData(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            const dataUri = event.target?.result as string;
            try {
                const result = await extractItemsFromBill({ billDataUri: dataUri });
                if (!result || !result.items || result.items.length === 0) {
                     setError("The AI couldn't find any items in the bill. Please try a clearer image or a different bill.");
                } else {
                    setExtractedData(result);
                }
            } catch (err) {
                console.error("Extraction error:", err);
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
                if (errorMessage.includes("quota")) {
                    setError("Could not process bill. The AI service quota may be exceeded. Please check your API key billing status or try again later.");
                } else {
                    setError("An error occurred while processing the bill. The AI might be unavailable, or the file could be corrupted.");
                }
            } finally {
                setIsLoading(false);
            }
        };
        reader.onerror = () => {
            setError("Failed to read the file.");
            setIsLoading(false);
        }
        reader.readAsDataURL(file);
    };
    
    const handleConfirm = () => {
        if (extractedData?.items) {
            onAddItems(extractedData.items);
            onOpenChange(false);
        }
    };
    
    const handleItemChange = (index: number, field: keyof ExtractedItem, value: string | number) => {
        if (!extractedData) return;
        const newItems = [...extractedData.items];
        (newItems[index] as any)[field] = value;
        setExtractedData({ items: newItems });
    };

    const handleRemoveItem = (index: number) => {
        if (!extractedData) return;
        const newItems = extractedData.items.filter((_, i) => i !== index);
        setExtractedData({ items: newItems });
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-48 gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-muted-foreground">Analyzing your bill, please wait...</p>
                </div>
            );
        }
        
        if (error) {
            return (
                 <div className="space-y-4">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Extraction Failed</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                    <Button onClick={() => { setError(null); setFile(null); }} className="w-full">Try Again</Button>
                </div>
            );
        }

        if (extractedData) {
            return (
                <div className="space-y-4">
                    <h3 className="font-semibold">Review Extracted Items</h3>
                    <ScrollArea className="h-72 border rounded-md">
                        <Table>
                            <TableHeader className="sticky top-0 bg-muted">
                                <TableRow>
                                    <TableHead>Brand</TableHead>
                                    <TableHead>Size</TableHead>
                                    <TableHead>Qty</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="w-10"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {extractedData.items.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell>
                                            <Input defaultValue={item.brand} onBlur={(e) => handleItemChange(index, 'brand', e.target.value)} className="h-8" />
                                        </TableCell>
                                        <TableCell>
                                            <Input defaultValue={item.size} onBlur={(e) => handleItemChange(index, 'size', e.target.value)} className="h-8" />
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" defaultValue={item.quantity} onBlur={(e) => handleItemChange(index, 'quantity', Number(e.target.value))} className="h-8 w-16" />
                                        </TableCell>
                                        <TableCell>
                                            <Input defaultValue={item.category} onBlur={(e) => handleItemChange(index, 'category', e.target.value)} className="h-8" />
                                        </TableCell>
                                        <TableCell>
                                             <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                             </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            )
        }

        if (file) {
            return (
                <div className="space-y-4">
                    <div className="p-4 border rounded-lg flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 overflow-hidden">
                           <FileCheck2 className="h-6 w-6 text-green-500 shrink-0" />
                           <p className="truncate text-sm font-medium">{file.name}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                    <Button onClick={handleExtraction} className="w-full" disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Start Extraction
                    </Button>
                </div>
            );
        }

        return (
            <div
                {...getRootProps()}
                className={`p-12 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/50 hover:border-primary'
                }`}
            >
                <input {...getInputProps()} />
                <UploadCloud className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="mt-4 font-semibold">
                    {isDragActive ? 'Drop the bill here...' : 'Drag & drop a file or click to select'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Supports PNG, JPG, or PDF files.</p>
            </div>
        );
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Scan New Bill</DialogTitle>
                    <DialogDescription>
                        Upload an image or PDF of your bill to automatically add stock to your godown.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="py-4">
                    {renderContent()}
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary" onClick={resetState}>Cancel</Button>
                    </DialogClose>
                     {extractedData && (
                        <Button onClick={handleConfirm} className="bg-green-600 hover:bg-green-700">
                            Confirm & Add to Godown
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


    
