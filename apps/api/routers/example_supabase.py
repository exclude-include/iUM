"""
Example router demonstrating Supabase integration with FastAPI
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from utils.supabase_client import get_supabase
from supabase import Client

router = APIRouter()


# Pydantic models for request/response
class UserCreate(BaseModel):
    email: str
    name: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: str


class NoteCreate(BaseModel):
    title: str
    content: str
    user_id: str


class NoteResponse(BaseModel):
    id: str
    title: str
    content: str
    user_id: str
    created_at: str


# Dependency for Supabase client
def get_db() -> Client:
    """Dependency for getting Supabase client"""
    return get_supabase()


# Example endpoints
@router.get("/users", response_model=List[UserResponse])
async def get_users(db: Client = Depends(get_db)):
    """
    Get all users from Supabase
    
    Example Supabase table schema:
    CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """
    try:
        response = db.table('users').select('*').execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, db: Client = Depends(get_db)):
    """Get a specific user by ID"""
    try:
        response = db.table('users').select('*').eq('id', user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate, db: Client = Depends(get_db)):
    """Create a new user"""
    try:
        response = db.table('users').insert({
            'email': user.email,
            'name': user.name
        }).execute()
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user: UserCreate, db: Client = Depends(get_db)):
    """Update an existing user"""
    try:
        response = db.table('users').update({
            'email': user.email,
            'name': user.name
        }).eq('id', user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, db: Client = Depends(get_db)):
    """Delete a user"""
    try:
        response = db.table('users').delete().eq('id', user_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {"message": "User deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# Example with filtering and joins
@router.get("/users/{user_id}/notes", response_model=List[NoteResponse])
async def get_user_notes(user_id: str, db: Client = Depends(get_db)):
    """
    Get all notes for a specific user
    
    Example notes table schema:
    CREATE TABLE notes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title TEXT NOT NULL,
        content TEXT,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """
    try:
        response = db.table('notes').select('*').eq('user_id', user_id).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/notes", response_model=NoteResponse)
async def create_note(note: NoteCreate, db: Client = Depends(get_db)):
    """Create a new note"""
    try:
        response = db.table('notes').insert({
            'title': note.title,
            'content': note.content,
            'user_id': note.user_id
        }).execute()
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# Advanced query examples
@router.get("/notes/search")
async def search_notes(
    query: str,
    user_id: Optional[str] = None,
    limit: int = 10,
    db: Client = Depends(get_db)
):
    """
    Search notes with full-text search
    Advanced filtering example
    """
    try:
        # Start building query
        query_builder = db.table('notes').select('*')
        
        # Add text search (requires full-text search setup in Supabase)
        if query:
            query_builder = query_builder.text_search('content', query)
        
        # Filter by user if provided
        if user_id:
            query_builder = query_builder.eq('user_id', user_id)
        
        # Limit results
        query_builder = query_builder.limit(limit)
        
        # Order by created_at descending
        query_builder = query_builder.order('created_at', desc=True)
        
        response = query_builder.execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# Example with RPC (Remote Procedure Call)
@router.post("/notes/bulk-create")
async def bulk_create_notes(notes: List[NoteCreate], db: Client = Depends(get_db)):
    """
    Bulk insert notes using Supabase RPC
    
    Example RPC function in Supabase:
    CREATE OR REPLACE FUNCTION bulk_insert_notes(notes_data JSONB)
    RETURNS SETOF notes AS $$
    BEGIN
        RETURN QUERY
        INSERT INTO notes (title, content, user_id)
        SELECT 
            (value->>'title')::TEXT,
            (value->>'content')::TEXT,
            (value->>'user_id')::UUID
        FROM jsonb_array_elements(notes_data)
        RETURNING *;
    END;
    $$ LANGUAGE plpgsql;
    """
    try:
        notes_data = [note.dict() for note in notes]
        response = db.rpc('bulk_insert_notes', {'notes_data': notes_data}).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
