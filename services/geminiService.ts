/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { RagStore, Document, QueryResult, CustomMetadata } from '../types';

let ai: GoogleGenAI;

export function initialize() {
    // Always create a new instance to ensure we use the latest key
    if (process.env.API_KEY) {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
}

async function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureInitialized() {
    if (!ai) {
        initialize();
        if (!ai) {
            throw new Error("Gemini AI client not initialized. Please wait for the API key to load.");
        }
    }
}

// Helper to find any array in the response object
function findArrayInResponse(response: any): any[] {
    if (!response) return [];
    if (Array.isArray(response)) return response;

    // 1. Try known keys
    if (Array.isArray(response.fileSearchStores)) return response.fileSearchStores;
    if (Array.isArray(response.file_search_stores)) return response.file_search_stores;
    if (Array.isArray(response.files)) return response.files;

    // 2. Iterate over all keys to find an array
    if (typeof response === 'object') {
        for (const key of Object.keys(response)) {
            if (Array.isArray(response[key])) {
                console.log(`Auto-detected array data in property: '${key}'`);
                return response[key];
            }
        }
    }

    return [];
}

export async function createRagStore(displayName: string): Promise<string> {
    ensureInitialized();
    const ragStore = await ai.fileSearchStores.create({ config: { displayName } });
    if (!ragStore.name) {
        throw new Error("Failed to create RAG store: name is missing.");
    }
    return ragStore.name;
}

export async function listRagStores(): Promise<RagStore[]> {
    ensureInitialized();
    console.log("Requesting list of RAG stores...");
    const response: any = await ai.fileSearchStores.list({
        pageSize: 100
    });
    
    // Debug logging
    console.log("Raw response from listRagStores:", response);
    
    const stores = findArrayInResponse(response);
    console.log("Found RAG Stores (extracted):", stores);

    return stores.map((store: any) => ({
        name: store.name,
        // Handle both camelCase and snake_case for display name
        displayName: store.displayName || store.display_name || 'Untitled Store'
    }));
}

export async function listDocuments(ragStoreName: string): Promise<Document[]> {
    ensureInitialized();
    console.log(`Requesting documents for store: ${ragStoreName}`);
    const response: any = await ai.fileSearchStores.listFiles({
        fileSearchStoreName: ragStoreName,
        pageSize: 100
    });
    
    console.log("Raw response from listDocuments:", response);

    const files = findArrayInResponse(response);
    console.log("Found files (extracted):", files);

    return files.map((f: any) => ({
        name: f.name,
        displayName: f.displayName || f.display_name || 'Untitled Document',
        customMetadata: []
    }));
}

export async function uploadToRagStore(ragStoreName: string, file: File): Promise<void> {
    ensureInitialized();
    
    let op = await ai.fileSearchStores.uploadToFileSearchStore({
        fileSearchStoreName: ragStoreName,
        file: file
    });

    while (!op.done) {
        await delay(3000);
        op = await ai.operations.get({operation: op});
    }
}

export async function deleteFile(fileName: string): Promise<void> {
    ensureInitialized();
    await ai.files.delete({ name: fileName });
}

export async function fileSearch(ragStoreName: string, query: string): Promise<QueryResult> {
    ensureInitialized();
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: query + "DO NOT ASK THE USER TO READ THE MANUAL, pinpoint the relevant sections in the response itself.",
        config: {
            tools: [
                    {
                        fileSearch: {
                            fileSearchStoreNames: [ragStoreName],
                        }
                    }
                ]
        }
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return {
        text: response.text || "No answer generated.",
        groundingChunks: groundingChunks,
    };
}

export async function generateExampleQuestions(ragStoreName: string): Promise<string[]> {
    ensureInitialized();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: "Analyze the provided documents to identify the main product or topic. Then generate 4 short, practical questions a user might ask about it. If you cannot identify a specific product, generate generic questions about the document content.",
            config: {
                tools: [
                    {
                        fileSearch: {
                            fileSearchStoreNames: [ragStoreName],
                        }
                    }
                ],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            product: { type: Type.STRING, nullable: true },
                            questions: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                            }
                        }
                    }
                }
            }
        });
        
        const jsonText = response.text || "[]";
        let parsedData;
        try {
            parsedData = JSON.parse(jsonText);
        } catch (e) {
            console.warn("Failed to parse JSON response:", jsonText);
            return [];
        }
        
        if (Array.isArray(parsedData)) {
            return parsedData.flatMap(item => (item.questions || [])).filter(q => typeof q === 'string');
        }
        
        return [];
    } catch (error) {
        // Fallback to empty questions if generation fails
        console.warn("Could not generate example questions:", error);
        return [];
    }
}


export async function deleteRagStore(ragStoreName: string): Promise<void> {
    ensureInitialized();
    // DO: Remove `(as any)` type assertion.
    await ai.fileSearchStores.delete({
        name: ragStoreName,
        config: { force: true },
    });
}