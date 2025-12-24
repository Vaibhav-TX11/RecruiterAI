import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Filter, Users, Upload, Briefcase, Target, TrendingUp, 
  Ban, Activity, Shield, StickyNote, LogOut, Menu, X, ChevronDown 
} from 'lucide-react';
import { logout, getCurrentUser } from '../services/auth';
import { usePermissions } from '../contexts/PermissionContext';

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const user = getCurrentUser();
  const { hasPermission, role } = usePermissions();

  const handleLogout = () => {
    logout();
    navigate('/login');
    window.location.reload();
  };

  // Navigation structure
  const navigation = [
    {
      section: 'Screening',
      items: [
        {
          name: 'Screening Pool',
          path: '/screening',
          icon: Filter,
          permission: 'view_candidates',
          badge: 'Stage 1',
          badgeColor: 'bg-green-100 text-green-800'
        },
        {
          name: 'Candidates',
          path: '/candidates',
          icon: Users,
          permission: 'view_candidates',
          badge: 'Stage 2',
          badgeColor: 'bg-blue-100 text-blue-800'
        }
      ]
    },
    {
      section: 'Management',
      items: [
        {
          name: 'Upload Resume',
          path: '/upload',
          icon: Upload,
          permission: 'upload_resume'
        },
        {
          name: 'Jobs',
          path: '/jobs',
          icon: Briefcase,
          permission: 'view_jobs'
        },
        {
          name: 'Matching',
          path: '/matching',
          icon: Target,
          permission: 'match_candidates'
        }
      ]
    },
    {
      section: 'Reports',
      items: [
        {
          name: 'Analytics',
          path: '/analytics',
          icon: TrendingUp,
          permission: 'view_analytics'
        },
        {
          name: 'Blacklist',
          path: '/blacklist',
          icon: Ban,
          permission: 'view_blacklist'
        },
        {
          name: 'Activity',
          path: '/activity',
          icon: Activity,
          permission: 'view_activity'
        }
      ]
    },
    {
      section: 'Personal',
      items: [
        {
          name: 'My Notes',
          path: '/my-notes',
          icon: StickyNote,
          permission: null // Available to all
        }
      ]
    },
    {
      section: 'Admin',
      items: [
        {
          name: 'User Management',
          path: '/users',
          icon: Shield,
          permission: 'manage_users'
        }
      ]
    }
  ];

  // Filter navigation based on permissions
  const visibleNavigation = navigation
    .map(section => ({
      ...section,
      items: section.items.filter(
        item => !item.permission || hasPermission(item.permission)
      )
    }))
    .filter(section => section.items.length > 0);

  const getRoleBadgeColor = (userRole) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-800',
      hr_manager: 'bg-blue-100 text-blue-800',
      recruiter: 'bg-green-100 text-green-800'
    };
    return colors[userRole] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64 bg-white border-r">
          {/* Logo/Brand */}
          <div className="flex items-center justify-center h-16 px-6 border-b bg-gradient-to-r from-blue-600 to-purple-600">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <Filter className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-white">
                <h1 className="text-lg font-bold">RecruiterAI</h1>
                <p className="text-xs opacity-80">Screening System</p>
              </div>
            </div>
          </div>

          {/* Navigation Sections */}
          <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
            {visibleNavigation.map((section, sectionIdx) => (
              <div key={sectionIdx}>
                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {section.section}
                </h3>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                          `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${
                            isActive
                              ? 'bg-blue-50 text-blue-700 shadow-sm'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon className={`h-5 w-5 mr-3 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
                            <span className="flex-1">{item.name}</span>
                            {item.badge && (
                              <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${item.badgeColor || 'bg-gray-100 text-gray-800'}`}>
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* User Profile Section */}
          <div className="p-4 border-t bg-gray-50">
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-full flex items-center justify-between p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-semibold text-sm">
                      {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="text-left overflow-hidden">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user?.full_name || 'User'}
                    </p>
                    <p className={`text-xs px-2 py-0.5 rounded-full inline-block ${getRoleBadgeColor(user?.role)}`}>
                      {user?.role?.replace('_', ' ').toUpperCase() || 'USER'}
                    </p>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* User Dropdown Menu */}
              {userMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setUserMenuOpen(false)}
                  ></div>
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border z-20">
                    <div className="p-3 border-b">
                      <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-b-lg"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b z-30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Filter className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">RecruiterAI</h1>
              <p className="text-xs text-gray-500">{user?.full_name}</p>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6 text-gray-700" />
            ) : (
              <Menu className="h-6 w-6 text-gray-700" />
            )}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <>
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40 top-[57px]" 
              onClick={() => setMobileMenuOpen(false)}
            ></div>
            <div className="absolute top-full left-0 right-0 bg-white border-t shadow-lg z-50 max-h-[calc(100vh-57px)] overflow-y-auto">
              <nav className="px-4 py-2 space-y-4">
                {visibleNavigation.map((section, sectionIdx) => (
                  <div key={sectionIdx}>
                    <h3 className="px-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      {section.section}
                    </h3>
                    <div className="space-y-1">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setMobileMenuOpen(false)}
                            className={({ isActive }) =>
                              `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg ${
                                isActive
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`
                            }
                          >
                            <Icon className="h-5 w-5 mr-3" />
                            <span className="flex-1">{item.name}</span>
                            {item.badge && (
                              <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${item.badgeColor || 'bg-gray-100 text-gray-800'}`}>
                                {item.badge}
                              </span>
                            )}
                          </NavLink>
                        );
                      })}
                    </div>
                  </div>
                ))}
                
                {/* Logout Button */}
                <div className="pt-4 border-t">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <LogOut className="h-5 w-5 mr-3" />
                    Logout
                  </button>
                </div>
              </nav>
            </div>
          </>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-0 pt-[57px] lg:pt-0">
        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}