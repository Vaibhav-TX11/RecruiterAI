import React, { useState, useEffect } from 'react';
import { Shield, UserCheck, UserX, Edit2, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { usePermissions } from '../contexts/PermissionContext';
import { formatDate } from '../utils/dateUtils';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [newRole, setNewRole] = useState('');
  const { hasPermission, isAdmin } = usePermissions();

  const loadUsers = async () => {
    try {
      const { data } = await api.get('/api/users');
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (userId) => {
    if (!newRole) {
      alert('Please select a role');
      return;
    }

    try {
      await api.put(`/api/users/${userId}/role`, { role: newRole });
      await loadUsers();
      setEditingUser(null);
      setNewRole('');
      alert('Role updated successfully');
    } catch (error) {
      console.error('Failed to update role:', error);
      alert('Failed to update role');
    }
  };

  const handleDeactivateUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to deactivate ${userName}?`)) {
      return;
    }

    try {
      await api.delete(`/api/users/${userId}`);
      await loadUsers();
      alert('User deactivated successfully');
    } catch (error) {
      console.error('Failed to deactivate user:', error);
      alert(error.response?.data?.detail || 'Failed to deactivate user');
    }
  };

  const getRoleBadge = (role) => {
    const badges = {
      admin: 'bg-purple-100 text-purple-800',
      hr_manager: 'bg-blue-100 text-blue-800',
      recruiter: 'bg-green-100 text-green-800'
    };
    return badges[role] || 'bg-gray-100 text-gray-800';
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Admin',
      hr_manager: 'HR Manager',
      recruiter: 'Recruiter'
    };
    return labels[role] || role;
  };

  if (!hasPermission('manage_users')) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-600">
            Only administrators can access user management.
          </p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="text-center p-12">Loading users...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center">
          <Shield className="h-8 w-8 text-purple-600 mr-3" />
          User Management
        </h1>
        <p className="text-gray-600 mt-2">
          Manage user roles and permissions (Admin Only)
        </p>
      </div>

      {/* Permission Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">Role Permissions:</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="font-medium text-purple-800">Admin</p>
            <ul className="text-gray-700 mt-1 space-y-1">
              <li>• Full system access</li>
              <li>• Manage users</li>
              <li>• Delete candidates</li>
              <li>• All other permissions</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-blue-800">HR Manager</p>
            <ul className="text-gray-700 mt-1 space-y-1">
              <li>• Upload resumes</li>
              <li>• Review & blacklist</li>
              <li>• Create jobs</li>
              <li>• View analytics</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-green-800">Recruiter</p>
            <ul className="text-gray-700 mt-1 space-y-1">
              <li>• Upload resumes</li>
              <li>• View candidates</li>
              <li>• Add comments</li>
              <li>• Match candidates</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center mr-3">
                      <span className="text-white font-medium">
                        {user.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{user.full_name}</div>
                      <div className="text-sm text-gray-500">@{user.username}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                <td className="px-6 py-4">
                  {editingUser === user.id ? (
                    <div className="flex items-center space-x-2">
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        <option value="">Select role...</option>
                        <option value="admin">Admin</option>
                        <option value="hr_manager">HR Manager</option>
                        <option value="recruiter">Recruiter</option>
                      </select>
                      <button
                        onClick={() => handleRoleChange(user.id)}
                        className="text-green-600 hover:text-green-800"
                      >
                        <CheckCircle className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingUser(null);
                          setNewRole('');
                        }}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getRoleBadge(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {user.is_active ? (
                    <span className="flex items-center text-green-600">
                      <UserCheck className="h-4 w-4 mr-1" />
                      Active
                    </span>
                  ) : (
                    <span className="flex items-center text-red-600">
                      <UserX className="h-4 w-4 mr-1" />
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {user.last_login ? formatDate(user.last_login) : 'Never'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {formatDate(user.created_at)}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    {user.is_active && editingUser !== user.id && (
                      <button
                        onClick={() => {
                          setEditingUser(user.id);
                          setNewRole(user.role);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                        title="Change role"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                    {user.is_active && (
                      <button
                        onClick={() => handleDeactivateUser(user.id, user.full_name)}
                        className="text-red-600 hover:text-red-800"
                        title="Deactivate user"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 mb-1">Total Users</p>
          <p className="text-3xl font-bold text-gray-900">{users.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 mb-1">Admins</p>
          <p className="text-3xl font-bold text-purple-600">
            {users.filter(u => u.role === 'admin').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 mb-1">HR Managers</p>
          <p className="text-3xl font-bold text-blue-600">
            {users.filter(u => u.role === 'hr_manager').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 mb-1">Recruiters</p>
          <p className="text-3xl font-bold text-green-600">
            {users.filter(u => u.role === 'recruiter').length}
          </p>
        </div>
      </div>
    </div>
  );
}