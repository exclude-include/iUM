"""
Database service layer for Supabase operations
"""
from typing import List, Optional, Dict, Any
from supabase import Client
from db.models import (
    Account, AccountCreate,
    GoogleIntegration,
    DriveFile, DriveFileCreate,
    File,
    History, HistoryCreate,
    Reel, ReelCreate
)


class AccountService:
    """Service for account operations"""
    
    def __init__(self, db: Client):
        self.db = db
        self.table = "accounts"
    
    def create(self, account: AccountCreate) -> Account:
        """Create a new account"""
        response = self.db.table(self.table).insert({
            "email": account.email,
            "name": account.name
        }).execute()
        return Account(**response.data[0])
    
    def get_by_id(self, account_id: str) -> Optional[Account]:
        """Get account by ID"""
        response = self.db.table(self.table).select("*").eq("id", account_id).execute()
        if response.data:
            return Account(**response.data[0])
        return None
    
    def get_by_email(self, email: str) -> Optional[Account]:
        """Get account by email"""
        response = self.db.table(self.table).select("*").eq("email", email).execute()
        if response.data:
            return Account(**response.data[0])
        return None
    
    def update(self, account_id: str, data: Dict[str, Any]) -> Account:
        """Update account"""
        response = self.db.table(self.table).update(data).eq("id", account_id).execute()
        return Account(**response.data[0])
    
    def delete(self, account_id: str) -> bool:
        """Delete account"""
        response = self.db.table(self.table).delete().eq("id", account_id).execute()
        return len(response.data) > 0


class GoogleIntegrationService:
    """Service for Google integration operations"""
    
    def __init__(self, db: Client):
        self.db = db
        self.table = "google_integrations"
    
    def create_or_update(self, account_id: str, access_token: str, 
                         refresh_token: Optional[str] = None,
                         scope: Optional[str] = None) -> GoogleIntegration:
        """Create or update Google integration"""
        existing = self.db.table(self.table).select("*").eq("account_id", account_id).execute()
        
        data = {
            "account_id": account_id,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "scope": scope
        }
        
        if existing.data:
            # Update
            response = self.db.table(self.table).update(data).eq("account_id", account_id).execute()
        else:
            # Insert
            response = self.db.table(self.table).insert(data).execute()
        
        return GoogleIntegration(**response.data[0])
    
    def get_by_account(self, account_id: str) -> Optional[GoogleIntegration]:
        """Get Google integration by account ID"""
        response = self.db.table(self.table).select("*").eq("account_id", account_id).execute()
        if response.data:
            return GoogleIntegration(**response.data[0])
        return None
    
    def delete(self, account_id: str) -> bool:
        """Delete Google integration"""
        response = self.db.table(self.table).delete().eq("account_id", account_id).execute()
        return len(response.data) > 0


class DriveFileService:
    """Service for Google Drive file operations"""
    
    def __init__(self, db: Client):
        self.db = db
        self.table = "drive_files"
    
    def create(self, drive_file: DriveFileCreate) -> DriveFile:
        """Create a new drive file record"""
        response = self.db.table(self.table).insert(drive_file.dict()).execute()
        return DriveFile(**response.data[0])
    
    def get_by_account(self, account_id: str, folder_id: Optional[str] = None) -> List[DriveFile]:
        """Get all drive files for an account, optionally filtered by folder"""
        query = self.db.table(self.table).select("*").eq("account_id", account_id)
        
        if folder_id:
            query = query.eq("folder_id", folder_id)
        
        response = query.order("created_at", desc=True).execute()
        return [DriveFile(**file) for file in response.data]
    
    def get_by_drive_id(self, google_drive_id: str) -> Optional[DriveFile]:
        """Get drive file by Google Drive ID"""
        response = self.db.table(self.table).select("*").eq("google_drive_id", google_drive_id).execute()
        if response.data:
            return DriveFile(**response.data[0])
        return None
    
    def update_sync(self, file_id: str) -> DriveFile:
        """Update sync timestamp"""
        from datetime import datetime
        response = self.db.table(self.table).update({
            "synced_at": datetime.utcnow().isoformat()
        }).eq("id", file_id).execute()
        return DriveFile(**response.data[0])
    
    def delete(self, file_id: str) -> bool:
        """Delete drive file record"""
        response = self.db.table(self.table).delete().eq("id", file_id).execute()
        return len(response.data) > 0


