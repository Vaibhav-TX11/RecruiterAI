import os
from supabase import create_client, Client
from typing import BinaryIO, Optional
import logging

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")
        
        if not supabase_url or not supabase_key:
            logger.warning("Supabase credentials not found. Using local storage.")
            self.supabase: Optional[Client] = None
        else:
            self.supabase: Client = create_client(supabase_url, supabase_key)
        
        self.bucket_name = "resumes"
    
    def upload_file(self, file: BinaryIO, filename: str, folder: str = "") -> str:
        """Upload file to Supabase Storage"""
        if not self.supabase:
            raise Exception("Supabase not configured")
        
        # Create path: batch_id/filename
        file_path = f"{folder}/{filename}" if folder else filename
        
        try:
            # Upload to Supabase
            response = self.supabase.storage.from_(self.bucket_name).upload(
                file_path,
                file,
                file_options={"content-type": "application/octet-stream"}
            )
            
            logger.info(f"Uploaded file: {file_path}")
            return file_path
        
        except Exception as e:
            logger.error(f"Failed to upload {filename}: {e}")
            raise
    
    def download_file(self, file_path: str) -> bytes:
        """Download file from Supabase Storage"""
        if not self.supabase:
            raise Exception("Supabase not configured")
        
        try:
            response = self.supabase.storage.from_(self.bucket_name).download(file_path)
            return response
        except Exception as e:
            logger.error(f"Failed to download {file_path}: {e}")
            raise
    
    def get_public_url(self, file_path: str) -> str:
        """Get public URL for file"""
        if not self.supabase:
            raise Exception("Supabase not configured")
        
        return self.supabase.storage.from_(self.bucket_name).get_public_url(file_path)
    
    def delete_file(self, file_path: str) -> bool:
        """Delete file from storage"""
        if not self.supabase:
            return True
        
        try:
            self.supabase.storage.from_(self.bucket_name).remove([file_path])
            logger.info(f"Deleted file: {file_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete {file_path}: {e}")
            return False
    
    def list_files(self, folder: str = "") -> list:
        """List files in a folder"""
        if not self.supabase:
            return []
        
        try:
            response = self.supabase.storage.from_(self.bucket_name).list(folder)
            return response
        except Exception as e:
            logger.error(f"Failed to list files in {folder}: {e}")
            return []

# Singleton instance
storage_service = StorageService()
