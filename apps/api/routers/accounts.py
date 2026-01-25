"""
Accounts router for user account management
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from utils.supabase_client import get_supabase
from supabase import Client
from db.services import AccountService
from db.models import Account, AccountCreate

router = APIRouter()


def get_account_service(db: Client = Depends(get_supabase)) -> AccountService:
    return AccountService(db)


@router.post("", response_model=Account)
async def create_account(
    account: AccountCreate,
    account_service: AccountService = Depends(get_account_service)
):
    """
    Create a new account
    """
    try:
        # Check if account with email already exists
        existing = account_service.get_by_email(account.email)
        if existing:
            raise HTTPException(status_code=400, detail="Account with this email already exists")
        
        return account_service.create(account)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating account: {str(e)}")


@router.get("/{account_id}", response_model=Account)
async def get_account(
    account_id: str,
    account_service: AccountService = Depends(get_account_service)
):
    """
    Get account by ID
    """
    account = account_service.get_by_id(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.get("/email/{email}", response_model=Account)
async def get_account_by_email(
    email: str,
    account_service: AccountService = Depends(get_account_service)
):
    """
    Get account by email
    """
    account = account_service.get_by_email(email)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.put("/{account_id}", response_model=Account)
async def update_account(
    account_id: str,
    account: AccountCreate,
    account_service: AccountService = Depends(get_account_service)
):
    """
    Update account information
    """
    try:
        # Check if account exists
        existing = account_service.get_by_id(account_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Account not found")
        
        return account_service.update(account_id, account.dict())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating account: {str(e)}")


@router.delete("/{account_id}")
async def delete_account(
    account_id: str,
    account_service: AccountService = Depends(get_account_service)
):
    """
    Delete an account
    """
    success = account_service.delete(account_id)
    if not success:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"message": "Account deleted successfully"}
