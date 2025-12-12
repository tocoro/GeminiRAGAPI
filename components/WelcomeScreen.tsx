/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Spinner from './Spinner';
import UploadCloudIcon from './icons/UploadCloudIcon';
import CarIcon from './icons/CarIcon';
import WashingMachineIcon from './icons/WashingMachineIcon';
import TrashIcon from './icons/TrashIcon';
import SendIcon from './icons/SendIcon';
import UploadIcon from './icons/UploadIcon';
import RefreshIcon from './icons/RefreshIcon';
import { RagStore, Document, CustomMetadata } from '../types';
import DocumentList from './DocumentList';
import ConfirmModal from './ConfirmModal';

interface WelcomeScreenProps {
    onUpload: () => Promise<void>;
    apiKeyError: string | null;
    files: File[];
    setFiles: React.Dispatch<React.SetStateAction<File[]>>;
    isApiKeySelected: boolean;
    onSelectKey: () => Promise<void>;
    existingStores: RagStore[];
    isLoadingStores: boolean;
    libraryError: string | null;
    onSelectStore: (store: RagStore) => void;
    onDeleteStore: (name: string) => void;
    onGetDocuments: (storeName: string) => Promise<Document[]>;
    onAddFileToStore: (storeName: string, file: File, metadata: CustomMetadata[]) => Promise<void>;
    onDeleteFile: (fileName: string) => Promise<void>;
    onRefreshStores: () => Promise<void>;
}

