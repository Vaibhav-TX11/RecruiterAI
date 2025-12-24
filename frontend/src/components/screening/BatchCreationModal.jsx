// Replace your existing BatchCreationModal.jsx with this updated version

import React, { useState } from 'react';
import { X, Upload, Folder, AlertCircle, FolderSearch } from 'lucide-react';
import { api } from '../../services/api';
import FolderBrowserModal from './FolderBrowserModal';

export default function BatchCreationModal({ onClose, onBatchCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    folder_path: '',
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
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Please enter a batch name');
      return;
    }

    if (!formData.folder_path.trim()) {
      setError('Please enter or select a folder path');
      return;
    }

    setCreating(true);

    try {
      const { data } = await api.post('/api/screening/start', formData);
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

  const handleFolderSelected = (path) => {
    setFormData({ ...formData, folder_path: path });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
            <div>
              <h2 className="text-2xl font-bold">Create Screening Batch</h2>
              <p className="text-sm text-gray-600 mt-1">
                Process a folder of resumes with filters
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

            {/* Folder Path with Browser */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Folder Path *
              </label>
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Folder className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={formData.folder_path}
                    onChange={(e) => setFormData({ ...formData, folder_path: e.target.value })}
                    placeholder="/path/to/resumes/folder"
                    className="w-full pl-10 pr-4 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowFolderBrowser(true)}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center whitespace-nowrap"
                >
                  <FolderSearch className="h-5 w-5 mr-2" />
                  Browse
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Click "Browse" to navigate folders or enter path manually
              </p>
            </div>

            {/* Filters Section */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Screening Filters (Optional)</h3>
              <p className="text-sm text-gray-600 mb-4">
                Set criteria to automatically filter candidates. Only matching candidates will appear in the top 100.
              </p>

              {/* Required Skills */}
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
                    <li>• System will process all resumes in the folder</li>
                    <li>• Extract candidate information automatically</li>
                    <li>• Apply your filters and calculate match scores</li>
                    <li>• Show you the top 100 best matches</li>
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
                    Processing...
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

      {/* Folder Browser Modal */}
      {showFolderBrowser && (
        <FolderBrowserModal
          onClose={() => setShowFolderBrowser(false)}
          onSelectFolder={handleFolderSelected}
          initialPath={formData.folder_path || '/'}
        />
      )}
    </>
  );
}
