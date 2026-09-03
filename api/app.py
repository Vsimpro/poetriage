#slop
"""
Poetriage Flask API.
"""
import os
import secrets

from datetime import timedelta

from flask import Flask, jsonify
from flask_cors import CORS

from api.database import main as sqlite
from api.database import queries as sqlite_queries

from api.bootstrap import create_default_admin

from api.endpoints.admin import ADMIN_BP
from api.endpoints.analyze import ANALYZE_BP
from api.endpoints.auth import AUTH_BP
from api.endpoints.files import FILES_BP
from api.endpoints.main import MAIN_BP
from api.endpoints.models import MODELS_BP

from src.pi_settings import initialize_settings_from_env
from src.model_settings import seed_allowed_models


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR     = os.path.join(PROJECT_ROOT, "data")

DEFAULT_DATABASE_PATH = os.path.join(DATA_DIR, "database.db")
DEFAULT_UPLOAD_DIR    = os.path.join(DATA_DIR, "uploads")
DEFAULT_MAX_UPLOAD_MB = 200
DEFAULT_PORT          = 5000

SECRET_KEY_FILE  = os.environ.get("SECRET_KEY_FILE", os.path.join(DATA_DIR, ".secret_key"))
ADMIN_CREDS_FILE = os.environ.get("ADMIN_CREDS_FILE", os.path.join(DATA_DIR, "admin_credentials.txt"))

DATABASE_TABLES = {
    "Users"        : sqlite_queries.Users.create_users_table,
    "Files"        : sqlite_queries.Files.create_files_table,
    "AnalysisJobs" : sqlite_queries.AnalysisJobs.create_analysis_jobs_table,
    "AppSettings"  : sqlite_queries.AppSettings.create_app_settings_table,
    "AllowedModels" : sqlite_queries.AllowedModels.create_allowed_models_table,
}

DATABASE_COLUMNS = {
    "Users" : (
        ("remember_token_hash", "TEXT"),
        ("remember_token_expires_at", "TIMESTAMP"),
    ),
    "Files" : (
        ("analysis_json", "TEXT"),
        ("analysis_context_rot", "INTEGER DEFAULT 0"),
        ("risk_score", "INTEGER"),
        ("analysis_tool_log", "TEXT"),
        ("analysis_token_count", "INTEGER DEFAULT 0"),
        ("summary_token_count", "INTEGER DEFAULT 0"),
        ("final_conversation_token_count", "INTEGER"),
        ("analysis_cost_complete", "INTEGER DEFAULT 1"),
    ),
    "AnalysisJobs" : (
        ("model", "TEXT"),
    ),
}

BLUEPRINTS = (
    MAIN_BP,
    AUTH_BP,
    ADMIN_BP,
    FILES_BP,
    ANALYZE_BP,
    MODELS_BP,
)


def _make_shared_path( path : str, mode : int ) -> None:
    try:
        os.chmod( path, mode )
    except OSError as error:
        raise RuntimeError( f"Poetriage data path is not writable by this runtime: {path}" ) from error


def _ensure_shared_dir( path : str ) -> None:
    os.makedirs( path, exist_ok = True )
    _make_shared_path( path, 0o777 )


def _load_or_create_secret_key() -> str:
    """Load the configured secret key, or create one for future restarts."""
    env_key = os.environ.get("SECRET_KEY")

    if env_key:
        return env_key

    if os.path.exists(SECRET_KEY_FILE):
        with open(SECRET_KEY_FILE, "rb") as file:
            value = file.read().decode("utf-8")

        _make_shared_path( SECRET_KEY_FILE, 0o666 )
        return value

    key = secrets.token_urlsafe(32)

    _ensure_shared_dir(os.path.dirname(SECRET_KEY_FILE) or ".")

    with open(SECRET_KEY_FILE, "wb") as file:
        file.write(key.encode("utf-8"))

    _make_shared_path( SECRET_KEY_FILE, 0o666 )

    return key


def _initialize_database(database_path : str) -> None:
    """Initialize the database and apply the current schema additions."""
    sqlite.initialize_db(database_path)
    sqlite.create_tables(DATABASE_TABLES)

    for table_name, columns in DATABASE_COLUMNS.items():
        for column_name, column_definition in columns:
            sqlite.ensure_column(table_name, column_name, column_definition)

    sqlite.execute_statement(sqlite_queries.Files.backfill_component_token_counts)
    initialize_settings_from_env()
    seed_allowed_models()


def _recover_stuck_analyses() -> None:
    """Mark analyses interrupted by a previous shutdown as errors."""
    rows = sqlite.query_database(sqlite_queries.Files.get_stuck_analyses)

    if not rows:
        print("[APP][+] No stuck analyses to recover.")
        return

    for row in rows:
        file_id  = row[0]
        filename = row[1]
        message  = "Recovered from interrupted run."

        sqlite.update_data(
            sqlite_queries.Files.update_file_analysis_by_id,
            (message, file_id),
        )
        sqlite.update_data(
            sqlite_queries.Files.update_file_status_by_id,
            ("error", file_id),
        )

        print(f"[APP][+] Reset stuck analysis: {filename} ({file_id})")


def _file_too_large(_error):
    return jsonify({
        "status" : "error",
        "error"  : "File too large",
    }), 413


def create_app() -> Flask:
    """Create and initialize the Flask application."""
    app           = Flask(__name__)
    database_path = os.environ.get("DATABASE_PATH", DEFAULT_DATABASE_PATH)
    upload_dir    = os.environ.get("UPLOAD_DIR", DEFAULT_UPLOAD_DIR)
    max_upload_mb = int(os.environ.get("MAX_UPLOAD_MB", DEFAULT_MAX_UPLOAD_MB))

    _ensure_shared_dir(DATA_DIR)
    _ensure_shared_dir(upload_dir)

    app.config.update({
        "SECRET_KEY"                 : _load_or_create_secret_key(),
        "UPLOAD_DIR"                 : upload_dir,
        "PERMANENT_SESSION_LIFETIME" : timedelta(days = 3650),
        "MAX_CONTENT_LENGTH"         : max_upload_mb * 1024 * 1024,
    })

    _initialize_database(database_path)

    _recover_stuck_analyses()
    create_default_admin( ADMIN_CREDS_FILE )

    CORS(
        app,
        resources = {r"/*" : {"origins" : "*"}},
        supports_credentials = True,
    )

    app.register_error_handler(413, _file_too_large)

    for blueprint in BLUEPRINTS:
        app.register_blueprint(blueprint)

    return app


app = create_app()


def main() -> None:
    port = int(os.environ.get("PORT", DEFAULT_PORT))
    host = os.environ.get("HOST", "0.0.0.0")

    app.run(host = host, port = port, debug = False, threaded = True)


if __name__ == "__main__":
    main()
