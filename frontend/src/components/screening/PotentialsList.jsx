import React, { useState } from 'react';
import { TrendingUp, Mail, Phone, MapPin, FileText, ChevronDown, Check, Clock, AlertCircle, XCircle } from 'lucide-react';
import QuickActionDropdown from './QuickActionDropdown';

export default function PotentialsList({ potentials, onStatusUpdate, batchId }) {
  const [expandedRow, setExpandedRow] = useState(null);

  const getScoreColor = (score) => {
    if (score >= 85) return 'bg-green-100 text-green-800 border-green-300';
    if (score >= 70) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (score >= 50) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { icon: Clock, color: 'bg-gray-100 text-gray-800', label: 'Pending' },
      to_be_called: { icon: Phone, color: 'bg-yellow-100 text-yellow-800', label: 'To Be Called' },
      interested: { icon: Check, color: 'bg-green-100 text-green-800', label: 'Interested' },
      waiting_resume: { icon: AlertCircle, color: 'bg-purple-100 text-purple-800', label: 'Waiting Resume' },
      not_interested: { icon: XCircle, color: 'bg-red-100 text-red-800', label: 'Not Interested' }
    };
    return badges[status] || badges.pending;
  };

  if (!potentials || potentials.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-medium text-gray-700 mb-2">No Candidates Found</h3>
        <p className="text-gray-500">
          No candidates match your current filters, or batch is still processing
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b">
        <h2 className="text-lg font-semibold">
          Top Candidates ({potentials.length})
        </h2>
        <p className="text-sm text-gray-600">
          Sorted by match score. Take quick action on each candidate.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Skills</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Experience</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {potentials.map((potential, idx) => {
              const statusInfo = getStatusBadge(potential.status);
              const StatusIcon = statusInfo.icon;
              const isExpanded = expandedRow === potential.id;

              return (
                <React.Fragment key={potential.id}>
                  <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-blue-50' : ''}`}>
                    {/* Expand Button */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedRow(isExpanded ? null : potential.id)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`} />
                      </button>
                    </td>

                    {/* Match Score */}
                    <td className="px-4 py-3">
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getScoreColor(potential.match_score)}`}>
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {potential.match_score.toFixed(0)}%
                      </div>
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{potential.name}</div>
                      <div className="text-xs text-gray-500">{potential.resume_filename}</div>
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3 text-sm">
                      {potential.email && (
                        <div className="flex items-center text-gray-600 mb-1">
                          <Mail className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span className="truncate max-w-[200px]">{potential.email}</span>
                        </div>
                      )}
                      {potential.phone && (
                        <div className="flex items-center text-gray-600">
                          <Phone className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span>{potential.phone}</span>
                        </div>
                      )}
                      {!potential.email && !potential.phone && (
                        <span className="text-gray-400 text-xs">No contact</span>
                      )}
                    </td>

                    {/* Skills */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(potential.skills || []).slice(0, 3).map((skill, skillIdx) => (
                          <span
                            key={skillIdx}
                            className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded"
                          >
                            {skill}
                          </span>
                        ))}
                        {(potential.skills || []).length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{potential.skills.length - 3}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Experience */}
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {potential.experience_years ? (
                        `${potential.experience_years} yrs`
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3 text-sm">
                      {potential.location ? (
                        <div className="flex items-center text-gray-600">
                          <MapPin className="h-3 w-3 mr-1" />
                          {potential.location}
                        </div>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusInfo.label}
                      </span>
                    </td>

                    {/* Quick Action */}
                    <td className="px-4 py-3">
                      <QuickActionDropdown
                        potential={potential}
                        onStatusUpdate={onStatusUpdate}
                        batchId={batchId}
                      />
                    </td>
                  </tr>

                  {/* Expanded Row */}
                  {isExpanded && (
                    <tr>
                      <td colSpan="9" className="px-4 py-4 bg-gray-50">
                        <div className="space-y-3">
                          {/* All Skills */}
                          {potential.skills && potential.skills.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-700 mb-2">All Skills:</p>
                              <div className="flex flex-wrap gap-1">
                                {potential.skills.map((skill, skillIdx) => (
                                  <span
                                    key={skillIdx}
                                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Education */}
                          {potential.education && potential.education.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-700 mb-2">Education:</p>
                              <div className="space-y-1">
                                {potential.education.map((edu, eduIdx) => (
                                  <div key={eduIdx} className="text-sm text-gray-600">
                                    • {edu.degree || 'Degree'} {edu.institution && `- ${edu.institution}`}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Resume Preview */}
                          {potential.resume_text && (
                            <div>
                              <p className="text-xs font-medium text-gray-700 mb-2">Resume Preview:</p>
                              <div className="text-sm text-gray-600 bg-white p-3 rounded border max-h-40 overflow-y-auto">
                                {potential.resume_text.slice(0, 500)}...
                              </div>
                            </div>
                          )}

                          {/* Assignment Info */}
                          {potential.assigned_to && (
                            <div className="text-xs text-gray-500">
                              Assigned to: <span className="font-medium">{potential.assigned_to}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}