class FileService:
    """Service for file operations"""
    
    def __init__(self, db: Client):
        self.db = db
        self.table = "files"
    
    def create(self, account_id: str, name: str, content_type: str, 
               size: int, storage_path: str, folder_id: Optional[str] = None) -> File:
        """Create a new file record"""
        response = self.db.table(self.table).insert({
            "account_id": account_id,
            "folder_id": folder_id,
            "name": name,
            "content_type": content_type,
            "size": size,
            "storage_path": storage_path,
            "vectorized": False
        }).execute()
        return File(**response.data[0])
    
    def get_by_account(self, account_id: str, folder_id: Optional[str] = None) -> List[File]:
        """Get all files for an account, optionally filtered by folder"""
        query = self.db.table(self.table).select("*").eq("account_id", account_id)
        
        if folder_id:
            query = query.eq("folder_id", folder_id)
        
        response = query.order("created_at", desc=True).execute()
        return [File(**file) for file in response.data]
    
    def mark_vectorized(self, file_id: str) -> File:
        """Mark file as vectorized"""
        response = self.db.table(self.table).update({
            "vectorized": True
        }).eq("id", file_id).execute()
        return File(**response.data[0])
    
    def delete(self, file_id: str) -> bool:
        """Delete file record"""
        response = self.db.table(self.table).delete().eq("id", file_id).execute()
        return len(response.data) > 0


class HistoryService:
    """Service for history operations"""
    
    def __init__(self, db: Client):
        self.db = db
        self.table = "history"
    
    def create(self, history: HistoryCreate) -> History:
        """Create a new history record"""
        response = self.db.table(self.table).insert({
            "account_id": history.account_id,
            "folder_id": history.folder_id,
            "title": history.title,
            "history_type": history.history_type,
            "content": history.content
        }).execute()
        return History(**response.data[0])
    
    def get_by_account(self, account_id: str, 
                       folder_id: Optional[str] = None,
                       history_type: Optional[str] = None,
                       limit: int = 50) -> List[History]:
        """Get history for an account"""
        query = self.db.table(self.table).select("*").eq("account_id", account_id)
        
        if folder_id:
            query = query.eq("folder_id", folder_id)
        
        if history_type:
            query = query.eq("history_type", history_type)
        
        response = query.order("created_at", desc=True).limit(limit).execute()
        return [History(**item) for item in response.data]
    
    def get_by_id(self, history_id: str) -> Optional[History]:
        """Get history by ID"""
        response = self.db.table(self.table).select("*").eq("id", history_id).execute()
        if response.data:
            return History(**response.data[0])
        return None
    
    def delete(self, history_id: str) -> bool:
        """Delete history record"""
        response = self.db.table(self.table).delete().eq("id", history_id).execute()
        return len(response.data) > 0


class ReelService:
    """Service for reel operations"""
    
    def __init__(self, db: Client):
        self.db = db
        self.table = "reels"
    
    def create(self, reel: ReelCreate) -> Reel:
        """Create a new reel"""
        response = self.db.table(self.table).insert(reel.dict()).execute()
        return Reel(**response.data[0])
    
    def get_all(self, limit: int = 10, offset: int = 0, 
                category: Optional[str] = None,
                tags: Optional[List[str]] = None) -> List[Reel]:
        """Get all reels with pagination and filters"""
        query = self.db.table(self.table).select("*")
        
        if category:
            query = query.eq("category", category)
        
        # Note: For tags filtering, you might need to use PostgreSQL array operators
        # This is a simplified version
        if tags:
            # This requires proper PostgreSQL array query support
            pass
        
        response = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        return [Reel(**reel) for reel in response.data]
    
    def get_by_id(self, reel_id: str) -> Optional[Reel]:
        """Get reel by ID"""
        response = self.db.table(self.table).select("*").eq("id", reel_id).execute()
        if response.data:
            return Reel(**response.data[0])
        return None
    
    def update(self, reel_id: str, data: Dict[str, Any]) -> Reel:
        """Update reel"""
        response = self.db.table(self.table).update(data).eq("id", reel_id).execute()
        return Reel(**response.data[0])
    
    def delete(self, reel_id: str) -> bool:
        """Delete reel"""
        response = self.db.table(self.table).delete().eq("id", reel_id).execute()
        return len(response.data) > 0
    
    def count(self) -> int:
        """Get total count of reels"""
        response = self.db.table(self.table).select("id", count="exact").execute()
        return response.count if hasattr(response, 'count') else len(response.data)
