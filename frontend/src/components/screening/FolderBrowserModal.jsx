// Create this file: frontend/src/components/screening/FolderBrowserModal.jsx

import React, { useState, useEffect } from 'react';
import { X, Folder, FolderOpen, ChevronRight, ChevronLeft, Home, HardDrive, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';

export default function FolderBrowserModal({ onClose, onSelectFolder, initialPath = '/' }) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [parentPath, setParentPath] = useState(null);
  const [allowedBasePaths, setAllowedBasePaths] = useState([]);
  const [validationResult, setValidationResult] = useState(null);

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath]);

  const loadDirectory = async (path) => {
    setLoading(true);
    setError('');
    setValidationResult(null);
    
    try {
      const { data } = await api.get('/api/filesystem/browse', {
        params: { path }
      });
      
      setItems(data.items || []);
      setCurrentPath(data.current_path);
      setParentPath(data.parent_path);
      setAllowedBasePaths(data.allowed_base_paths || []);
    } catch (err) {
      console.error('Failed to load directory:', err);
      setError(err.response?.data?.detail || 'Failed to load directory');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folder) => {
    if (folder.is_directory) {
      setCurrentPath(folder.path);
      setSelectedFolder(null);
    }
  };

  const handleFolderSelect = (folder) => {
    if (folder.is_directory) {
      setSelectedFolder(folder);
      validateFolder(folder.path);
    }
  };

  const validateFolder = async (path) => {
    try {
      const { data } = await api.get('/api/filesystem/validate', {
        params: { path }
      });
      setValidationResult(data);
    } catch (err) {
      console.error('Failed to validate folder:', err);
      setValidationResult({ valid: false, error: 'Failed to validate folder' });
    }
  };

  const handleGoUp = () => {
    if (parentPath) {
      setCurrentPath(parentPath);
      setSelectedFolder(null);
    }
  };

  const handleSelectQuickPath = (path) => {
    setCurrentPath(path);
    setSelectedFolder(null);
  };

  const handleConfirmSelection = () => {
    if (selectedFolder && validationResult?.valid) {
      onSelectFolder(selectedFolder.path);
      onClose();
    }
  };

  const renderBreadcrumb = () => {
    const parts = currentPath.split('/').filter(Boolean);
    
    return (
      <div className="flex items-center space-x-2 text-sm overflow-x-auto">
        <button
          onClick={() => setCurrentPath('/')}
          className="flex items-center px-2 py-1 hover:bg-gray-100 rounded"
        >
          <Home className="h-4 w-4" />
        </button>
        {parts.map((part, idx) => {
          const path = '/' + parts.slice(0, idx + 1).join('/');
          return (
            <React.Fragment key={idx}>
              <ChevronRight className="h-4 w-4 text-gray-400" />
              <button
                onClick={() => setCurrentPath(path)}
                className="px-2 py-1 hover:bg-gray-100 rounded whitespace-nowrap"
              >
                {part}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Browse Folders</h2>
            <p className="text-sm text-gray-600 mt-1">
              Select a folder containing resume files (PDF, DOCX)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Quick Access Paths */}
        {allowedBasePaths.length > 0 && (
          <div className="px-6 pt-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Quick Access:</p>
            <div className="flex flex-wrap gap-2">
              {allowedBasePaths.map((path, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectQuickPath(path)}
                  className="flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm"
                >
                  <HardDrive className="h-4 w-4 mr-1" />
                  {path}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation Bar */}
        <div className="px-6 py-3 border-b bg-gray-50">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleGoUp}
              disabled={!parentPath}
              className="p-2 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              title="Go up one level"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 bg-white border rounded-lg px-3 py-2">
              {renderBreadcrumb()}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-600">{error}</div>
          </div>
        )}

        {/* File Browser */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Folder className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>This folder is empty</p>
            </div>
          ) : (
            <div className="space-y-1">
              {items
                .filter(item => item.is_directory)
                .map((folder, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedFolder?.path === folder.path
                        ? 'bg-blue-50 border-2 border-blue-500'
                        : 'hover:bg-gray-50 border-2 border-transparent'
                    }`}
                    onClick={() => handleFolderSelect(folder)}
                    onDoubleClick={() => handleFolderClick(folder)}
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <FolderOpen className="h-5 w-5 text-yellow-500 mr-3 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{folder.name}</p>
                        {folder.resume_count > 0 && (
                          <p className="text-xs text-gray-500 flex items-center mt-1">
                            <FileText className="h-3 w-3 mr-1" />
                            {folder.resume_count} resume file{folder.resume_count !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Validation Result */}
        {validationResult && selectedFolder && (
          <div className={`mx-6 mb-4 p-4 rounded-lg border ${
            validationResult.valid 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start">
              {validationResult.valid ? (
                <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                {validationResult.valid ? (
                  <>
                    <p className="text-sm font-medium text-green-900">
                      ✅ Valid folder selected
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Found {validationResult.resume_files} resume files ({validationResult.total_files} total files)
                    </p>
                    {validationResult.file_list && validationResult.file_list.length > 0 && (
                      <div className="mt-2 text-xs text-green-700">
                        <p className="font-medium">Sample files:</p>
                        <ul className="list-disc list-inside mt-1 space-y-0.5">
                          {validationResult.file_list.slice(0, 5).map((file, idx) => (
                            <li key={idx} className="truncate">{file}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-red-600">{validationResult.error}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {selectedFolder ? (
                <span className="font-medium">Selected: {selectedFolder.path}</span>
              ) : (
                <span>Double-click a folder to open it, single-click to select</span>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSelection}
                disabled={!selectedFolder || !validationResult?.valid}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Select Folder
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
