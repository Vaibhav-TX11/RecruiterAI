import React, { useState } from 'react';
import { X, Upload, AlertCircle, FileText, FolderOpen } from 'lucide-react';
import { api } from '../../services/api';

export default function BatchCreationModal({ onClose, onBatchCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    files: [],
    filters: {
      skills: [],
      min_experience: 0,
      max_experience: null,
      locations: []
    }
  });
  const [skillInput, setSkillInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    
    // Validate file types
    const allowedTypes = ['.pdf', '.docx', '.doc', '.txt'];
    const invalidFiles = selectedFiles.filter(file => {
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      return !allowedTypes.includes(ext);
    });
    
    if (invalidFiles.length > 0) {
      setError(`Invalid file types: ${invalidFiles.map(f => f.name).join(', ')}`);
      return;
    }
    
    setFormData({ ...formData, files: [...formData.files, ...selectedFiles] });
    setError('');
  };

  const removeFile = (index) => {
    setFormData({
      ...formData,
      files: formData.files.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Please enter a batch name');
      return;
    }

    if (formData.files.length === 0) {
      setError('Please upload at least one resume');
      return;
    }

    setCreating(true);
    setUploadProgress(0);

    try {
      // Create FormData
      const uploadData = new FormData();
      uploadData.append('name', formData.name);
      uploadData.append('skills', JSON.stringify(formData.filters.skills));
      uploadData.append('min_experience', formData.filters.min_experience.toString());
      if (formData.filters.max_experience) {
        uploadData.append('max_experience', formData.filters.max_experience.toString());
      }
      uploadData.append('locations', JSON.stringify(formData.filters.locations));
      
      // Append all files
      formData.files.forEach(file => {
        uploadData.append('files', file);
      });

      // Upload with progress
      const { data } = await api.post('/api/screening/upload-batch', uploadData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });
      
      onBatchCreated(data);
    } catch (error) {
      console.error('Failed to create batch:', error);
      setError(error.response?.data?.detail || 'Failed to create batch');
      setCreating(false);
    }
  };

  const addSkill = () => {
    if (skillInput.trim() && !formData.filters.skills.includes(skillInput.trim())) {
      setFormData({
        ...formData,
        filters: {
          ...formData.filters,
          skills: [...formData.filters.skills, skillInput.trim()]
        }
      });
      setSkillInput('');
    }
  };

  const removeSkill = (skill) => {
    setFormData({
      ...formData,
      filters: {
        ...formData.filters,
        skills: formData.filters.skills.filter(s => s !== skill)
      }
    });
  };

  const addLocation = () => {
    if (locationInput.trim() && !formData.filters.locations.includes(locationInput.trim())) {
      setFormData({
        ...formData,
        filters: {
          ...formData.filters,
          locations: [...formData.filters.locations, locationInput.trim()]
        }
      });
      setLocationInput('');
    }
  };

  const removeLocation = (location) => {
    setFormData({
      ...formData,
      filters: {
        ...formData.filters,
        locations: formData.filters.locations.filter(l => l !== location)
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-2xl font-bold">Create Screening Batch</h2>
            <p className="text-sm text-gray-600 mt-1">
              Upload resumes and apply filters
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Batch Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Batch Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Q4 2024 Software Engineer Applications"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Resumes * (PDF, DOCX, TXT)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
              <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-3">
                Drag and drop files or click to select
              </p>
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                disabled={creating}
              />
              <label
                htmlFor="file-upload"
                className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700"
              >
                Select Files
              </label>
            </div>

            {/* File List */}
            {formData.files.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Selected Files ({formData.files.length})
                </p>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {formData.files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <span className="text-sm truncate">{file.name}</span>
                        <span className="text-xs text-gray-500">
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      {!creating && (
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {creating && uploadProgress > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  Uploading files...
                </span>
                <span className="text-sm text-gray-600">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Filters Section */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Screening Filters (Optional)</h3>
            
            {/* Skills */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Required Skills
              </label>
              <div className="flex space-x-2 mb-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder="Type a skill and press Enter"
                  className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={addSkill}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              {formData.filters.skills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.filters.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Experience Range */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Experience (years)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.filters.min_experience}
                  onChange={(e) => setFormData({
                    ...formData,
                    filters: {
                      ...formData.filters,
                      min_experience: parseInt(e.target.value) || 0
                    }
                  })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Experience (years)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.filters.max_experience || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    filters: {
                      ...formData.filters,
                      max_experience: e.target.value ? parseInt(e.target.value) : null
                    }
                  })}
                  placeholder="No limit"
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Locations */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Locations
              </label>
              <div className="flex space-x-2 mb-2">
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addLocation();
                    }
                  }}
                  placeholder="e.g., Mumbai, Remote"
                  className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={addLocation}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              {formData.filters.locations.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.filters.locations.map((location, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center"
                    >
                      {location}
                      <button
                        type="button"
                        onClick={() => removeLocation(location)}
                        className="ml-2 text-green-600 hover:text-green-800"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Upload className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 mb-1">What happens next?</p>
                <ul className="text-blue-700 space-y-1">
                  <li>• Files will be uploaded to secure cloud storage</li>
                  <li>• System will extract candidate information automatically</li>
                  <li>• Filters will be applied and match scores calculated</li>
                  <li>• Top 100 matches will be shown for review</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
            >
              {creating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {uploadProgress > 0 ? `Uploading... ${uploadProgress}%` : 'Processing...'}
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 mr-2" />
                  Create Batch
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
