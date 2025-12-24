import React, { useState, useEffect } from 'react';
import { StickyNote, Pin, Edit2, Trash2, Save, X, Lock, AlertCircle } from 'lucide-react';
import { createNote, getNotes, updateNote, deleteNote, toggleNotePin } from '../services/api';
import { formatTimeAgo } from '../utils/dateUtils';

export default function PrivateNotes({ candidateId }) {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadNotes = async () => {
    try {
      const data = await getNotes(candidateId);
      setNotes(data);
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [candidateId]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setSaving(true);
    try {
      await createNote(candidateId, newNote);
      setNewNote('');
      await loadNotes();
    } catch (error) {
      console.error('Failed to add note:', error);
      alert('Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateNote = async (noteId) => {
    if (!editText.trim()) return;

    setSaving(true);
    try {
      await updateNote(noteId, editText);
      setEditingNote(null);
      setEditText('');
      await loadNotes();
    } catch (error) {
      console.error('Failed to update note:', error);
      alert('Failed to update note');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      await deleteNote(noteId);
      await loadNotes();
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert('Failed to delete note');
    }
  };

  const handleTogglePin = async (noteId) => {
    try {
      await toggleNotePin(noteId);
      await loadNotes();
    } catch (error) {
      console.error('Failed to toggle pin:', error);
      alert('Failed to toggle pin');
    }
  };

  const startEdit = (note) => {
    setEditingNote(note.id);
    setEditText(note.note);
  };

  const cancelEdit = () => {
    setEditingNote(null);
    setEditText('');
  };

  if (loading) {
    return <div className="text-center py-4">Loading notes...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Lock className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-semibold">My Private Notes ({notes.length})</h3>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <AlertCircle className="h-4 w-4" />
          <span>Only visible to you</span>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
        <div className="flex items-start">
          <Lock className="h-5 w-5 text-purple-600 mr-2 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-purple-900">Private Notes</p>
            <p className="text-purple-700 mt-1">
              These notes are completely private and only visible to you. Use them for personal observations, 
              reminders, or sensitive information. Team members can only see public comments.
            </p>
          </div>
        </div>
      </div>

      {/* Add Note Form */}
      <div className="bg-gray-50 rounded-lg p-4">
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a private note... (e.g., 'Follow up next week', 'Strong technical skills but needs more experience')"
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          rows="3"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleAddNote}
            disabled={!newNote.trim() || saving}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <StickyNote className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Add Note'}
          </button>
        </div>
      </div>

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <StickyNote className="h-12 w-12 mx-auto mb-3 text-gray-400" />
          <p>No private notes yet. Add your first note above!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`rounded-lg border p-4 transition-all ${
                note.is_pinned
                  ? 'bg-yellow-50 border-yellow-300 shadow-sm'
                  : 'bg-white border-gray-200'
              }`}
            >
              {editingNote === note.id ? (
                /* Edit Mode */
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none"
                    rows="3"
                    autoFocus
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </button>
                    <button
                      onClick={() => handleUpdateNote(note.id)}
                      disabled={saving}
                      className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {note.is_pinned && (
                        <Pin className="h-4 w-4 text-yellow-600 transform rotate-45" />
                      )}
                      <span className="text-xs text-gray-500">
                        {formatTimeAgo(note.updated_at)}
                        {note.created_at !== note.updated_at && (
                          <span className="ml-1">(edited)</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleTogglePin(note.id)}
                        className={`p-1 rounded hover:bg-gray-100 ${
                          note.is_pinned ? 'text-yellow-600' : 'text-gray-400'
                        }`}
                        title={note.is_pinned ? 'Unpin note' : 'Pin note'}
                      >
                        <Pin className={`h-4 w-4 ${note.is_pinned ? 'transform rotate-45' : ''}`} />
                      </button>
                      <button
                        onClick={() => startEdit(note)}
                        className="p-1 text-blue-600 rounded hover:bg-blue-50"
                        title="Edit note"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-1 text-red-600 rounded hover:bg-red-50"
                        title="Delete note"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{note.note}</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {notes.length > 0 && (
        <div className="text-xs text-gray-500 text-center pt-2 border-t">
          {notes.filter(n => n.is_pinned).length > 0 && (
            <span>{notes.filter(n => n.is_pinned).length} pinned • </span>
          )}
          {notes.length} total note{notes.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}