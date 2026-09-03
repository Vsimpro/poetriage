import argparse, os, sys, time, traceback, uuid

from datetime import datetime
from pathlib import Path

ROOT = Path( __file__ ).resolve().parent
sys.path.insert( 0, str( ROOT ) )

from api.database import main    as sqlite
from api.database import queries as sqlite_queries

from src.analysis import *
from src.model_settings import seed_allowed_models
from src.pi_settings import initialize_settings_from_env


#
#   Helpers
#
def _extension_for( filename : str ) -> str:
    """
    Extracts the file extension from name (i.e. exe from example.exe )

    Args:
        filename (str) : Original uploaded filename.

    Returns:
        str : File extension without dot, or bin when missing.
    """
    
    _, ext = os.path.splitext( filename or "" )
    return ext.lstrip( "." ) or "bin"


def _disk_path( upload_dir : str, file_row ) -> str:
    """
    Resolve the uploaded sample path for the 'Files' row.

    Args:
        upload_dir (str) : Directory where uploaded samples are stored.
        file_row         : Files row returned from the database.

    Returns:
        str : Expected local path to the uploaded sample.
    """
    
    ext = _extension_for( file_row[ 1 ] )
    return os.path.join( upload_dir, f"{file_row[ 0 ]}.{ext}" )


#
#   Implementation
#
def initialize( database_path : str ):
    """
    Initializes the database and ensures worker tables exist.

    Args:
        database_path (str) : Path to the shared SQLite db.
    """
    
    sqlite.initialize_db( database_path )
    sqlite.create_tables({
        "Users"        : sqlite_queries.Users.create_users_table,
        "Files"        : sqlite_queries.Files.create_files_table,
        "AnalysisJobs" : sqlite_queries.AnalysisJobs.create_analysis_jobs_table,
        "AppSettings"  : sqlite_queries.AppSettings.create_app_settings_table,
        "AllowedModels" : sqlite_queries.AllowedModels.create_allowed_models_table,
    })
    sqlite.ensure_column( "AnalysisJobs", "model", "TEXT" )
     
    initialize_settings_from_env()
    seed_allowed_models()


def claim_job( worker_id : str ):
    """
    Claims the oldest analysis from the job queue,
    and assigns it for this worker.

    Args:
        worker_id (str) : Unique worker identifier.

    Returns:
        tuple | None : Claimed AnalysisJobs row, or None when queue is empty.
    """
    
    now = datetime.now().isoformat()

    sqlite.update_data(
        sqlite_queries.AnalysisJobs.claim_oldest_queued_job,
        ( worker_id, now ),
    )

    rows = sqlite.query_database(
        sqlite_queries.AnalysisJobs.get_running_job_by_worker_id,
        ( worker_id, ),
    )

    return rows[ 0 ] if rows else None


def mark_job_done( job_id : str, status : str, error : str | None = None ):
    """
    Mark an analysis job complete.

    Args:
        job_id (str)        : AnalysisJobs.id value to update.
        status (str)        : Final job status.
        error  (str | None) : Error details for failed jobs.

    """
    
    sqlite.update_data(
        sqlite_queries.AnalysisJobs.finish_job_by_id,
        ( status, error, datetime.now().isoformat(), job_id ),
    )


def mark_file_failure( file_id : str, message : str, details : str ):
    """
    Store an analysis failure on a Files row.

    Args:
        file_id (str)  : Files.id value to update.
        message (str)  : Short user-facing failure message.
        details (str)  : Detailed error log for analysis_tool_log.
    """
    
    sqlite.update_data(
        sqlite_queries.Files.update_file_analysis_result_by_id,
        (
            message,
            "error",
            0,
            0,
            0,
            None,
            0,
            1,
            None,
            1,
            None,
            details,
            file_id,
        )
    )


def begin_analysis( job, upload_dir : str ):
    """
    Run the claimed analysis and store its result.

    Args:
        job              : Claimed AnalysisJobs row.
        upload_dir (str) : Directory where uploaded samples are stored.
    """
    
    # Get the file associated with the analysis
    job_id = job[ 0 ]
    model  = job[ 8 ] if len( job ) > 8 else None
    rows   = sqlite.query_database(
        sqlite_queries.AnalysisJobs.get_job_file_by_id,
        ( job_id, ),
    )

    # File doesn't exist?
    if not rows:
        mark_job_done( job_id, "error", "File row was not found." )
        return

    file_row    = rows[ 0 ]
    file_id     = file_row[ 0 ]
    sample_path = _disk_path( upload_dir, file_row )
    
    # No file found -- mark as failure.
    if not os.path.exists( sample_path ):
        message = "Analysis failed: uploaded sample was not found."
        mark_file_failure( file_id, message, sample_path )
        mark_job_done( job_id, "error", message )
        return

    # Try running the analysis workflow.
    try:
        print( f"[WORKER][+] Analyzing {file_row[ 1 ]} ({file_row[ 3 ]})" )
        sqlite.update_data(
            sqlite_queries.Files.update_file_status_by_id,
            ( "analyzing", file_id ),
        )
        
        # Run and update database with the result
        result = run_analysis_for_sample( sample_path, model = model )
        sqlite.update_data(
            sqlite_queries.Files.update_file_analysis_result_by_id,
            update_file_with_result( file_id, result ),
        )
        
        # Remove job from the queue.
        mark_job_done( job_id, "done" )
        print( f"[WORKER][+] Done {file_row[ 1 ]}" )

    except Exception:
        details = traceback.format_exc()
        message = "Analysis failed. See analysis tool log for details."
        print( f"[WORKER][!] Failed {file_row[ 1 ]}\n{details}" )
        
        # Update database regarding the failure.
        mark_file_failure( file_id, message, details )
        mark_job_done( job_id, "error", details )


#
#   The main entrypoint
#
def main():
    """
    Poll the AnalysisJobs queue and process jobs forever.

    Args:
        None

    Returns:
        None
    """
    parser = argparse.ArgumentParser()
    parser.add_argument( "--database", default = os.getenv( "DATABASE_PATH", "./data/database.db" ) )
    parser.add_argument( "--uploads",  default = os.getenv( "UPLOAD_DIR", "./data/uploads" ) )
    parser.add_argument( "--sleep",    default = 2, type = int )
    
    args      = parser.parse_args()
    worker_id = f"worker-{uuid.uuid4()}"

    initialize( args.database )
    print( f"[WORKER][+] Started {worker_id}" )

    while True:
        # Pick up a new job from the queue.
        job = claim_job( worker_id )

        if job:
            begin_analysis( job, args.uploads )
            continue
        
        # No job -> wait.
        time.sleep( args.sleep )
        continue
                
    

if __name__ == "__main__":
    main()
