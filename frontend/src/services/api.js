import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

// Add auth token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (redirect to login)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const uploadResume = async (file, uploadedBy) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post(`/api/resumes/upload?uploaded_by=${uploadedBy}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data;
};

export const pauseBatch = async (batchId) => {
  const { data } = await api.put(`/api/screening/batches/${batchId}/pause`);
  return data;
};

export const resumeBatch = async (batchId) => {
  const { data } = await api.put(`/api/screening/batches/${batchId}/resume`);
  return data;
};

export const cancelBatch = async (batchId) => {
  const { data } = await api.put(`/api/screening/batches/${batchId}/cancel`);
  return data;
};

export const deleteBatch = async (batchId) => {
  const { data } = await api.delete(`/api/screening/batches/${batchId}`);
  return data;
};

export const getCandidates = async () => {
  const { data } = await api.get('/api/candidates');
  return data;
};

export const getCandidate = async (id) => {
  const { data } = await api.get(`/api/candidates/${id}`);
  return data;
};

export const updateCandidateStatus = async (id, status, version, user) => {
  const { data } = await api.put(`/api/candidates/${id}/status`, { status, version, user });
  return data;
};

export const blacklistCandidate = async (candidateId, reason, user) => {
  const { data } = await api.put(`/api/candidates/${candidateId}/blacklist`, {
    reason,
    user
  });
  return data;
};

export const unblacklistCandidate = async (candidateId) => {
  const { data } = await api.put(`/api/candidates/${candidateId}/unblacklist`);
  return data;
};

export const getBlacklist = async () => {
  const { data } = await api.get('/api/blacklist');
  return data;
};

export const createJob = async (jobData) => {
  const { data } = await api.post('/api/jobs', jobData);
  return data;
};

export const getJobs = async () => {
  const { data } = await api.get('/api/jobs');
  return data;
};

export const matchCandidate = async (candidateId, jobId) => {
  const { data } = await api.post(`/api/match?candidate_id=${candidateId}&job_id=${jobId}`);
  return data;
};

export const addComment = async (candidateId, commentText) => {
  // commentText is just a string like "missing details"
  // We wrap it in {comment: text} here
  const { data } = await api.post(`/api/candidates/${candidateId}/comments`, {
    comment: commentText
  });
  return data;
};

export const getComments = async (candidateId) => {
  const { data } = await api.get(`/api/candidates/${candidateId}/comments`);
  return data;
};

export const createNote = async (candidateId, noteText, isPinned = false) => {
  const { data } = await api.post(`/api/candidates/${candidateId}/notes`, {
    note: noteText,
    is_pinned: isPinned
  });
  return data;
};

export const getNotes = async (candidateId) => {
  const { data } = await api.get(`/api/candidates/${candidateId}/notes`);
  return data;
};

export const updateNote = async (noteId, noteText, isPinned) => {
  const { data } = await api.put(`/api/notes/${noteId}`, {
    note: noteText,
    is_pinned: isPinned
  });
  return data;
};

export const deleteNote = async (noteId) => {
  const { data } = await api.delete(`/api/notes/${noteId}`);
  return data;
};

export const toggleNotePin = async (noteId) => {
  const { data } = await api.put(`/api/notes/${noteId}/pin`);
  return data;
};

export const getMyNotes = async (limit = 50) => {
  const { data } = await api.get(`/api/notes/my-notes?limit=${limit}`);
  return data;
};

export const searchNotes = async (query) => {
  const { data } = await api.get(`/api/notes/search?q=${encodeURIComponent(query)}`);
  return data;
};

export const getNoteCount = async (candidateId) => {
  const { data } = await api.get(`/api/candidates/${candidateId}/notes/count`);
  return data;
};

export const browseFolders = async (path = '/') => {
  const { data } = await api.get('/api/filesystem/browse', {
    params: { path }
  });
  return data;
};

export const validateFolderPath = async (path) => {
  const { data } = await api.get('/api/filesystem/validate', {
    params: { path }
  });
  return data;
};