const sampleDocuments = [
    {
        name: 'Hyundai i10 Manual',
        details: '562 pages, PDF',
        url: 'https://www.hyundai.com/content/dam/hyundai/in/en/data/connect-to-service/owners-manual/2025/i20&i20nlineFromOct2023-Present.pdf',
        icon: <CarIcon />,
        fileName: 'hyundai-i10-manual.pdf'
    },
    {
        name: 'LG Washer Manual',
        details: '36 pages, PDF',
        url: 'https://www.lg.com/us/support/products/documents/WM2077CW.pdf',
        icon: <WashingMachineIcon />,
        fileName: 'lg-washer-manual.pdf'
    }
];

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ 
    onUpload, 
    apiKeyError, 
    files, 
    setFiles, 
    isApiKeySelected, 
    onSelectKey,
    existingStores,
    isLoadingStores,
    libraryError,
    onSelectStore,
    onDeleteStore,
    onGetDocuments,
    onAddFileToStore,
    onDeleteFile,
    onRefreshStores
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [loadingSample, setLoadingSample] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Document Management Modal State
    const [managingStore, setManagingStore] = useState<RagStore | null>(null);
    const [storeDocuments, setStoreDocuments] = useState<Document[]>([]);
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);
    const [processingFile, setProcessingFile] = useState<string | null>(null);

    // Confirmation Modal State
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        type: 'store' | 'file';
        targetId: string; // storeName or fileName
        displayName: string;
    }>({ isOpen: false, type: 'store', targetId: '', displayName: '' });

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFiles(prev => [...prev, ...Array.from(event.target.files!)]);
        }
    };
    
    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        if (event.dataTransfer.files) {
            setFiles(prev => [...prev, ...Array.from(event.dataTransfer.files)]);
        }
    }, [setFiles]);

    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isDragging) setIsDragging(true);
    }, [isDragging]);
    
    const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleSelectSample = async (name: string, url: string, fileName: string) => {
        if (loadingSample) return;
        setLoadingSample(name);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${name}: ${response.statusText}. This may be a CORS issue.`);
            }
            const blob = await response.blob();
            const file = new File([blob], fileName, { type: blob.type });
            setFiles(prev => [...prev, file]);
        } catch (error) {
            console.error("Error fetching sample file:", error);
            if (error instanceof Error && error.message.includes('Failed to fetch')) {
                // Use console error instead of alert if possible, or assume alert works better than confirm
                console.error("Could not fetch the sample document. Please try uploading a local file instead.");
            }
        } finally {
            setLoadingSample(null);
        }
    };

    const handleConfirmUpload = async () => {
        try {
            await onUpload();
        } catch (error) {
            // Error is handled by the parent component
            console.error("Upload process failed:", error);
        }
    };

    const handleRemoveFile = (indexToRemove: number) => {
        setFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    };

    const handleSelectKeyClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        await onSelectKey();
    };

    const toggleMenu = (e: React.MouseEvent, storeName: string) => {
        e.stopPropagation();
        setOpenMenuId(openMenuId === storeName ? null : storeName);
    };

    const handleMenuAction = async (e: React.MouseEvent, action: 'chat' | 'delete' | 'files', store: RagStore) => {
        e.stopPropagation();
        setOpenMenuId(null);

        if (action === 'chat') {
            onSelectStore(store);
        } else if (action === 'delete') {
            // Open confirmation modal instead of window.confirm
            setConfirmState({
                isOpen: true,
                type: 'store',
                targetId: store.name,
                displayName: store.displayName
            });
        } else if (action === 'files') {
            setManagingStore(store);
            setIsLoadingDocs(true);
            try {
                const docs = await onGetDocuments(store.name);
                setStoreDocuments(docs);
            } catch (err) {
                console.error("Failed to fetch documents", err);
                // Avoid alert if possible or rely on console
                setManagingStore(null);
            } finally {
                setIsLoadingDocs(false);
            }
        }
    };

    const handleModalUpload = async (file: File, metadata: CustomMetadata[]) => {
        if (!managingStore) return;
        setProcessingFile(file.name);
        try {
            await onAddFileToStore(managingStore.name, file, metadata);
            // Refresh
            const docs = await onGetDocuments(managingStore.name);
            setStoreDocuments(docs);
        } catch (err) {
            console.error("Failed to upload file to store", err);
        } finally {
            setProcessingFile(null);
        }
    }

    const handleModalDeleteClick = (fileName: string) => {
        if (!managingStore) return;
        setConfirmState({
            isOpen: true,
            type: 'file',
            targetId: fileName,
            displayName: fileName
        });
    }

    const executeDelete = async () => {
        const { type, targetId } = confirmState;
        // Close modal first
        setConfirmState(prev => ({ ...prev, isOpen: false }));

        if (type === 'store') {
            onDeleteStore(targetId);
        } else if (type === 'file') {
             if (!managingStore) return;
            // Optimistic update
            const prevDocs = [...storeDocuments];
            setStoreDocuments(prev => prev.filter(d => d.name !== targetId));

            try {
                await onDeleteFile(targetId);
            } catch (err) {
                console.error("Failed to delete file", err);
                setStoreDocuments(prevDocs); // Revert
            }
        }
    };

    const closeManageModal = () => {
        setManagingStore(null);
        setStoreDocuments([]);
    }

    return (
        <div className="flex flex-col items-center justify-start min-h-screen p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <ConfirmModal 
                isOpen={confirmState.isOpen}
                title={confirmState.type === 'store' ? "Delete Document Set?" : "Delete File?"}
                message={`Are you sure you want to delete "${confirmState.displayName}"? This action cannot be undone.`}
                confirmText="Delete"
                isDangerous={true}
                onConfirm={executeDelete}
                onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
            />

            <div className="w-full max-w-5xl text-center">
                <h1 className="text-4xl sm:text-5xl font-bold mb-2">Chat With Your Document</h1>
                <p className="text-gem-offwhite/70 mb-8">
                    Powered by <strong className="font-semibold text-gem-offwhite">FileSearch</strong>. Upload documents once, query anytime.
                </p>

                <div className="w-full max-w-xl mx-auto mb-8">
                     {!isApiKeySelected ? (
                        <button
                            onClick={handleSelectKeyClick}
                            className="w-full bg-gem-blue hover:bg-blue-500 text-white font-semibold rounded-lg py-3 px-5 text-center focus:outline-none focus:ring-2 focus:ring-gem-blue"
                        >
                            Select Gemini API Key to Begin
                        </button>
                    ) : (
                        <div className="w-full bg-gem-slate border border-gem-mist/50 rounded-lg py-3 px-5 text-center text-gem-teal font-semibold">
                            ✓ API Key Selected
                        </div>
                    )}
                     {apiKeyError && <p className="text-red-500 text-sm mt-2">{apiKeyError}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column: Upload New */}
                    <div className="flex flex-col">
                        <h3 className="text-xl font-bold mb-4 text-left">Upload New</h3>
                        <div 
                            className={`flex-grow relative border-2 border-dashed rounded-lg p-10 text-center transition-colors mb-6 ${isDragging ? 'border-gem-blue bg-gem-mist/10' : 'border-gem-mist/50'}`}
                            onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                        >
                            <div className="flex flex-col items-center justify-center">
                                <UploadCloudIcon />
                                <p className="mt-4 text-lg text-gem-offwhite/80">Drag & drop your PDF, .txt, or .md file here.</p>
                                <input id="file-upload" type="file" multiple className="hidden" onChange={handleFileChange} accept=".pdf,.txt,.md"/>
                                <label 
                                    htmlFor="file-upload" 
                                    className="mt-4 cursor-pointer px-6 py-2 bg-gem-blue text-white rounded-full font-semibold hover:bg-blue-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gem-onyx focus:ring-gem-blue" 
                                    title="Select files from your device"
                                    tabIndex={0}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            (document.getElementById('file-upload') as HTMLInputElement)?.click();
                                        }
                                    }}
                                >
                                    Or Browse Files
                                </label>
                            </div>
                        </div>

                        {files.length > 0 && (
                            <div className="w-full text-left mb-6">
                                <h4 className="font-semibold mb-2">Selected Files ({files.length}):</h4>
                                <ul className="max-h-36 overflow-y-auto space-y-1 pr-2">
                                    {files.map((file, index) => (
                                        <li key={`${file.name}-${index}`} className="text-sm bg-gem-mist/50 p-2 rounded-md flex justify-between items-center group">
                                            <span className="truncate" title={file.name}>{file.name}</span>
                                            <div className="flex items-center flex-shrink-0">
                                                <span className="text-xs text-gem-offwhite/50 ml-2">{(file.size / 1024).toFixed(2)} KB</span>
                                                <button 
                                                    onClick={() => handleRemoveFile(index)}
                                                    className="ml-2 p-1 text-red-400 hover:text-red-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                    aria-label={`Remove ${file.name}`}
                                                    title="Remove this file"
                                                >
                                                    <TrashIcon />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        
                        <div className="w-full">
                            {files.length > 0 && (
                                <button 
                                    onClick={handleConfirmUpload}
                                    disabled={!isApiKeySelected}
                                    className="w-full px-6 py-3 rounded-md bg-gem-blue hover:bg-blue-500 text-white font-bold transition-colors disabled:bg-gem-mist/50 disabled:cursor-not-allowed"
                                    title={!isApiKeySelected ? "Please select an API key first" : "Upload files to Library"}
                                >
                                    Upload and Register
                                </button>
                            )}
                        </div>

                        {files.length === 0 && (
                            <div className="mt-4">
                                <p className="text-left text-sm text-gem-offwhite/60 mb-2">Or try an example:</p>
                                <div className="grid grid-cols-1 gap-2">
                                    {sampleDocuments.map(doc => (
                                        <button
                                            key={doc.name}
                                            onClick={() => handleSelectSample(doc.name, doc.url, doc.fileName)}
                                            disabled={!!loadingSample}
                                            className="bg-gem-slate p-3 rounded-lg border border-gem-mist/30 hover:border-gem-blue/50 hover:bg-gem-mist/10 transition-all text-left flex items-center space-x-3 disabled:opacity-50"
                                        >
                                            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 bg-gem-mist/20 rounded-md">
                                                {loadingSample === doc.name ? <Spinner /> : doc.icon}
                                            </div>
                                            <span className="font-medium text-sm text-gem-offwhite">{doc.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Existing Stores */}
                    <div className="flex flex-col h-full">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-left">Your Library</h3>
                            <button
                                onClick={onRefreshStores}
                                className="p-2 text-gem-offwhite/70 hover:text-gem-blue bg-gem-mist/30 hover:bg-gem-mist rounded-full transition-colors"
                                title="Refresh library list"
                                disabled={isLoadingStores}
                            >
                                <RefreshIcon />
                            </button>
                        </div>
                        <div ref={menuRef} className="flex-grow bg-gem-slate/50 rounded-lg p-4 border border-gem-mist/50 min-h-[300px]">
                            {isLoadingStores ? (
                                <div className="flex items-center justify-center h-full">
                                    <Spinner />
                                    <span className="ml-2">Loading saved documents...</span>
                                </div>
                            ) : libraryError ? (
                                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                                    <p className="text-red-400 mb-2">{libraryError}</p>
                                    <button 
                                        onClick={onRefreshStores}
                                        className="text-sm bg-gem-mist hover:bg-gem-mist/70 px-3 py-1 rounded-full transition-colors"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            ) : existingStores.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gem-offwhite/50">
                                    <p>No saved documents found.</p>
                                    <p className="text-sm">Upload a file to get started.</p>
                                </div>
                            ) : (
                                <ul className="space-y-3">
                                    {existingStores.map(store => (
                                        <li key={store.name} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-gem-mist/30 hover:border-gem-blue/30 transition-all relative">
                                            <div className="flex-grow min-w-0 mr-2">
                                                <h4 className="font-medium text-gem-offwhite truncate" title={store.displayName}>{store.displayName}</h4>
                                                <p className="text-xs text-gem-offwhite/50 truncate">{store.name.split('/').pop()}</p>
                                            </div>
                                            
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => toggleMenu(e, store.name)}
                                                    className="flex items-center space-x-1 px-3 py-1.5 bg-gem-mist/30 hover:bg-gem-mist rounded-md transition-colors text-sm text-gem-offwhite font-medium"
                                                >
                                                    <span>Action</span>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>

                                                {openMenuId === store.name && (
                                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 border border-gem-mist/50 z-20 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                                        <button
                                                            onClick={(e) => handleMenuAction(e, 'chat', store)}
                                                            className="flex items-center w-full px-4 py-2 text-sm text-gem-offwhite hover:bg-gem-mist/30 hover:text-gem-blue"
                                                        >
                                                            <div className="w-5 mr-2">
                                                               <SendIcon /> 
                                                            </div>
                                                            Chat
                                                        </button>
                                                         <button
                                                            onClick={(e) => handleMenuAction(e, 'files', store)}
                                                            className="flex items-center w-full px-4 py-2 text-sm text-gem-offwhite hover:bg-gem-mist/30 hover:text-gem-blue"
                                                        >
                                                            <div className="w-5 mr-2">
                                                               <UploadIcon /> 
                                                            </div>
                                                            Files
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleMenuAction(e, 'delete', store)}
                                                            className="flex items-center w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50"
                                                        >
                                                            <div className="w-5 mr-2">
                                                                <TrashIcon />
                                                            </div>
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Document Management Modal */}
            {managingStore && (
                <div 
                    className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" 
                    onClick={closeManageModal} 
                    role="dialog" 
                    aria-modal="true"
                    aria-labelledby="manage-files-title"
                >
                    <div className="bg-gem-slate rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col p-6" onClick={e => e.stopPropagation()}>
                         <div className="flex justify-between items-center mb-4">
                             <h3 id="manage-files-title" className="text-2xl font-bold truncate pr-4">
                                 {managingStore.displayName}
                             </h3>
                             <button onClick={closeManageModal} className="text-gem-offwhite/50 hover:text-gem-offwhite">
                                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                 </svg>
                             </button>
                         </div>
                         <div className="flex-grow overflow-hidden">
                             <DocumentList 
                                selectedStore={managingStore} 
                                documents={storeDocuments} 
                                isLoading={isLoadingDocs} 
                                processingFile={processingFile}
                                onUpload={handleModalUpload}
                                onDelete={handleModalDeleteClick}
                             />
                         </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WelcomeScreen;