'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface Option {
    value: string;
    label: string;
    [key: string]: any;
}

interface CustomSelectProps {
    options: any[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    renderOption?: (option: any) => React.ReactNode;
    renderValue?: (option: any) => React.ReactNode;
    className?: string;
    valueKey?: string;
    searchable?: boolean; // New prop
}

export function CustomSelect({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    renderOption,
    renderValue,
    className = '',
    valueKey = 'value',
    searchable = false
}: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedOption = options.find(opt => opt[valueKey] === value);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Reset search query when dropdown closes
    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
        }
    }, [isOpen]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && searchable && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen, searchable]);


    const filteredOptions = searchable
        ? options.filter(option => {
            const label = option.label || option[valueKey] || '';
            const val = option[valueKey] || '';
            const searchText = searchQuery.toLowerCase();

            // Check if any property of the option (like country name or code) matches
            // We can check the valueKey and 'name' if it exists, or just check the rendered string if possible
            // But strict matching on properties is safer.

            // For countries, we usually have 'name', 'code', 'iso'.
            // Let's search in all logical fields if they exist
            const nameMatch = option.name && typeof option.name === 'string' && option.name.toLowerCase().includes(searchText);
            const codeMatch = option.code && typeof option.code === 'string' && option.code.toLowerCase().includes(searchText);
            const isoMatch = option.iso && typeof option.iso === 'string' && option.iso.toLowerCase().includes(searchText);
            const valueMatch = val.toString().toLowerCase().includes(searchText);

            return nameMatch || codeMatch || isoMatch || valueMatch;
        })
        : options;

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-white border border-gray-200 rounded-lg p-2.5 flex items-center justify-between focus:outline-none focus:border-primary text-sm text-left text-foreground shadow-sm"
            >
                <div className="truncate flex items-center gap-2">
                    {selectedOption ? (
                        renderValue ? renderValue(selectedOption) : (selectedOption.label || selectedOption[valueKey])
                    ) : (
                        <span className="text-muted">{placeholder}</span>
                    )}
                </div>
                <ChevronDown size={16} className={`text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-hidden flex flex-col">
                    {searchable && (
                        <div className="p-2 border-b border-gray-100 sticky top-0 bg-white z-10">
                            <div className="relative">
                                <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    className="w-full pl-8 pr-2 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:border-primary text-foreground"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onClick={(e) => e.stopPropagation()} // Prevent closing when clicking input
                                />
                            </div>
                        </div>
                    )}
                    <div className="overflow-y-auto custom-scrollbar flex-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option, index) => (
                                <div
                                    key={index}
                                    className="p-2.5 hover:bg-primary/10 hover:text-primary cursor-pointer flex items-center gap-2 text-sm text-foreground transition-all duration-200 rounded-md mx-1"
                                    onClick={() => {
                                        onChange(option[valueKey]);
                                        setIsOpen(false);
                                    }}
                                >
                                    {renderOption ? renderOption(option) : (option.label || option[valueKey])}
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center text-xs text-muted">No results found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
