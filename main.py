"""
* Sloppy CLI interface for testing of the analysis 
* process and further development, sample testing etc.
"""

import argparse, os, uuid

from datetime import datetime
from pathlib import Path

from api.bootstrap import create_default_admin
from api.database import main    as sqlite
from api.database import queries as sqlite_queries
from src.analysis import run_analysis_for_sample, update_file_with_result
from src.model_settings import seed_allowed_models
from src.pi_settings import initialize_settings_from_env



def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument( "--sample",           default = "./sample.exe" )
    parser.add_argument( "--database",         default = os.getenv( "DATABASE_PATH", "./data/database.db" ) )
    parser.add_argument( "--admin-creds-file", default = os.getenv( "ADMIN_CREDS_FILE", "./data/admin_credentials.txt" ) )

    return parser.parse_args()


def initialize( database_path : str, admin_creds_file : str ) -> None:
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
    Path( admin_creds_file ).parent.mkdir( parents = True, exist_ok = True )
    create_default_admin( admin_creds_file )


#
#   Main analysis flow
#
def run_sample( sample_path : str ) -> None:
    """
    Run analysis flow for the requested sample outside of docker.

    Args:
        sample_path (str) : Path to local sample.
    """
    
    # Run analysis for the sample.
    sample = Path( sample_path )
    result = run_analysis_for_sample( sample )

    # Check admin ID
    rows = sqlite.query_database(
        sqlite_queries.Users.get_user_by_username,
        ( "admin", ),
    )
    
    admin_id     = rows[ 0 ][ 0 ]
    admin_exists = sqlite.query_database(
        sqlite_queries.Files.get_owned_file_by_sha256,
        ( admin_id, result.get( "sha256" ) ),
    )

    # File exists, we'll just update its existing data.
    if admin_exists:
        sqlite.update_data(
            sqlite_queries.Files.update_file_filename_by_id,
            ( sample.name, admin_exists[ 0 ][ 0 ] ),
        )
        sqlite.update_data(
            sqlite_queries.Files.update_file_analysis_result_by_id,
            update_file_with_result( admin_exists[ 0 ][ 0 ], result )
        )
        return

    # No file found, create new rows.
    sqlite.insert_data(
        sqlite_queries.Files.insert_completed_file,
        (
            str( uuid.uuid4() ),
            result.get( "filename" ),
            result.get( "md5" ),
            result.get( "sha256" ),
            result.get( "size" ),
            datetime.now().isoformat(),
            result.get( "analysis" ),
            "done",
            result.get( "token_count", 0 ),
            result.get( "analysis_cost", 0 ),
            admin_id,
            0,
            None,
            result.get( "analysis_json" ),
            result.get( "analysis_context_rot", 0 ),
            result.get( "risk_score" ),
            result.get( "analysis_tool_log" ),
            result.get( "analysis_token_count", 0 ),
            result.get( "summary_token_count", 0 ),
            result.get( "final_conversation_token_count" ),
            result.get( "analysis_cost_complete", 1 ),
        )
    )


#
#   Entrypoint
#
def main():
    args = parse_args()
    initialize( args.database, args.admin_creds_file )
    run_sample( args.sample )


if __name__ == "__main__":
    main()
