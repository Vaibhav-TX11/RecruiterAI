import React, { useState, useEffect } from 'react';
import { StickyNote, Search, Pin, User, Calendar, ExternalLink } from 'lucide-react';
import { getMyNotes, searchNotes } from '../services/api';
import { formatTimeAgo, formatDate } from '../utils/dateUtils';
import { Link } from 'react-router-dom';

export default function MyNotesPage() {
  const [notes, setNotes] = useState([]);
  const [filteredNotes, setFilteredNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPinned, setFilterPinned] = useState(false);

  const loadNotes = async () => {
    try {
      const data = await getMyNotes(100);
      setNotes(data);
      setFilteredNotes(data);
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    let filtered = notes;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(note =>
        note.note.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by pinned
    if (filterPinned) {
      filtered = filtered.filter(note => note.is_pinned);
    }

    setFilteredNotes(filtered);
  }, [searchQuery, filterPinned, notes]);

  // Group notes by candidate
  const groupedNotes = filteredNotes.reduce((acc, note) => {
    if (!acc[note.candidate_id]) {
      acc[note.candidate_id] = [];
    }
    acc[note.candidate_id].push(note);
    return acc;
  }, {});

  if (loading) {
    return <div className="text-center p-12">Loading your notes...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center">
          <StickyNote className="h-8 w-8 text-purple-600 mr-3" />
          My Private Notes
        </h1>
        <p className="text-gray-600 mt-2">
          All your private notes across all candidates
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Total Notes</p>
              <p className="text-3xl font-bold text-gray-900">{notes.length}</p>
            </div>
            <StickyNote className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Pinned Notes</p>
              <p className="text-3xl font-bold text-yellow-600">
                {notes.filter(n => n.is_pinned).length}
              </p>
            </div>
            <Pin className="h-8 w-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Candidates</p>
              <p className="text-3xl font-bold text-blue-600">
                {Object.keys(groupedNotes).length}
              </p>
            </div>
            <User className="h-8 w-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your notes..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button
            onClick={() => setFilterPinned(!filterPinned)}
            className={`flex items-center px-4 py-2 rounded-lg border transition-colors ${
              filterPinned
                ? 'bg-yellow-50 border-yellow-500 text-yellow-700'
                : 'hover:bg-gray-50'
            }`}
          >
            <Pin className="h-4 w-4 mr-2" />
            Pinned Only
          </button>
        </div>
      </div>

      {/* Notes List */}
      {filteredNotes.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <StickyNote className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-700 mb-2">
            {searchQuery || filterPinned ? 'No matching notes' : 'No notes yet'}
          </h3>
          <p className="text-gray-500">
            {searchQuery || filterPinned
              ? 'Try adjusting your search or filters'
              : 'Start adding private notes to candidates'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedNotes).map(([candidateId, candidateNotes]) => {
            // Get candidate info from the first note
            const firstNote = candidateNotes[0];
            
            return (
              <div key={candidateId} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Candidate Header */}
                <div className="bg-gray-50 px-6 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-gray-400" />
                    <span className="font-medium text-gray-900">
                      Candidate ID: {candidateId}
                    </span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                      {candidateNotes.length} note{candidateNotes.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <Link
                    to={`/candidates`}
                    className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
                  >
                    View Candidate
                    <ExternalLink className="h-4 w-4 ml-1" />
                  </Link>
                </div>

                {/* Notes for this candidate */}
                <div className="p-6 space-y-3">
                  {candidateNotes.map((note) => (
                    <div
                      key={note.id}
                      className={`p-4 rounded-lg border ${
                        note.is_pinned
                          ? 'bg-yellow-50 border-yellow-300'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {note.is_pinned && (
                            <Pin className="h-4 w-4 text-yellow-600 transform rotate-45" />
                          )}
                          <span className="text-xs text-gray-500 flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(note.updated_at)}
                            {note.created_at !== note.updated_at && (
                              <span className="ml-1">(edited)</span>
                            )}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatTimeAgo(note.updated_at)}
                        </span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{note.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
