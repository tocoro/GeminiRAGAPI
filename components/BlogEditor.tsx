/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';

interface BlogEditorProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (title: string, content: string) => void;
}

const BlogEditor: React.FC<BlogEditorProps> = ({ isOpen, onClose, onSave }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    const handleSave = () => {
        if (title.trim() && content.trim()) {
            onSave(title.trim(), content.trim());
            handleClose();
        }
    };

    const handleClose = () => {
        setTitle('');
        setContent('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]" role="dialog" aria-modal="true" aria-labelledby="blog-editor-title">
            <div className="bg-gem-slate p-6 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col h-[80vh]">
                <div className="flex justify-between items-center mb-6 border-b border-gem-mist pb-4">
                    <div>
                        <h3 id="blog-editor-title" className="text-2xl font-bold text-gem-offwhite">Write Knowledge Update</h3>
                        <p className="text-sm text-gem-offwhite/60">Create a virtual document to patch or augment existing manuals.</p>
                    </div>
                    <button onClick={handleClose} className="text-gem-offwhite/50 hover:text-gem-offwhite transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-grow flex flex-col space-y-4 overflow-hidden">
                    <div>
                        <label htmlFor="blog-title" className="block text-sm font-medium text-gem-offwhite/80 mb-1">Title</label>
                        <input
                            id="blog-title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Update: Handling Error Code E54"
                            className="w-full bg-gem-mist border border-gem-mist/50 rounded-md py-2 px-4 focus:outline-none focus:ring-2 focus:ring-gem-blue font-medium"
                            autoFocus
                        />
                    </div>
                    <div className="flex-grow flex flex-col">
                        <label htmlFor="blog-content" className="block text-sm font-medium text-gem-offwhite/80 mb-1">Content</label>
                        <textarea
                            id="blog-content"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Write the updated information, correction, or new procedure here..."
                            className="flex-grow w-full bg-gem-mist border border-gem-mist/50 rounded-md py-3 px-4 focus:outline-none focus:ring-2 focus:ring-gem-blue resize-none font-sans leading-relaxed"
                        />
                    </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gem-mist">
                    <button 
                        onClick={handleClose} 
                        className="px-5 py-2 rounded-md bg-transparent hover:bg-gem-mist text-gem-offwhite/70 hover:text-gem-offwhite transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={!title.trim() || !content.trim()} 
                        className="px-6 py-2 rounded-md bg-gem-blue hover:bg-blue-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                        Save & Index
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BlogEditor;