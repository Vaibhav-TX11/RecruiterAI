import React from 'react';
import { X, Tag, Briefcase, MapPin } from 'lucide-react';

export default function FilterPanel({ batch, onFilterChange }) {
  if (!batch) return null;

  const hasFilters = 
    (batch.filter_skills && batch.filter_skills.length > 0) ||
    batch.filter_min_experience > 0 ||
    batch.filter_max_experience ||
    (batch.filter_locations && batch.filter_locations.length > 0);

  if (!hasFilters) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="text-center py-6">
          <p className="text-gray-500">No filters applied to this batch</p>
          <p className="text-sm text-gray-400 mt-1">
            All candidates from the folder are being shown
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Active Filters</h3>
        <span className="text-sm text-gray-500">
          Applied during batch creation
        </span>
      </div>

      <div className="space-y-4">
        {/* Skills Filter */}
        {batch.filter_skills && batch.filter_skills.length > 0 && (
          <div>
            <div className="flex items-center mb-2">
              <Tag className="h-4 w-4 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-gray-700">
                Required Skills ({batch.filter_skills.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-2 ml-6">
              {batch.filter_skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Experience Filter */}
        {(batch.filter_min_experience > 0 || batch.filter_max_experience) && (
          <div>
            <div className="flex items-center mb-2">
              <Briefcase className="h-4 w-4 text-green-600 mr-2" />
              <span className="text-sm font-medium text-gray-700">
                Experience Range
              </span>
            </div>
            <div className="ml-6">
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                {batch.filter_min_experience || 0} - {batch.filter_max_experience || 'Any'} years
              </span>
            </div>
          </div>
        )}

        {/* Location Filter */}
        {batch.filter_locations && batch.filter_locations.length > 0 && (
          <div>
            <div className="flex items-center mb-2">
              <MapPin className="h-4 w-4 text-purple-600 mr-2" />
              <span className="text-sm font-medium text-gray-700">
                Preferred Locations ({batch.filter_locations.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-2 ml-6">
              {batch.filter_locations.map((location, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                >
                  {location}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t">
        <p className="text-xs text-gray-600">
          ℹ️ Filters were applied when creating this batch. Only candidates matching these criteria are shown.
          Create a new batch to change filters.
        </p>
      </div>
    </div>
  );
}