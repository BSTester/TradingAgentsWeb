#!/usr/bin/env python3
"""
Migration script to add stock names to existing snapshot positions data.

This script:
1. Reads all AccountSnapshot records with positions_data
2. For each position without stock_name, fetches it from Futu API
3. Updates the positions_data JSON with stock names
"""

import sys
import os
import asyncio
import logging
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from web.backend.database import AsyncSessionLocal
from web.backend.models import AccountSnapshot
from sqlalchemy import select

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def get_stock_name_from_api(stock_code: str, market_type: str, user_id: int) -> str:
    """
    Get stock name from Futu API
    
    Args:
        stock_code: Stock code
        market_type: Market type (US/HK/CN)
        user_id: User ID for API configuration
        
    Returns:
        Stock name or empty string if not found
    """
    try:
        from web.backend.services.futu_async_wrapper import get_quote_async
        
        quote = await get_quote_async(stock_code, user_id=user_id)
        if quote and 'stock_name' in quote:
            return quote['stock_name']
    except Exception as e:
        logger.warning(f"Failed to get stock name for {stock_code}: {e}")
    
    return ''


async def migrate_snapshot_stock_names():
    """
    Migrate existing snapshots to include stock names in positions_data
    """
    logger.info("Starting migration to add stock names to snapshot positions...")
    
    async with AsyncSessionLocal() as db:
        # Get all snapshots with positions_data
        result = await db.execute(
            select(AccountSnapshot).where(AccountSnapshot.positions_data.isnot(None))
        )
        snapshots = result.scalars().all()
        
        logger.info(f"Found {len(snapshots)} snapshots with positions data")
        
        updated_count = 0
        skipped_count = 0
        error_count = 0
        
        for snapshot in snapshots:
            try:
                positions_data = snapshot.positions_data
                if not positions_data or not isinstance(positions_data, list):
                    skipped_count += 1
                    continue
                
                needs_update = False
                
                # Check each position for missing stock_name
                for pos in positions_data:
                    if not pos.get('stock_name'):
                        stock_code = pos.get('stock_code', '')
                        if stock_code:
                            # Fetch stock name from API
                            stock_name = await get_stock_name_from_api(
                                stock_code,
                                snapshot.market_type,
                                snapshot.user_id
                            )
                            
                            if stock_name:
                                pos['stock_name'] = stock_name
                                needs_update = True
                                logger.info(
                                    f"Added stock name '{stock_name}' for {stock_code} "
                                    f"in snapshot {snapshot.id}"
                                )
                            else:
                                logger.warning(
                                    f"Could not fetch stock name for {stock_code} "
                                    f"in snapshot {snapshot.id}"
                                )
                
                # Update snapshot if any position was modified
                if needs_update:
                    snapshot.positions_data = positions_data
                    await db.commit()
                    updated_count += 1
                else:
                    skipped_count += 1
                
            except Exception as e:
                error_count += 1
                logger.error(f"Error processing snapshot {snapshot.id}: {e}")
                await db.rollback()
                continue
        
        logger.info(
            f"\n✅ Migration completed:\n"
            f"  - Updated: {updated_count} snapshots\n"
            f"  - Skipped: {skipped_count} snapshots (already have stock names or no positions)\n"
            f"  - Errors: {error_count} snapshots"
        )


if __name__ == "__main__":
    asyncio.run(migrate_snapshot_stock_names())
