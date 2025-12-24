import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const PermissionContext = createContext();

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionProvider');
  }
  return context;
};

export const PermissionProvider = ({ children }) => {
  const [permissions, setPermissions] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const { data } = await api.get('/api/users/me/permissions');
      
      setPermissions(data.permissions);
      setRole(data.role);
    } catch (error) {
      console.error('Failed to load permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, []);

  const hasPermission = (action) => {
    if (!permissions) return false;
    return permissions[action] === true;
  };

  const hasAnyPermission = (actions) => {
    return actions.some(action => hasPermission(action));
  };

  const hasAllPermissions = (actions) => {
    return actions.every(action => hasPermission(action));
  };

  const isAdmin = () => role === 'admin';
  const isHRManager = () => role === 'hr_manager';
  const isRecruiter = () => role === 'recruiter';

  const value = {
    permissions,
    role,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
    isHRManager,
    isRecruiter,
    refreshPermissions: loadPermissions
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};

// HOC to protect components
export const withPermission = (Component, requiredPermission) => {
  return (props) => {
    const { hasPermission, loading } = usePermissions();

    if (loading) {
      return <div className="p-4 text-center">Loading...</div>;
    }

    if (!hasPermission(requiredPermission)) {
      return (
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <h2 className="text-2xl font-bold text-red-800 mb-2">Access Denied</h2>
            <p className="text-red-600">
              You don't have permission to access this feature.
            </p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
};

// Component to conditionally render based on permission
export const Can = ({ do: action, children, fallback = null }) => {
  const { hasPermission, loading } = usePermissions();

  if (loading) return null;
  if (!hasPermission(action)) return fallback;

  return children;
};

// Component to show content only for specific roles
export const RoleOnly = ({ roles, children, fallback = null }) => {
  const { role, loading } = usePermissions();

  if (loading) return null;
  if (!roles.includes(role)) return fallback;

  return children;
};
