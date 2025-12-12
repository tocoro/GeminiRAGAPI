/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDangerous?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
    isOpen, 
    title, 
    message, 
    confirmText = "Confirm", 
    cancelText = "Cancel", 
    onConfirm, 
    onCancel, 
    isDangerous = false 
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70]" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
            <div className="bg-gem-slate p-6 rounded-lg shadow-xl w-full max-w-sm border border-gem-mist/50">
                <h3 id="confirm-modal-title" className="text-xl font-bold mb-3 text-gem-offwhite">{title}</h3>
                <p className="text-gem-offwhite/80 mb-6">{message}</p>
                <div className="flex justify-end space-x-3">
                    <button 
                        onClick={onCancel}
                        className="px-4 py-2 rounded-md bg-gem-mist hover:bg-gem-mist/70 transition-colors font-medium text-gem-offwhite"
                    >
                        {cancelText}
                    </button>
                    <button 
                        onClick={onConfirm}
                        className={`px-4 py-2 rounded-md text-white transition-colors font-medium ${isDangerous ? 'bg-red-500 hover:bg-red-600' : 'bg-gem-blue hover:bg-blue-500'}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;