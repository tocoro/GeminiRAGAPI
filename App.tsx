/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppStatus, ChatMessage, RagStore, Document, CustomMetadata } from './types';
import * as geminiService from './services/geminiService';
import Spinner from './components/Spinner';
import WelcomeScreen from './components/WelcomeScreen';
import ProgressBar from './components/ProgressBar';
import ChatInterface from './components/ChatInterface';

// DO: Define the AIStudio interface to resolve a type conflict where `window.aistudio` was being redeclared with an anonymous type.
// FIX: Moved the AIStudio interface definition inside the `declare global` block to resolve a TypeScript type conflict.
declare global {
    interface AIStudio {
        openSelectKey: () => Promise<void>;
        hasSelectedApiKey: () => Promise<boolean>;
    }
    interface Window {
        aistudio?: AIStudio;
    }
}

const App: React.FC = () => {
    const [status, setStatus] = useState<AppStatus>(AppStatus.Initializing);
    const [isApiKeySelected, setIsApiKeySelected] = useState(false);
    const [apiKeyError, setApiKeyError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<{ current: number, total: number, message?: string, fileName?: string } | null>(null);
    const [activeRagStoreName, setActiveRagStoreName] = useState<string | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isQueryLoading, setIsQueryLoading] = useState(false);
    const [exampleQuestions, setExampleQuestions] = useState<string[]>([]);
    const [documentName, setDocumentName] = useState<string>('');
    const [files, setFiles] = useState<File[]>([]);
    
    // New state for listing existing stores
    const [existingStores, setExistingStores] = useState<RagStore[]>([]);
    const [isLoadingStores, setIsLoadingStores] = useState(false);
    const [libraryError, setLibraryError] = useState<string | null>(null);

    const checkApiKey = useCallback(async () => {
        if (window.aistudio?.hasSelectedApiKey) {
            try {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                setIsApiKeySelected(hasKey);
            } catch (e) {
                console.error("Error checking for app key:", e);
                setIsApiKeySelected(false); // Assume no key on error
            }
        }
    }, []);

    useEffect(() => {
        const handleVisibilityChange = () => {
            // This event fires when the user switches to or from the tab.
            if (document.visibilityState === 'visible') {
                checkApiKey();
            }
        };
        
        checkApiKey(); // Initial check when the component mounts.

        // Listen for visibility changes and window focus. This ensures that if the user
        // changes the API key in another tab (like the AI Studio settings),
        // the app's state will update automatically when they return to this tab.
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', checkApiKey);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', checkApiKey);
        };
    }, [checkApiKey]);

    // Initialize Service and Load Stores when API Key is ready
    useEffect(() => {
        if (isApiKeySelected) {
            geminiService.initialize();
            loadExistingStores();
        } else {
            setStatus(AppStatus.Welcome);
        }
    }, [isApiKeySelected]);

    const loadExistingStores = async () => {
        setIsLoadingStores(true);
        setLibraryError(null);
        try {
            const stores = await geminiService.listRagStores();
            setExistingStores(stores);
        } catch (err) {
            console.error("Failed to load existing stores", err);
            setLibraryError("Failed to load your library. Please check your network or API key.");
        } finally {
            setIsLoadingStores(false);
            if (status === AppStatus.Initializing) {
                setStatus(AppStatus.Welcome);
            }
        }
    };

    const handleError = (message: string, err: any) => {
        console.error(message, err);
        setError(`${message}${err ? `: ${err instanceof Error ? err.message : String(err)}` : ''}`);
        setStatus(AppStatus.Error);
    };

    const clearError = () => {
        setError(null);
        setStatus(AppStatus.Welcome);
    }

    const handleSelectKey = async () => {
        if (window.aistudio?.openSelectKey) {
            try {
                await window.aistudio.openSelectKey();
                await checkApiKey(); // Check right after the dialog promise resolves
            } catch (err) {
                console.error("Failed to open API key selection dialog", err);
            }
        } else {
            console.log('window.aistudio.openSelectKey() not available.');
            alert('API key selection is not available in this environment.');
        }
    };

    const handleUploadAndStartChat = async () => {
        if (!isApiKeySelected) {
            setApiKeyError("Please select your Gemini API Key first.");
            throw new Error("API Key is required.");
        }
        if (files.length === 0) return;
        
        setApiKeyError(null);

        // Service already initialized in useEffect
        
        setStatus(AppStatus.Uploading);
        const totalSteps = files.length + 2;
        setUploadProgress({ current: 0, total: totalSteps, message: "Creating document index..." });

        try {
            // Generate a more friendly name if possible, otherwise use timestamp
            let friendlyName = `Session ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
            if (files.length === 1) {
                friendlyName = files[0].name;
            } else if (files.length > 1) {
                 friendlyName = `${files[0].name} + ${files.length - 1} others`;
            }

            const ragStoreName = await geminiService.createRagStore(friendlyName);
            
            setUploadProgress({ current: 1, total: totalSteps, message: "Generating embeddings..." });

            for (let i = 0; i < files.length; i++) {
                setUploadProgress(prev => ({ 
                    ...(prev!),
                    current: i + 1,
                    message: "Generating embeddings...",
                    fileName: `(${i + 1}/${files.length}) ${files[i].name}`
                }));
                await geminiService.uploadToRagStore(ragStoreName, files[i]);
            }
            
            setUploadProgress({ current: files.length + 1, total: totalSteps, message: "Registered! updating library...", fileName: "" });
            
            await new Promise(resolve => setTimeout(resolve, 800)); // Short delay

            // Optimistic update: Add the new store to the list immediately
            // This prevents the "empty list" issue if the API is slow to index the new store
            const newStore: RagStore = { name: ragStoreName, displayName: friendlyName };
            setExistingStores(prev => [newStore, ...prev]);

            setFiles([]); // Clear input files
            setStatus(AppStatus.Welcome);
            
            // We do NOT call loadExistingStores() immediately here to avoid race conditions
            // where the API might return an empty list because the new store isn't indexed yet.
            // The optimistic update handles the UI, and the user can hit refresh later if needed.

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
            if (errorMessage.includes('api key not valid') || errorMessage.includes('requested entity was not found')) {
                setApiKeyError("The selected API key is invalid. Please select a different one and try again.");
                setIsApiKeySelected(false);
                setStatus(AppStatus.Welcome);
            } else {
                handleError("Failed to upload files", err);
            }
            throw err;
        } finally {
            setUploadProgress(null);
        }
    };

    const handleSelectExistingStore = async (store: RagStore) => {
        setApiKeyError(null);
        setStatus(AppStatus.Uploading); // Use uploading screen for loading state
        setUploadProgress({ current: 1, total: 1, message: "Loading existing session..." });

        try {
            setActiveRagStoreName(store.name);
            setDocumentName(store.displayName);
            
            // Generate/Load questions for this store
            const questions = await geminiService.generateExampleQuestions(store.name);
            setExampleQuestions(questions);

            setChatHistory([]);
            setStatus(AppStatus.Chatting);
        } catch (err) {
            handleError("Failed to load existing session", err);
        } finally {
            setUploadProgress(null);
        }
    };

    const handleDeleteStore = async (storeName: string) => {
        try {
            await geminiService.deleteRagStore(storeName);
            // Optimistic update
            setExistingStores(prev => prev.filter(s => s.name !== storeName));
            // Ensure sync
            loadExistingStores();
        } catch (err) {
            console.error("Failed to delete store:", err);
            alert("Failed to delete the document set.");
        }
    }
    
    // New handlers for managing files inside a store
    const handleGetDocuments = async (storeName: string): Promise<Document[]> => {
        return await geminiService.listDocuments(storeName);
    };

    const handleAddFileToStore = async (storeName: string, file: File, metadata: CustomMetadata[]) => {
         // Note: Metadata is not currently used by the service upload, but kept for interface compatibility
         await geminiService.uploadToRagStore(storeName, file);
    };

    const handleDeleteFile = async (fileName: string) => {
        await geminiService.deleteFile(fileName);
    };

    const handleEndChat = () => {
        // DO NOT delete the store here. Just return to welcome screen.
        setActiveRagStoreName(null);
        setChatHistory([]);
        setExampleQuestions([]);
        setDocumentName('');
        setFiles([]);
        setStatus(AppStatus.Welcome);
        loadExistingStores(); // Refresh list
    };

    const handleSendMessage = async (message: string) => {
        if (!activeRagStoreName) return;

        const userMessage: ChatMessage = { role: 'user', parts: [{ text: message }] };
        setChatHistory(prev => [...prev, userMessage]);
        setIsQueryLoading(true);

        try {
            const result = await geminiService.fileSearch(activeRagStoreName, message);
            const modelMessage: ChatMessage = {
                role: 'model',
                parts: [{ text: result.text }],
                groundingChunks: result.groundingChunks
            };
            setChatHistory(prev => [...prev, modelMessage]);
        } catch (err) {
            const errorMessage: ChatMessage = {
                role: 'model',
                parts: [{ text: "Sorry, I encountered an error. Please try again." }]
            };
            setChatHistory(prev => [...prev, errorMessage]);
            handleError("Failed to get response", err);
        } finally {
            setIsQueryLoading(false);
        }
    };
    
    const renderContent = () => {
        switch(status) {
            case AppStatus.Initializing:
                return (
                    <div className="flex items-center justify-center h-screen">
                        <Spinner /> <span className="ml-4 text-xl">Initializing...</span>
                    </div>
                );
            case AppStatus.Welcome:
                 return <WelcomeScreen 
                    onUpload={handleUploadAndStartChat} 
                    apiKeyError={apiKeyError} 
                    files={files} 
                    setFiles={setFiles} 
                    isApiKeySelected={isApiKeySelected} 
                    onSelectKey={handleSelectKey}
                    existingStores={existingStores}
                    isLoadingStores={isLoadingStores}
                    libraryError={libraryError}
                    onSelectStore={handleSelectExistingStore}
                    onDeleteStore={handleDeleteStore}
                    onGetDocuments={handleGetDocuments}
                    onAddFileToStore={handleAddFileToStore}
                    onDeleteFile={handleDeleteFile}
                    onRefreshStores={loadExistingStores}
                 />;
            case AppStatus.Uploading:
                let icon = null;
                if (uploadProgress?.message?.includes("Creating")) {
                    icon = <img src="https://services.google.com/fh/files/misc/applet-upload.png" alt="Uploading files icon" className="h-80 w-80 rounded-lg object-cover" />;
                } else if (uploadProgress?.message?.includes("Generating embeddings")) {
                    icon = <img src="https://services.google.com/fh/files/misc/applet-creating-embeddings_2.png" alt="Creating embeddings icon" className="h-240 w-240 rounded-lg object-cover" />;
                } else if (uploadProgress?.message?.includes("Registered")) {
                     icon = <img src="https://services.google.com/fh/files/misc/applet-completion_2.png" alt="Completion icon" className="h-240 w-240 rounded-lg object-cover" />;
                } else {
                     icon = <img src="https://services.google.com/fh/files/misc/applet-suggestions_2.png" alt="Loading icon" className="h-240 w-240 rounded-lg object-cover" />;
                }

                return <ProgressBar 
                    progress={uploadProgress?.current || 0} 
                    total={uploadProgress?.total || 1} 
                    message={uploadProgress?.message || "Preparing..."} 
                    fileName={uploadProgress?.fileName}
                    icon={icon}
                />;
            case AppStatus.Chatting:
                return <ChatInterface 
                    documentName={documentName}
                    history={chatHistory}
                    isQueryLoading={isQueryLoading}
                    onSendMessage={handleSendMessage}
                    onNewChat={handleEndChat}
                    exampleQuestions={exampleQuestions}
                />;
            case AppStatus.Error:
                 return (
                    <div className="flex flex-col items-center justify-center h-screen bg-red-900/20 text-red-300">
                        <h1 className="text-3xl font-bold mb-4">Application Error</h1>
                        <p className="max-w-md text-center mb-4">{error}</p>
                        <button onClick={clearError} className="px-4 py-2 rounded-md bg-gem-mist hover:bg-gem-mist/70 transition-colors" title="Return to the welcome screen">
                           Try Again
                        </button>
                    </div>
                );
            default:
                 return <WelcomeScreen 
                    onUpload={handleUploadAndStartChat} 
                    apiKeyError={apiKeyError} 
                    files={files} 
                    setFiles={setFiles} 
                    isApiKeySelected={isApiKeySelected} 
                    onSelectKey={handleSelectKey}
                    existingStores={existingStores}
                    isLoadingStores={isLoadingStores}
                    libraryError={libraryError}
                    onSelectStore={handleSelectExistingStore}
                    onDeleteStore={handleDeleteStore}
                    onGetDocuments={handleGetDocuments}
                    onAddFileToStore={handleAddFileToStore}
                    onDeleteFile={handleDeleteFile}
                    onRefreshStores={loadExistingStores}
                 />;
        }
    }

    return (
        <main className="h-screen bg-gem-onyx text-gem-offwhite">
            {renderContent()}
        </main>
    );
};

export default App;