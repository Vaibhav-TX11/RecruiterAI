from typing import List
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from . import models
from .auth import get_current_user
from .database import get_db

# Define role hierarchy
ROLE_HIERARCHY = {
    "admin": 3,
    "hr_manager": 2,
    "recruiter": 1
}

# Define permissions for each action
PERMISSIONS = {
    "view_candidates": ["admin", "hr_manager", "recruiter"],
    "upload_resume": ["admin", "hr_manager", "recruiter"],
    "edit_candidate": ["admin", "hr_manager"],
    "delete_candidate": ["admin"],
    "blacklist_candidate": ["admin", "hr_manager"],
    "unblacklist_candidate": ["admin", "hr_manager"],
    
    "view_jobs": ["admin", "hr_manager", "recruiter"],
    "create_job": ["admin", "hr_manager"],
    "edit_job": ["admin", "hr_manager"],
    "delete_job": ["admin"],
    
    "match_candidates": ["admin", "hr_manager", "recruiter"],
    "view_analytics": ["admin", "hr_manager", "recruiter"],
    
    "add_comment": ["admin", "hr_manager", "recruiter"],
    "view_comments": ["admin", "hr_manager", "recruiter"],
    "delete_comment": ["admin", "hr_manager"],
    
    "view_activity": ["admin", "hr_manager"],
    "view_blacklist": ["admin", "hr_manager"],
    
    "manage_users": ["admin"],
    "view_users": ["admin", "hr_manager"],
    "change_status": ["admin", "hr_manager"],
}


def has_permission(user_role: str, action: str) -> bool:
    """Check if a role has permission for an action"""
    allowed_roles = PERMISSIONS.get(action, [])
    return user_role in allowed_roles


def require_permission(action: str):
    """Decorator to require specific permission for an endpoint"""
    async def permission_checker(
        current_user: models.User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> models.User:
        if not has_permission(current_user.role, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required permission: {action}. Your role: {current_user.role}"
            )
        return current_user
    return permission_checker


def require_roles(allowed_roles: List[str]):
    """Decorator to require specific roles for an endpoint"""
    async def role_checker(
        current_user: models.User = Depends(get_current_user)
    ) -> models.User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {', '.join(allowed_roles)}. Your role: {current_user.role}"
            )
        return current_user
    return role_checker


def require_min_role(min_role: str):
    """Require minimum role level (e.g., hr_manager allows hr_manager and admin)"""
    async def role_checker(
        current_user: models.User = Depends(get_current_user)
    ) -> models.User:
        user_level = ROLE_HIERARCHY.get(current_user.role, 0)
        required_level = ROLE_HIERARCHY.get(min_role, 999)
        
        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required minimum role: {min_role}. Your role: {current_user.role}"
            )
        return current_user
    return role_checker


def can_modify_candidate(current_user: models.User, candidate: models.Candidate, db: Session) -> bool:
    """Check if user can modify a specific candidate"""
    # Admins can modify anything
    if current_user.role == "admin":
        return True
    
    # HR managers can modify anything
    if current_user.role == "hr_manager":
        return True
    
    # Recruiters can only modify candidates they uploaded
    if current_user.role == "recruiter":
        return candidate.uploaded_by == current_user.full_name
    
    return False


def can_delete_comment(current_user: models.User, comment: models.Comment) -> bool:
    """Check if user can delete a specific comment"""
    # Admins and HR managers can delete any comment
    if current_user.role in ["admin", "hr_manager"]:
        return True
    
    # Users can delete their own comments
    if comment.hr_name == current_user.full_name:
        return True
    
    return False


def get_user_permissions(role: str) -> dict:
    """Get all permissions for a role"""
    permissions = {}
    for action, allowed_roles in PERMISSIONS.items():
        permissions[action] = role in allowed_roles
    return permissions
