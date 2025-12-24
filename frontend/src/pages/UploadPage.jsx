import React, { useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { uploadResume } from '../services/api';

export default function UploadPage() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    setUploading(true);
    setResults([]);
    
    for (const file of files) {
      try {
        const result = await uploadResume(file, 'HR Manager');
        setResults(prev => [...prev, { file: file.name, ...result }]);
      } catch (error) {
        setResults(prev => [...prev, { file: file.name, status: 'error', message: error.message }]);
      }
    }
    
    setUploading(false);
    setFiles([]);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Upload Resumes</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600 mb-4">Drag and drop files or click to select</p>
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.txt"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700">
            Select Files
          </label>
        </div>

        {files.length > 0 && (
          <div className="mt-6">
            <h3 className="font-medium mb-3">Selected Files ({files.length})</h3>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-gray-500" />
                    <span className="text-sm">{file.name}</span>
                  </div>
                  <button onClick={() => removeFile(index)} className="text-red-500 hover:text-red-700">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
            
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="mt-4 w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? 'Processing...' : 'Upload & Process'}
            </button>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-medium mb-4">Processing Results</h3>
          <div className="space-y-3">
            {results.map((result, index) => (
              <div key={index} className={`p-4 rounded ${result.status === 'success' ? 'bg-green-50' : result.status === 'duplicate' ? 'bg-yellow-50' : 'bg-red-50'}`}>
                <p className="font-medium">{result.file}</p>
                <p className="text-sm text-gray-600">{result.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
